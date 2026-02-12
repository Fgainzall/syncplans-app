// src/lib/groupsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * Tipos de grupo soportados por la app.
 *
 * - pair: grupos de pareja
 * - family: grupos familiares
 * - other: grupos compartidos genéricos (amigos, equipos, etc.)
 * - solo/personal: reservas para modos personales si la DB los usa
 */
export type GroupType = "pair" | "family" | "other" | "solo" | "personal";

export type GroupRow = {
  id: string;
  name: string | null;
  // Dejamos string extra para no romper si la DB tiene otros valores legacy
  type: GroupType | string;
  created_at?: string | null;
  owner_id?: string | null;
};

/**
 * Metadata humana de la membresía de un usuario en un grupo.
 * No son permisos (owner/admin), es cómo se ve en ese grupo.
 */
export type GroupMemberCoordinationPrefs = {
  group_note?: string;
  priority_hint?: "alta" | "media" | "baja";
};

export type GroupMemberRow = {
  group_id: string;
  user_id: string;
  role: string; // 'owner' | 'admin' | 'member'...
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

/* ─────────────────── Labels / nombres ─────────────────── */

/**
 * Helper centralizado para convertir el tipo técnico de grupo
 * en una etiqueta humana consistente en toda la app.
 */
export function getGroupTypeLabel(
  type: GroupType | string | null | undefined
): string {
  const t = String(type ?? "").toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  if (t === "other") return "Compartido";
  if (t === "solo" || t === "personal") return "Personal";
  return "Grupo";
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function defaultGroupNameForType(type: GroupType | string): string {
  const t = String(type ?? "").toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  if (t === "other") return "Compartido";
  if (t === "solo" || t === "personal") return "Personal";
  return "Grupo";
}

/**
 * Nombre “para mostrar” SIEMPRE consistente (selector, headers, etc.)
 * - Si el grupo tiene name -> lo usamos (limpio).
 * - Si no -> fallback por tipo ("Pareja", "Familia", ...).
 */
export function getGroupDisplayName(group: Pick<GroupRow, "name" | "type">): string {
  const n = cleanName(String(group?.name ?? ""));
  if (n) return n;
  return defaultGroupNameForType(group?.type ?? "group");
}

/**
 * Formatea un nombre de pareja tipo “Fernando & Ara”.
 * Úsalo cuando tú controles ambos nombres (ej. en UI al crear/renombrar).
 */
export function formatPairGroupName(a: string, b: string): string {
  const A = cleanName(a);
  const B = cleanName(b);
  if (A && B) return `${A} & ${B}`;
  return A || B || "Pareja";
}

/* ─────────────────── Mis grupos ─────────────────── */

/**
 * Devuelve los grupos a los que pertenezco, ordenados por
 * membresía más reciente. No incluye la metadata humana
 * de la membresía (display_name, relationship_role, etc.).
 */
export async function getMyGroups(): Promise<GroupRow[]> {
  const uid = await requireUid();

  // 1) memberships
  const { data: ms, error: mErr } = await supabase
    .from("group_members")
    .select("group_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (mErr) throw mErr;

  const groupIds = Array.from(
    new Set((ms ?? []).map((m: any) => m.group_id).filter(Boolean))
  );

  if (groupIds.length === 0) return [];

  // 2) grupos por ids
  const { data: gs, error: gErr } = await supabase
    .from("groups")
    .select("id,name,type,created_at,owner_id")
    .in("id", groupIds);

  if (gErr) throw gErr;

  // 3) orden por “más reciente membership”
  const membershipRank = new Map<string, number>();
  (ms ?? []).forEach((m: any, idx: number) => {
    if (m.group_id && !membershipRank.has(m.group_id)) {
      membershipRank.set(m.group_id, idx);
    }
  });

  const rows = (gs ?? []) as any[];
  rows.sort((a, b) => {
    const ra = membershipRank.get(a.id) ?? 999_999;
    const rb = membershipRank.get(b.id) ?? 999_999;
    return ra - rb;
  });

  return rows.map((g: any) => ({
    id: g.id,
    name: g.name ?? null,
    type: g.type,
    created_at: g.created_at ?? null,
    owner_id: g.owner_id ?? null,
  }));
}

/* ─────────────────── Crear grupo ─────────────────── */

/**
 * Crea un grupo.
 * - Preferencia: RPC create_group(p_name, p_type) si existe.
 * - Fallback: insert directo en groups + insert owner en group_members.
 *
 * Tipos permitidos aquí:
 * - "pair"   → grupo de pareja
 * - "family" → grupo familiar
 * - "other"  → grupo compartido genérico (amigos, equipos, etc.)
 */
export async function createGroup(input: {
  name: string;
  type: "pair" | "family" | "other";
}): Promise<GroupRow> {
  const uid = await requireUid();

  // ✅ Permitimos vacío pero lo normalizamos a un default potente por tipo.
  const rawName = cleanName(input.name ?? "");
  const name = rawName || defaultGroupNameForType(input.type);

  // 1) RPC (si existe)
  try {
    const { data, error } = await supabase.rpc("create_group", {
      p_name: name,
      p_type: input.type,
    });

    if (!error) {
      const g = Array.isArray(data) ? data[0] : data;
      if (!g?.id) throw new Error("No se pudo crear el grupo.");
      return {
        id: g.id,
        name: g.name ?? null,
        type: g.type,
        created_at: g.created_at ?? null,
        owner_id: g.owner_id ?? null,
      };
    }

    // si el error no es “function missing”, lo lanzamos
    const msg = (error as any)?.message?.toLowerCase?.() ?? "";
    if (!msg.includes("function") && !msg.includes("rpc")) throw error;
    // si es “function missing”, caemos al fallback
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      throw e;
    }
  }

  // 2) fallback: insert directo
  // Nota: requiere RLS correcto para insertar groups (owner_id = auth.uid()).
  const { data: gRow, error: gErr } = await supabase
    .from("groups")
    .insert([{ name, type: input.type, owner_id: uid }])
    .select("id,name,type,created_at,owner_id")
    .single();

  if (gErr) throw gErr;
  if (!gRow?.id) throw new Error("No se pudo crear el grupo (insert).");

  // asegurar membership owner (si tu trigger/RPC ya lo hace, esto puede fallar por duplicate; lo ignoramos si es duplicate)
  try {
    await supabase.from("group_members").insert([
      {
        group_id: gRow.id,
        user_id: uid,
        role: "owner",
      },
    ]);
  } catch {
    // ignore duplicate
  }

  return {
    id: gRow.id,
    name: gRow.name ?? null,
    type: gRow.type,
    created_at: (gRow as any).created_at ?? null,
    owner_id: (gRow as any).owner_id ?? null,
  };
}

/* ─────────────────── Editar grupo ─────────────────── */

/**
 * Actualiza la metadata básica del grupo (nombre y/o tipo).
 * RLS en groups debe permitir UPDATE solo al owner.
 */
export async function updateGroupMeta(
  groupId: string,
  patch: { name?: string | null; type?: GroupType }
): Promise<GroupRow> {
  if (!patch.name && !patch.type) {
    throw new Error("No hay cambios para guardar.");
  }

  const payload: any = {};
  if (patch.type) payload.type = patch.type;

  if (patch.name !== undefined) {
    const n = cleanName(String(patch.name ?? ""));
    payload.name = n ? n : null;
  }

  const { data, error } = await supabase
    .from("groups")
    .update(payload)
    .eq("id", groupId)
    .select("id,name,type,created_at,owner_id")
    .single();

  if (error) {
    console.error("[updateGroupMeta] error", error);
    throw error;
  }
  if (!data) {
    throw new Error("No se pudo actualizar el grupo.");
  }

  return {
    id: data.id,
    name: data.name ?? null,
    type: data.type,
    created_at: data.created_at ?? null,
    owner_id: data.owner_id ?? null,
  };
}

/* ─────────────────── Eliminar / salir de grupo ─────────────────── */

/**
 * Elimina por completo un grupo.
 * - Llama al RPC delete_group(p_group_id uuid)
 * - El RPC debe verificar que auth.uid() sea el owner.
 */
export async function deleteGroup(groupId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_group", {
    p_group_id: groupId,
  });

  if (error) {
    console.error("[deleteGroup] error", error);
    throw error;
  }
}

