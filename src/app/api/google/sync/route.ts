import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  createSupabaseUserClient,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  logRequestStart,
  logWarn,
} from "@/lib/apiObservability";

export const dynamic = "force-dynamic";

const GOOGLE_SYNC_RATE_LIMIT_WINDOW_SECONDS = 60;
const GOOGLE_SYNC_RATE_LIMIT_MAX_ATTEMPTS = 5;

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
  description?: string;
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

const INFORMATIONAL_GOOGLE_CALENDAR_PATTERNS = [
  "holiday",
  "holidays",
  "feriado",
  "feriados",
  "festivo",
  "festivos",
  "cumpleanos",
  "cumpleaños",
  "birthday",
  "birthdays",
  "contacts",
  "addressbook",
];

const INFORMATIONAL_GOOGLE_EVENT_TITLE_PATTERNS = [
  "fiesta del sol",
  "dia del campesino",
  "día del campesino",
  "batalla de arica",
  "dia de la bandera",
  "día de la bandera",
  "domingo de pascua",
  "feriado",
  "holiday",
];

function normalizeInformationalText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isInformationalGoogleCalendar(cal: GoogleCalendarListItem): boolean {
  const haystack = normalizeInformationalText(
    [cal.id, cal.summary, cal.description].filter(Boolean).join(" ")
  );

  return INFORMATIONAL_GOOGLE_CALENDAR_PATTERNS.some((pattern) =>
    haystack.includes(normalizeInformationalText(pattern))
  );
}

function isInformationalGoogleEventTitle(title: string): boolean {
  const normalizedTitle = normalizeInformationalText(title);
  return INFORMATIONAL_GOOGLE_EVENT_TITLE_PATTERNS.some((pattern) =>
    normalizedTitle.includes(normalizeInformationalText(pattern))
  );
}

type GoogleEventUpsertRow = Record<string, unknown>;

type GoogleRefreshResult = {
  access_token: string;
  expires_in?: number;
};

class GoogleProviderError extends Error {
  status: number;
  providerCode?: string;

