import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type GoogleAccountRow = {
  user_id: string;
  email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
};
type GoogleCalendarListItem = {
  id: string;
  summary?: string;
  primary?: boolean;
  accessRole?: string;
};

type GoogleEventItem = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  updated?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
};

type GoogleEventsResponse = {
  items?: GoogleEventItem[];
  nextPageToken?: string;
};
type GoogleListResponse = {
  items?: unknown[];
  nextPageToken?: string | null;
};

type GoogleEventUpsertRow = Record<string, unknown>;
function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function toIsoFromGoogleBoundary(
  value?: { dateTime?: string; date?: string } | null,
  fallbackAllDayEnd = false
): string | null {
  if (!value) return null;

  if (value.dateTime) {
    const d = new Date(value.dateTime);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  if (value.date) {
    if (fallbackAllDayEnd) {
      // Google all-day end date is exclusive.
      const d = new Date(`${value.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    const d = new Date(`${value.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  return null;
}

async function refreshGoogleAccessToken(
  refreshToken: string
): Promise<{
  access_token: string;
  expires_in?: number;
}> {
  // En el resto del flujo OAuth del proyecto se usan GOOGLE_OAUTH_CLIENT_ID
  // y GOOGLE_OAUTH_CLIENT_SECRET. Dejamos fallback a los nombres antiguos para
  // no romper ningún entorno local que todavía los tenga configurados.
  const clientId =
    process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Faltan GOOGLE_OAUTH_CLIENT_ID o GOOGLE_OAUTH_CLIENT_SECRET"
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const json = await res.json();

  if (!res.ok || !json?.access_token) {
    throw new Error(
      json?.error_description ||
        json?.error ||
        "No se pudo refrescar el access token de Google"
    );
  }

  return {
    access_token: String(json.access_token),
    expires_in:
      typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

async function googleFetchJson<T>(
  url: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(
      json?.error?.message ||
        json?.error_description ||
        `Google API error ${res.status}`
    );
  }

  return json as T;
}

async function listAllVisibleCalendars(accessToken: string) {
  const out: GoogleCalendarListItem[] = [];
  let pageToken = "";

  while (true) {
    const qs = new URLSearchParams({
      minAccessRole: "reader",
      showHidden: "false",
      maxResults: "250",
    });

    if (pageToken) qs.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/users/me/calendarList?${qs.toString()}`;

    const json = await googleFetchJson<GoogleCalendarListResponse>(
      url,
      accessToken
    );

    const items = Array.isArray(json?.items) ? json.items : [];
    out.push(...items);

const next = (json as GoogleListResponse).nextPageToken;
    if (!next) break;
    pageToken = String(next);
  }

  return out;
}

async function listEventsForCalendar(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
) {
  const out: GoogleEventItem[] = [];
  let pageToken = "";

  while (true) {
    const qs = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "250",
      timeMin,
      timeMax,
    });

    if (pageToken) qs.set("pageToken", pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events?${qs.toString()}`;

    const json = await googleFetchJson<GoogleEventsResponse>(url, accessToken);

    const items = Array.isArray(json?.items) ? json.items : [];
    out.push(...items);

    if (!json?.nextPageToken) break;
    pageToken = String(json.nextPageToken);
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const bearer = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!bearer) {
      return jsonError("Falta bearer token", 401);
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonError("Faltan variables de Supabase en el servidor", 500);
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${bearer}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return jsonError("Sesión inválida", 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: ga, error: gaError } = await supabaseAdmin
      .from("google_accounts")
.select("user_id, email, access_token, refresh_token, expires_at")
      .eq("user_id", user.id)
      .maybeSingle<GoogleAccountRow>();

    if (gaError) {
      return jsonError(
        gaError.message || "No se pudo leer google_accounts",
        500
      );
    }

    if (!ga) {
      return jsonError("La cuenta Google no está conectada", 404);
    }

    let accessToken = ga.access_token ?? null;
    const refreshToken = ga.refresh_token ?? null;

    const nowMs = Date.now();
   const expiryMs = ga.expires_at ? new Date(ga.expires_at).getTime() : 0;
    const isExpired =
      !accessToken || !expiryMs || Number.isNaN(expiryMs) || expiryMs <= nowMs + 60_000;

    if (isExpired) {
      if (!refreshToken) {
        return jsonError(
          "La cuenta Google necesita reconectarse porque no tiene refresh_token",
          401
        );
      }

      const refreshed = await refreshGoogleAccessToken(refreshToken);
      accessToken = refreshed.access_token;

      const nextExpiry = new Date(
        Date.now() + (refreshed.expires_in ?? 3600) * 1000
      ).toISOString();

      const { error: updateTokenError } = await supabaseAdmin
        .from("google_accounts")
       .update({
  access_token: accessToken,
  expires_at: nextExpiry,
})
        .eq("user_id", user.id);

      if (updateTokenError) {
        return jsonError(
          updateTokenError.message ||
            "No se pudo guardar el token refrescado",
          500
        );
      }
    }

    if (!accessToken) {
      return jsonError("No hay access token disponible", 401);
    }

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 30);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 120);
    timeMax.setHours(23, 59, 59, 999);

    const calendars = await listAllVisibleCalendars(accessToken);

    if (!calendars.length) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        calendars: 0,
        message: "No se encontraron calendarios visibles para esta cuenta",
      });
    }

    const allRowsToUpsert: Record<string, GoogleEventUpsertRow> = {};
    let totalFetched = 0;

    for (const cal of calendars) {
      const calendarId = String(cal.id || "").trim();
      if (!calendarId) continue;

      const calendarName = cal.summary?.trim() || "Google Calendar";

      let items: GoogleEventItem[] = [];
      try {
        items = await listEventsForCalendar(
          accessToken,
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
  } catch (err: unknown) {
  // No tumbamos toda la sync por un calendario problemático.
  console.warn(
    `[google sync] No se pudo leer el calendario ${calendarId}:`,
    err instanceof Error ? err.message : err
  );
  continue;
}

      totalFetched += items.length;

      for (const it of items) {
        if (!it?.id) continue;
        if (it.status === "cancelled") continue;

        const startIso = toIsoFromGoogleBoundary(it.start, false);
        const endIso = toIsoFromGoogleBoundary(it.end, true);

        if (!startIso || !endIso) continue;

        const externalId = `google:${calendarId}:${String(it.id)}`;
        const summary = (it.summary || "").trim() || "Evento de Google";
        const updated = it.updated ? String(it.updated) : null;

        allRowsToUpsert[externalId] = {
          user_id: user.id,
          owner_id: user.id,
          created_by: user.id,
          group_id: null,
          title: summary,
          notes: it.description ? String(it.description) : null,
          start: startIso,
          end: endIso,
          external_source: "google",
          external_id: externalId,
          external_updated_at: updated,
          source_calendar_id: calendarId,
          source_calendar_name: calendarName,
        };
      }
    }

    const rowsToUpsert = Object.values(allRowsToUpsert);

    if (!rowsToUpsert.length) {
      return NextResponse.json({
        ok: true,
        imported: 0,
        calendars: calendars.length,
        fetched: totalFetched,
        message: "No hubo eventos válidos para importar",
      });
    }

    const { error: upsertError } = await supabaseAdmin
      .from("events")
      .upsert(rowsToUpsert, {
        onConflict: "external_id",
      });

    if (upsertError) {
      return jsonError(
        upsertError.message || "No se pudieron guardar los eventos importados",
        500
      );
    }

    return NextResponse.json({
      ok: true,
      imported: rowsToUpsert.length,
      calendars: calendars.length,
      fetched: totalFetched,
    });
 } catch (err: unknown) {
  return jsonError(
    err instanceof Error
      ? err.message
      : "Falló la sincronización de Google Calendar",
    500
  );
}
}