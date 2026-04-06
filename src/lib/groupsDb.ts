// src/lib/groupsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

/* ======================================================
  Tipos
====================================================== */

/**
 * Catálogo canónico de grupos que queremos sostener en la app.
 * - pair
 * - family
 * - other
 *
 * Legacy tolerado al leer:
 * - couple -> pair
 * - shared -> other
 * - solo/personal -> personal (solo para compat)
 */
export type CanonicalGroupType = "pair" | "family" | "other" | "personal";
export type GroupType = CanonicalGroupType | "solo";

export type GroupRow = {
  id: string;
  name: string | null;
  type: GroupType | string;
  created_at?: string | null;
  owner_id?: string | null;
};

export type GroupMemberCoordinationPrefs = {
  group_note?: string;
  priority_hint?: "alta" | "media" | "baja";
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
  relationship_role: string | null;
  coordination_prefs: GroupMemberCoordinationPrefs | null;
};

export type GroupMemberMeta = {
  display_name?: string | null;
  relationship_role?: string | null;
  coordination_prefs?: GroupMemberCoordinationPrefs | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

/* ======================================================
  Normalización / labels
====================================================== */

function cleanName(value: string): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeGroupType(
  type: GroupType | string | null | undefined
): CanonicalGroupType {
  const t = String(type ?? "").trim().toLowerCase();

  if (t === "pair" || t === "couple") return "pair";
  if (t === "family") return "family";
  if (t === "other" || t === "shared") return "other";
  if (t === "solo" || t === "personal") return "personal";

  return "other";
}

/**
 * Helper centralizado para etiquetas humanas consistentes.
 */
export function getGroupTypeLabel(
  type: GroupType | string | null | undefined
): string {
  const normalized = normalizeGroupType(type);

  if (normalized === "pair") return "Pareja";
  if (normalized === "family") return "Familia";
  if (normalized === "other") return "Compartido";
  return "Personal";
}

function defaultGroupNameForType(
  type: GroupType | string | null | undefined
): string {
  const normalized = normalizeGroupType(type);

  if (normalized === "pair") return "Pareja";
  if (normalized === "family") return "Familia";
  if (normalized === "other") return "Compartido";
  return "Personal";
}

/**
 * Nombre para mostrar:
 * - usa name si existe y está limpio
 * - si no, cae al fallback por tipo
 */
export function getGroupDisplayName(
  group: Pick<GroupRow, "name" | "type">
): string {
  const name = cleanName(String(group?.name ?? ""));
  if (name) return name;
  return defaultGroupNameForType(group?.type);
}

/**
 * Formatea nombre de pareja tipo "Fernando & Ara".
 */
export function formatPairGroupName(a: string, b: string): string {
  const A = cleanName(a);
  const B = cleanName(b);

  if (A && B) return `${A} & ${B}`;
  return A || B || "Pareja";
}

function mapGroupRow(row: any): GroupRow {
  return {
    id: String(row?.id ?? ""),
    name: row?.name ?? null,
    type: row?.type ?? null,
    created_at: row?.created_at ?? null,
    owner_id: row?.owner_id ?? null,
  };
}

/* ======================================================
  Mis grupos
====================================================== */

/**
 * Devuelve los grupos a los que pertenezco, ordenados por
 * membresía más reciente.
 */
export async function getMyGroups(): Promise<GroupRow[]> {
  const uid = await requireUid();

  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (membershipError) throw membershipError;

  const groupIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((m: any) => String(m?.group_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (groupIds.length === 0) return [];

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, type, created_at, owner_id")
    .in("id", groupIds);

  if (groupsError) throw groupsError;

  const membershipRank = new Map<string, number>();
  (memberships ?? []).forEach((m: any, idx: number) => {
    const gid = String(m?.group_id ?? "").trim();
    if (gid && !membershipRank.has(gid)) {
      membershipRank.set(gid, idx);
    }
  });

  const rows = (groups ?? []).map(mapGroupRow);

  rows.sort((a, b) => {
    const ra = membershipRank.get(String(a.id)) ?? 999_999;
    const rb = membershipRank.get(String(b.id)) ?? 999_999;
    return ra - rb;
  });

  return rows;
}

/* ======================================================
  Crear grupo
====================================================== */

/**
 * Tipos permitidos para crear grupos reales compartidos.
 * No promovemos "solo/personal" desde esta capa.
 */
export async function createGroup(input: {
  name: string;
  type: "pair" | "family" | "other";
}): Promise<GroupRow> {
  const uid = await requireUid();

  const normalizedType = normalizeGroupType(input.type);
  const safeType: "pair" | "family" | "other" =
    normalizedType === "pair" || normalizedType === "family"
      ? normalizedType
      : "other";

  const rawName = cleanName(input.name ?? "");
  const name = rawName || defaultGroupNameForType(safeType);

  /* ---------- 1) RPC preferida ---------- */
  try {
    const { data, error } = await supabase.rpc("create_group", {
      p_name: name,
      p_type: safeType,
    });

    if (!error) {
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.id) {
        throw new Error("No se pudo crear el grupo.");
      }
      return mapGroupRow(row);
    }

    const msg = String((error as any)?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") || msg.includes("rpc") || msg.includes("does not exist");

    if (!missingFunction) throw error;
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") || msg.includes("rpc") || msg.includes("does not exist");

    if (!missingFunction) throw e;
  }

  /* ---------- 2) Fallback insert directo ---------- */
  const { data: groupRow, error: groupError } = await supabase
    .from("groups")
    .insert([
      {
        name,
        type: safeType,
        owner_id: uid,
      },
    ])
    .select("id, name, type, created_at, owner_id")
    .single();

  if (groupError) throw groupError;
  if (!groupRow?.id) throw new Error("No se pudo crear el grupo.");

  /**
   * Asegurar membership owner.
   * Si ya existe por trigger/RPC, ignoramos el duplicado silenciosamente.
   */
  const { error: membershipInsertError } = await supabase
    .from("group_members")
    .insert([
      {
        group_id: groupRow.id,
        user_id: uid,
        role: "owner",
      },
    ]);

  if (membershipInsertError) {
    const msg = String(membershipInsertError.message ?? "").toLowerCase();
    const duplicate =
      msg.includes("duplicate") ||
      msg.includes("unique") ||
      msg.includes("already exists");

    if (!duplicate) {
      throw membershipInsertError;
    }
  }

  return mapGroupRow(groupRow);
}

/* ======================================================
  Editar grupo
====================================================== */

/**
 * Actualiza metadata básica del grupo.
 * Solo permitimos movernos dentro del catálogo canónico compartido:
 * - pair
 * - family
 * - other
 */
export async function updateGroupMeta(
  groupId: string,
  patch: { name?: string | null; type?: "pair" | "family" | "other" }
): Promise<GroupRow> {
  const safeGroupId = String(groupId ?? "").trim();
  if (!safeGroupId) throw new Error("Group id inválido.");

  if (typeof patch.name === "undefined" && typeof patch.type === "undefined") {
    throw new Error("No hay cambios para guardar.");
  }

  const payload: Record<string, any> = {};

  if (typeof patch.type !== "undefined") {
    const normalizedType = normalizeGroupType(patch.type);
    payload.type =
      normalizedType === "pair" || normalizedType === "family"
        ? normalizedType
        : "other";
  }

  if (typeof patch.name !== "undefined") {
    const clean = cleanName(String(patch.name ?? ""));
    payload.name = clean || null;
  }

  const { data, error } = await supabase
    .from("groups")
    .update(payload)
    .eq("id", safeGroupId)
    .select("id, name, type, created_at, owner_id")
    .single();

  if (error) {
    console.error("[updateGroupMeta] error", error);
    throw error;
  }

  if (!data) {
    throw new Error("No se pudo actualizar el grupo.");
  }

  return mapGroupRow(data);
}

/* ======================================================
  Eliminar / salir de grupo
====================================================== */

/**
 * Elimina por completo un grupo.
 * Preferimos RPC delete_group().
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const safeGroupId = String(groupId ?? "").trim();
  if (!safeGroupId) throw new Error("Group id inválido.");

  const { error } = await supabase.rpc("delete_group", {
    p_group_id: safeGroupId,
  });

  if (error) {
    console.error("[deleteGroup] error", error);
    throw error;
  }
}

/**
 * Sale del grupo el usuario actual.
 * Preferimos RPC leave_group() para respetar reglas de owner/member.
 * Fallback: delete directo de membership.
 */
export async function leaveGroup(groupId: string): Promise<void> {
  const uid = await requireUid();
  const safeGroupId = String(groupId ?? "").trim();

  if (!safeGroupId) throw new Error("Group id inválido.");

  /* ---------- 1) RPC preferida ---------- */
  try {
    const { data, error } = await supabase.rpc("leave_group", {
      p_group_id: safeGroupId,
    });

    if (!error) {
      const result = Array.isArray(data) ? data[0] : data;

      if (result?.ok === false) {
        throw new Error(result?.error || "No se pudo salir del grupo.");
      }

      return;
    }

    const msg = String(error.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") || msg.includes("rpc") || msg.includes("does not exist");

    if (!missingFunction) {
      console.error("[leaveGroup] RPC error", error);
      throw error;
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    const missingFunction =
      msg.includes("function") || msg.includes("rpc") || msg.includes("does not exist");

    if (!missingFunction) {
      throw e;
    }
  }

  /* ---------- 2) Fallback ---------- */
  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", safeGroupId)
    .eq("user_id", uid);

  if (error) {
    console.error("[leaveGroup] fallback error", error);
    throw error;
  }
}

/* ======================================================
  Mis memberships
====================================================== */

export async function getMyGroupMemberships(): Promise<GroupMemberRow[]> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("group_members")
    .select(
      "group_id, user_id, role, display_name, relationship_role, coordination_prefs"
    )
    .eq("user_id", uid);

  if (error) throw error;

  const rows = (data ?? []) as any[];

  return rows.map((row) => ({
    group_id: String(row.group_id),
    user_id: String(row.user_id),
    role: String(row.role ?? "member"),
    display_name: row.display_name ?? null,
    relationship_role: row.relationship_role ?? null,
    coordination_prefs:
      (row.coordination_prefs ?? null) as GroupMemberCoordinationPrefs | null,
  }));
}

/**
 * Actualiza MI metadata en un grupo concreto.
 */
export async function updateMyGroupMeta(
  groupId: string,
  patch: {
    display_name: string | null;
    relationship_role: string | null;
    coordination_prefs: any | null;
  }
): Promise<void> {
  const uid = await requireUid();
  const safeGroupId = String(groupId ?? "").trim();

  if (!safeGroupId) throw new Error("Group id inválido.");

  const displayName = cleanName(String(patch.display_name ?? ""));
  const relationshipRole = cleanName(String(patch.relationship_role ?? ""));

  const payload: Record<string, any> = {
    display_name: displayName || null,
    relationship_role: relationshipRole || null,
    coordination_prefs: patch.coordination_prefs ?? null,
  };

  const { error } = await supabase
    .from("group_members")
    .update(payload)
    .eq("group_id", safeGroupId)
    .eq("user_id", uid);

  if (error) {
    console.error("[updateMyGroupMeta] error", error);
    throw error;
  }
}

/* ======================================================
  Grupo compartido entre dos usuarios
====================================================== */

export type SharedGroupCandidate = GroupRow & {
  my_role?: string | null;
  other_role?: string | null;
};

function rankSharedGroupType(
  type: GroupType | string | null | undefined
): number {
  const normalized = normalizeGroupType(type);
  if (normalized === "pair") return 0;
  if (normalized === "family") return 1;
  if (normalized === "other") return 2;
  return 3;
}

/**
 * Detecta el mejor grupo compartido entre el usuario actual y otro usuario.
 *
 * Prioridad:
 * 1) grupos pair
 * 2) family
 * 3) other
 * 4) más reciente
 */
export async function getSharedGroupBetweenUsers(
  otherUserId: string,
  currentUserId?: string | null
): Promise<SharedGroupCandidate | null> {
  const me = String(currentUserId ?? "").trim() || (await requireUid());
  const other = String(otherUserId ?? "").trim();

  if (!me || !other) return null;
  if (me === other) return null;

  const { data: memberships, error: membershipError } = await supabase
    .from("group_members")
    .select("group_id, user_id, role")
    .in("user_id", [me, other]);

  if (membershipError) throw membershipError;

  const rows = Array.isArray(memberships) ? memberships : [];
  if (rows.length < 2) return null;

  const grouped = new Map<
    string,
    { users: Set<string>; my_role?: string | null; other_role?: string | null }
  >();

  for (const row of rows) {
    const gid = String(row?.group_id ?? "").trim();
    const uid = String(row?.user_id ?? "").trim();
    if (!gid || !uid) continue;

    const entry = grouped.get(gid) ?? {
      users: new Set<string>(),
      my_role: null,
      other_role: null,
    };

    entry.users.add(uid);

    if (uid === me) entry.my_role = String(row?.role ?? "").trim() || null;
    if (uid === other) entry.other_role = String(row?.role ?? "").trim() || null;

    grouped.set(gid, entry);
  }

  const sharedIds = Array.from(grouped.entries())
    .filter(([, entry]) => entry.users.has(me) && entry.users.has(other))
    .map(([gid]) => gid);

  if (sharedIds.length === 0) return null;

  const { data: groups, error: groupsError } = await supabase
    .from("groups")
    .select("id, name, type, created_at, owner_id")
    .in("id", sharedIds);

  if (groupsError) throw groupsError;

  const candidates = (groups ?? []).map((row: any) => {
    const mapped = mapGroupRow(row);
    const membership = grouped.get(mapped.id);

    return {
      ...mapped,
      my_role: membership?.my_role ?? null,
      other_role: membership?.other_role ?? null,
    };
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const typeRank = rankSharedGroupType(a.type) - rankSharedGroupType(b.type);
    if (typeRank !== 0) return typeRank;

    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime;
  });

  const pairGroup = candidates.find(
    (group) => normalizeGroupType(group.type) === "pair"
  );

  if (pairGroup) {
    return pairGroup;
  }

  if (candidates.length > 1) {
    return null;
  }

  return candidates[0] ?? null;
}