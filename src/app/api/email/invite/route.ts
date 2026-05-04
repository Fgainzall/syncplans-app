// src/app/api/email/invite/route.ts
import { Resend } from "resend";
import {
  checkRateLimit,
  createSupabaseUserClient,
  getAuthenticatedUser,
  getClientIp,
  isLikelyEmail,
  isUuid,
  rateLimitHeaders,
  readJsonBody,
  requiredServerEnv,
} from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  logRequestStart,
  maskEmail,
  safeError,
  type ApiRequestContext,
} from "@/lib/apiObservability";

type InviteEmailRequestBody = {
  email?: unknown;
  inviteId?: unknown;
  groupId?: unknown;
};

type GroupInviteRow = {
  id: string;
  group_id: string;
  email: string | null;
  invited_email: string | null;
  invited_by: string | null;
  status: string | null;
  role: string | null;
  created_at: string | null;
};

type ResendErrorLike = {
  message?: string;
};

const MAX_BODY_BYTES = 2_000;
const EMAIL_RATE_LIMIT_WINDOW_SECONDS = 60;
const EMAIL_RATE_LIMIT_MAX_ATTEMPTS = 5;
const EMAIL_DAILY_LIMIT_WINDOW_SECONDS = 24 * 60 * 60;
const EMAIL_DAILY_LIMIT_MAX_ATTEMPTS = 30;

function normEmail(value: string) {
  return String(value || "").trim().toLowerCase();
}

function baseUrl() {
  const raw =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  return raw.replace(/\/$/, "");
}

