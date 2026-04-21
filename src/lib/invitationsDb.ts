// src/lib/invitationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

/* ======================================================
  Tipos
====================================================== */

export type GroupInviteRow = {
  id: string;
  group_id: string;
  email: string | null;
  status: string | null;
  created_at: string | null;
  accepted_at?: string | null;
  invited_email?: string | null;
  invited_user_id?: string | null;
  role?: string | null;
  invited_by?: string | null;
};

export type GroupInvitation = GroupInviteRow & {
  group_name: string | null;
  group_type: string | null;
};

type InviteResult = {
  ok: boolean;
  id?: string;
  invite_id?: string;
  invited_email?: string;
  email_sent?: boolean | null;
  email_error?: string | null;
  error?: string;
};

export type GroupInviteResult = InviteResult;

/* ======================================================
  Helpers base
====================================================== */

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

function cleanEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeInviteRow(row: any): GroupInviteRow {
  return {
    id: String(row?.id ?? ""),
    group_id: String(row?.group_id ?? ""),
    email: row?.email ?? row?.invited_email ?? null,
    status: row?.status ?? null,
    created_at: row?.created_at ?? null,
    accepted_at: row?.accepted_at ?? null,
    invited_email: row?.invited_email ?? row?.email ?? null,
    invited_user_id: row?.invited_user_id ?? null,
    role: row?.role ?? null,
    invited_by: row?.invited_by ?? null,
  };
}

async function loadGroupsMeta(groupIds: string[]) {
  const safeIds = Array.from(
    new Set((groupIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))
  );

  const map = new Map<string, { name: string | null; type: string | null }>();

  if (safeIds.length === 0) return map;

  const { data, error } = await supabase
    .from("groups")
    .select("id, name, type")
    .in("id", safeIds);

  if (error) {
    console.error("[loadGroupsMeta] error", error);
    return map;
  }

  for (const row of data ?? []) {
    map.set(String((row as any).id), {
      name: (row as any).name ?? null,
      type: (row as any).type ?? null,
    });
  }

  return map;
}

function enrichInvitation(
  invite: GroupInviteRow,
  groupsById: Map<string, { name: string | null; type: string | null }>
): GroupInvitation {
  const group = groupsById.get(String(invite.group_id)) ?? {
    name: null,
    type: null,
  };

  return {
    ...invite,
    email: invite.email ?? invite.invited_email ?? null,
    invited_email: invite.invited_email ?? invite.email ?? null,
    group_name: group.name,
    group_type: group.type,
  };
}

/* ======================================================
  Lectura: mis invitaciones
====================================================== */

export async function getMyInvitations(): Promise<GroupInvitation[]> {
  const { email } = await requireUser();
  const safeEmail = cleanEmail(email);

  if (!safeEmail) return [];

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, accepted_at, invited_email, invited_user_id, role, invited_by"
    )
    .or(`email.eq.${safeEmail},invited_email.eq.${safeEmail}`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyInvitations] error", error);
    throw error;
  }

  const invites = (data ?? []).map(normalizeInviteRow);
  if (invites.length === 0) return [];

  const groupsById = await loadGroupsMeta(invites.map((r) => r.group_id));
  return invites.map((invite) => enrichInvitation(invite, groupsById));
}

/* ======================================================
  Lectura: detalle
====================================================== */

export async function getInvitationById(
  inviteId: string
): Promise<GroupInvitation | null> {
  await requireUser();

  const safeInviteId = String(inviteId ?? "").trim();
  if (!safeInviteId) return null;

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, accepted_at, invited_email, invited_user_id, role, invited_by"
    )
    .eq("id", safeInviteId)
    .maybeSingle();

  if (error) {
    console.error("[getInvitationById] error", error);
    throw error;
  }

  if (!data) return null;

  const invite = normalizeInviteRow(data);
  const groupsById = await loadGroupsMeta([invite.group_id]);

  return enrichInvitation(invite, groupsById);
}

/**
 * Compat vieja
 */
export async function getInviteById(
  inviteId: string
): Promise<GroupInviteRow | null> {
  const safeInviteId = String(inviteId ?? "").trim();
  if (!safeInviteId) return null;

  const { data, error } = await supabase
    .from("group_invites")
    .select(
      "id, group_id, email, status, created_at, accepted_at, invited_email, invited_user_id, role, invited_by"
    )
    .eq("id", safeInviteId)
    .maybeSingle();

  if (error) {
    console.error("[getInviteById] error", error);
    throw error;
  }

  if (!data) return null;
  return normalizeInviteRow(data);
}

