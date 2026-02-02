// src/lib/profilesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  display_name?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) {
    throw new Error("Not authenticated");
  }
  return uid;
}

/**
 * Obtiene mi perfil desde la tabla `profiles`.
 * Si no existe, devuelve null.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, display_name")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  return (data as Profile) ?? null;
}

/**
 * Crea o actualiza mi perfil (UPSERT).
 * Usa:
 *  - id = auth.uid()
 *  - display_name = "Nombre Apellido"
 */
export async function createMyProfile(input: {
  first_name: string;
  last_name: string;
}): Promise<Profile> {
  const uid = await requireUid();

  const first_name = input.first_name.trim();
  const last_name = input.last_name.trim();

  if (!first_name || !last_name) {
    throw new Error("Nombre y apellido son obligatorios.");
  }

  const display_name = `${first_name} ${last_name}`.trim();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: uid,
        display_name,
        first_name,
        last_name,
      },
      { onConflict: "id" }
    )
    .select("id, first_name, last_name, avatar_url, display_name")
    .single();

  if (error) throw error;
  return data as Profile;
}

/**
 * Obtiene perfiles por un listado de ids (para Members, etc.)
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id)))).filter(
    Boolean
  );
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url, display_name")
    .in("id", uniqueIds);

  if (error) throw error;
  return (data ?? []) as Profile[];
}

/**
 * Devuelve iniciales "FG" a partir de first_name/last_name o display_name.
 */
export function getInitials(p: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}): string {
  let first = (p.first_name ?? "").trim();
  let last = (p.last_name ?? "").trim();

  if (!first || !last) {
    const dn = (p.display_name ?? "").trim();
    if (dn) {
      const parts = dn.split(/\s+/);
      if (!first && parts.length > 0) first = parts[0];
      if (!last && parts.length > 1) last = parts[parts.length - 1];
    }
  }

  const a = first ? first[0].toUpperCase() : "";
  const b = last ? last[0].toUpperCase() : "";

  if (a || b) return `${a}${b}`;
  return "U";
}
