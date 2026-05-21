import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  durationMs,
  jsonError,
  jsonOk,
  logRequestStart,
  safeError,
  type ApiRequestContext,
} from "@/lib/apiObservability";
import {
  cronAuthFailureResponse,
  getCronDateParam,
  validateCronRequest,
} from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ───────────────────────────────── env & clients ──────────────────────────────

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";

// Soportamos EMAIL_FROM o, si no, RESEND_FROM (que ya tienes en env)
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  "SyncPlans <no-reply@syncplansapp.com>";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Tipamos explícito el admin client para que TS no moleste
type AdminClient = ReturnType<typeof createClient>;

type MembershipRow = {
  group_id: string | null;
};

type DigestGroupRow = {
  id: string;
  name: string | null;
  type: string | null;
};

type DailySummarySettingRow = {
  user_id: string;
  daily_summary: boolean | null;
};

type ProfileTimezoneRow = {
  daily_digest_timezone?: string | null;
  timezone?: string | null;
};

type ManualDigestBody = {
  date?: unknown;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
function getResend() {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env var");
  }
  return new Resend(RESEND_API_KEY);
}

function getAdminClient(): AdminClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin env vars");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

// ───────────────────────────── helpers de formato ────────────────────────────

type EventPayload = {
  title: string;
  start: string;
  end: string;
  groupLabel: string;
};

const DEFAULT_DIGEST_TIME_ZONE = "America/Lima";

type ZonedDateParts = {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function normalizeDigestTimeZone(value: string | null | undefined): string {
  const timeZone = String(value ?? "").trim();

  if (!timeZone) return DEFAULT_DIGEST_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_DIGEST_TIME_ZONE;
  }
}

function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const byType = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    year: Number(byType.year),
    monthIndex: Number(byType.month) - 1,
    day: Number(byType.day),
    hour: Number(byType.hour),
    minute: Number(byType.minute),
    second: Number(byType.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getZonedParts(date, timeZone);

  const localAsUtcMs = Date.UTC(
    parts.year,
    parts.monthIndex,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    0
  );

  return localAsUtcMs - date.getTime();
}

function zonedLocalDateTimeToUtc(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
  timeZone: string
): Date {
  const localAsUtcMs = Date.UTC(
    year,
    monthIndex,
    day,
    hour,
    minute,
    second,
    millisecond
  );

  let utc = new Date(localAsUtcMs);

  for (let i = 0; i < 3; i += 1) {
    const offsetMs = getTimeZoneOffsetMs(utc, timeZone);
    utc = new Date(localAsUtcMs - offsetMs);
  }

  return utc;
}

function formatTime(iso: string, timeZone: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localDateKey(iso: string, timeZone: string): string {
  const parts = getZonedParts(new Date(iso), timeZone);
  const month = String(parts.monthIndex + 1).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");

  return `${parts.year}-${month}-${day}`;
}

function formatShortDate(iso: string, timeZone: string): string {
  const d = new Date(iso);
  const label = new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(d);

  return label.replace(/\./g, "");
}

function formatEventRange(e: EventPayload, timeZone: string): string {
  const startDate = new Date(e.start);
  const endDate = new Date(e.end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Horario por confirmar";
  }

  const startTime = formatTime(e.start, timeZone);
  const endTime = formatTime(e.end, timeZone);

  const startsAndEndsSameLocalDay =
    localDateKey(e.start, timeZone) === localDateKey(e.end, timeZone);

  if (startsAndEndsSameLocalDay) {
    return `${startTime} – ${endTime}`;
  }

  return `${formatShortDate(e.start, timeZone)} ${startTime} → ${formatShortDate(
    e.end,
    timeZone
  )} ${endTime}`;
}

function buildDigestDayRange(dateParam: string | null, timeZoneInput?: string | null) {
  const timeZone = normalizeDigestTimeZone(timeZoneInput);
  let year: number;
  let monthIndex: number;
  let day: number;

  const safeParam = String(dateParam ?? "").trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(safeParam)) {
    const [y, m, d] = safeParam.split("-").map(Number);
    year = y;
    monthIndex = m - 1;
    day = d;
  } else {
    const now = getZonedParts(new Date(), timeZone);
    year = now.year;
    monthIndex = now.monthIndex;
    day = now.day;
  }

  const dayStart = zonedLocalDateTimeToUtc(
    year,
    monthIndex,
    day,
    0,
    0,
    0,
    0,
    timeZone
  );
  const dayEnd = zonedLocalDateTimeToUtc(
    year,
    monthIndex,
    day + 1,
    0,
    0,
    0,
    0,
    timeZone
  );

  const dateLabel = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(dayStart);

  return {
    dayStartIso: dayStart.toISOString(),
    dayEndIso: dayEnd.toISOString(),
    dateLabel,
    timeZone,
  };
}

