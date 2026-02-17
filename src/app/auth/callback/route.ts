// src/app/auth/callback/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const dynamic = "force-dynamic";

function safeNext(nextRaw: string | null) {
  const n = (nextRaw ?? "/summary").trim();
  return n.startsWith("/") ? n : "/summary";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  // ✅ IMPORTANTE:
  // Usamos el ORIGIN REAL del request (ya canónico gracias al middleware).
  // Así la cookie se setea en el mismo host donde luego se va a leer.
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnon) {
    console.error("Missing env vars for Supabase in callback");
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  // ✅ Response final dentro del MISMO origin
  const response = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
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

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("Exchange error:", exchangeError.message);
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  // Confirmar usuario
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    console.error("getUser error:", userErr?.message);
    return NextResponse.redirect(new URL("/auth/login", origin));
  }

  // Guardar tokens (Google OAuth) si vienen
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;

    const accessToken = (session as any)?.provider_token as string | undefined;
    const refreshToken = (session as any)?.provider_refresh_token as string | undefined;

    if (accessToken) {
      const approxExpiresAt = new Date(Date.now() + 55 * 60 * 1000).toISOString();
      const scope = "https://www.googleapis.com/auth/calendar.readonly";

      const { error: upsertErr } = await supabase
        .from("google_accounts")
        .upsert(
          {
            user_id: userData.user.id,
            access_token: accessToken,
            refresh_token: refreshToken ?? null,
            expires_at: approxExpiresAt,
            scope,
            email: userData.user.email ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertErr) console.error("google_accounts upsert error:", upsertErr.message);
    }
  } catch (e: any) {
    console.error("Saving google tokens failed:", e?.message ?? e);
  }

  return response;
}