// src/lib/groupInvitesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import { inviteToGroup as inviteToGroupCore } from "@/lib/invitationsDb";

export type InviteResult =
  | {
      ok: true;
      invite_id: string;
      group_id: string;
      invited_email: string;
      status: string;
      email_sent?: boolean;
      accept_url?: string;
      warning?: string;
    }
  | { ok: false; error: string };

function cleanEmail(email: string) {
  return String(email ?? "").trim().toLowerCase();
}

function clientBaseUrl() {
  const env = String(process.env.NEXT_PUBLIC_APP_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  if (env) return env;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

async function trySendEmail(
  inviteId: string,
  groupId: string,
  invitedEmail: string
) {
  const base = clientBaseUrl();
  const accept_url = `${base}/invitations/accept?invite=${encodeURIComponent(
    inviteId
  )}`;

  try {
    const response = await fetch("/api/email/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: invitedEmail,
        inviteId,
        groupId,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));

      return {
        email_sent: false,
        accept_url,
        warning:
          body?.error || "Invitación creada, pero no se pudo enviar el email.",
      };
    }

    return {
      email_sent: true,
      accept_url,
    };
  } catch (e: any) {
    return {
      email_sent: false,
      accept_url,
      warning:
        e?.message || "Invitación creada, pero falló el envío de email.",
    };
  }
}

/**
 * Wrapper fino:
 * - delega la creación REAL a invitationsDb.ts
 * - se encarga solo del envío de email / accept_url
 *
 * Así dejamos una sola capa de negocio para la invitación.
 */
export async function inviteToGroup(params: {
  groupId: string;
  email: string;
  role?: "member" | "admin" | "owner" | string;
}): Promise<InviteResult> {
  const groupId = String(params.groupId ?? "").trim();
  const invitedEmail = cleanEmail(params.email);
  const role = String(params.role ?? "member").trim() || "member";

  if (!groupId) return { ok: false, error: "Falta el grupo." };
  if (!invitedEmail) return { ok: false, error: "Escribe un email." };

  /**
   * Ya no duplicamos aquí la lógica RPC/insert.
   * La capa canónica es invitationsDb.ts.
   */
  const result = await inviteToGroupCore({
    groupId,
    email: invitedEmail,
    role,
  });

  if (!result.ok || !result.invite_id) {
    return {
      ok: false,
      error: result.error || "No se pudo invitar.",
    };
  }

  /**
   * Si la capa base ya sabe que el email salió correctamente, respetamos eso.
   * Si no, intentamos el envío desde aquí.
   */
  if (result.email_sent === true) {
    return {
      ok: true,
      invite_id: result.invite_id,
      group_id: groupId,
      invited_email: result.invited_email ?? invitedEmail,
      status: "pending",
      email_sent: true,
      accept_url: `${clientBaseUrl()}/invitations/accept?invite=${encodeURIComponent(
        result.invite_id
      )}`,
    };
  }

  const mail = await trySendEmail(
    result.invite_id,
    groupId,
    result.invited_email ?? invitedEmail
  );

  return {
    ok: true,
    invite_id: result.invite_id,
    group_id: groupId,
    invited_email: result.invited_email ?? invitedEmail,
    status: "pending",
    ...mail,
  };
}