/* ======================================================
  Crear invitación
====================================================== */

export async function inviteToGroup(input: {
  groupId: string;
  email: string;
  role: string;
}): Promise<InviteResult> {
  const groupId = String(input.groupId ?? "").trim();
  const invitedEmail = cleanEmail(input.email);
  const role = String(input.role ?? "member").trim() || "member";

  try {
    await requireUser();
  } catch (e: any) {
    return { ok: false, error: e?.message || "No autenticado" };
  }

  if (!groupId) return { ok: false, error: "Falta el grupo." };
  if (!invitedEmail) return { ok: false, error: "Escribe un email." };

  /* ---------- 1) RPC invite_to_group (preferida) ---------- */
  try {
    const { data, error } = await supabase.rpc("invite_to_group", {
      p_group_id: groupId,
      p_email: invitedEmail,
      p_role: role,
    });

    if (!error && data) {
      const result = Array.isArray(data) ? data[0] : data;
      const inviteId =
        result?.invite_id ?? result?.id ?? result?.invitation_id ?? null;

      return {
        ok: true,
        id: inviteId ?? undefined,
        invite_id: inviteId ?? undefined,
        invited_email: result?.invited_email ?? result?.email ?? invitedEmail,
        email_sent:
          typeof result?.email_sent === "boolean" ? result.email_sent : null,
        email_error: result?.email_error ?? null,
      };
    }

    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      const missingFunction =
        msg.includes("function") ||
        msg.includes("rpc") ||
        msg.includes("does not exist");

      if (!missingFunction) {
        console.error("[inviteToGroup] invite_to_group RPC error", error);
        return { ok: false, error: error.message };
      }
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[inviteToGroup] invite_to_group RPC exception", e);
      return { ok: false, error: e?.message || "Error creando invitación" };
    }
  }

  /* ---------- 2) RPC create_group_invite (compat) ---------- */
  try {
    const { data, error } = await supabase.rpc("create_group_invite", {
      p_group_id: groupId,
      p_email: invitedEmail,
      p_role: role,
    });

    if (!error && data) {
      const result = Array.isArray(data) ? data[0] : data;
      const inviteId =
        result?.invite_id ?? result?.id ?? result?.invitation_id ?? null;

      return {
        ok: true,
        id: inviteId ?? undefined,
        invite_id: inviteId ?? undefined,
        invited_email: result?.invited_email ?? result?.email ?? invitedEmail,
        email_sent:
          typeof result?.email_sent === "boolean" ? result.email_sent : null,
        email_error: result?.email_error ?? null,
      };
    }

    if (error) {
      const msg = String(error.message ?? "").toLowerCase();
      const missingFunction =
        msg.includes("function") ||
        msg.includes("rpc") ||
        msg.includes("does not exist");

      if (!missingFunction) {
        console.error("[inviteToGroup] create_group_invite RPC error", error);
        return { ok: false, error: error.message };
      }
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[inviteToGroup] create_group_invite RPC exception", e);
      return { ok: false, error: e?.message || "Error creando invitación" };
    }
  }

  /* ---------- 3) Fallback insert directo ---------- */
  try {
    const { data, error } = await supabase
      .from("group_invites")
      .insert([
        {
          group_id: groupId,
          email: invitedEmail,
          invited_email: invitedEmail,
          invited_user_id: null,
          role,
          status: "pending",
        },
      ])
      .select(
        "id, group_id, email, invited_email, status, created_at, accepted_at, invited_user_id, role, invited_by"
      )
      .single();

    if (error) {
      console.error("[inviteToGroup] fallback insert error", error);
      return { ok: false, error: error.message };
    }

    const row = normalizeInviteRow(data);

    return {
      ok: true,
      id: row.id,
      invite_id: row.id,
      invited_email: row.invited_email ?? row.email ?? invitedEmail,
      email_sent: null,
      email_error: null,
    };
  } catch (e: any) {
    console.error("[inviteToGroup] fallback insert exception", e);
    return {
      ok: false,
      error: e?.message || "No se pudo crear la invitación",
    };
  }
}

/* ======================================================
  Aceptar invitación
====================================================== */

