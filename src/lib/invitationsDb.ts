// src/lib/invitationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * Fila base de invitación de grupo.
 */
export type GroupInviteRow = {
  id: string;
  group_id: string;
  email: string | null;
  status: string | null;
  created_at: string | null;
  invited_email?: string | null;
  invited_user_id?: string | null;
  role?: string | null;
};

/**
 * Invitación enriquecida con datos del grupo (para /invitations).
 */
export type GroupInvitation = GroupInviteRow & {
  group_name: string | null;
  group_type: string | null;
};

type InviteResult = {
  ok: boolean;
  id?: string;
  invite_id?: string; // alias para UI
  invited_email?: string;
  email_sent?: boolean | null;
  email_error?: string | null;
  error?: string;
};

// 🔁 Alias de compatibilidad por si en algún sitio se usa el nombre viejo
export type GroupInviteResult = InviteResult;

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const user = data.user;
  if (!user) throw new Error("No autenticado");
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

/* ─────────────────── Mis invitaciones ─────────────────── */

/**
 * Devuelve las invitaciones pendientes para el usuario actual,
 * con info básica del grupo (nombre + tipo) para la UI.
 */
export async function getMyInvitations(): Promise<GroupInvitation[]> {
  const { email } = await requireUser();
  if (!email) return [];

  // 1) Traer invitaciones del usuario
  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, invited_email, invited_user_id, role"
    )
    .or(`email.eq.${email},invited_email.eq.${email}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyInvitations] error", error);
    throw error;
  }

  const rows =
    (data ?? []) as Array<{
      id: string;
      group_id: string;
      email: string | null;
      status: string | null;
      created_at: string | null;
      invited_email?: string | null;
      invited_user_id?: string | null;
      role?: string | null;
    }>;

  if (rows.length === 0) {
    return [];
  }

  // 2) Resolver nombres y tipos de grupo por separado (sin joins raros)
  const groupIds = Array.from(
    new Set(rows.map((r) => r.group_id).filter(Boolean))
  );

  const groupsById = new Map<string, { name: string | null; type: string | null }>();

  if (groupIds.length > 0) {
    const { data: groupsData, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, type")
      .in("id", groupIds);

    if (groupsError) {
      console.error("[getMyInvitations] groups error", groupsError);
      // No lanzamos error: si falla, devolvemos sin nombre/tipo
    } else {
      (groupsData ?? []).forEach((g: any) => {
        groupsById.set(g.id, {
          name: g.name ?? null,
          type: g.type ?? null,
        });
      });
    }
  }

  // 3) Combinar invitaciones con datos de grupo
  const result: GroupInvitation[] = rows.map((r) => {
    const grp = groupsById.get(r.group_id) ?? {
      name: null,
      type: null,
    };

    return {
      id: r.id,
      group_id: r.group_id,
      email: r.email ?? r.invited_email ?? null,
      status: r.status ?? null,
      created_at: r.created_at ?? null,
      invited_email: r.invited_email ?? r.email ?? null,
      invited_user_id: r.invited_user_id ?? null,
      role: r.role ?? null,
      group_name: grp.name,
      group_type: grp.type,
    };
  });

  return result;
}

/* ─────────────────── Detalle de invitación ─────────────────── */

/**
 * Devuelve una sola invitación (con datos de grupo) por id.
 * Usado en /invitations/accept.
 */
export async function getInvitationById(
  inviteId: string
): Promise<GroupInvitation | null> {
  // No hace falta revalidar usuario aquí, AcceptInviteClient ya pide sesión,
  // pero tampoco estorba:
  await requireUser();

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, invited_email, invited_user_id, role"
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    console.error("[getInvitationById] error", error);
    throw error;
  }
  if (!data) return null;

  // Traer grupo asociado (nombre + tipo)
  let group_name: string | null = null;
  let group_type: string | null = null;

  if (data.group_id) {
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("name, type")
      .eq("id", data.group_id)
      .maybeSingle();

    if (gErr) {
      console.error("[getInvitationById] group error", gErr);
    } else if (g) {
      group_name = g.name ?? null;
      group_type = g.type ?? null;
    }
  }

  return {
    id: data.id,
    group_id: data.group_id,
    email: data.email ?? data.invited_email ?? null,
    status: data.status ?? null,
    created_at: data.created_at ?? null,
    invited_email: data.invited_email ?? data.email ?? null,
    invited_user_id: data.invited_user_id ?? null,
    role: (data as any).role ?? null,
    group_name,
    group_type,
  };
}

/**
 * Versión simple sin datos del grupo (por si algún código viejo la usa).
 */
export async function getInviteById(
  inviteId: string
): Promise<GroupInviteRow | null> {
  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, invited_email, invited_user_id, role"
    )
    .eq("id", inviteId)
    .maybeSingle();

  if (error) {
    console.error("[getInviteById] error", error);
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id,
    group_id: data.group_id,
    email: data.email ?? data.invited_email ?? null,
    status: data.status ?? null,
    created_at: data.created_at ?? null,
    invited_email: data.invited_email ?? data.email ?? null,
    invited_user_id: data.invited_user_id ?? null,
    role: (data as any).role ?? null,
  };
}

/* ─────────────────── Crear invitación ─────────────────── */

/**
 * Crea una invitación a un grupo.
 * Intenta usar un RPC create_group_invite(p_group_id, p_email, p_role)
 * y, si no existe, cae a insert directo en group_invites.
 */
export async function inviteToGroup(input: {
  groupId: string;
  email: string;
  role: string;
}): Promise<InviteResult> {
  const { groupId, email, role } = input;

  // 👤 Asegurar que hay usuario logueado (si tus policies lo exigen)
  try {
    await requireUser();
  } catch (e: any) {
    return { ok: false, error: e?.message || "No autenticado" };
  }

  const trimmedEmail = email.trim().toLowerCase();

  // 1) Intentar RPC create_group_invite
  try {
    const { data, error } = await supabase.rpc("create_group_invite", {
      p_group_id: groupId,
      p_email: trimmedEmail,
      p_role: role,
    });

    if (!error) {
      const invite = Array.isArray(data) ? data[0] : data;

      const id =
        invite?.id || invite?.invite_id || invite?.invitation_id || null;

      return {
        ok: true,
        id: id ?? undefined,
        invite_id: id ?? undefined,
        invited_email: invite?.invited_email ?? invite?.email ?? trimmedEmail,
        email_sent:
          typeof invite?.email_sent === "boolean" ? invite.email_sent : null,
        email_error: invite?.email_error ?? null,
      };
    }

    // Si el error NO es "función no existe", lo tratamos como error real
    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[inviteToGroup] RPC error", error);
      return { ok: false, error: error.message };
    }
    // si es "function missing", seguimos al fallback
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[inviteToGroup] exception RPC", e);
      return { ok: false, error: e?.message || "Error creando invitación" };
    }
  }

  // 2) Fallback: insert directo en group_invites (sin mandar email aquí)
  try {
    const { data, error } = await supabase
      .from("group_invites")
      .insert([
        {
          group_id: groupId,
          email: trimmedEmail,
          role,
          status: "pending",
        },
      ])
      .select("id, group_id, email, status, created_at, role")
      .single();

    if (error) {
      console.error("[inviteToGroup] insert error", error);
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      id: data.id,
      invite_id: data.id,
      invited_email: data.email ?? trimmedEmail,
      email_sent: null,
      email_error: null,
    };
  } catch (e: any) {
    console.error("[inviteToGroup] fallback exception", e);
    return { ok: false, error: e?.message || "No se pudo crear la invitación" };
  }
}

/* ─────────────────── Aceptar / rechazar invitación ─────────────────── */

export async function acceptInvitation(inviteId: string) {
  // 1) Intentar RPC
  try {
    const { data, error } = await supabase.rpc("accept_group_invite", {
      p_invite_id: inviteId,
    });

    if (!error) {
      return { ok: true, data };
    }

    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[acceptInvitation] RPC error", error);
      return { ok: false, error: error.message };
    }
    // si la función no existe, caemos al fallback
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[acceptInvitation] exception RPC", e);
      return { ok: false, error: e?.message || "Error al aceptar invitación" };
    }
  }

  // 2) Fallback simple: marcar status = 'accepted' (no crea membership)
  try {
    const { error } = await supabase
      .from("group_invites")
      .update({ status: "accepted" })
      .eq("id", inviteId);

    if (error) {
      console.error("[acceptInvitation] fallback update error", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: null };
  } catch (e: any) {
    console.error("[acceptInvitation] fallback exception", e);
    return { ok: false, error: e?.message || "Error al aceptar invitación" };
  }
}

export async function declineInvitation(inviteId: string) {
  // 1) RPC
  try {
    const { data, error } = await supabase.rpc("decline_group_invite", {
      p_invite_id: inviteId,
    });

    if (!error) {
      return { ok: true, data };
    }

    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[declineInvitation] RPC error", error);
      return { ok: false, error: error.message };
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[declineInvitation] exception RPC", e);
      return { ok: false, error: e?.message || "Error al rechazar invitación" };
    }
  }

  // 2) Fallback simple
  try {
    const { error } = await supabase
      .from("group_invites")
      .update({ status: "declined" })
      .eq("id", inviteId);

    if (error) {
      console.error("[declineInvitation] fallback update error", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: null };
  } catch (e: any) {
    console.error("[declineInvitation] fallback exception", e);
    return { ok: false, error: e?.message || "Error al rechazar invitación" };
  }
}
