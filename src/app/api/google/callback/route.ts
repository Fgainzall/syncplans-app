// src/app/api/google/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createApiRequestContext,
  logError,
  logInfo,
  logRequestStart,
  maskEmail,
  responseHeaders,
} from "@/lib/apiObservability";

export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  expires_in?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type GoogleUserInfoResponse = {
  email?: unknown;
};

type ExistingGoogleAccountRow = {
  refresh_token?: string | null;
  email?: string | null;
};

type GoogleAccountUpsertPayload = {
  user_id: string;
  provider: "google";
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expires_at: string;
  scope: string | null;
  updated_at: string;
  created_at?: string;
};

function mustEnv(name: string, fallbackName?: string) {
  const primary = (process.env[name] ?? "").trim();
  if (primary) return primary;

  const fallback = fallbackName ? (process.env[fallbackName] ?? "").trim() : "";
  if (fallback) return fallback;

  throw new Error(
    fallbackName ? `Missing env: ${name} or ${fallbackName}` : `Missing env: ${name}`
  );
}

function getAppUrl() {
  const a = (process.env.APP_URL ?? "").trim();
  if (a) return a.replace(/\/+$/, "");
  const b = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (b) return b.replace(/\/+$/, "");
  return "http://localhost:3000";
}

async function exchangeCodeForTokens(input: { code: string; redirect_uri: string }) {
  const client_id = mustEnv("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_CLIENT_ID");
  const client_secret = mustEnv(
    "GOOGLE_OAUTH_CLIENT_SECRET",
    "GOOGLE_CLIENT_SECRET"
  );

  const body = new URLSearchParams();
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);
  body.set("code", input.code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", input.redirect_uri);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      providerError: json.error ? String(json.error) : null,
      providerDescription: json.error_description ? String(json.error_description) : null,
    };
  }

  const access_token = String(json.access_token || "");
  const refresh_token = json.refresh_token ? String(json.refresh_token) : null;
  const scope = json.scope ? String(json.scope) : null;
  const expires_in = Number(json.expires_in || 0);

  if (!access_token || !expires_in) {
    return {
      ok: false as const,
      status: 500,
      providerError: "missing_token_or_expiry",
      providerDescription: null,
    };
  }

  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  return { ok: true as const, access_token, refresh_token, scope, expires_at };
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = (await response.json().catch(() => ({}))) as GoogleUserInfoResponse;
    if (!response.ok) return null;
    return json.email ? String(json.email) : null;
  } catch {
    return null;
  }
}

function safeNextPath(input: string | null | undefined): string {
  const v = String(input ?? "").trim();
  if (!v) return "/settings";
  if (!v.startsWith("/")) return "/settings";
  if (v.startsWith("//")) return "/settings";
  return v;
}

function withQuery(path: string, params: Record<string, string>) {
  const [pathname, query = ""] = path.split("?");
  const qs = new URLSearchParams(query);
  for (const [key, value] of Object.entries(params)) qs.set(key, value);
  return `${pathname}?${qs.toString()}`;
}

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "google.callback" });

  const appUrl = getAppUrl();
  const isSecure = appUrl.startsWith("https://");
  let nextPath = "/settings";

  const redirect = (reason: string, extra?: Record<string, unknown>) => {
    logInfo("google.callback.redirect", {
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      reason,
      ...extra,
    });

    return NextResponse.redirect(
      `${appUrl}${withQuery(nextPath, {
        google: reason === "connected" ? "connected" : "error",
        ...(reason === "connected" ? {} : { reason }),
        requestId: ctx.requestId,
      })}`,
      { headers: responseHeaders(ctx) }
    );
  };

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const oauthError = url.searchParams.get("error");

    const cookieStore = await cookies();
    const nextCookie = cookieStore.get("sp_google_oauth_next")?.value || "";
    nextPath = safeNextPath(nextCookie);

    cookieStore.set("sp_google_oauth_next", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    if (oauthError) {
      return redirect("oauth_error", { providerError: oauthError });
    }

    if (!code) {
      return redirect("missing_code");
    }

    const stateCookie = cookieStore.get("sp_google_oauth_state")?.value || "";

    cookieStore.set("sp_google_oauth_state", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    if (!state || !stateCookie || state !== stateCookie) {
      return redirect("bad_state");
    }

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
    if (!supabaseUrl || !supabaseAnon) {
      return redirect("missing_supabase_env");
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      const loginNext = `${nextPath}?google=resume&requestId=${encodeURIComponent(
        ctx.requestId
      )}`;
      return NextResponse.redirect(
        `${appUrl}/auth/login?next=${encodeURIComponent(loginNext)}`,
        { headers: responseHeaders(ctx) }
      );
    }

    const redirect_uri = `${appUrl}/api/google/callback`;
    const exchanged = await exchangeCodeForTokens({ code, redirect_uri });
    if (!exchanged.ok) {
      return redirect("exchange_failed", {
        userId: user.id,
        providerStatus: exchanged.status,
        providerError: exchanged.providerError,
      });
    }

    const googleEmail = await fetchGoogleEmail(exchanged.access_token);

    const { data: existing } = await supabase
      .from("google_accounts")
      .select("refresh_token,email")
      .eq("user_id", user.id)
      .maybeSingle();

    const existingAccount = existing as ExistingGoogleAccountRow | null;
    const refreshToStore =
      exchanged.refresh_token ||
      (existingAccount?.refresh_token ? String(existingAccount.refresh_token) : null);

    const emailToStore =
      googleEmail || (existingAccount?.email ? String(existingAccount.email) : null);

    const nowIso = new Date().toISOString();

    const payload: GoogleAccountUpsertPayload = {
      user_id: user.id,
      provider: "google",
      email: emailToStore,
      access_token: exchanged.access_token,
      refresh_token: refreshToStore,
      expires_at: exchanged.expires_at,
      scope: exchanged.scope,
      updated_at: nowIso,
    };

    const { error: upErr } = await supabase
      .from("google_accounts")
      .upsert(payload, { onConflict: "user_id" });

    if (upErr) {
      return redirect("save_failed", {
        userId: user.id,
        providerError: upErr.message,
      });
    }

    logInfo("google.callback.connected", {
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      userId: user.id,
      googleEmail: maskEmail(emailToStore),
      hasRefreshToken: Boolean(refreshToStore),
    });

    return redirect("connected", { userId: user.id });
  } catch (error) {
    logError("google.callback.failed", {
      requestId: ctx.requestId,
      endpoint: ctx.endpoint,
      method: ctx.method,
      code: "GOOGLE_CALLBACK_FAILED",
      error,
    });
    return redirect("unexpected");
  }
}