/**
 * Sale del grupo el usuario actual (borra su fila en group_members).
 */
export async function leaveGroup(groupId: string): Promise<void> {
  const uid = await requireUid();

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", uid);

  if (error) {
    console.error("[leaveGroup] error", error);
    throw error;
  }
}

/* ─────────────────── Mis memberships ─────────────────── */

/**
 * Devuelve TODAS mis memberships con metadata humana:
 * - display_name (cómo quiero que me llamen en ese grupo)
 * - relationship_role (pareja, padre, hijo/a, etc.)
 * - coordination_prefs (nota contextual por grupo)
 *
 * Esto lo usaremos en el Panel para “Tu rol en los grupos”.
 */
export async function getMyGroupMemberships(): Promise<GroupMemberRow[]> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("group_members")
    .select(
      "group_id,user_id,role,display_name,relationship_role,coordination_prefs"
    )
    .eq("user_id", uid);

  if (error) throw error;

  const rows = (data ?? []) as any[];
  return rows.map((row) => ({
    group_id: row.group_id,
    user_id: row.user_id,
    role: row.role,
    display_name: row.display_name ?? null,
    relationship_role: row.relationship_role ?? null,
    coordination_prefs:
      (row.coordination_prefs ?? null) as GroupMemberCoordinationPrefs | null,
  }));
}

/**
 * Actualiza MI metadata en un grupo concreto (fila en group_members).
 * - Solo toca display_name, relationship_role y coordination_prefs.
 * - Respeta RLS filtrando por group_id + user_id = auth.uid().
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

  const displayName = cleanName(String(patch.display_name ?? ""));
  const rel = cleanName(String(patch.relationship_role ?? ""));

  const payload: Record<string, any> = {
    display_name: displayName ? displayName : null,
    relationship_role: rel ? rel : null,
    coordination_prefs: patch.coordination_prefs ?? null,
  };

  const { error: updError } = await supabase
    .from("group_members")
    .update(payload)
    .eq("group_id", groupId)
    .eq("user_id", uid);

  if (updError) {
    console.error("[updateMyGroupMeta] error", updError);
    throw updError;
  }
}