function optionalEnv(primaryName: string, fallbackName?: string) {
  const primary = String(process.env[primaryName] ?? "").trim();
  if (primary) return primary;

  if (!fallbackName) return "";
  return String(process.env[fallbackName] ?? "").trim();
}

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function inviteEmailHtml(opts: { acceptUrl: string; appUrl: string }) {
  const { acceptUrl, appUrl } = opts;
  const safeAcceptUrl = escapeHtml(acceptUrl);
  const safeAppUrl = escapeHtml(appUrl);

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

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0 14px;">
        <tr>
          <td align="center" bgcolor="#2563eb" style="border-radius:12px;">
            <a href="${safeAcceptUrl}"
               target="_blank"
               style="display:inline-block;padding:12px 20px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;">
              Aceptar invitación ✅
            </a>
          </td>
        </tr>
      </table>

      <div style="margin-top:14px;padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,0.10);background:rgba(0,0,0,0.20);">
        <div style="font-size:12px;opacity:0.85;font-weight:800;margin-bottom:6px;">Si el botón no abre:</div>
        <div style="font-size:12px;opacity:0.75;word-break:break-all;line-height:1.45;">
          <a href="${safeAcceptUrl}" target="_blank" style="color:rgba(56,189,248,0.95);text-decoration:none;">${safeAcceptUrl}</a>
        </div>
      </div>

      <p style="margin:14px 0 0;font-size:12px;opacity:0.65;line-height:1.45;">
        Si no esperabas esta invitación, puedes ignorar este correo.
      </p>

      <div style="margin-top:16px;font-size:11px;opacity:0.55;">
        ${safeAppUrl}
      </div>
    </div>
  </div>
  `;
}

function publicError(
  ctx: ApiRequestContext,
  error: string,
  code: string,
  status: number,
  log?: Record<string, unknown>
) {
  return jsonError(ctx, {
    error,
    code,
    status,
    log,
  });
}

function isPendingInvite(invite: GroupInviteRow) {
  return String(invite.status ?? "pending").trim().toLowerCase() === "pending";
}

function inviteRecipientEmail(invite: GroupInviteRow) {
  return normEmail(invite.invited_email ?? invite.email ?? "");
}

async function loadInviteForCurrentUser(req: Request, inviteId: string) {
  const supabase = await createSupabaseUserClient(req);

  return supabase
    .from("group_invites")
    .select("id,group_id,email,invited_email,invited_by,status,role,created_at")
    .eq("id", inviteId)
    .maybeSingle<GroupInviteRow>();
}

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "email-invite" });

  try {
    const auth = await getAuthenticatedUser(req, ctx);

    if (!auth.ok) return auth.response;

    const body = (await readJsonBody(req, MAX_BODY_BYTES)) as InviteEmailRequestBody;

    const email = normEmail(String(body.email ?? ""));
    const inviteId = String(body.inviteId ?? "").trim();
    const requestedGroupId = String(body.groupId ?? "").trim();

    if (!isLikelyEmail(email) || !isUuid(inviteId)) {
      return publicError(
        ctx,
        "Falta email válido o inviteId válido.",
        "EMAIL_INVALID_INVITE_REQUEST",
        400
      );
    }

    if (requestedGroupId && !isUuid(requestedGroupId)) {
      return publicError(ctx, "groupId inválido.", "EMAIL_INVALID_GROUP_ID", 400);
    }

    const shortLimit = await checkRateLimit({
      prefix: "email-invite-short",
      keyParts: [auth.user.id, getClientIp(req), email],
      limit: EMAIL_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: EMAIL_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!shortLimit.allowed) {
      return jsonError(ctx, {
        error: "Demasiados envíos. Intenta nuevamente en unos segundos.",
        code: "EMAIL_INVITE_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(shortLimit),
        log: { userId: auth.user.id, email: maskEmail(email) },
      });
    }

    const dailyLimit = await checkRateLimit({
      prefix: "email-invite-daily",
      keyParts: [auth.user.id],
      limit: EMAIL_DAILY_LIMIT_MAX_ATTEMPTS,
      windowSeconds: EMAIL_DAILY_LIMIT_WINDOW_SECONDS,
    });

    if (!dailyLimit.allowed) {
      return jsonError(ctx, {
        error: "Límite diario de invitaciones alcanzado.",
        code: "EMAIL_INVITE_DAILY_LIMITED",
        status: 429,
        headers: rateLimitHeaders(dailyLimit),
        log: { userId: auth.user.id },
      });
    }

    const { data: invite, error: inviteError } = await loadInviteForCurrentUser(req, inviteId);

    if (inviteError) {
      return publicError(
        ctx,
        "No se pudo validar la invitación.",
        "EMAIL_INVITE_LOOKUP_FAILED",
        500,
        { error: safeError(inviteError) }
      );
    }

    if (!invite) {
      return publicError(ctx, "Invitación no encontrada.", "EMAIL_INVITE_NOT_FOUND", 404);
    }

    if (invite.invited_by !== auth.user.id) {
      return publicError(
        ctx,
        "No tienes permisos para enviar esta invitación.",
        "EMAIL_INVITE_FORBIDDEN",
        403,
        { userId: auth.user.id, inviteId }
      );
    }

    if (requestedGroupId && requestedGroupId !== invite.group_id) {
      return publicError(
        ctx,
        "La invitación no pertenece a ese grupo.",
        "EMAIL_INVITE_GROUP_MISMATCH",
        403,
        { inviteId, requestedGroupId }
      );
    }

    const invitedEmail = inviteRecipientEmail(invite);

    if (!invitedEmail || invitedEmail !== email) {
      return publicError(
        ctx,
        "El email no coincide con la invitación.",
        "EMAIL_INVITE_EMAIL_MISMATCH",
        403,
        { inviteId, requestedEmail: maskEmail(email), invitedEmail: maskEmail(invitedEmail) }
      );
    }

    if (!isPendingInvite(invite)) {
      return publicError(ctx, "La invitación ya no está pendiente.", "EMAIL_INVITE_NOT_PENDING", 409);
    }

    let resendKey = "";

    try {
      resendKey = requiredServerEnv("RESEND_API_KEY");
    } catch {
      return publicError(
        ctx,
        "Configuración de email incompleta.",
        "EMAIL_RESEND_API_KEY_MISSING",
        500
      );
    }

    const from = optionalEnv("EMAIL_FROM", "RESEND_FROM");

    if (!from) {
      return publicError(
        ctx,
        "Configuración de remitente incompleta.",
        "EMAIL_FROM_MISSING",
        500
      );
    }

    const appUrl = baseUrl();
    const acceptUrl = `${appUrl}/invitations/accept?invite=${encodeURIComponent(
      invite.id
    )}&groupId=${encodeURIComponent(invite.group_id)}`;

    const resend = new Resend(resendKey);
    const subject = "Te invitaron a un grupo en SyncPlans";
    const html = inviteEmailHtml({ acceptUrl, appUrl });

    const { data, error } = await resend.emails.send({
      from,
      to: invitedEmail,
      subject,
      html,
    });

    if (error) {
      return jsonError(ctx, {
        error: (error as ResendErrorLike | null)?.message || "Resend error",
        code: "EMAIL_PROVIDER_REJECTED",
        status: 502,
        log: {
          userId: auth.user.id,
          inviteId,
          email: maskEmail(invitedEmail),
          error: safeError(error),
        },
      });
    }

    return jsonOk(
      ctx,
      {
        id: data?.id ?? null,
        acceptUrl,
      },
      {
        headers: rateLimitHeaders(shortLimit),
        log: { userId: auth.user.id, inviteId },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return publicError(ctx, "Payload demasiado grande.", "EMAIL_INVALID_BODY", 400);
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return publicError(ctx, "JSON inválido.", "EMAIL_INVALID_BODY", 400);
    }

    return publicError(
      ctx,
      "Error enviando email.",
      "EMAIL_INVITE_FAILED",
      500,
      { error: safeError(error) }
    );
  }
}
