// src/lib/apiSecurity.ts
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient, type User } from "@supabase/supabase-js";
import { jsonError, type ApiRequestContext } from "@/lib/apiObservability";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type SupabaseCookieOptions = {
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

type RateLimitMode = "redis" | "memory";

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
  mode: RateLimitMode;
};

type LocalRateLimitBucket = {
  count: number;
  resetAt: number;
};

const localRateLimitStore = new Map<string, LocalRateLimitBucket>();
const MAX_LOCAL_RATE_LIMIT_KEYS = 5_000;

function trimEnv(name: string) {
  return String(process.env[name] ?? "").trim();
}

export function requiredServerEnv(name: string) {
  const value = trimEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabasePublicEnv() {
  return {
    url: requiredServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requiredServerEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function noStoreHeaders(extra?: HeadersInit): HeadersInit {
  return {
    "Cache-Control": "no-store",
    ...(extra ?? {}),
  };
}

export function jsonNoStore(
  payload: JsonValue,
  init?: { status?: number; headers?: HeadersInit }
) {
  return NextResponse.json(payload, {
    status: init?.status ?? 200,
    headers: noStoreHeaders(init?.headers),
  });
}

export function getClientIp(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

export function getBearerToken(req: Request) {
  const authHeader = String(req.headers.get("authorization") ?? "").trim();
  return authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

export function sha256Key(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim()
  );
}

export async function readJsonBody(req: Request, maxBytes: number) {
  const rawLength = req.headers.get("content-length");
  const contentLength = Number(rawLength);

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  try {
    return (await req.json()) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function pruneLocalRateLimitStore(now: number) {
  if (localRateLimitStore.size <= MAX_LOCAL_RATE_LIMIT_KEYS) return;

  for (const [key, bucket] of localRateLimitStore.entries()) {
    if (bucket.resetAt <= now) localRateLimitStore.delete(key);
  }

  if (localRateLimitStore.size <= MAX_LOCAL_RATE_LIMIT_KEYS) return;

  const keysToDelete = localRateLimitStore.size - MAX_LOCAL_RATE_LIMIT_KEYS;
  let deleted = 0;

  for (const key of localRateLimitStore.keys()) {
    localRateLimitStore.delete(key);
    deleted += 1;
    if (deleted >= keysToDelete) break;
  }
}

function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  pruneLocalRateLimitStore(now);

  const current = localRateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    localRateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });

    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: windowSeconds,
      mode: "memory",
    };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      mode: "memory",
    };
  }

  current.count += 1;
  localRateLimitStore.set(key, current);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    mode: "memory",
  };
}

async function checkRedisRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult | null> {
  const url = trimEnv("UPSTASH_REDIS_REST_URL").replace(/\/$/, "");
  const token = trimEnv("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) return null;

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", key, "0", "EX", String(windowSeconds), "NX"],
      ["INCR", key],
      ["TTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as Array<{ result?: unknown }>;
  const count = Number(payload?.[1]?.result ?? 1);
  const ttlRaw = Number(payload?.[2]?.result ?? windowSeconds);
  const ttl = Number.isFinite(ttlRaw) && ttlRaw > 0 ? ttlRaw : windowSeconds;

  if (!Number.isFinite(count)) return null;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil(ttl)),
    mode: "redis",
  };
}

export async function checkRateLimit(opts: {
  prefix: string;
  keyParts: Array<string | number | null | undefined>;
  limit: number;
  windowSeconds: number;
}) {
  const rawKey = opts.keyParts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(":");

  const key = `syncplans:rl:${opts.prefix}:${sha256Key(rawKey || "anonymous")}`;

  try {
    const redis = await checkRedisRateLimit(key, opts.limit, opts.windowSeconds);
    if (redis) return redis;
  } catch (error) {
    console.warn("[apiSecurity] Redis rate limit unavailable; using memory fallback", error);
  }

  return checkMemoryRateLimit(key, opts.limit, opts.windowSeconds);
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Mode": result.mode,
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export async function createSupabaseUserClient(req: Request) {
  const { url, anonKey } = getSupabasePublicEnv();
  const bearerToken = getBearerToken(req);

  if (bearerToken) {
    return createClient(url, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearerToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Route handlers normally can set cookies. Server components may be read-only.
        }
      },
      remove(name: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // no-op
        }
      },
    },
  });
}

export async function getAuthenticatedUser(
  req: Request,
  ctx?: ApiRequestContext
): Promise<
  | { ok: true; user: User }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createSupabaseUserClient(req);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      ok: false,
      response: ctx
        ? jsonError(ctx, {
            error: "Sesión inválida o expirada.",
            code: "AUTH_REQUIRED",
            status: 401,
          })
        : jsonNoStore(
            {
              ok: false,
              error: "Sesión inválida o expirada.",
              code: "AUTH_REQUIRED",
            },
            { status: 401 }
          ),
    };
  }

  return { ok: true, user };
}
