// src/app/api/cron/daily-reminders/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const CRON_SECRET = process.env.CRON_SECRET || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM || "SyncPlans <no-reply@syncplansapp.com>";

// Autorización básica para llamadas de cron
function isAuthorized(req: Request): boolean {
  // Si no hay CRON_SECRET configurado, no bloqueamos (útil en desarrollo)
  if (!CRON_SECRET) return true;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");

  // Permitimos:
  // - ?token=CRON_SECRET
  // - x-cron-secret: CRON_SECRET
  // - Authorization: Bearer CRON_SECRET
  if (token && token === CRON_SECRET) return true;
  if (headerSecret && headerSecret === CRON_SECRET) return true;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearer = authHeader.slice(7);
    if (bearer === CRON_SECRET) return true;
  }

  return false;
}

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

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function todayRangeISO() {
  const now = new Date();

  // Ajustamos a Lima (aprox)
  const local = new Date(
    now.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000
  );

  const start = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate(),
    0,
    0,
    0
  );

  const end = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() + 1,
    0,
    0,
    0
  );

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label: local.toLocaleDateString("es-PE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DbUserSettings = {
  user_id: string;
};

type DbProfile = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

type DbEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  group_id: string | null;
  group_type: "solo" | "pair" | "family" | "other" | null;
  group_name: string | null;
};

type DailyDigestEvent = {
  title: string;
  start: string;
  end: string;
  groupLabel: string;
};

function buildGroupLabel(e: DbEvent): string {
  if (e.group_name) return e.group_name;
  switch (e.group_type) {
    case "solo":
      return "Personal";
    case "pair":
      return "Pareja";
    case "family":
      return "Familia";
    case "other":
      return "Compartido";
    default:
      return "General";
  }
}

function mapEvents(events: DbEvent[]): DailyDigestEvent[] {
  return events.map((e) => ({
    title: e.title || "Evento sin título",
    start: e.start,
    end: e.end,
    groupLabel: buildGroupLabel(e),
  }));
}

function renderEmailHtml(
  dateLabel: string,
  userName: string | null | undefined,
  events: DailyDigestEvent[]
) {
  const displayName = userName || "Hola";

  if (!events.length) {
    return `
      <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; background: #020617; color: #E5E7EB; padding: 24px;">
        <h1 style="font-size: 20px; margin: 0 0 12px;">${displayName}, hoy no tienes nada agendado 🎉</h1>
        <p style="margin: 0 0 12px; color: #9CA3AF;">
          Igual, si ya quedaste en algo por WhatsApp o por llamada, te conviene ponerlo en SyncPlans para evitar confusiones.
        </p>
        <p style="margin: 0; color: #9CA3AF; font-size: 13px;">
          Este correo solo te recuerda lo que ya está en tu calendario compartido. Nada más, nada menos.
        </p>
      </div>
    `;
  }

  const rows = events
    .map((e) => {
      const start = formatTime(e.start);
      const end = formatTime(e.end);

      return `
        <tr>
          <td style="padding: 8px 12px; font-size: 13px; color: #9CA3AF; white-space: nowrap; vertical-align: top;">
            ${start} – ${end}
          </td>
          <td style="padding: 8px 12px; font-size: 14px; color: #E5E7EB; font-weight: 500; vertical-align: top;">
            ${e.title}
            <div style="margin-top: 2px; font-size: 12px; color: #9CA3AF;">
              ${e.groupLabel}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif; background: #020617; color: #E5E7EB; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 4px;">${displayName}, esto es lo que tienes hoy</h1>
      <p style="margin: 0 0 16px; color: #9CA3AF; font-size: 13px;">
        ${dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="margin: 0; color: #6B7280; font-size: 12px;">
        Este correo solo resume lo que ya está en SyncPlans. No reemplaza tus decisiones, solo te evita discusiones por cosas que ya se habían coordinado.
      </p>
    </div>
  `;
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // 1️⃣ Seguridad
    if (!isAuthorized(req)) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getAdminSupabase();
    const resend = getResend();
    const { startISO, endISO, label } = todayRangeISO();

    // 2️⃣ Usuarios con resumen diario activo
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("daily_summary", true);

    if (usersErr) {
      console.error("[daily-reminders] error fetching user_settings", usersErr);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch user settings" },
        { status: 500 }
      );
    }

    const userIds = (users || []).map((u: DbUserSettings) => u.user_id);
    if (!userIds.length) {
      return NextResponse.json({ ok: true, sent: 0, message: "No users" });
    }

    // 3️⃣ Perfiles con email
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .in("user_id", userIds);

    if (profilesErr) {
      console.error("[daily-reminders] error fetching profiles", profilesErr);
      return NextResponse.json(
        { ok: false, message: "Failed to fetch profiles" },
        { status: 500 }
      );
    }

    const profileByUser = new Map<string, DbProfile>();
    (profiles || []).forEach((p: DbProfile) => {
      profileByUser.set(p.user_id, p);
    });

    let sent = 0;

    // 4️⃣ Para cada usuario, buscamos eventos del día y mandamos resumen
    for (const userId of userIds) {
      const profile = profileByUser.get(userId);
      const email = profile?.email;
      if (!email) continue;

      const { data: events, error: eventsErr } = await supabase
        .from("events_with_groups_daily_view")
        .select(
          "id, title, start, end, group_id, group_type, group_name"
        )
        .eq("user_id", userId)
        .gte("start", startISO)
        .lt("end", endISO)
        .order("start", { ascending: true });

      if (eventsErr) {
        console.error(
          `[daily-reminders] error fetching events for user ${userId}`,
          eventsErr
        );
        continue;
      }

      const mapped = mapEvents((events || []) as DbEvent[]);
      const html = renderEmailHtml(
        label,
        profile?.first_name || profile?.last_name,
        mapped
      );

      try {
        const res = await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject: `Tu día en SyncPlans (${label})`,
          html,
        });

        if (res.error) {
          console.error(
            `[daily-reminders] error sending email to ${email}`,
            res.error
          );
        } else {
          sent++;
        }
      } catch (sendErr) {
        console.error(
          `[daily-reminders] unexpected error sending email to ${email}`,
          sendErr
        );
      }
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[daily-reminders] cron failed", err);
    return NextResponse.json(
      { ok: false, message: "Cron failed" },
      { status: 500 }
    );
  }
}