"use client";

import supabase from "@/lib/supabaseClient";

export type GroupType = "pair" | "family" | "solo" | "personal";

export type GroupRow = {
  id: string;
  name: string | null;
  type: GroupType | string;
  created_at?: string | null;
  owner_id?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export async function getMyGroups(): Promise<GroupRow[]> {
  const uid = await requireUid();

  // 1) memberships
  const { data: ms, error: mErr } = await supabase
    .from("group_members")
    .select("group_id, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (mErr) throw mErr;

  const groupIds = Array.from(new Set((ms ?? []).map((m: any) => m.group_id).filter(Boolean)));
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
    if (m.group_id && !membershipRank.has(m.group_id)) membershipRank.set(m.group_id, idx);
  });

  const rows = (gs ?? []) as any[];
  rows.sort((a, b) => {
    const ra = membershipRank.get(a.id) ?? 999999;
    const rb = membershipRank.get(b.id) ?? 999999;
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

/**
 * Crea un grupo.
 * - Preferencia: RPC create_group(p_name, p_type) si existe
 * - Fallback: insert directo en groups + insert owner en group_members
 */
export async function createGroup(input: { name: string; type: "pair" | "family" }): Promise<GroupRow> {
  const uid = await requireUid();

  const name = input.name.trim();
  if (!name) throw new Error("Ponle un nombre al grupo.");

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
    await supabase.from("group_members").insert([{ group_id: gRow.id, user_id: uid, role: "owner" }]);
  } catch {
    // ignore
  }

  return {
    id: gRow.id,
    name: gRow.name ?? null,
    type: gRow.type,
    created_at: (gRow as any).created_at ?? null,
    owner_id: (gRow as any).owner_id ?? null,
  };
}
