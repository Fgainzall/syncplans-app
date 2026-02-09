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

// Lazy init para que el build no reviente si faltan envs en local
function getAdminSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin env vars");
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
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

  // Ajustamos a Lima
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

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    // 1️⃣ Seguridad
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== CRON_SECRET) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Clients (solo aquí, no en top-level)
    const supabase = getAdminSupabase();
    const resend = getResend();

    const { startISO, endISO, label } = todayRangeISO();

    // 3️⃣ Usuarios con resumen diario activo
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("daily_summary", true); // 👈 usamos daily_summary, no event_reminders

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;

    // 4️⃣ Loop usuarios
    for (const u of users) {
      const uid = u.user_id;

      // Email del usuario
      const { data: authUser, error: authErr } = await supabase
        .from("auth.users")
        .select("email")
        .eq("id", uid)
        .maybeSingle();

      if (authErr) throw authErr;

      const email = (authUser as any)?.email;
      if (!email) continue;

      // Eventos de HOY
      const { data: events, error: evErr } = await supabase
        .from("events")
        .select("title, start, end, group_id")
        .eq("user_id", uid)
        .gte("start", startISO)
        .lt("start", endISO)
        .order("start", { ascending: true });

      if (evErr) throw evErr;
      if (!events || events.length === 0) continue;

      // Payload para el email
      const payload = events.map((e) => ({
        title: e.title || "Evento",
        start: e.start,
        end: e.end,
        groupLabel: e.group_id ? "Compartido" : "Personal",
      }));

      const listHtml = payload
        .map(
          (e) =>
            `<li><strong>${formatTime(e.start)} – ${formatTime(
              e.end
            )}</strong> · ${e.title} <span style="color:#9ca3af;">(${e.groupLabel})</span></li>`
        )
        .join("");

      const html = `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#0f172a;">
          <h2 style="margin-bottom:4px;">Tus eventos de hoy</h2>
          <p style="margin-top:0;margin-bottom:12px;color:#6b7280;">${label}</p>
          <ul style="padding-left:20px;margin-top:0;margin-bottom:16px;">
            ${listHtml}
          </ul>
          <p style="font-size:12px;color:#9ca3af;">
            Enviado por SyncPlans · Organiza tu día sin choques de horario.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: "Tus eventos de hoy · SyncPlans",
        html,
      });

      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[daily-reminders]", err);
    return NextResponse.json(
      { ok: false, message: "Cron failed" },
      { status: 500 }
    );
  }
}
