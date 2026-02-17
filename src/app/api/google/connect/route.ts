// src/app/api/google/connect/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
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
  try {
    const clientId = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
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

    return NextResponse.redirect(authUrl.toString());
  } catch (e: any) {
    console.error("[/api/google/connect] error", e);
    return NextResponse.json(
      { ok: false, error: e?.message || "Error iniciando conexión Google." },
      { status: 500 }
    );
  }
}