export async function acceptInvitation(inviteId: string) {
  const safeInviteId = String(inviteId ?? "").trim();
  if (!safeInviteId) {
    return { ok: false, error: "Invitación inválida." };
  }

  /* ---------- 1) RPC preferida ---------- */
  try {
    const { data, error } = await supabase.rpc("accept_group_invite", {
      p_invite_id: safeInviteId,
    });

    if (!error) {
      return { ok: true, data };
    }

    const msg = String(error.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[acceptInvitation] RPC error", error);
      return { ok: false, error: error.message };
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[acceptInvitation] RPC exception", e);
      return { ok: false, error: e?.message || "Error al aceptar invitación" };
    }
  }

  /* ---------- 2) Fallback ---------- */
  try {
    const user = await requireUser();
    const invite = await getInviteById(safeInviteId);

    if (!invite) {
      return { ok: false, error: "Invitación no encontrada." };
    }

    const status = String(invite.status ?? "").toLowerCase();
    if (status && status !== "pending") {
      return { ok: true, data: { already: true, status } };
    }

    const role = String(invite.role ?? "member").trim() || "member";

    const { error: memberErr } = await supabase.from("group_members").insert([
      {
        group_id: invite.group_id,
        user_id: user.id,
        role,
      },
    ]);

    if (memberErr) {
      console.error("[acceptInvitation] fallback insert member error", memberErr);
      return { ok: false, error: memberErr.message };
    }

    const { error: updateErr } = await supabase
      .from("group_invites")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        invited_user_id: user.id,
        invited_email: cleanEmail(invite.invited_email ?? invite.email ?? user.email),
        email: cleanEmail(invite.email ?? invite.invited_email ?? user.email),
      })
      .eq("id", safeInviteId);

    if (updateErr) {
      console.error("[acceptInvitation] fallback update invite error", updateErr);
    }

    return { ok: true, data: { invite_id: safeInviteId, status: "accepted" } };
  } catch (e: any) {
    console.error("[acceptInvitation] fallback exception", e);
    return { ok: false, error: e?.message || "Error al aceptar invitación" };
  }
}

/* ======================================================
  Rechazar invitación
====================================================== */

export async function declineInvitation(inviteId: string) {
  const safeInviteId = String(inviteId ?? "").trim();
  if (!safeInviteId) {
    return { ok: false, error: "Invitación inválida." };
  }

  /* ---------- 1) RPC preferida ---------- */
  try {
    const { data, error } = await supabase.rpc("decline_group_invite", {
      p_invite_id: safeInviteId,
    });

    if (!error) {
      return { ok: true, data };
    }

    const msg = String(error.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[declineInvitation] RPC error", error);
      return { ok: false, error: error.message };
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") ||
      msg.includes("rpc") ||
      msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[declineInvitation] RPC exception", e);
      return { ok: false, error: e?.message || "Error al rechazar invitación" };
    }
  }

  /* ---------- 2) Fallback ---------- */
  try {
    const user = await requireUser().catch(() => null);

    const { error } = await supabase
      .from("group_invites")
      .update({
        status: "declined",
        accepted_at: new Date().toISOString(),
        invited_user_id: user?.id ?? null,
      })
      .eq("id", safeInviteId);

    if (error) {
      console.error("[declineInvitation] fallback update error", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, data: { invite_id: safeInviteId, status: "declined" } };
  } catch (e: any) {
    console.error("[declineInvitation] fallback exception", e);
    return { ok: false, error: e?.message || "Error al rechazar invitación" };
  }
}

// ==============================
// Public invites (external flow)
// ==============================

export type PublicInviteStatus = "pending" | "accepted" | "rejected";

export type PublicInviteRow = {
  id: string;
  event_id: string;
  contact: string | null;
  token: string;
  status: PublicInviteStatus;
  proposed_date: string | null;
  message: string | null;
  created_at: string;
  creator_response: string | null;
};

export type CreatePublicInviteInput = {
  eventId: string;
  contact?: string | null;
};

export type RespondToPublicInviteInput = {
  token: string;
  status: Exclude<PublicInviteStatus, "pending">;
  proposedDate?: string | null;
  message?: string | null;
};

const PUBLIC_INVITES_TABLE = "public_invites";
const PUBLIC_INVITE_TTL_HOURS = 168;

function makePublicInviteToken() {
  const random = Math.random().toString(36).slice(2);
  const stamp = Date.now().toString(36);
  return `spi_${stamp}_${random}`;
}

function isPublicInviteExpiredByCreatedAt(
  createdAt: string | null | undefined
) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const expiresAt =
    created.getTime() + PUBLIC_INVITE_TTL_HOURS * 60 * 60 * 1000;

  return Date.now() > expiresAt;
}

/**
 * Crea una invitación pública para compartir externamente.
 */
