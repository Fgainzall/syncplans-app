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

const TZ_OFFSET_HOURS = -5;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function thisWeekRangeISO() {
  const now = new Date();
  const local = new Date(
    now.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000
  );

  // Tomamos lunes como inicio de semana
  const day = local.getDay(); // 0 = domingo, 1 = lunes...
  const diffToMonday = (day + 6) % 7; // 0 si ya es lunes

  const start = new Date(
    local.getFullYear(),
    local.getMonth(),
    local.getDate() - diffToMonday,
    0,
    0,
    0
  );
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const label = `${start.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  })} – ${end.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "short",
  })}`;

  return {
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    label,
  };
}

// ─────────────────────────────────────────────
// POST
// ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== CRON_SECRET) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const supabase = getAdminSupabase();
    const resend = getResend();

    const { startISO, endISO, label } = thisWeekRangeISO();

    // Usuarios con resumen semanal activo
    const { data: users, error: usersErr } = await supabase
      .from("user_settings")
      .select("user_id")
      .eq("weekly_summary", true);

    if (usersErr) throw usersErr;
    if (!users || users.length === 0) {
      return NextResponse.json({ ok: true, sent: 0 });
    }

    let sent = 0;

    for (const u of users) {
      const uid = u.user_id;

      const { data: authUser, error: authErr } = await supabase
        .from("auth.users")
        .select("email")
        .eq("id", uid)
        .maybeSingle();

      if (authErr) throw authErr;

      const email = (authUser as any)?.email;
      if (!email) continue;

      const { data: events, error: evErr } = await supabase
        .from("events")
        .select("title, start, end, group_id")
        .eq("user_id", uid)
        .gte("start", startISO)
        .lt("start", endISO)
        .order("start", { ascending: true });

      if (evErr) throw evErr;
      if (!events || events.length === 0) continue;

      const total = events.length;

      const html = `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#0f172a;">
          <h2 style="margin-bottom:4px;">Tu semana en SyncPlans</h2>
          <p style="margin-top:0;margin-bottom:8px;color:#6b7280;">${label}</p>
          <p style="margin-top:0;margin-bottom:12px;">
            Tienes <strong>${total}</strong> eventos organizados para esta semana.
          </p>
          <p style="font-size:12px;color:#9ca3af;">
            Enviado por SyncPlans · Una sola verdad para los horarios compartidos.
          </p>
        </div>
      `;

      await resend.emails.send({
        from: EMAIL_FROM,
        to: email,
        subject: "Tu semana con SyncPlans",
        html,
      });

      sent++;
    }

    return NextResponse.json({ ok: true, sent });
  } catch (err) {
    console.error("[weekly-summary]", err);
    return NextResponse.json(
      { ok: false, message: "Weekly cron failed" },
      { status: 500 }
    );
  }
}
