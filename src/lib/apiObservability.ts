// src/lib/apiObservability.ts
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type LogFields = Record<string, unknown>;

export type ApiRequestContext = {
  requestId: string;
  endpoint: string;
  method: string;
  startedAt: string;
  startedAtMs: number;
};

const REDACTED = "[redacted]";
const REQUEST_ID_MAX_LENGTH = 120;

function publicTimestamp() {
  return new Date().toISOString();
}

function isSafeRequestId(value: string) {
  return /^[a-zA-Z0-9._:-]{8,120}$/.test(value);
}

function makeRequestId() {
  return `req_${randomUUID()}`;
}

function getEndpoint(req: Request) {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "unknown";
  }
}

export function getRequestId(req: Request) {
  const incoming = String(req.headers.get("x-request-id") ?? "").trim();

  if (incoming && incoming.length <= REQUEST_ID_MAX_LENGTH && isSafeRequestId(incoming)) {
    return incoming;
  }

  return makeRequestId();
}

export function createApiRequestContext(req: Request): ApiRequestContext {
  return {
    requestId: getRequestId(req),
    endpoint: getEndpoint(req),
    method: req.method || "UNKNOWN",
    startedAt: publicTimestamp(),
    startedAtMs: Date.now(),
  };
}

export function durationMs(ctx: ApiRequestContext) {
  return Math.max(0, Date.now() - ctx.startedAtMs);
}

export function responseHeaders(
  ctx: ApiRequestContext,
  extra?: HeadersInit
): HeadersInit {
  return {
    "Cache-Control": "no-store",
    "x-request-id": ctx.requestId,
    ...(extra ?? {}),
  };
}

function isSensitiveKey(key: string) {
  return /(token|secret|password|authorization|apikey|api_key|key|cookie|refresh|access)/i.test(
    key
  );
}

function safeString(value: string) {
  if (value.length <= 280) return value;
  return `${value.slice(0, 277)}...`;
}

export function maskEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().toLowerCase();
  const at = email.indexOf("@");

  if (at <= 0) return email ? "[masked]" : "";

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const first = local[0] ?? "*";

  return `${first}***@${domain}`;
}

export function safeError(error: unknown): JsonValue {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: safeString(error.message || "Unknown error"),
    };
  }

  if (typeof error === "string") return safeString(error);
  if (typeof error === "number" || typeof error === "boolean" || error === null) return error;

  return "Unknown error";
}

function sanitizeValue(value: unknown, keyHint = "", seen = new WeakSet<object>()): JsonValue {
  if (isSensitiveKey(keyHint)) return REDACTED;

  if (value === null || value === undefined) return null;

  if (typeof value === "string") return safeString(value);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();

  if (value instanceof Error) return safeError(value);
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, keyHint, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    seen.add(value);

    const output: Record<string, JsonValue> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
      output[key] = sanitizeValue(nested, key, seen);
    }

    return output;
  }

  return String(value);
}

export function sanitizeLogFields(fields?: LogFields): Record<string, JsonValue> {
  if (!fields) return {};

  const safe = sanitizeValue(fields);
  return typeof safe === "object" && safe !== null && !Array.isArray(safe)
    ? (safe as Record<string, JsonValue>)
    : { value: safe };
}

function log(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const payload = {
    level,
    event,
    ts: publicTimestamp(),
    ...sanitizeLogFields(fields),
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(event: string, fields?: LogFields) {
  log("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields) {
  log("warn", event, fields);
}

export function logError(event: string, fields?: LogFields) {
  log("error", event, fields);
}

export function logRequestStart(ctx: ApiRequestContext, extra?: LogFields) {
  logInfo("api.request.started", {
    requestId: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    ...extra,
  });
}

export function logRequestSuccess(ctx: ApiRequestContext, extra?: LogFields) {
  logInfo("api.request.succeeded", {
    requestId: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    durationMs: durationMs(ctx),
    ...extra,
  });
}

export function logRequestFailure(
  ctx: ApiRequestContext,
  code: string,
  status: number,
  extra?: LogFields
) {
  logWarn("api.request.failed", {
    requestId: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    code,
    status,
    durationMs: durationMs(ctx),
    ...extra,
  });
}

export function jsonOk(
  ctx: ApiRequestContext,
  payload?: Record<string, unknown>,
  init?: { status?: number; headers?: HeadersInit; event?: string; log?: LogFields }
) {
  const status = init?.status ?? 200;

  logRequestSuccess(ctx, {
    status,
    ...(init?.log ?? {}),
    ...(init?.event ? { eventName: init.event } : {}),
  });

  return NextResponse.json(
    {
      ok: true,
      requestId: ctx.requestId,
      ts: publicTimestamp(),
      ...(payload ?? {}),
    },
    {
      status,
      headers: responseHeaders(ctx, init?.headers),
    }
  );
}

export function jsonError(
  ctx: ApiRequestContext,
  opts: {
    error: string;
    code: string;
    status: number;
    headers?: HeadersInit;
    log?: LogFields;
    level?: "warn" | "error";
    data?: Record<string, unknown>;
  }
) {
  const fields = {
    requestId: ctx.requestId,
    endpoint: ctx.endpoint,
    method: ctx.method,
    code: opts.code,
    status: opts.status,
    durationMs: durationMs(ctx),
    ...(opts.log ?? {}),
  };

  if (opts.level === "error" || opts.status >= 500) {
    logError("api.request.failed", fields);
  } else {
    logWarn("api.request.failed", fields);
  }

  return NextResponse.json(
    {
      ok: false,
      error: opts.error,
      code: opts.code,
      requestId: ctx.requestId,
      ts: publicTimestamp(),
      ...(opts.data ?? {}),
    },
    {
      status: opts.status,
      headers: responseHeaders(ctx, opts.headers),
    }
  );
}