export async function createPublicInvite(
  input: CreatePublicInviteInput
): Promise<PublicInviteRow> {
  const token = makePublicInviteToken();

  const payload = {
    event_id: input.eventId,
    contact: input.contact ?? null,
    token,
    status: "pending",
    proposed_date: null,
    message: null,
  };

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo crear la invitación pública.");
  }

  return data as PublicInviteRow;
}

function normalizePublicInviteRow(row: any): PublicInviteRow | null {
  if (!row) return null;

  const status = String(row?.status ?? "pending").toLowerCase();
  const safeStatus: PublicInviteStatus =
    status === "accepted" || status === "rejected" ? status : "pending";

  return {
    id: String(row?.id ?? ""),
    event_id: String(row?.event_id ?? ""),
    contact: row?.contact ?? null,
    token: String(row?.token ?? ""),
    status: safeStatus,
    message: row?.message ?? null,
    proposed_date: row?.proposed_date ?? null,
    created_at: row?.created_at ?? null,
    creator_response: row?.creator_response ?? null,
  };
}

function normalizePublicInviteRows(rows: any[] | null | undefined) {
  return (rows ?? [])
    .map((row) => normalizePublicInviteRow(row))
    .filter(Boolean) as PublicInviteRow[];
}

export async function getPendingPublicInviteByEventId(
  eventId: string
): Promise<PublicInviteRow | null> {
  const safeEventId = String(eventId ?? "").trim();
  if (!safeEventId) return null;

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .select("*")
    .eq("event_id", safeEventId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "No se pudo revisar la invitación pública existente."
    );
  }

  return normalizePublicInviteRow(data);
}

export async function getLatestPublicInviteByEventId(
  eventId: string
): Promise<PublicInviteRow | null> {
  const safeEventId = String(eventId ?? "").trim();
  if (!safeEventId) return null;

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .select("*")
    .eq("event_id", safeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "No se pudo obtener el estado de la invitación pública."
    );
  }

  return normalizePublicInviteRow(data);
}

export async function getLatestPublicInvitesByEventIds(
  eventIds: string[]
): Promise<Record<string, PublicInviteRow | null>> {
  const safeEventIds = Array.from(
    new Set(
      (eventIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (safeEventIds.length === 0) {
    return {};
  }

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .select("*")
    .in("event_id", safeEventIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      error.message || "No se pudo obtener el estado de las invitaciones públicas."
    );
  }

  const rows = normalizePublicInviteRows(data);
  const byEventId: Record<string, PublicInviteRow | null> = {};

  for (const eventId of safeEventIds) {
    byEventId[eventId] = null;
  }

  for (const row of rows) {
    if (!row.event_id) continue;
    if (byEventId[row.event_id]) continue;
    byEventId[row.event_id] = row;
  }

  return byEventId;
}

export async function getOrCreatePublicInvite(
  input: CreatePublicInviteInput
): Promise<PublicInviteRow> {
  const existing = await getPendingPublicInviteByEventId(input.eventId);
  if (existing) return existing;
  return createPublicInvite(input);
}

/**
 * Busca una invitación pública por token.
 */
export async function getPublicInviteByToken(
  token: string
): Promise<PublicInviteRow | null> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) return null;

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .select("*")
    .eq("token", safeToken)
    .maybeSingle();

  if (error) {
    throw new Error(
      error.message || "No se pudo obtener la invitación pública."
    );
  }

  return normalizePublicInviteRow(data);
}

/**
 * Responde una invitación pública.
 */
export async function respondToPublicInvite(
  input: RespondToPublicInviteInput
): Promise<PublicInviteRow> {
  const safeToken = String(input.token ?? "").trim();

  if (!safeToken) {
    throw new Error("Token inválido.");
  }

  const currentInvite = await getPublicInviteByToken(safeToken);

  if (!currentInvite) {
    throw new Error("Token inválido o inexistente.");
  }

  if (isPublicInviteExpiredByCreatedAt(currentInvite.created_at)) {
    throw new Error("Este enlace de invitación expiró.");
  }

  if (currentInvite.status !== "pending") {
    throw new Error("Este enlace ya fue usado.");
  }

  const payload = {
    status: input.status,
    proposed_date: input.proposedDate ?? null,
    message: input.message ?? null,
  };

  const { data, error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .update(payload)
    .eq("token", safeToken)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error) {
    throw new Error(
      error.message || "No se pudo responder la invitación pública."
    );
  }

  return normalizePublicInviteRow(data) as PublicInviteRow;
}

export type PublicInviteCaptureStatus = "accepted" | "rejected";

