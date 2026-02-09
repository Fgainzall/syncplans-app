// src/app/api/daily-digest/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const EMAIL_FROM =
  process.env.EMAIL_FROM || "SyncPlans <no-reply@syncplansapp.com>";

type EventPayload = {
  title: string;
  start: string;
  end: string;
  groupLabel: string;
};

function getResend() {
  if (!RESEND_API_KEY) {
    throw new Error("Missing RESEND_API_KEY env var");
  }
  return new Resend(RESEND_API_KEY);
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const to = String(body.to || "").trim();
    const dateLabel = String(body.date || "").trim();
    const events = (body.events || []) as EventPayload[];

    if (!to || !events.length) {
      return NextResponse.json(
        { ok: false, message: "Faltan destinatario o eventos." },
        { status: 400 }
      );
    }

    const resend = getResend();

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
             <strong>${formatTime(e.start)} – ${formatTime(
            e.end
          )}</strong> · ${e.title}
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

    await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[daily-digest] error", err);
    return NextResponse.json(
      { ok: false, message: "Error enviando el correo" },
      { status: 500 }
    );
  }
}
