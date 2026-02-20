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
// Helpers de fechas
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
// Tipos
// ─────────────────────────────────────────────
type WeeklyUserRow = {
  user_id: string;
};

type WeeklyEventRow = {
  title: string | null;
  start: string;
  end: string;
  group_id: string | null;
};

// ─────────────────────────────────────────────
// Render de correo
// ─────────────────────────────────────────────
function renderWeeklyHtml(opts: {
  dateLabel: string;
  events: WeeklyEventRow[];
  busiestLabel: string | null;
}) {
  const { dateLabel, events, busiestLabel } = opts;
  const total = events.length;
  const shared = events.filter((e) => e.group_id).length;
  const personal = total - shared;

  const rows = events
    .slice(0, 10) // top 10 para no hacer correos infinitos
    .map((e) => {
      const localStart = toLocalDate(e.start);
      const dayLabel = localStart.toLocaleDateString("es-PE", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      const timeLabel = localStart.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const title = e.title || "Evento sin título";
      const scope = e.group_id ? "Compartido" : "Personal";

      return `
        <tr>
          <td style="padding: 6px 10px; font-size: 12px; color: #9CA3AF; white-space: nowrap; vertical-align: top;">
            ${dayLabel}<br />
            <span style="font-size: 11px; color:#6B7280;">${timeLabel}</span>
          </td>
          <td style="padding: 6px 10px; font-size: 13px; color: #E5E7EB; vertical-align: top;">
            ${title}
            <div style="margin-top: 2px; font-size: 11px; color: #9CA3AF;">
              ${scope}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const busiestBlock = busiestLabel
    ? `<p style="margin: 0 0 8px; font-size: 13px; color: #E5E7EB;">
         <strong>Día más cargado:</strong> ${busiestLabel}
       </p>`
    : "";

  return `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'SF Pro Text',sans-serif;background:#020617;color:#E5E7EB;padding:24px;">
      <div style="max-width:520px;margin:0 auto;background:#020617;border-radius:18px;border:1px solid rgba(148,163,184,0.25);box-shadow:0 18px 60px rgba(15,23,42,0.9);padding:20px 18px;">
        <h1 style="font-size:18px;margin:0 0 4px;">Tu semana en SyncPlans</h1>
        <p style="margin:0 0 12px;font-size:13px;color:#9CA3AF;">
          ${dateLabel}
        </p>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
          <div style="flex:1;min-width:120px;border-radius:999px;background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.35);padding:8px 12px;">
            <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Total</div>
            <div style="font-size:16px;font-weight:600;color:#F9FAFB;">${total}</div>
          </div>
          <div style="flex:1;min-width:120px;border-radius:999px;background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.35);padding:8px 12px;">
            <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Compartidos</div>
            <div style="font-size:16px;font-weight:600;color:#F9FAFB;">${shared}</div>
          </div>
          <div style="flex:1;min-width:120px;border-radius:999px;background:rgba(15,23,42,0.9);border:1px solid rgba(148,163,184,0.35);padding:8px 12px;">
            <div style="font-size:11px;color:#9CA3AF;margin-bottom:2px;">Personales</div>
            <div style="font-size:16px;font-weight:600;color:#F9FAFB;">${personal}</div>
          </div>
        </div>

        ${busiestBlock}

        ${
          rows
            ? `
          <table style="width:100%;border-collapse:collapse;margin-top:12px;">
            <tbody>
              ${rows}
            </tbody>
          </table>
        `
            : ""
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
    for (const u of users as WeeklyUserRow[]) {
      const uid = u.user_id;
      try {
        const { data: adminUser, error: adminErr } =
          await supabase.auth.admin.getUserById(uid);

        if (adminErr) {
          console.error(
            "[weekly-summary] error fetching auth user",
            uid,
            adminErr
          );
          continue;
        }

        const email = adminUser?.user?.email;
        if (!email) {
          console.warn(
            "[weekly-summary] user without email, skipping",
            uid
          );
          continue;
        }

        // 4️⃣ Eventos de la semana para este usuario
        const { data: events, error: evErr } = await supabase
          .from("events")
          .select("title, start, end, group_id")
          .eq("user_id", uid)
          .gte("start", startISO)
          .lt("start", endISO)
          .order("start", { ascending: true });

        if (evErr) {
          console.error(
            "[weekly-summary] error fetching events",
            uid,
            evErr
          );
          continue;
        }
        if (!events || events.length === 0) {
          continue;
        }

        const typedEvents = events as WeeklyEventRow[];
        const total = typedEvents.length;

        // Día más cargado
        const byDay: Record<string, number> = {};
        for (const ev of typedEvents) {
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

        let busiestLabel: string | null = null;
        if (busiestKey) {
          const [y, m, d] = busiestKey.split("-").map(Number);
          const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
          busiestLabel = dt.toLocaleDateString("es-PE", {
            weekday: "long",
            day: "numeric",
            month: "short",
          });
        }

        if (total === 0) {
          continue;
        }

        const html = renderWeeklyHtml({
          dateLabel: label,
          events: typedEvents,
          busiestLabel,
        });

        try {
          const res = await resend.emails.send({
            from: EMAIL_FROM,
            to: email,
            subject: `Tu semana en SyncPlans (${label})`,
            html,
          });

          if (res.error) {
            console.error(
              `[weekly-summary] error sending email to ${email}`,
              res.error
            );
          } else {
            sent++;
          }
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