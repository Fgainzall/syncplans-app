import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { cronAuthFailureResponse, validateCronRequest } from "@/lib/cronAuth";

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

// Timezone fijo (Lima)
const TZ_OFFSET_HOURS = -5;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function atLocalMidnight(date: Date) {
  const copy = new Date(date);
  copy.setUTCHours(0 - TZ_OFFSET_HOURS, 0, 0, 0);
  return copy;
}

function formatDayLabel(dateIso: string | null | undefined) {
  if (!dateIso) return "Sin fecha";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(date);
}

function formatHourLabel(dateIso: string | null | undefined) {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("es-PE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Lima",
  }).format(date);
}

function thisWeekRangeISO() {
  const now = new Date();
  const todayLocalMidnight = atLocalMidnight(now);

  const day = todayLocalMidnight.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;

  const weekStart = addDays(todayLocalMidnight, mondayOffset);
  const weekEnd = addDays(weekStart, 7);

  const label = `${new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(weekStart)} - ${new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(addDays(weekEnd, -1))}`;

  return {
    startISO: weekStart.toISOString(),
    endISO: weekEnd.toISOString(),
    label,
  };
}

function renderWeeklyHtml(opts: {
  userName: string;
  label: string;
  events: Array<{ title: string; start: string | null; end: string | null }>;
}) {
  const { userName, label, events } = opts;

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
                          ${formatDayLabel(event.start)} ${
                            formatHourLabel(event.start)
                              ? `• ${formatHourLabel(event.start)}`
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
  try {
    // 1️⃣ Seguridad
    const auth = validateCronRequest(req);

    if (!auth.ok) {
      return cronAuthFailureResponse(auth);
    }

    const supabase = getAdminSupabase();
    const resend = getResend();
    const { startISO, endISO, label } = thisWeekRangeISO();

    // 2️⃣ Usuarios con resumen semanal activo
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("weekly_summary", true);

    if (usersErr) {
      console.error("[weekly-summary] error fetching users", usersErr);
      throw usersErr;
    }

    if (!users || users.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;

    // 3️⃣ Recorremos usuario por usuario
    for (const u of users) {
      try {
        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("first_name, email")
          .eq("id", u.user_id)
          .maybeSingle();

        if (profileErr) {
          console.error("[weekly-summary] error fetching profile", profileErr);
          continue;
        }

       const profileRow = profile as WeeklyProfileRow | null;
const email = String(profileRow?.email ?? "").trim();
        if (!email) continue;

        const { data: events, error: eventsErr } = await supabase
          .from("events")
          .select("title, start, end")
          .eq("user_id", u.user_id)
          .gte("start", startISO)
          .lt("start", endISO)
          .order("start", { ascending: true });

        if (eventsErr) {
          console.error("[weekly-summary] error fetching events", eventsErr);
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
          console.error(
            `[weekly-summary] unexpected error sending email to ${email}`,
            sendErr
          );
        }
      } catch (userErr) {
        console.error(
          "[weekly-summary] error processing user",
          u.user_id,
          userErr
        );
        // seguimos con el siguiente usuario
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[weekly-summary] cron failed", err);
    return NextResponse.json(
      { ok: false, message: "Weekly cron failed" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return runWeeklySummary(req);
}

export async function POST(req: Request) {
  return runWeeklySummary(req);
}