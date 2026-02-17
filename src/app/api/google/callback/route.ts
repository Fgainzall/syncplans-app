// src/app/api/google/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function getAppUrl() {
  const a = (process.env.APP_URL ?? "").trim();
  if (a) return a.replace(/\/+$/, "");
  const b = (process.env.NEXT_PUBLIC_APP_URL ?? "").trim();
  if (b) return b.replace(/\/+$/, "");
  return "http://localhost:3000";
}

async function exchangeCodeForTokens(input: { code: string; redirect_uri: string }) {
  const client_id = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const client_secret = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);
  body.set("code", input.code);
  body.set("grant_type", "authorization_code");
  body.set("redirect_uri", input.redirect_uri);

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await r.json().catch(() => ({} as any));
  if (!r.ok) return { ok: false as const, status: r.status, json };

  const access_token = String(json.access_token || "");
  const refresh_token = json.refresh_token ? String(json.refresh_token) : null;
  const scope = json.scope ? String(json.scope) : null;
  const expires_in = Number(json.expires_in || 0);

  if (!access_token || !expires_in) return { ok: false as const, status: 500, json };

  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  return { ok: true as const, access_token, refresh_token, scope, expires_at, raw: json };
}

async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await r.json().catch(() => ({} as any));
    if (!r.ok) return null;
    return json.email ? String(json.email) : null;
  } catch {
    return null;
  }
}

function safeNextPath(input: string | null | undefined): string {
  const v = String(input ?? "").trim();
  if (!v) return "/settings";
  // solo permitimos paths internos (evita open-redirect)
  if (!v.startsWith("/")) return "/settings";
  if (v.startsWith("//")) return "/settings";
  return v;
}

export async function GET(req: Request) {
  const appUrl = getAppUrl();
  const isSecure = appUrl.startsWith("https://");

  // default: volvemos a settings si no hay next
  let nextPath = "/settings";

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const oauthError = url.searchParams.get("error");

    const cookieStore = await cookies();

    // ✅ leemos next guardado por /api/google/connect (si existe)
    const nextCookie = cookieStore.get("sp_google_oauth_next")?.value || "";
    nextPath = safeNextPath(nextCookie);

    // limpiamos next cookie siempre
    cookieStore.set("sp_google_oauth_next", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    // Si Google devolvió error (usuario canceló, etc.)
    if (oauthError) {
      return NextResponse.redirect(
        `${appUrl}${nextPath}?google=error&reason=${encodeURIComponent(oauthError)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(`${appUrl}${nextPath}?google=error&reason=missing_code`);
    }

    const stateCookie = cookieStore.get("sp_google_oauth_state")?.value || "";

    // limpiamos state cookie siempre
    cookieStore.set("sp_google_oauth_state", "", {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    if (!state || !stateCookie || state !== stateCookie) {
      return NextResponse.redirect(`${appUrl}${nextPath}?google=error&reason=bad_state`);
    }

    // Supabase SSR client
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.redirect(
        `${appUrl}${nextPath}?google=error&reason=missing_supabase_env`
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnon, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    });

    // Usuario logueado
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return NextResponse.redirect(
        `${appUrl}/auth/login?next=${encodeURIComponent(
          `${nextPath}?google=resume`
        )}`
      );
    }

    // Intercambio code -> tokens
    const redirect_uri = `${appUrl}/api/google/callback`;
    const ex = await exchangeCodeForTokens({ code, redirect_uri });
    if (!ex.ok) {
      console.error("[google/callback] exchange failed", ex);
      return NextResponse.redirect(`${appUrl}${nextPath}?google=error&reason=exchange_failed`);
    }

    // Email (para UI)
    const googleEmail = await fetchGoogleEmail(ex.access_token);

    // Si NO viene refresh_token, mantenemos el existente
    const { data: existing } = await supabase
      .from("google_accounts")
      .select("refresh_token,email")
      .eq("user_id", user.id)
      .maybeSingle();

    const refreshToStore =
      ex.refresh_token ||
      ((existing as any)?.refresh_token ? String((existing as any).refresh_token) : null);

    const emailToStore =
      googleEmail || ((existing as any)?.email ? String((existing as any).email) : null);

    const nowIso = new Date().toISOString();

    const payload: any = {
      user_id: user.id,
      provider: "google",
      email: emailToStore,
      access_token: ex.access_token,
      refresh_token: refreshToStore,
      expires_at: ex.expires_at,
      scope: ex.scope,
      updated_at: nowIso,
    };

    const { error: upErr } = await supabase
      .from("google_accounts")
      .upsert(payload, { onConflict: "user_id" });

    if (upErr) {
      console.error("[google/callback] upsert google_accounts failed", upErr);
      return NextResponse.redirect(`${appUrl}${nextPath}?google=error&reason=save_failed`);
    }

    // ✅ éxito
    return NextResponse.redirect(`${appUrl}${nextPath}?google=connected`);
  } catch (e: any) {
    console.error("[google/callback] error", e);
    return NextResponse.redirect(`${appUrl}${nextPath}?google=error&reason=unexpected`);
  }
}