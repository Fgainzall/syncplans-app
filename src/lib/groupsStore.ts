"use client";

import supabase from "@/lib/supabaseClient";

export type GroupType = "pair" | "family" | "solo" | "personal" | string;

export type GroupRow = {
  id: string;
  name: string;
  type: GroupType;
  role?: "owner" | "admin" | "member" | string;
  created_at?: string;
  created_by?: string;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

/**
 * ✅ fetchMyGroups()
 * Devuelve grupos donde soy miembro.
 * DEDUPE en origen por group.id (evita duplicados en selects y UI).
 */
export async function fetchMyGroups(): Promise<GroupRow[]> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      role,
      created_at,
      groups:groups (
        id,
        name,
        type,
        created_at,
        created_by
      )
    `
    )
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as any[];

  const map = new Map<string, GroupRow>();
  for (const r of rows) {
    const g = r.groups;
    if (!g?.id) continue;

    // Si ya existe, nos quedamos con el más reciente (por orden desc)
    if (!map.has(g.id)) {
      map.set(g.id, {
        id: g.id,
        name: g.name ?? "Grupo",
        type: g.type ?? "pair",
        role: r.role ?? "member",
        created_at: g.created_at ?? null,
        created_by: g.created_by ?? null,
      });
    }
  }

  return Array.from(map.values());
}
