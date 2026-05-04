// src/app/api/google/connect/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createApiRequestContext,
  jsonError,
  logError,
  logInfo,
  logRequestStart,
  responseHeaders,
} from "@/lib/apiObservability";

export const dynamic = "force-dynamic";

function mustEnv(name: string, fallbackName?: string) {
  const primary = (process.env[name] ?? "").trim();
  if (primary) return primary;

  const fallback = fallbackName ? (process.env[fallbackName] ?? "").trim() : "";
  if (fallback) return fallback;

  throw new Error(
    fallbackName ? `Missing env: ${name} or ${fallbackName}` : `Missing env: ${name}`
  );
}

function getAppUrl(): string {
  const a = (process.env.APP_URL ?? "").trim();
  if (a) return a.replace(/\/+$/, "");
  const b = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (b) return b.replace(/\/+$/, "");
  return "http://localhost:3000";
}

function randomState(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function safeNextPath(input: string | null | undefined): string {
  const v = String(input ?? "").trim();
  if (!v) return "/settings";
  if (!v.startsWith("/")) return "/settings";
  if (v.startsWith("//")) return "/settings";
  return v;
}

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "google.connect" });

  try {
    const clientId = mustEnv("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID");
    const appUrl = getAppUrl();
    const isSecure = appUrl.startsWith("https://");
    const redirectUri = `${appUrl}/api/google/callback`;

    const url = new URL(req.url);
    const next = safeNextPath(url.searchParams.get("next") || "/settings");
    const state = randomState();

    const cookieStore = await cookies();

    cookieStore.set("sp_google_oauth_state", state, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    cookieStore.set("sp_google_oauth_next", next, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    const scope = [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("state", state);

    logInfo("google.connect.redirect", {
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      next,
    });

    return NextResponse.redirect(authUrl.toString(), {
      headers: responseHeaders(ctx),
    });
  } catch (error) {
    logError("google.connect.failed", {
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      code: "GOOGLE_CONNECT_FAILED",
      error,
    });

    return jsonError(ctx, {
      error: "Error iniciando conexión Google.",
      code: "GOOGLE_CONNECT_FAILED",
      status: 500,
      level: "error",
      log: { flow: "google.connect", error },
    });
  }
}
