import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { cronAuthFailureResponse, validateCronRequest } from "@/lib/cronAuth";
import {
  createApiRequestContext,
  durationMs,
  jsonError,
  jsonOk,
  logError,
  logRequestStart,
  maskEmail,
  safeError,
} from "@/lib/apiObservability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM ||
  process.env.RESEND_FROM ||
  "SyncPlans <no-reply@syncplansapp.com>";

type WeeklyProfileRow = {
  first_name?: string | null;
  email?: string | null;
  daily_digest_timezone?: string | null;
  timezone?: string | null;
};
// Lazy init para que el build no reviente si faltan envs en local
function getAdminSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getResend() {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env var");
  }

  return new Resend(RESEND_API_KEY);
}

const DEFAULT_SUMMARY_TIME_ZONE = "America/Lima";

type ZonedDateParts = {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function normalizeSummaryTimeZone(value: string | null | undefined): string {
  const timeZone = String(value ?? "").trim();

  if (!timeZone) return DEFAULT_SUMMARY_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_SUMMARY_TIME_ZONE;
  }
}

function pickSummaryTimeZone(profile: WeeklyProfileRow | null | undefined): string {
  return normalizeSummaryTimeZone(
    profile?.daily_digest_timezone || profile?.timezone || null
  );
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

function addUtcDays(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function localDateLabelInstant(date: Date, timeZone: string): Date {
  return zonedLocalDateTimeToUtc(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12,
    0,
    0,
    0,
    timeZone
  );
}

function formatDayLabel(dateIso: string | null | undefined, timeZone: string) {
  if (!dateIso) return "Sin fecha";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(date);
}

function formatHourLabel(dateIso: string | null | undefined, timeZone: string) {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(date);
}

function thisWeekRangeISO(timeZoneInput?: string | null) {
  const timeZone = normalizeSummaryTimeZone(timeZoneInput);
  const now = getZonedParts(new Date(), timeZone);
  const todayAsUtcDate = new Date(Date.UTC(now.year, now.monthIndex, now.day));
  const day = todayAsUtcDate.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const weekStartLocal = addUtcDays(todayAsUtcDate, mondayOffset);
  const weekEndLocal = addUtcDays(weekStartLocal, 7);
  const weekLastLocal = addUtcDays(weekEndLocal, -1);

  const weekStart = zonedLocalDateTimeToUtc(
    weekStartLocal.getUTCFullYear(),
    weekStartLocal.getUTCMonth(),
    weekStartLocal.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );
  const weekEnd = zonedLocalDateTimeToUtc(
    weekEndLocal.getUTCFullYear(),
    weekEndLocal.getUTCMonth(),
    weekEndLocal.getUTCDate(),
    0,
    0,
    0,
    0,
    timeZone
  );

  const weekLastLabelDate = localDateLabelInstant(weekLastLocal, timeZone);

  const label = `${new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(weekStart)} - ${new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(weekLastLabelDate)}`;

  return {
    startISO: weekStart.toISOString(),
    endISO: weekEnd.toISOString(),
    label,
    timeZone,
  };
}

function renderWeeklyHtml(opts: {
  userName: string;
  label: string;
  events: Array<{ title: string; start: string | null; end: string | null }>;
  timeZone: string;
}) {
  const { userName, label, events, timeZone } = opts;

  return `
    <div style="background:#F8FAFC;padding:24px 12px;font-family:Inter,Arial,sans-serif;color:#0F172A;">
      <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:20px;overflow:hidden;">
        <div style="padding:24px 24px 12px;background:linear-gradient(135deg,#0F172A 0%, #111827 100%);color:#F8FAFC;">
          <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75;font-weight:700;">
            Resumen semanal
          </div>
          <h1 style="margin:10px 0 8px;font-size:28px;line-height:1.05;">
            Hola ${userName || "Fernando"}
          </h1>
          <p style="margin:0;font-size:14px;line-height:1.6;opacity:.88;">
            Esta es tu semana en SyncPlans (${label}).
          </p>
        </div>

        <div style="padding:20px 24px 24px;">
          ${
            events.length === 0
              ? `<div style="padding:18px;border:1px dashed #CBD5E1;border-radius:16px;background:#F8FAFC;color:#475569;font-size:14px;line-height:1.6;">
                   No encontramos eventos para esta semana.
                 </div>`
              : events
                  .slice(0, 10)
                  .map(
                    (event) => `
                      <div style="padding:14px 0;border-bottom:1px solid #E2E8F0;">
                        <div style="font-size:16px;font-weight:700;color:#0F172A;">
                          ${event.title || "Evento"}
                        </div>
                        <div style="margin-top:4px;font-size:13px;color:#64748B;">
                          ${formatDayLabel(event.start, timeZone)} ${
                            formatHourLabel(event.start, timeZone)
                              ? `• ${formatHourLabel(event.start, timeZone)}`
                              : ""
                          }
                        </div>
                      </div>
                    `
                  )
                  .join("")
          }

          ${
            events.length > 10
              ? `<p style="margin:8px 0 0;font-size:11px;color:#6B7280;">
                   Tienes más eventos en la semana. Solo mostramos los primeros 10 aquí.
                 </p>`
              : ""
          }

          <p style="margin:16px 0 0;font-size:11px;color:#6B7280;line-height:1.5;">
            Este correo no añade nada nuevo a tu agenda. Solo resume lo que ya está en SyncPlans
            para que tú decidas con calma qué conservar, qué mover y qué hablar.
          </p>
        </div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────
async function runWeeklySummary(req: Request) {
  const ctx = createApiRequestContext(req);
  const startedAt = new Date().toISOString();
  logRequestStart(ctx, { job: "weekly-summary" });

  try {
    // 1️⃣ Seguridad
    const auth = validateCronRequest(req);

    if (!auth.ok) {
      return cronAuthFailureResponse(auth, ctx);
    }

    const supabase = getAdminSupabase();
    const resend = getResend();

    // 2️⃣ Usuarios con resumen semanal activo
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("weekly_summary", true);

    if (usersErr) {
      throw usersErr;
    }

    const userRows = users ?? [];

    if (userRows.length === 0) {
      return jsonOk(ctx, {
        job: "weekly-summary",
        startedAt,
        finishedAt: new Date().toISOString(),
        durationMs: durationMs(ctx),
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      });
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    // 3️⃣ Recorremos usuario por usuario
    for (const u of userRows) {
      const userId = String(u.user_id ?? "").trim();

      if (!userId) {
        skipped += 1;
        continue;
      }

      try {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("first_name, email, daily_digest_timezone, timezone")
          .eq("id", userId)
          .maybeSingle();

        if (profileErr) {
          failed += 1;
          logError("weekly_summary.profile_lookup_failed", {
            requestId: ctx.requestId,
            endpoint: ctx.endpoint,
            userId,
            code: "EMAIL_WEEKLY_PROFILE_LOOKUP_FAILED",
            error: safeError(profileErr),
          });
          continue;
        }

        const profileRow = profile as WeeklyProfileRow | null;
        const email = String(profileRow?.email ?? "").trim();
        const timeZone = pickSummaryTimeZone(profileRow);
        const { startISO, endISO, label } = thisWeekRangeISO(timeZone);

        if (!email) {
          skipped += 1;
          continue;
        }

        const { data: events, error: eventsErr } = await supabase
          .from("events")
          .select("title, start, end")
          .eq("user_id", userId)
          .gte("start", startISO)
          .lt("start", endISO)
          .order("start", { ascending: true });

        if (eventsErr) {
          failed += 1;
          logError("weekly_summary.events_lookup_failed", {
            requestId: ctx.requestId,
            endpoint: ctx.endpoint,
            userId,
            code: "EMAIL_WEEKLY_EVENTS_LOOKUP_FAILED",
            error: safeError(eventsErr),
          });
          continue;
        }

        const html = renderWeeklyHtml({
          userName: String(profileRow?.first_name ?? "").trim(),
          label,
          events: (events ?? []) as Array<{
            title: string;
            start: string | null;
            end: string | null;
          }>,
          timeZone,
        });

        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: `Tu semana en SyncPlans · ${label}`,
            html,
          });

          sent += 1;
        } catch (sendErr) {
          failed += 1;
          logError("weekly_summary.email_send_failed", {
            requestId: ctx.requestId,
            endpoint: ctx.endpoint,
            userId,
            email: maskEmail(email),
            code: "EMAIL_WEEKLY_SEND_FAILED",
            error: safeError(sendErr),
          });
        }
      } catch (userErr) {
        failed += 1;
        logError("weekly_summary.user_processing_failed", {
          requestId: ctx.requestId,
          endpoint: ctx.endpoint,
          userId,
          code: "EMAIL_WEEKLY_USER_PROCESSING_FAILED",
          error: safeError(userErr),
        });
        // seguimos con el siguiente usuario
      }
    }

    const defaultWeek = thisWeekRangeISO(DEFAULT_SUMMARY_TIME_ZONE);

    return jsonOk(ctx, {
      job: "weekly-summary",
      label: defaultWeek.label,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: durationMs(ctx),
      processed: userRows.length,
      sent,
      skipped,
      failed,
    });
  } catch (err) {
    return jsonError(ctx, {
      error: "Weekly cron failed.",
      code: "EMAIL_WEEKLY_SUMMARY_FAILED",
      status: 500,
      log: { job: "weekly-summary", error: safeError(err) },
    });
  }
}

export async function GET(req: Request) {
  return runWeeklySummary(req);
}

export async function POST(req: Request) {
  return runWeeklySummary(req);
}