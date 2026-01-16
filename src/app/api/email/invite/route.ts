// src/app/api/email/invite/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

function normEmail(x: string) {
  return String(x || "").trim().toLowerCase();
}

function baseUrl() {
  // Prioridad:
  // 1) APP_URL (server-only, recomendado)
  // 2) NEXT_PUBLIC_APP_URL (por compat)
  // 3) VERCEL_URL (si no seteaste APP_URL)
  // 4) localhost
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  return raw.replace(/\/$/, "");
}

function requiredEnv(name: string) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : "";
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inviteEmailHtml(opts: { acceptUrl: string; appUrl: string }) {
  const { acceptUrl, appUrl } = opts;

  // template “premium” simple, responsive, sin dependencias
  return `
  <div style="background:#050816;padding:24px 12px;">
    <div style="max-width:560px;margin:0 auto;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);border-radius:18px;padding:18px 18px 16px;font-family:Arial,Helvetica,sans-serif;color:rgba(255,255,255,0.92);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <div style="width:12px;height:12px;border-radius:999px;background:rgba(56,189,248,0.95);box-shadow:0 0 24px rgba(56,189,248,0.55)"></div>
        <div style="font-weight:900;letter-spacing:-0.3px;">SyncPlans</div>
      </div>

      <h2 style="margin:10px 0 6px;font-size:18px;letter-spacing:-0.2px;">
        Te invitaron a un grupo
      </h2>

      <p style="margin:0 0 14px;line-height:1.5;color:rgba(255,255,255,0.82);font-size:13px;">
        Abre la invitación para unirte y sincronizar horarios.
      </p>

      <div style="margin:16px 0 14px;">
        <a href="${acceptUrl}"
          style="display:inline-block;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,0.14);background:linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22));color:rgba(255,255,255,0.95);text-decoration:none;font-weight:900;">
          Aceptar invitación ✅
        </a>
      </div>

      <div style="margin-top:14px;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.20);">
        <div style="font-size:12px;opacity:0.85;font-weight:800;margin-bottom:6px;">Si el botón no abre:</div>
        <div style="font-size:12px;opacity:0.75;word-break:break-all;line-height:1.45;">
          <a href="${acceptUrl}" style="color:rgba(56,189,248,0.95);text-decoration:none;">${acceptUrl}</a>
        </div>
      </div>

      <p style="margin:14px 0 0;font-size:12px;opacity:0.65;line-height:1.45;">
        Si no esperabas esta invitación, puedes ignorar este correo.
      </p>

      <div style="margin-top:16px;font-size:11px;opacity:0.55;">
        ${escapeHtml(appUrl)}
      </div>
    </div>
  </div>
  `;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const email = normEmail(body?.email);
    const inviteId = String(body?.inviteId ?? "").trim();
    const groupId = String(body?.groupId ?? "").trim();

    if (!email || !email.includes("@") || !inviteId) {
      return NextResponse.json(
        { ok: false, error: "Falta email válido o inviteId" },
        { status: 400 }
      );
    }

    const resendKey = requiredEnv("RESEND_API_KEY");
    if (!resendKey) {
      return NextResponse.json(
        { ok: false, error: "Falta RESEND_API_KEY" },
        { status: 500 }
      );
    }

    // FROM:
    // 1) Usa RESEND_FROM si está definido
    // 2) Si no, usa por defecto el dominio verificado en Resend
    const fromEnv = requiredEnv("RESEND_FROM");
    const from = fromEnv || "SyncPlans <noreply@syncplansapp.com>";

    const appUrl = baseUrl();
    const acceptUrl =
      `${appUrl}/invitations/accept?invite=${encodeURIComponent(inviteId)}` +
      (groupId ? `&groupId=${encodeURIComponent(groupId)}` : "");

    const resend = new Resend(resendKey);

    const subject = "Te invitaron a un grupo en SyncPlans";
    const html = inviteEmailHtml({ acceptUrl, appUrl });

    const { data, error } = await resend.emails.send({
      from,
      to: email,
      subject,
      html,
    });

    if (error) {
      console.error("[resend] send error:", error);
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Resend error",
          debug: { from, to: email, appUrl },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null, acceptUrl });
  } catch (e: any) {
    console.error("[api/email/invite] unexpected error:", e);
    return NextResponse.json(
      { ok: false, error: e?.message ?? "Error enviando email" },
      { status: 500 }
    );
  }
}
