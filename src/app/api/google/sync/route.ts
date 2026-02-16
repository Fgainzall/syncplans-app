// src/app/api/google/sync/route.ts
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

function mustEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeIso(d: any): string | null {
  try {
    const t = new Date(d).toISOString();
    return t;
  } catch {
    return null;
  }
}

function toTimeMinMax() {
  // Traemos un rango razonable para calendario:
  // desde 30 días atrás hasta 120 días adelante
  const now = new Date();
  const min = new Date(now);
  min.setDate(min.getDate() - 30);
  const max = new Date(now);
  max.setDate(max.getDate() + 120);
  return { timeMin: min.toISOString(), timeMax: max.toISOString() };
}

async function refreshGoogleAccessToken(input: {
  refresh_token: string;
}) {
  // Necesitas setear estas env vars en Vercel:
  // GOOGLE_OAUTH_CLIENT_ID
  // GOOGLE_OAUTH_CLIENT_SECRET
  const client_id = mustEnv("GOOGLE_OAUTH_CLIENT_ID");
  const client_secret = mustEnv("GOOGLE_OAUTH_CLIENT_SECRET");

  const body = new URLSearchParams();
  body.set("client_id", client_id);
  body.set("client_secret", client_secret);
  body.set("refresh_token", input.refresh_token);
  body.set("grant_type", "refresh_token");

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await r.json();

  if (!r.ok) {
    return { ok: false as const, status: r.status, json };
  }

  const access_token = String(json.access_token || "");
  const expires_in = Number(json.expires_in || 0); // segundos

  if (!access_token || !expires_in) {
    return { ok: false as const, status: 500, json };
  }

  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  return { ok: true as const, access_token, expires_at };
}

export async function POST() {
  const cookieStore = await cookies();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

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

  // 1) Auth
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 });
  }

  // 2) Leer google_accounts
  const { data: ga, error: gaErr } = await supabase
    .from("google_accounts")
    .select("access_token, refresh_token, expires_at, email, scope, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (gaErr || !ga) {
    return NextResponse.json(
      { ok: false, error: "No hay Google conectado (google_accounts no encontrado)." },
      { status: 400 }
    );
  }

  let accessToken = (ga as any).access_token as string | null;
  const refreshToken = (ga as any).refresh_token as string | null;
  const expiresAtRaw = (ga as any).expires_at as string | null;

  // 3) Si expiró, refrescar
  const nowMs = Date.now();
  const expiresMs = expiresAtRaw ? new Date(expiresAtRaw).getTime() : 0;

  // margen de 60s para no llegar justo al límite
  const expired = !accessToken || !expiresMs || expiresMs < nowMs + 60_000;

  if (expired) {
    if (!refreshToken) {
      return NextResponse.json(
        { ok: false, error: "Tu token Google expiró y no hay refresh_token. Reconecta Google." },
        { status: 400 }
      );
    }

    const refreshed = await refreshGoogleAccessToken({ refresh_token: refreshToken });
    if (!refreshed.ok) {
      return NextResponse.json(
        { ok: false, error: "No se pudo refrescar token Google", details: refreshed },
        { status: 502 }
      );
    }

    accessToken = refreshed.access_token;

    // Guardar nuevo access_token + expires_at
    await supabase
      .from("google_accounts")
      .update({
        access_token: refreshed.access_token,
        expires_at: refreshed.expires_at,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  // 4) Fetch eventos Google
  const { timeMin, timeMax } = toTimeMinMax();

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=250`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  const json = await r.json();
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, status: r.status, google: json },
      { status: 502 }
    );
  }

  const items: any[] = Array.isArray(json.items) ? json.items : [];

  // 5) Transform + UPSERT a events
  //    - Solo importamos eventos con start/end reales
  //    - All-day: Google manda { start: { date: "YYYY-MM-DD" } }
  //      Lo convertimos a 00:00→23:59:59.999
  const rowsToUpsert = items
    .map((it) => {
      const external_id = String(it.id || "").trim();
      if (!external_id) return null;

      const summary = String(it.summary || "Evento (Google)");
      const updated = safeIso(it.updated);

      const startObj = it.start || {};
      const endObj = it.end || {};

      let startIso: string | null = null;
      let endIso: string | null = null;

      if (startObj.dateTime && endObj.dateTime) {
        startIso = safeIso(startObj.dateTime);
        endIso = safeIso(endObj.dateTime);
      } else if (startObj.date && endObj.date) {
        // All-day event: end.date en Google es exclusivo (día siguiente)
        const s = new Date(String(startObj.date) + "T00:00:00.000Z");
        const eExclusive = new Date(String(endObj.date) + "T00:00:00.000Z");
        // lo convertimos a fin del día previo
        const e = new Date(eExclusive.getTime() - 1);
        startIso = s.toISOString();
        endIso = e.toISOString();
      }

      if (!startIso || !endIso) return null;

      return {
        user_id: user.id,
        group_id: null,
        title: summary,
        notes: it.description ? String(it.description) : null,

        start: startIso,
        end: endIso,

        external_source: "google",
        external_id,
        external_updated_at: updated,
      };
    })
    .filter(Boolean) as any[];

  if (rowsToUpsert.length === 0) {
    return NextResponse.json({ ok: true, imported: 0, message: "No hay eventos para importar." });
  }

  const { error: upErr } = await supabase
    .from("events")
    .upsert(rowsToUpsert, { onConflict: "user_id,external_source,external_id" });

  if (upErr) {
    return NextResponse.json(
      { ok: false, error: "No se pudo upsertear en events", details: upErr },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    imported: rowsToUpsert.length,
    range: { timeMin, timeMax },
  });
}