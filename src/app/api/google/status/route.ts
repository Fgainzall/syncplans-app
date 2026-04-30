import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type ConnectionState = "connected" | "needs_reauth" | "disconnected";

type GoogleAccountStatusRow = {
  provider?: string | null;
  email?: string | null;
  refresh_token?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};
function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          error: "Faltan env vars de Supabase (URL/ANON).",
        },
        { status: 500 }
      );
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
    const userId = userData?.user?.id;

    if (!userId) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          error: "No autenticado.",
        },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("google_accounts")
      .select("provider,email,created_at,updated_at,expires_at,refresh_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        ok: true,
        connected: false,
        connection_state: "disconnected" satisfies ConnectionState,
        account: null,
      });
    }

    const account = data as GoogleAccountStatusRow | null;

const refreshToken = account?.refresh_token ?? null;

    // El access_token de Google expira normalmente. Eso NO significa que el usuario
    // deba reconectar si todavía tenemos refresh_token. La sincronización se encarga
    // de refrescar el access_token cuando haga falta.
    const connectionState: ConnectionState = refreshToken
      ? "connected"
      : "needs_reauth";

    return NextResponse.json({
      ok: true,
      connected: connectionState === "connected",
      connection_state: connectionState,
    account: {
  provider: account?.provider ?? "google",
  email: account?.email ?? null,
  created_at: account?.created_at ?? null,
  updated_at: account?.updated_at ?? null,
},
    });
 } catch (e: unknown) {
    console.error("[/api/google/status] error", e);

    return NextResponse.json(
      {
        ok: false,
        connected: false,
        connection_state: "disconnected",
      message: getErrorMessage(e, "Error revisando conexión con Google"),
      },
      { status: 500 }
    );
  }
}