export type PublicInviteCaptureItem = {
  invite_id: string;
  token: string;
  event_id: string;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  event_group_id: string | null;
  contact: string | null;
  status: PublicInviteCaptureStatus;
  proposed_date: string | null;
  message: string | null;
  created_at: string | null;
  creator_response: string | null;
};

function normalizeCaptureStatus(
  value: unknown
): PublicInviteCaptureStatus | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "accepted" || raw === "rejected") return raw;
  return null;
}

export async function getPendingPublicInviteCaptures(
  limit = 6
): Promise<PublicInviteCaptureItem[]> {
  await requireUser();

  const safeLimit = Math.max(1, Math.min(12, Number(limit) || 6));

  const { data: inviteRows, error: inviteError } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .select(
      "id, token, event_id, contact, status, proposed_date, message, created_at, creator_response"
    )
    .neq("status", "pending")
    .is("creator_response", null)
    .order("created_at", { ascending: false })
    .limit(30);

  if (inviteError) {
    throw new Error(
      inviteError.message ||
        "No se pudieron obtener las capturas de invitaciones públicas."
    );
  }

const normalizedInvites = (inviteRows ?? [])
  .map((row: any) => {
    const safeStatus = normalizeCaptureStatus(row?.status);
    if (!safeStatus) return null;

    const inviteId = String(row?.id ?? "").trim();
    const eventId = String(row?.event_id ?? "").trim();
    if (!inviteId || !eventId) return null;

    return {
      invite_id: inviteId,
      token: String(row?.token ?? ""),
      event_id: eventId,
      contact: row?.contact ?? null,
      status: safeStatus,
      proposed_date: row?.proposed_date ?? null,
      message: row?.message ?? null,
      created_at: row?.created_at ?? null,
      creator_response: row?.creator_response ?? null,
    };
  })
  .filter(Boolean) as Array<{
    invite_id: string;
    token: string;
    event_id: string;
    contact: string | null;
    status: PublicInviteCaptureStatus;
    proposed_date: string | null;
    message: string | null;
    created_at: string | null;
    creator_response: string | null;
  }>;

  if (normalizedInvites.length === 0) {
    return [];
  }

  const eventIds = Array.from(
    new Set(
      normalizedInvites
        .map((row) => String(row.event_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (eventIds.length === 0) {
    return [];
  }

  const { data: eventRows, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start, end, group_id")
    .in("id", eventIds);

  if (eventsError) {
    throw new Error(
      eventsError.message ||
        "No se pudo completar la lectura de eventos para las capturas."
    );
  }

  const eventsById = new Map<
    string,
    {
      id: string;
      title: string;
      start: string | null;
      end: string | null;
      group_id: string | null;
    }
  >();

  for (const row of eventRows ?? []) {
    eventsById.set(String((row as any).id), {
      id: String((row as any).id),
      title: String((row as any).title ?? "Evento"),
      start: (row as any).start ?? null,
      end: (row as any).end ?? null,
      group_id: (row as any).group_id ?? null,
    });
  }

  const merged = normalizedInvites
    .map((invite) => {
      const event = eventsById.get(invite.event_id);

      return {
        invite_id: invite.invite_id,
        token: invite.token,
        event_id: invite.event_id,
        event_title: event?.title ?? "Evento",
        event_start: event?.start ?? null,
        event_end: event?.end ?? null,
        event_group_id: event?.group_id ?? null,
        contact: invite.contact,
        status: invite.status,
        proposed_date: invite.proposed_date,
        message: invite.message,
        created_at: invite.created_at,
        creator_response: invite.creator_response,
      } satisfies PublicInviteCaptureItem;
    })
    .filter(Boolean) as PublicInviteCaptureItem[];

  const dedupedByEvent: PublicInviteCaptureItem[] = [];
  const seenEventIds = new Set<string>();

  for (const item of merged) {
    const eventId = String(item.event_id ?? "").trim();
    if (!eventId) continue;
    if (seenEventIds.has(eventId)) continue;

    seenEventIds.add(eventId);
    dedupedByEvent.push(item);
  }

  return dedupedByEvent.slice(0, safeLimit);
}

export async function markPublicInviteCaptureHandled(
  token: string,
  response: string = "handled"
): Promise<void> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) return;

  const { error } = await (supabase as any)
    .from(PUBLIC_INVITES_TABLE)
    .update({
      creator_response: response,
    })
    .eq("token", safeToken);

  if (error) {
    throw new Error(
      error.message || "No se pudo marcar la captura como procesada."
    );
  }
}