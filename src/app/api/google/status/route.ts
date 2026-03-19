// src/app/api/google/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ConnectionState = "connected" | "needs_reauth" | "disconnected";

export async function GET(req: Request) {
  try {
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

    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          error: "No autorizado (token faltante).",
        },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return NextResponse.json(
        {
          ok: false,
          connected: false,
          connection_state: "disconnected" satisfies ConnectionState,
          error: "Token inválido o sesión expirada.",
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

    const expiresAtRaw = (data as any).expires_at ?? null;
    const refreshToken = (data as any).refresh_token ?? null;

    const expiresMs = expiresAtRaw ? new Date(String(expiresAtRaw)).getTime() : 0;
    const nowMs = Date.now();

    const needsReauth =
      !refreshToken || !expiresMs || Number.isNaN(expiresMs) || expiresMs < nowMs + 60_000;

    const connectionState: ConnectionState = needsReauth
      ? "needs_reauth"
      : "connected";

    return NextResponse.json({
      ok: true,
      connected: connectionState === "connected",
      connection_state: connectionState,
      account: {
        provider: (data as any).provider ?? "google",
        email: (data as any).email ?? null,
        created_at: (data as any).created_at ?? null,
        updated_at: (data as any).updated_at ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        connected: false,
        connection_state: "disconnected",
        error: e?.message || "Error inesperado.",
      },
      { status: 500 }
    );
  }
}