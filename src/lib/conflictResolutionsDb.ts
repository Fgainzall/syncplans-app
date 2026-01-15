"use client";

import supabase from "@/lib/supabaseClient";

export type Resolution = "keep_existing" | "replace_with_new" | "none";

export type ConflictResolutionRow = {
  conflict_id: string;
  resolution: Resolution;
  user_id: string;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

/**
 * Devuelve un map conflictId -> resolution (solo del usuario actual)
 */
export async function getMyConflictResolutionsMap(): Promise<Record<string, Resolution>> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from("conflict_resolutions")
    .select("conflict_id, resolution")
    .eq("user_id", uid);

  if (error) throw error;

  const map: Record<string, Resolution> = {};
  for (const row of data ?? []) {
    map[String(row.conflict_id)] = row.resolution as Resolution;
  }
  return map;
}

/**
 * Inserta o actualiza la resolución de un conflicto
 * IMPORTANTÍSIMO: valida error y lanza (para que Compare muestre "No se pudo guardar").
 */
export async function upsertConflictResolution(conflictId: string, resolution: Resolution) {
  const uid = await requireUserId();

  const { error } = await supabase
    .from("conflict_resolutions")
    .upsert(
      { conflict_id: String(conflictId), resolution, user_id: uid },
      { onConflict: "conflict_id,user_id" }
    );

  if (error) throw error;
}

/**
 * Borra todas las resoluciones del usuario (reset)
 */
export async function clearMyConflictResolutions() {
  const uid = await requireUserId();

  const { error } = await supabase
    .from("conflict_resolutions")
    .delete()
    .eq("user_id", uid);

  if (error) throw error;
}
