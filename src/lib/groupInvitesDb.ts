// src/lib/groupInvitesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import { inviteToGroup as inviteToGroupCore } from "@/lib/invitationsDb";
import { getMyGroups, getGroupDisplayName } from "@/lib/groupsDb";

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
const { data: sessionData } = await supabase.auth.getSession();
const accessToken = sessionData.session?.access_token ?? "";

if (!accessToken) {
  return {
    email_sent: false,
    accept_url,
    warning: "Invitación creada, pero no se pudo enviar el email porque la sesión expiró.",
  };
}

const response = await fetch("/api/email/invite", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${accessToken}`,
  },
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
} catch (e: unknown) {
  return {
    email_sent: false,
    accept_url,
    warning:
      e instanceof Error
        ? e.message
        : "Invitación creada, pero falló el envío de email.",
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

export type SentGroupInvitation = {
  id: string;
  group_id: string;
  group_name: string | null;
  group_type: string | null;
  invited_email: string;
  status: string;
  created_at: string | null;
  accept_url: string;
};

type GroupInviteDbRow = {
  id?: unknown;
  group_id?: unknown;
  invited_email?: unknown;
  status?: unknown;
  created_at?: unknown;
};

/**
 * Invitaciones creadas desde los grupos del usuario.
 *
 * Nota de producto: lo mostramos como “enviadas desde tus grupos” para evitar
 * prometer autoría exacta si la tabla no expone created_by/invited_by en todas
 * las instalaciones. En la práctica, para el owner/admin es el tracking que
 * necesita: quién todavía falta aceptar en sus espacios.
 */
export async function getSentGroupInvitations(): Promise<SentGroupInvitation[]> {
  const myGroups = await getMyGroups();
  const groups = Array.isArray(myGroups) ? myGroups : [];

  const groupIds = groups
    .map((group) => String(group.id ?? "").trim())
    .filter(Boolean);

  if (groupIds.length === 0) return [];

  const groupById = new Map(
    groups.map((group) => [
      String(group.id),
      {
        name: getGroupDisplayName(group),
        type: String(group.type ?? "other"),
      },
    ])
  );

  const { data, error } = await supabase
    .from("group_invites")
    .select("id, group_id, invited_email, status, created_at")
    .in("group_id", groupIds)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (Array.isArray(data) ? data : []) as GroupInviteDbRow[];

  return rows
    .map((row) => {
      const id = String(row.id ?? "").trim();
      const groupId = String(row.group_id ?? "").trim();
      const invitedEmail = cleanEmail(String(row.invited_email ?? ""));
      const group = groupById.get(groupId) ?? { name: null, type: null };

      if (!id || !groupId || !invitedEmail) return null;

      return {
        id,
        group_id: groupId,
        group_name: group.name,
        group_type: group.type,
        invited_email: invitedEmail,
        status: String(row.status ?? "pending").trim() || "pending",
        created_at: row.created_at == null ? null : String(row.created_at),
        accept_url: `${clientBaseUrl()}/invitations/accept?invite=${encodeURIComponent(id)}`,
      } satisfies SentGroupInvitation;
    })
    .filter((row): row is SentGroupInvitation => Boolean(row));
}
