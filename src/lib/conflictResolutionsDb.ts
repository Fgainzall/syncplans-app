// src/lib/conflictResolutionsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type Resolution = "keep_existing" | "replace_with_new" | "none";

export type ConflictResolutionRow = {
  conflict_id: string;
  resolution: Resolution;
  user_id: string;
};

/**
 * Devuelve un map conflictId -> resolution
 */
export async function getMyConflictResolutionsMap(): Promise<
  Record<string, Resolution>
> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return {};

  const { data, error } = await supabase
    .from("conflict_resolutions")
    .select("conflict_id, resolution")
    .eq("user_id", user.id);

  if (error || !data) return {};

  const map: Record<string, Resolution> = {};
  for (const row of data) {
    map[row.conflict_id] = row.resolution as Resolution;
  }
  return map;
}

/**
 * Inserta o actualiza la resolución de un conflicto
 */
export async function upsertConflictResolution(
  conflictId: string,
  resolution: Resolution
) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return;

  await supabase.from("conflict_resolutions").upsert(
    {
      conflict_id: conflictId,
      resolution,
      user_id: user.id,
    },
    {
      onConflict: "conflict_id,user_id",
    }
  );
}

/**
 * Borra todas las resoluciones del usuario (reset)
 */
export async function clearMyConflictResolutions() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return;

  await supabase
    .from("conflict_resolutions")
    .delete()
    .eq("user_id", user.id);
}
