import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function safeRedirectTarget(raw: string | null, origin: string) {
  const fallback = new URL("/auth/update-password", origin);

  if (!raw) return fallback;

  if (raw.startsWith("/")) {
    return new URL(raw, origin);
  }

  try {
    const parsed = new URL(raw);
    if (parsed.origin === origin) return parsed;
    return fallback;
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const redirectRaw =
    url.searchParams.get("redirect_to") ??
    url.searchParams.get("next") ??
    "/auth/update-password";

  const successUrl = safeRedirectTarget(redirectRaw, origin);
  const errorUrl = new URL("/auth/update-password?error=invalid_or_expired_link", origin);

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(errorUrl);
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(successUrl);

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return response;
}