function pickDigestTimeZone(profile: ProfileTimezoneRow | null | undefined): string {
  return normalizeDigestTimeZone(
    profile?.daily_digest_timezone || profile?.timezone || null
  );
}

async function getDigestTimeZoneForUser(
  client: AdminClient,
  userId: string
): Promise<string> {
  const { data, error } = await client
    .from("profiles")
    .select("daily_digest_timezone, timezone")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "daily_digest.timezone_lookup_failed",
        userId,
        error: safeError(error),
      })
    );

    return DEFAULT_DIGEST_TIME_ZONE;
  }

  return pickDigestTimeZone(data as ProfileTimezoneRow | null);
}

function buildDailyDigestHtml(
  dateLabel: string,
  events: EventPayload[],
  timeZone: string
): { html: string; subject: string } {
  const total = events.length;
  const sharedCount = events.filter(
    (e) => e.groupLabel && e.groupLabel.toLowerCase() !== "personal"
  ).length;

  const summaryLineParts: string[] = [];
  summaryLineParts.push(
    `Tienes <strong>${total}</strong> evento${
      total > 1 ? "s" : ""
    } para hoy.`
  );
  if (sharedCount > 0) {
    summaryLineParts.push(
      `${sharedCount} de ellos son <strong>compartidos</strong>.`
    );
  }

  const listHtml = events
    .map((e) => {
      const rangeLabel = escapeHtml(formatEventRange(e, timeZone));
      const title = escapeHtml(e.title);
      const groupLabel = escapeHtml(e.groupLabel);

      return `<li style="margin-bottom:6px;">
           <strong>${rangeLabel}</strong> · ${title}
           <span style="color:#9ca3af;"> (${groupLabel})</span>
         </li>`;
    })
    .join("");

  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#0f172a;background-color:#020617;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;padding:20px;">
        <p style="font-size:11px;color:#9ca3af;margin:0 0 8px 0;">
          SyncPlans · Resumen diario
        </p>
        <h2 style="margin:0 0 4px 0;font-size:20px;color:#e5e7eb;">
          Tu día de hoy, sin sorpresas
        </h2>
        <p style="margin:0 0 12px 0;color:#9ca3af;font-size:13px;">
          ${dateLabel || ""}
        </p>

        <p style="margin:0 0 12px 0;color:#e5e7eb;font-size:13px;line-height:1.5;">
          ${summaryLineParts.join(" ")}
        </p>

        <ul style="padding-left:18px;margin:0 0 16px 0;color:#e5e7eb;list-style-type:disc;">
          ${listHtml}
        </ul>

        <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">
          Todo lo que ves aquí está sincronizado con tu calendario en SyncPlans.
        </p>
        <p style="margin:0;font-size:11px;color:#6b7280;">
          SyncPlans · Una sola verdad para los horarios compartidos.
        </p>
      </div>
    </div>
  `;

  const subject =
    total === 1
      ? "Hoy tienes 1 evento · SyncPlans"
      : `Hoy tienes ${total} eventos · SyncPlans`;

  return { html, subject };
}

// ───────────────────────────── helpers de datos ──────────────────────────────

function groupLabelFromType(type: string | null | undefined): string {
  const t = (type || "").toLowerCase();
  if (t === "pair") return "Pareja";
  if (t === "family") return "Familia";
  if (t === "solo" || t === "personal") return "Personal";
  if (t === "other") return "Compartido";
  return "Grupo";
}

/**
 * Eventos que el usuario puede ver en un día (personal + grupos donde es miembro).
 */
async function getEventsForUserOnDay(
  client: AdminClient,
  userId: string,
  dayStartIso: string,
  dayEndIso: string
): Promise<EventPayload[]> {
  // 1) grupos donde es miembro
  const { data: memberships, error: memErr } = await client
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (memErr) throw memErr;

const memberRows = (memberships ?? []) as MembershipRow[];

const memberGroupIds = memberRows
  .map((m) => m.group_id)
  .filter((groupId): groupId is string => Boolean(groupId));

  // 2) eventos personales + de esos grupos
  let query = client
    .from("events")
    .select("id, title, start, end, group_id")
    // Importante: no buscamos solo eventos que EMPIEZAN hoy.
    // El digest debe incluir eventos que se cruzan con el día,
    // por ejemplo: empieza hoy y termina el domingo, o empezó ayer
    // y sigue activo hoy.
    .lt("start", dayEndIso)
    .gt("end", dayStartIso)
    .order("start", { ascending: true });

  if (memberGroupIds.length > 0) {
    const list = `(${memberGroupIds.map((id) => `"${id}"`).join(",")})`;
    query = query.or(`user_id.eq.${userId},group_id.in.${list}`);
  } else {
    query = query.eq("user_id", userId);
  }

  const { data: events, error: evErr } = await query;
  if (evErr) throw evErr;

  const rows = (events ?? []) as {
    id: string;
    title: string | null;
    start: string;
    end: string;
    group_id: string | null;
  }[];

  if (rows.length === 0) return [];

  // 3) labels de grupos
  const groupIds = Array.from(
    new Set(
      rows
        .map((e) => e.group_id)
        .filter(Boolean)
        .map((x) => String(x))
    )
  );

  const groupMap: Record<
    string,
    { name: string | null; type: string | null }
  > = {};

  if (groupIds.length > 0) {
    const { data: groups, error: gErr } = await client
      .from("groups")
      .select("id, name, type")
      .in("id", groupIds);

    if (gErr) throw gErr;

 for (const g of (groups ?? []) as DigestGroupRow[]) {
  groupMap[String(g.id)] = {
    name: g.name ?? null,
    type: g.type ?? null,
  };
}
  }

  return rows.map((e) => {
    const baseTitle =
      e.title && e.title.trim().length > 0 ? e.title : "Evento sin título";

    if (!e.group_id) {
      return {
        title: baseTitle,
        start: e.start,
        end: e.end,
        groupLabel: "Personal",
      };
    }

    const meta = groupMap[String(e.group_id)];
    const label =
      (meta?.name && meta.name.trim().length > 0
        ? meta.name
        : groupLabelFromType(meta?.type ?? null)) || "Grupo";

    return {
      title: baseTitle,
      start: e.start,
      end: e.end,
      groupLabel: label,
    };
  });
}

// ───────────────────────────── núcleo de la función ──────────────────────────

export async function runDailyDigest(
  dateParam: string | null,
  ctx?: ApiRequestContext
) {
  const startedAt = new Date().toISOString();

  try {
    const supabaseAdmin = getAdminClient();
    const resend = getResend();

    // 1) usuarios que tienen daily_summary = true
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, daily_summary")
      .eq("daily_summary", true);

    if (settingsErr) throw settingsErr;

    const targets = ((settings ?? []) as DailySummarySettingRow[]).map((s) =>
      String(s.user_id)
    );

    const results: { userId: string; sent: boolean; reason?: string }[] = [];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    if (targets.length === 0) {
      const payload = {
        job: "daily-reminders",
        message: "No users to notify",
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: ctx ? durationMs(ctx) : 0,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      };

      return ctx ? jsonOk(ctx, payload) : Response.json({ ok: true, ...payload });
    }

    // 2) recorremos usuarios (por ahora secuencial está bien)
    for (const userId of targets) {
      try {
        // 2.1) traemos el usuario para obtener el email
        const { data: userRes, error: userErr } =
          await supabaseAdmin.auth.admin.getUserById(userId);

        if (userErr) {
          failed += 1;
          results.push({
            userId,
            sent: false,
            reason: "auth_user_error",
          });
          continue;
        }

        const email = userRes?.user?.email;
        if (!email) {
          skipped += 1;
          results.push({
            userId,
            sent: false,
            reason: "no_email",
          });
          continue;
        }

        // 2.2) eventos del día según timezone del usuario
        const timeZone = await getDigestTimeZoneForUser(supabaseAdmin, userId);
        const { dayStartIso, dayEndIso, dateLabel } = buildDigestDayRange(
          dateParam,
          timeZone
        );

        const events = await getEventsForUserOnDay(
          supabaseAdmin,
          userId,
          dayStartIso,
          dayEndIso
        );

        if (events.length === 0) {
          skipped += 1;
          results.push({
            userId,
            sent: false,
            reason: "no_events",
          });
          continue;
        }

        const { html, subject } = buildDailyDigestHtml(
          dateLabel,
          events,
          timeZone
        );

        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject,
          html,
        });

        sent += 1;
        results.push({ userId, sent: true });
      } catch (innerErr) {
        failed += 1;
        console.error(
          JSON.stringify({
            level: "error",
            event: "daily_digest.user_failed",
            requestId: ctx?.requestId ?? null,
            userId,
            error: safeError(innerErr),
          })
        );
        results.push({
          userId,
          sent: false,
          reason: "send_error",
        });
      }
    }

    const payload = {
      job: "daily-reminders",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: ctx ? durationMs(ctx) : 0,
      processed: targets.length,
      sent,
      skipped,
      failed,
      results,
    };

    return ctx ? jsonOk(ctx, payload) : Response.json({ ok: true, ...payload });
  } catch (err: unknown) {
    const payload = {
      error: "Error ejecutando daily digest",
      code: "EMAIL_DAILY_DIGEST_FAILED",
      status: 500,
      log: { job: "daily-reminders", error: safeError(err) },
    };

    if (ctx) return jsonError(ctx, payload);

    console.error("[daily-digest] error global", err);
    return Response.json(
      { ok: false, error: payload.error, code: payload.code },
      { status: 500 }
    );
  }
}

async function runManualDigestForAuthedUser(
  req: Request,
  dateParam: string | null,
  ctx: ApiRequestContext
) {
  try {
    const auth = await getAuthenticatedUser(req, ctx);

    if (!auth.ok) {
      return auth.response;
    }

    const user = auth.user;

    if (!user.email) {
      return jsonError(ctx, {
        error: "No email",
        code: "EMAIL_DIGEST_NO_EMAIL",
        status: 400,
        log: { userId: user.id },
      });
    }

    const supabaseAdmin = getAdminClient();
    const resend = getResend();
    const timeZone = await getDigestTimeZoneForUser(supabaseAdmin, user.id);
    const { dayStartIso, dayEndIso, dateLabel } = buildDigestDayRange(
      dateParam,
      timeZone
    );

    const events = await getEventsForUserOnDay(
      supabaseAdmin,
      user.id,
      dayStartIso,
      dayEndIso
    );

    if (events.length === 0) {
      return jsonOk(ctx, {
        sent: false,
        reason: "no_events",
        count: 0,
      });
    }

    const { html, subject } = buildDailyDigestHtml(
      dateLabel,
      events,
      timeZone
    );

    await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject,
      html,
    });

    return jsonOk(ctx, {
      sent: true,
      count: events.length,
    });
  } catch (err: unknown) {
    return jsonError(ctx, {
      error: getErrorMessage(err, "Manual digest failed"),
      code: "EMAIL_MANUAL_DIGEST_FAILED",
      status: 500,
      log: { error: safeError(err) },
    });
  }
}

// ───────────────────────────── handlers GET & POST ───────────────────────────

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { job: "daily-digest" });

  const auth = validateCronRequest(req);

  if (!auth.ok) {
    return cronAuthFailureResponse(auth, ctx);
  }

  const dateParam = getCronDateParam(req, ctx);

  if (!dateParam.ok) {
    return dateParam.response;
  }

  return runDailyDigest(dateParam.date, ctx);
}

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { job: "daily-digest" });

  const url = new URL(req.url);
  const dateFromQuery = url.searchParams.get("date");
  const cronAuth = validateCronRequest(req);

  if (cronAuth.ok) {
    const dateParam = getCronDateParam(req, ctx);

    if (!dateParam.ok) {
      return dateParam.response;
    }

    return runDailyDigest(dateParam.date, ctx);
  }

  const body = (await req.json().catch(() => ({}))) as ManualDigestBody;
  const dateFromBody =
    typeof body?.date === "string" && body.date.trim() ? body.date.trim() : null;

  return runManualDigestForAuthedUser(req, dateFromBody ?? dateFromQuery, ctx);
}
