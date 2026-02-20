import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const CRON_SECRET = process.env.CRON_SECRET || "";

// Tipamos explícito el admin client para que TS no moleste
type AdminClient = SupabaseClient<any, "public", any>;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "[daily-digest] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en env"
  );
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

// ───────────────────────────── helpers de auth ───────────────────────────────

function isAuthorized(req: Request): boolean {
  // Si no hay CRON_SECRET configurado, no bloqueamos (útil en desarrollo/local)
  if (!CRON_SECRET) return true;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");

  // ✅ Permitimos:
  // - ?token=CRON_SECRET        (llamadas manuales tipo /api/daily-digest?token=...)
  // - x-cron-secret: CRON_SECRET  (si algún día quieres usarlo desde otra infra)
  // - Authorization: Bearer CRON_SECRET  (lo que envía Vercel Cron automáticamente)
  if (token && token === CRON_SECRET) return true;
  if (headerSecret && headerSecret === CRON_SECRET) return true;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken === CRON_SECRET) return true;
  }

  return false;
}

// ───────────────────────────── helpers de formato ────────────────────────────

type EventPayload = {
  title: string;
  start: string;
  end: string;
  groupLabel: string;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(isoDayStart: string) {
  const d = new Date(isoDayStart);
  return d.toLocaleDateString("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function buildDailyDigestHtml(
  dateLabel: string,
  events: EventPayload[]
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
    .map(
      (e) =>
        `<li style="margin-bottom:6px;">
           <strong>${formatTime(e.start)} – ${formatTime(e.end)}</strong> · ${
          e.title
        }
           <span style="color:#9ca3af;"> (${e.groupLabel})</span>
         </li>`
    )
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

  const memberGroupIds = (memberships ?? [])
    .map((m: any) => m.group_id as string | null)
    .filter(Boolean) as string[];

  // 2) eventos personales + de esos grupos
  let query = client
    .from("events")
    .select("id, title, start, end, group_id")
    .gte("start", dayStartIso)
    .lt("start", dayEndIso);

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

  let groupMap: Record<
    string,
    { name: string | null; type: string | null }
  > = {};

  if (groupIds.length > 0) {
    const { data: groups, error: gErr } = await client
      .from("groups")
      .select("id, name, type")
      .in("id", groupIds);

    if (gErr) throw gErr;

    for (const g of groups ?? []) {
      groupMap[String((g as any).id)] = {
        name: (g as any).name ?? null,
        type: (g as any).type ?? null,
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

async function runDailyDigest(dateParam: string | null) {
  try {
    const supabaseAdmin = getAdminClient();
    const resend = getResend();

    // Día base (UTC) – puedes pasar ?date=2026-02-09 para testear
    const todayIso = dateParam
      ? `${dateParam}T00:00:00.000Z`
      : new Date().toISOString().slice(0, 10) + "T00:00:00.000Z";

    const dayStartIso = todayIso;
    const dayEndIso =
      new Date(new Date(dayStartIso).getTime() + 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 19) + "Z";

    // 1) usuarios que tienen daily_summary = true
    const { data: settings, error: settingsErr } = await supabaseAdmin
      .from("user_settings")
      .select("user_id, daily_summary")
      .eq("daily_summary", true);

    if (settingsErr) throw settingsErr;

    const targets = (settings ?? []).map((s: any) => String(s.user_id));
    if (targets.length === 0) {
      return NextResponse.json({ ok: true, message: "No users to notify" });
    }

    // 2) recorremos usuarios (por ahora secuencial está bien)
    const results: { userId: string; sent: boolean; reason?: string }[] = [];

    for (const userId of targets) {
      try {
        // 2.1) traemos el usuario para obtener el email
        const { data: userRes, error: userErr } =
          await supabaseAdmin.auth.admin.getUserById(userId);

        if (userErr) {
          results.push({
            userId,
            sent: false,
            reason: "auth_user_error",
          });
          continue;
        }

        const email = userRes?.user?.email;
        if (!email) {
          results.push({
            userId,
            sent: false,
            reason: "no_email",
          });
          continue;
        }

        // 2.2) eventos del día
        const events = await getEventsForUserOnDay(
          supabaseAdmin,
          userId,
          dayStartIso,
          dayEndIso
        );

        if (events.length === 0) {
          results.push({
            userId,
            sent: false,
            reason: "no_events",
          });
          continue;
        }

        const dateLabel = formatDateLabel(dayStartIso);
        const { html, subject } = buildDailyDigestHtml(dateLabel, events);

        await resend.emails.send({
          from: EMAIL_FROM,
          to: email,
          subject,
          html,
        });

        results.push({ userId, sent: true });
      } catch (innerErr) {
        console.error("[daily-digest] error con usuario", userId, innerErr);
        results.push({
          userId,
          sent: false,
          reason: "send_error",
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("[daily-digest] error global", err);
    return NextResponse.json(
      { ok: false, message: "Error ejecutando daily digest" },
      { status: 500 }
    );
  }
}

// ───────────────────────────── handlers GET & POST ───────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}
