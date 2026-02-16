import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/summary";

  if (!code) {
    return NextResponse.redirect(new URL("/auth/login", url.origin));
  }

  // ✅ CLAVE: en tu Next, cookies() es async
  const cookieStore = await cookies();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnon) {
    console.error("Missing env vars:", {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnon,
    });
    return NextResponse.redirect(new URL("/auth/login", url.origin));
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

  // 1) Exchange code -> session (cookie)
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code
  );

  if (exchangeError) {
    console.error("Exchange error:", exchangeError.message);
    return NextResponse.redirect(new URL("/auth/login", url.origin));
  }

  // 2) Leer user + session (ya autenticado por cookies SSR)
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    console.error("getUser error:", userErr?.message);
    return NextResponse.redirect(new URL("/auth/login", url.origin));
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  // 3) Guardar tokens si vienen (Google OAuth)
  try {
    const accessToken = (session as any)?.provider_token as string | undefined;
    const refreshToken = (session as any)?.provider_refresh_token as
      | string
      | undefined;

    // Si no hay provider_token, no pasa nada (login con email/password)
    if (accessToken) {
      // expiry aproximado: 55 min
      const approxExpiresAt = new Date(
        Date.now() + 55 * 60 * 1000
      ).toISOString();

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

      if (upsertErr) {
        console.error("google_accounts upsert error:", upsertErr.message);
        // No bloqueamos el login por esto; solo logueamos.
      }
    }
  } catch (e: any) {
    console.error("Saving google tokens failed:", e?.message ?? e);
  }

  // ✅ Redirigir SOLO después de exchange
  return NextResponse.redirect(new URL(next, url.origin));
}