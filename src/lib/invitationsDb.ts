// src/lib/invitationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type GroupInvitationStatus = "pending" | "accepted" | "declined";

/**
 * Esta interfaz ES la que debe importar tu UI.
 * group_name / group_type vienen desde el join groups:group_id (name,type)
 */
export type GroupInvitation = {
  id: string;
  group_id: string;

  email: string | null;
  invited_email: string | null;

  role: string | null;
  status: GroupInvitationStatus | string;

  invited_by: string | null;
  created_at: string;
  accepted_at: string | null;

  // ✅ Enriquecidos (join)
  group_name: string | null;
  group_type: "personal" | "pair" | "family" | string | null;
};

export type RpcResult = {
  ok: boolean;
  group_id?: string;
  invite_id?: string;
  invited_email?: string;
  status?: string;
  error?: string;

  email_sent?: boolean;
  email_error?: string;
};

function normEmail(x: string) {
  return String(x || "").trim().toLowerCase();
}

async function requireAuthedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user?.id) throw new Error("Not authenticated");
  return { id: data.user.id, email: (data.user.email || "").toLowerCase() };
}

async function requireAuthedEmail(): Promise<string> {
  const { data: ses, error: sesErr } = await supabase.auth.getSession();
  if (sesErr) throw sesErr;

  const emailFromSession = ses.session?.user?.email;
  if (emailFromSession) return normEmail(emailFromSession);

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const email = data.user?.email;
  if (!email) throw new Error("No hay usuario autenticado (sin email).");
  return normEmail(email);
}

function mapRowToInvitation(r: any): GroupInvitation {
  return {
    id: r.id,
    group_id: r.group_id,
    email: r.email ?? null,
    invited_email: r.invited_email ?? null,
    role: r.role ?? null,
    status: r.status,
    invited_by: r.invited_by ?? null,
    created_at: r.created_at,
    accepted_at: r.accepted_at ?? null,
    group_name: r.groups?.name ?? null,
    group_type: r.groups?.type ?? null,
  };
}

/**
 * 🔹 Invitaciones del usuario logueado
 * Hace join con groups usando la FK group_id → groups.id
 */
export async function getMyInvitations(): Promise<GroupInvitation[]> {
  const myEmail = await requireAuthedEmail();

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      `
      id,
      group_id,
      email,
      invited_email,
      role,
      status,
      invited_by,
      created_at,
      accepted_at,
      groups:group_id ( name, type )
    `
    )
    .eq("status", "pending")
    .or(`invited_email.eq.${myEmail},email.eq.${myEmail}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapRowToInvitation);
}

/**
 * 🔹 Detalle de una invitación por ID (para /invitations/accept)
 */
export async function getInvitationById(
  inviteId: string
): Promise<GroupInvitation | null> {
  const { data, error } = await supabase
    .from("group_invites")
    .select(
      `
      id,
      group_id,
      email,
      invited_email,
      role,
      status,
      invited_by,
      created_at,
      accepted_at,
      groups:group_id ( name, type )
    `
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapRowToInvitation(data);
}

// RPCs existentes (para aceptar / rechazar)
export async function acceptInvitation(inviteId: string) {
  const { data, error } = await supabase.rpc("accept_group_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return (data ?? { ok: false }) as any;
}

export async function declineInvitation(inviteId: string) {
  const { data, error } = await supabase.rpc("decline_group_invite", {
    p_invite_id: inviteId,
  });
  if (error) throw error;
  return (data ?? { ok: false }) as any;
}

/** Lee respuesta como JSON si se puede, si no como texto */
async function readJsonOrText(
  res: Response
): Promise<{ json: any | null; text: string | null }> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      const json = await res.json();
      return { json, text: null };
    } catch {
      // cae a text
    }
  }
  try {
    const text = await res.text();
    return { json: null, text };
  } catch {
    return { json: null, text: null };
  }
}

/**
 * Invitar:
 * - upsert en group_invites
 * - luego intenta email via /api/email/invite (si falla no rompe)
 */
export async function inviteToGroup(input: {
  groupId: string;
  email: string;
  role?: "member" | "admin" | "owner";
}): Promise<RpcResult> {
  const to = normEmail(input.email);
  if (!to || !to.includes("@")) return { ok: false, error: "Email inválido." };

  const me = await requireAuthedUser();
  if (me.email && me.email === to) {
    return { ok: false, error: "No puedes invitarte a ti mismo." };
  }

  const payload: any = {
    group_id: input.groupId,
    email: to,
    invited_email: to,
    role: input.role ?? "member",
    status: "pending",
    invited_by: me.id,
    accepted_at: null,
  };

  const { data: row, error: upErr } = await supabase
    .from("group_invites")
    .upsert(payload, { onConflict: "group_id,email", ignoreDuplicates: false })
    .select("id, group_id, email, invited_email, status")
    .single();

  if (upErr) throw upErr;
  if (!row?.id) return { ok: false, error: "No se pudo crear la invitación." };

  let email_sent = false;
  let email_error: string | undefined;

  try {
    const res = await fetch("/api/email/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: to,
        inviteId: row.id,
        groupId: row.group_id,
      }),
    });

    const { json, text } = await readJsonOrText(res);

    if (res.ok && json?.ok) {
      email_sent = true;
    } else {
      const fromJson = json?.error || json?.message;
      const fromText = text ? text.slice(0, 240) : null;
      email_error =
        fromJson ||
        fromText ||
        `HTTP ${res.status} ${res.statusText || ""}`.trim();
    }
  } catch (e: any) {
    email_error = e?.message || "Error enviando email";
  }

  return {
    ok: true,
    group_id: row.group_id,
    invite_id: row.id,
    invited_email: row.invited_email ?? row.email ?? to,
    status: row.status,
    email_sent,
    email_error,
  };
}
