// src/app/api/google/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
    const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Faltan env vars de Supabase (URL/ANON)." },
        { status: 500 }
      );
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, connected: false, error: "No autorizado (token faltante)." },
        { status: 401 }
      );
    }

    // ✅ IMPORTANTE:
    // Creamos el cliente CON el JWT del usuario para que RLS permita leer su fila.
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

    // Validamos token + obtenemos user (esto ya corre autenticado)
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userErr || !userId) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Token inválido o sesión expirada." },
        { status: 401 }
      );
    }

    // ⚠️ Seleccionamos SOLO campos seguros (no tokens)
    const { data, error } = await supabase
      .from("google_accounts")
      .select("provider,email,created_at,updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, connected: false, error: error.message },
        { status: 500 }
      );
    }

    const connected = !!data;

    return NextResponse.json({
      ok: true,
      connected,
      account: data
        ? {
            provider: (data as any).provider ?? "google",
            email: (data as any).email ?? null,
            created_at: (data as any).created_at ?? null,
            updated_at: (data as any).updated_at ?? null,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, connected: false, error: e?.message || "Error inesperado." },
      { status: 500 }
    );
  }
}