// src/app/api/integrations/google/list/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function mustEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function refreshGoogleAccessToken(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  refreshToken: string
): Promise<string> {
  const clientId = mustEnv("GOOGLE_CLIENT_ID");
  const clientSecret = mustEnv("GOOGLE_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await resp.json();

  if (!resp.ok || !data.access_token) {
    throw new Error(
      data?.error_description ||
        data?.error ||
        "No se pudo refrescar el token de Google."
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof data.expires_in === "number" ? nowSec + data.expires_in : null;

  // Guardamos el nuevo access_token en Supabase
  await supabase
    .from("google_accounts")
    .update({
      access_token: data.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return data.access_token as string;
}

async function fetchEventsWithToken(accessToken: string) {
  const timeMin = new Date().toISOString();

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&singleEvents=true&orderBy=startTime&maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const json = await r.json();

  return { response: r, json };
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
          error: "Faltan variables de entorno de Supabase (URL/ANON).",
        },
        { status: 500 }
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

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    // ✅ aquí sí podemos leer tokens (es una ruta interna del propio backend)
    const { data: ga, error: gaErr } = await supabase
      .from("google_accounts")
      .select("access_token, refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (gaErr || !ga?.access_token) {
      return NextResponse.json(
        {
          ok: false,
          error: "No hay Google conectado (token no encontrado). Vuelve a conectar tu cuenta desde el Panel.",
        },
        { status: 400 }
      );
    }

    let accessToken = ga.access_token as string;

    // 1️⃣ Intento inicial
    let { response, json } = await fetchEventsWithToken(accessToken);

    // 2️⃣ Si el token está caducado / inválido y tenemos refresh_token, intentamos refrescar una vez
    if (
      (response.status === 401 || response.status === 403) &&
      ga.refresh_token
    ) {
      try {
        const newToken = await refreshGoogleAccessToken(
          supabase,
          user.id,
          ga.refresh_token as string
        );
        accessToken = newToken;

        const retry = await fetchEventsWithToken(accessToken);
        response = retry.response;
        json = retry.json;
      } catch (e: any) {
        return NextResponse.json(
          {
            ok: false,
            error:
              e?.message ||
              "No se pudo refrescar la sesión de Google. Vuelve a conectar tu cuenta desde el Panel.",
          },
          { status: 401 }
        );
      }
    }

    if (!response.ok) {
      const base = json || {};
      const code = (base.error && base.error.status) || response.status;
      const msg =
        base.error?.message ||
        base.error_description ||
        "Error al leer los eventos de Google.";

      return NextResponse.json(
        {
          ok: false,
          status: response.status,
          error: `Google devolvió un error (${code}): ${msg}`,
        },
        { status: 502 }
      );
    }

    const items = Array.isArray(json.items) ? json.items : [];

    return NextResponse.json({
      ok: true,
      items,
    });
  } catch (e: any) {
    console.error("[/api/integrations/google/list] error", e);
    return NextResponse.json(
      {
        ok: false,
        error:
          e?.message ||
          "Error inesperado al leer los eventos de Google.",
      },
      { status: 500 }
    );
  }
}