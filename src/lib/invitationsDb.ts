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

// 🔁 Alias de compatibilidad
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

function cleanEmail(x: string | null) {
  return String(x ?? "")
    .trim()
    .toLowerCase();
}

/* ─────────────────── Mis invitaciones ─────────────────── */

export async function getMyInvitations(): Promise<GroupInvitation[]> {
  const { email } = await requireUser();
  const em = cleanEmail(email);
  if (!em) return [];

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, invited_email, invited_user_id, role"
    )
    // ⚠️ usamos OR porque tu tabla puede usar email o invited_email
    .or(`email.eq.${em},invited_email.eq.${em}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyInvitations] error", error);
    throw error;
  }

  const rows = (data ?? []) as GroupInviteRow[];
  if (rows.length === 0) return [];

  const groupIds = Array.from(new Set(rows.map((r) => r.group_id).filter(Boolean)));

  const groupsById = new Map<string, { name: string | null; type: string | null }>();

  if (groupIds.length > 0) {
    const { data: groupsData, error: groupsError } = await supabase
      .from("groups")
      .select("id, name, type")
      .in("id", groupIds);

    if (groupsError) {
      console.error("[getMyInvitations] groups error", groupsError);
    } else {
      (groupsData ?? []).forEach((g: any) => {
        groupsById.set(String(g.id), {
          name: g.name ?? null,
          type: g.type ?? null,
        });
      });
    }
  }

  return rows.map((r) => {
    const grp = groupsById.get(String(r.group_id)) ?? { name: null, type: null };
    return {
      ...r,
      email: r.email ?? r.invited_email ?? null,
      invited_email: r.invited_email ?? r.email ?? null,
      group_name: grp.name,
      group_type: grp.type,
    };
  });
}

/* ─────────────────── Detalle de invitación ─────────────────── */

export async function getInvitationById(inviteId: string): Promise<GroupInvitation | null> {
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

  let group_name: string | null = null;
  let group_type: string | null = null;

  if (data.group_id) {
    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("name, type")
      .eq("id", data.group_id)
      .maybeSingle();

    if (gErr) console.error("[getInvitationById] group error", gErr);
    else if (g) {
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

// Compat viejo (si alguien lo usa)
export async function getInviteById(inviteId: string): Promise<GroupInviteRow | null> {
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

export async function inviteToGroup(input: {
  groupId: string;
  email: string;
  role: string;
}): Promise<InviteResult> {
  const { groupId, email, role } = input;

  try {
    await requireUser();
  } catch (e: any) {
    return { ok: false, error: e?.message || "No autenticado" };
  }

  const trimmedEmail = cleanEmail(email);
  if (!trimmedEmail) return { ok: false, error: "Escribe un email." };

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

    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[inviteToGroup] RPC error", error);
      return { ok: false, error: error.message };
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[inviteToGroup] exception RPC", e);
      return { ok: false, error: e?.message || "Error creando invitación" };
    }
  }

  // 2) Fallback insert (sin email aquí)
  try {
    const { data, error } = await supabase
      .from("group_invites")
      .insert([
        {
          group_id: groupId,
          invited_email: trimmedEmail,
          invited_user_id: null,
          role,
          status: "pending",
        },
      ])
      .select("id, group_id, invited_email, status, created_at, role")
      .single();

    if (error) {
      console.error("[inviteToGroup] insert error", error);
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      id: data.id,
      invite_id: data.id,
      invited_email: data.invited_email ?? trimmedEmail,
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
  // 1) RPC (ideal)
  try {
    const { data, error } = await supabase.rpc("accept_group_invite", {
      p_invite_id: inviteId,
    });

    if (!error) return { ok: true, data };

    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[acceptInvitation] RPC error", error);
      return { ok: false, error: error.message };
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      console.error("[acceptInvitation] exception RPC", e);
      return { ok: false, error: e?.message || "Error al aceptar invitación" };
    }
  }

  // 2) Fallback PRO: crea membership + marca invite aceptada
  try {
    const user = await requireUser();

    const inv = await getInviteById(inviteId);
    if (!inv) return { ok: false, error: "Invitación no encontrada." };

    const status = String(inv.status ?? "").toLowerCase();
    if (status && status !== "pending") {
      return { ok: true, data: { already: true, status } };
    }

    // Insert membership (best-effort, depende de RLS)
    const role = String(inv.role ?? "member");
    const { error: insErr } = await supabase.from("group_members").insert([
      {
        group_id: inv.group_id,
        user_id: user.id,
        role,
      },
    ]);

    if (insErr) {
      console.error("[acceptInvitation] fallback insert member error", insErr);
      return { ok: false, error: insErr.message };
    }

    const { error: upErr } = await supabase
      .from("group_invites")
      .update({
        status: "accepted",
        invited_user_id: user.id,
        invited_email: cleanEmail(inv.invited_email ?? inv.email ?? user.email),
      })
      .eq("id", inviteId);

    if (upErr) {
      console.error("[acceptInvitation] fallback update invite error", upErr);
      // membership ya creado; igual lo consideramos ok
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

    if (!error) return { ok: true, data };

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

  // 2) Fallback: solo status
  try {
    const user = await requireUser().catch(() => null);

    const { error } = await supabase
      .from("group_invites")
      .update({
        status: "declined",
        invited_user_id: user?.id ?? null,
      })
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