  constructor(message: string, status: number, providerCode?: string) {
    super(message);
    this.name = "GoogleProviderError";
    this.status = status;
    this.providerCode = providerCode;
  }
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
    const d = new Date(`${value.date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  return fallbackAllDayEnd ? null : null;
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<GoogleRefreshResult> {
  const clientId =
    (process.env.GOOGLE_OAUTH_CLIENT_ID ?? "").trim() ||
    (process.env.GOOGLE_CLIENT_ID ?? "").trim();
  const clientSecret =
    (process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "").trim() ||
    (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();

  if (!clientId || !clientSecret) {
    throw new GoogleProviderError("Missing Google OAuth environment variables", 500, "missing_env");
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

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok || !json?.access_token) {
    const providerCode =
      typeof json?.error === "string" ? json.error : `google_http_${res.status}`;
    throw new GoogleProviderError(
      "No se pudo refrescar el access token de Google",
      res.status,
      providerCode
    );
  }

  return {
    access_token: String(json.access_token),
    expires_in: typeof json.expires_in === "number" ? json.expires_in : undefined,
  };
}

async function googleFetchJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    const errorRecord =
      json && typeof json.error === "object" && json.error !== null
        ? (json.error as Record<string, unknown>)
        : null;
    const providerCode =
      (typeof errorRecord?.status === "string" && errorRecord.status) ||
      (typeof json.error === "string" && json.error) ||
      `google_http_${res.status}`;

    throw new GoogleProviderError("Google API error", res.status, providerCode);
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
    const json = await googleFetchJson<GoogleCalendarListResponse>(url, accessToken);

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

function getInformationalGoogleEventsCleanupFilter(): string {
  return [
    "external_id.ilike.%holiday@group.v.calendar.google.com%",
    "external_id.ilike.%#holiday@group.v.calendar.google.com%",
    "external_id.ilike.%addressbook#contacts@group.v.calendar.google.com%",
    "external_id.ilike.%contacts@group.v.calendar.google.com%",
    "external_id.ilike.%birthdays%",
    "external_id.ilike.%birthday%",
    "title.ilike.%Fiesta del Sol%",
    "title.ilike.%Día del Campesino%",
    "title.ilike.%Dia del Campesino%",
    "title.ilike.%Batalla de Arica%",
    "title.ilike.%Día de la Bandera%",
    "title.ilike.%Dia de la Bandera%",
    "title.ilike.%Domingo de Pascua%",
  ].join(",");
}

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "google.sync" });

  let userIdForLog = "unknown";

  try {
    const supabaseAuth = await createSupabaseUserClient(req);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user?.id) {
      return jsonError(ctx, {
        error: "Falta sesión para sincronizar Google Calendar.",
        code: "GOOGLE_SYNC_UNAUTHORIZED",
        status: 401,
        log: { flow: "google.sync" },
      });
    }

    userIdForLog = user.id;

    const syncLimit = await checkRateLimit({
      prefix: "google-sync",
      keyParts: [user.id, getClientIp(req)],
      limit: GOOGLE_SYNC_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: GOOGLE_SYNC_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!syncLimit.allowed) {
      return jsonError(ctx, {
        error: "Demasiadas sincronizaciones. Intenta nuevamente en unos segundos.",
        code: "GOOGLE_SYNC_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(syncLimit),
        log: { flow: "google.sync", userId: user.id },
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonError(ctx, {
        error: "Faltan variables de entorno para sincronizar Google Calendar.",
        code: "GOOGLE_SYNC_ENV_MISSING",
        status: 500,
        level: "error",
        log: { flow: "google.sync", userId: user.id },
      });
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
      return jsonError(ctx, {
        error: "No se pudo leer la conexión de Google.",
        code: "GOOGLE_SYNC_ACCOUNT_LOOKUP_FAILED",
        status: 500,
        log: { flow: "google.sync", userId: user.id, providerError: gaError.message },
      });
    }

    if (!ga) {
      return jsonError(ctx, {
        error: "La cuenta Google no está conectada.",
        code: "GOOGLE_NO_ACCOUNT",
        status: 404,
        log: { flow: "google.sync", userId: user.id },
      });
    }

    let accessToken = ga.access_token ?? null;
    const refreshToken = ga.refresh_token ?? null;

    const nowMs = Date.now();
    const expiryMs = ga.expires_at ? new Date(ga.expires_at).getTime() : 0;
    const isExpired =
      !accessToken || !expiryMs || Number.isNaN(expiryMs) || expiryMs <= nowMs + 60_000;

    if (isExpired) {
      if (!refreshToken) {
        return jsonError(ctx, {
          error: "La cuenta Google necesita reconectarse.",
          code: "GOOGLE_REAUTH_REQUIRED",
          status: 401,
          log: { flow: "google.sync", userId: user.id, reason: "missing_refresh_token" },
        });
      }

      let refreshed: GoogleRefreshResult;
      try {
        refreshed = await refreshGoogleAccessToken(refreshToken);
      } catch (error) {
        const providerError = error instanceof GoogleProviderError ? error : null;
        return jsonError(ctx, {
          error: "No se pudo refrescar la sesión de Google. Vuelve a conectar tu cuenta.",
          code: "GOOGLE_TOKEN_REFRESH_FAILED",
          status: providerError?.status === 400 || providerError?.status === 401 ? 401 : 502,
          headers: rateLimitHeaders(syncLimit),
          log: {
            flow: "google.sync",
            userId: user.id,
            providerStatus: providerError?.status ?? null,
            providerCode: providerError?.providerCode ?? null,
          },
        });
      }

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
        return jsonError(ctx, {
          error: "No se pudo guardar la sesión renovada de Google.",
          code: "GOOGLE_TOKEN_SAVE_FAILED",
          status: 500,
          log: { flow: "google.sync", userId: user.id, providerError: updateTokenError.message },
        });
      }
    }

    if (!accessToken) {
      return jsonError(ctx, {
        error: "La cuenta Google necesita reconectarse.",
        code: "GOOGLE_REAUTH_REQUIRED",
        status: 401,
        log: { flow: "google.sync", userId: user.id, reason: "missing_access_token" },
      });
    }

    const now = new Date();
    const timeMin = new Date(now);
    timeMin.setDate(timeMin.getDate() - 30);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date(now);
    timeMax.setDate(timeMax.getDate() + 120);
    timeMax.setHours(23, 59, 59, 999);

    const calendars = await listAllVisibleCalendars(accessToken);
    const syncableCalendars = calendars.filter((cal) => !isInformationalGoogleCalendar(cal));
    const skippedInformationalCalendars = Math.max(0, calendars.length - syncableCalendars.length);

    let removedInformationalEvents = 0;
    try {
      const { count, error } = await supabaseAdmin
        .from("events")
        .delete({ count: "exact" })
        .eq("user_id", user.id)
        .eq("external_source", "google")
        .or(getInformationalGoogleEventsCleanupFilter());

      if (error) {
        throw error;
      }

      removedInformationalEvents = typeof count === "number" ? count : 0;
    } catch (error) {
      logWarn("google.sync.informational_cleanup_failed", {
        requestId: ctx.requestId,
        endpoint: ctx.endpoint,
        method: ctx.method,
        userId: user.id,
        error,
      });
    }

    if (!syncableCalendars.length) {
      return jsonOk(
        ctx,
        {
          imported: 0,
          calendars: 0,
          skippedInformationalCalendars,
          removedInformationalEvents,
          fetched: 0,
          message: "No se encontraron calendarios sincronizables para esta cuenta.",
        },
        { headers: rateLimitHeaders(syncLimit), log: { flow: "google.sync", userId: user.id, imported: 0, calendars: 0, skippedInformationalCalendars, removedInformationalEvents } }
      );
    }

    const allRowsToUpsert: Record<string, GoogleEventUpsertRow> = {};
    let totalFetched = 0;
    let skippedInformationalEvents = 0;
    let calendarFailures = 0;

    for (const [calendarIndex, cal] of syncableCalendars.entries()) {
      const calendarId = String(cal.id || "").trim();
      if (!calendarId) continue;

      let items: GoogleEventItem[] = [];
      try {
        items = await listEventsForCalendar(
          accessToken,
          calendarId,
          timeMin.toISOString(),
          timeMax.toISOString()
        );
      } catch (error) {
        calendarFailures += 1;
        const providerError = error instanceof GoogleProviderError ? error : null;
        logWarn("google.sync.calendar_failed", {
          requestId: ctx.requestId,
          endpoint: ctx.endpoint,
          method: ctx.method,
          userId: user.id,
          calendarIndex,
          providerStatus: providerError?.status ?? null,
          providerCode: providerError?.providerCode ?? null,
        });
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

        if (isInformationalGoogleEventTitle(summary)) {
          skippedInformationalEvents += 1;
          continue;
        }

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
        };
      }
    }

    const rowsToUpsert = Object.values(allRowsToUpsert);

    if (!rowsToUpsert.length) {
      return jsonOk(
        ctx,
        {
          imported: 0,
          calendars: syncableCalendars.length,
          skippedInformationalCalendars,
          skippedInformationalEvents,
          removedInformationalEvents,
          fetched: totalFetched,
          calendarFailures,
          message: "No hubo eventos válidos para importar.",
        },
        {
          log: {
            flow: "google.sync",
            userId: user.id,
            imported: 0,
            calendars: syncableCalendars.length,
            skippedInformationalCalendars,
            skippedInformationalEvents,
            removedInformationalEvents,
            fetched: totalFetched,
            calendarFailures,
          },
        }
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from("events")
      .upsert(rowsToUpsert, {
        onConflict: "user_id,external_source,external_id",
      });

    if (upsertError) {
      return jsonError(ctx, {
        error: "No se pudieron guardar los eventos importados.",
        code: "GOOGLE_SYNC_UPSERT_FAILED",
        status: 500,
        log: { flow: "google.sync", userId: user.id, providerError: upsertError.message },
      });
    }

    return jsonOk(
      ctx,
      {
        imported: rowsToUpsert.length,
        calendars: syncableCalendars.length,
        skippedInformationalCalendars,
        skippedInformationalEvents,
        removedInformationalEvents,
        fetched: totalFetched,
        calendarFailures,
      },
      {
        headers: rateLimitHeaders(syncLimit),
        log: {
          flow: "google.sync",
          userId: user.id,
          imported: rowsToUpsert.length,
          calendars: syncableCalendars.length,
          skippedInformationalCalendars,
          skippedInformationalEvents,
          removedInformationalEvents,
          fetched: totalFetched,
          calendarFailures,
        },
      }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "Falló la sincronización de Google Calendar.",
      code: "GOOGLE_SYNC_FAILED",
      status: 500,
      level: "error",
      log: { flow: "google.sync", userId: userIdForLog, error },
    });
  }
}
