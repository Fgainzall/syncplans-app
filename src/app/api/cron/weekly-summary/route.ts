import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "SyncPlans <no-reply@syncplansapp.com>";

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TZ_OFFSET_HOURS = -5;

function weekRangeISO() {
  const now = new Date();
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
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const label = `Próximos 7 días · desde ${start.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
  })} hasta ${end.toLocaleDateString("es-PE", {
    day: "numeric",
    month: "long",
  })}`;

  return { startISO: start.toISOString(), endISO: end.toISOString(), label };
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(req: Request) {
  try {
    const secret = req.headers.get("x-cron-secret");
    if (!secret || secret !== CRON_SECRET) {
      return NextResponse.json(
        { ok: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { startISO, endISO, label } = weekRangeISO();

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
        .from("auth.users" as any)
        .select("email")
        .eq("id", uid)
        .single();

      if (authErr) continue;
      const email = (authUser as any)?.email as string | undefined;
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

      // Agrupamos por día
      const byDay = new Map<string, { title: string; start: string; end: string; groupLabel: string }[]>();

      for (const e of events) {
        const d = new Date(e.start as string);
        const dayKey = d.toISOString().slice(0, 10);
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey)!.push({
          title: e.title || "Evento",
          start: e.start as string,
          end: e.end as string,
          groupLabel: e.group_id ? "Compartido" : "Personal",
        });
      }

      const sections: string[] = [];
      const sortedDays = Array.from(byDay.keys()).sort();

      for (const day of sortedDays) {
        const prettyDay = formatDay(day + "T00:00:00Z");
        const items = byDay.get(day)!;
        const list = items
          .map(
            (e) =>
              `<li style="margin-bottom:4px;"><strong>${formatTime(
                e.start
              )} – ${formatTime(
                e.end
              )}</strong> · ${e.title} <span style="color:#9ca3af;">(${e.groupLabel})</span></li>`
          )
          .join("");
        sections.push(`
          <section style="margin-bottom:12px;">
            <h3 style="margin:0 0 4px 0;font-size:13px;">${prettyDay}</h3>
            <ul style="padding-left:20px;margin:0;list-style:disc;">
              ${list}
            </ul>
          </section>
        `);
      }

      const html = `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;color:#0f172a;">
          <h2 style="margin-bottom:4px;">Tu semana en SyncPlans</h2>
          <p style="margin-top:0;margin-bottom:12px;color:#6b7280;">${label}</p>
          ${sections.join("")}
          <p style="font-size:12px;color:#9ca3af;margin-top:16px;">
            Enviado por SyncPlans · Decide mejor qué mantener y qué mover, sin discutir por memoria.
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
      { ok: false, message: "Cron failed" },
      { status: 500 }
    );
  }
}
