// src/app/api/cron/weekly-summary/route.ts
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

  // Lunes como inicio de semana
  const day = local.getDay(); // 0 = domingo, 1 = lunes...
  const diffToMonday = (day + 6) % 7;

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

function toLocalDate(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() + TZ_OFFSET_HOURS * 60 * 60 * 1000);
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
      const shared = events.filter((e) => e.group_id).length;
      const personal = total - shared;

      // Día más cargado
      const byDay: Record<string, number> = {};
      for (const ev of events) {
        const local = toLocalDate(ev.start);
        const key = local.toISOString().slice(0, 10); // YYYY-MM-DD
        byDay[key] = (byDay[key] || 0) + 1;
      }

      let busiestKey: string | null = null;
      let busiestCount = 0;
      for (const [k, v] of Object.entries(byDay)) {
        if (v > busiestCount) {
          busiestCount = v;
          busiestKey = k;
        }
      }

      let busiestLabel = "";
      if (busiestKey) {
        const [y, m, d] = busiestKey.split("-").map(Number);
        const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
        busiestLabel = dt.toLocaleDateString("es-PE", {
          weekday: "long",
          day: "numeric",
          month: "short",
        });
      }

      const html = `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#0f172a;background-color:#020617;padding:24px;">
          <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid #1f2937;padding:20px;">
            <p style="font-size:11px;color:#9ca3af;margin:0 0 8px 0;">
              SyncPlans · Resumen semanal
            </p>
            <h2 style="margin:0 0 4px 0;font-size:20px;color:#e5e7eb;">
              Tu semana en SyncPlans
            </h2>
            <p style="margin:0 0 12px 0;color:#9ca3af;font-size:13px;">
              ${label}
            </p>

            <ul style="padding-left:18px;margin:0 0 14px 0;color:#e5e7eb;list-style-type:disc;">
              <li><strong>${total}</strong> evento${
        total > 1 ? "s" : ""
      } organizados en esta semana.</li>
              <li>${personal} personales · ${shared} compartidos.</li>
              ${
                busiestLabel
                  ? `<li>Día más cargado: <strong>${busiestLabel}</strong> (${busiestCount} evento${
                      busiestCount > 1 ? "s" : ""
                    }).</li>`
                  : ""
              }
            </ul>

            <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">
              Usa este correo como “cheat sheet” rápido: abre SyncPlans si necesitas ajustar algo.
            </p>
            <p style="margin:0;font-size:11px;color:#6b7280;">
              SyncPlans · Una sola verdad para los horarios compartidos.
            </p>
          </div>
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
