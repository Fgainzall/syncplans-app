// src/app/api/google/status/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Faltan env vars de Supabase (URL/ANON)." },
        { status: 500 }
      );
    }

    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";

    if (!token) {
      return NextResponse.json(
        { ok: false, connected: false, error: "No autorizado (token faltante)." },
        { status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnon);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user?.id) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Token inválido o sesión expirada." },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

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