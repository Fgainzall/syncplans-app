// src/lib/conflictResolutionsDb.ts
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
export async function getMyConflictResolutionsMap(): Promise<
  Record<string, Resolution>
> {
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
 * ✅ Upsert robusto sin depender de onConflict (evita 400 PostgREST)
 */
export async function upsertConflictResolution(
  conflictId: string,
  resolution: Resolution
) {
  const uid = await requireUserId();

  const payload = {
    conflict_id: String(conflictId),
    user_id: uid,
    resolution,
  };

  // 1) Intentar UPDATE
  const { data: updated, error: updateErr } = await supabase
    .from("conflict_resolutions")
    .update({ resolution })
    .eq("conflict_id", payload.conflict_id)
    .eq("user_id", payload.user_id)
    .select("conflict_id")
    .maybeSingle();

  if (updateErr) {
    throw updateErr;
  }

  // Si actualizó, listo
  if (updated?.conflict_id) return;

  // 2) Si no existía, INSERT
  const { error: insertErr } = await supabase
    .from("conflict_resolutions")
    .insert(payload);

  if (insertErr) throw insertErr;
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
