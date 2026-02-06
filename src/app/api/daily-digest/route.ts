// src/app/api/daily-digest/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EventPayload = {
  title: string;
  start: string;
  end: string;
  groupLabel: string;
};

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

    const from =
      process.env.EMAIL_FROM || "SyncPlans <no-reply@syncplansapp.com>";

    const formatTime = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    const listHtml = events
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
        <p style="margin-top:0;margin-bottom:12px;color:#6b7280;">${dateLabel}</p>
        <ul style="padding-left:20px;margin-top:0;margin-bottom:16px;">
          ${listHtml}
        </ul>
        <p style="font-size:12px;color:#9ca3af;">Enviado por SyncPlans · Organiza tu día sin choques de horario.</p>
      </div>
    `;

    await resend.emails.send({
      from,
      to,
      subject: `Tus eventos de hoy · SyncPlans`,
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
