"use client";

import supabase from "@/lib/supabaseClient";

export type Resolution = "keep_existing" | "replace_with_new" | "none";

export type ConflictResolutionRow = {
  conflict_id: string;
  resolution: Resolution;
  user_id: string;
};

type UpsertConflictResolutionInput = {
  conflictId: string;
  existingEventId?: string;
  incomingEventId?: string;
  resolution: Resolution;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

/**
 * Devuelve un map conflictId -> resolution del usuario actual
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
    if (!row?.conflict_id) continue;
    map[String(row.conflict_id)] = row.resolution as Resolution;
  }

  return map;
}

/**
 * Guarda o actualiza la resolución del conflicto para el usuario actual.
 * Soporta el formato nuevo ({ conflictId, resolution, ... }) y evita
 * romperse si aún no existe una fila previa.
 */
export async function upsertConflictResolution(
  inputOrConflictId: UpsertConflictResolutionInput | string,
  maybeResolution?: Resolution
) {
  const uid = await requireUserId();

  const payload =
    typeof inputOrConflictId === "string"
      ? {
          conflict_id: String(inputOrConflictId),
          user_id: uid,
          resolution: maybeResolution as Resolution,
        }
      : {
          conflict_id: String(inputOrConflictId.conflictId),
          user_id: uid,
          resolution: inputOrConflictId.resolution,
        };

  if (!payload.conflict_id) {
    throw new Error("Falta conflict_id para guardar la resolución.");
  }

  if (!payload.resolution) {
    throw new Error("Falta resolution para guardar la decisión.");
  }

  const { data: existing, error: existingErr } = await supabase
    .from("conflict_resolutions")
    .select("conflict_id")
    .eq("conflict_id", payload.conflict_id)
    .eq("user_id", payload.user_id)
    .maybeSingle();

  if (existingErr) throw existingErr;

  if (existing?.conflict_id) {
    const { error: updateErr } = await supabase
      .from("conflict_resolutions")
      .update({ resolution: payload.resolution })
      .eq("conflict_id", payload.conflict_id)
      .eq("user_id", payload.user_id);

    if (updateErr) throw updateErr;
    return;
  }

  const { error: insertErr } = await supabase
    .from("conflict_resolutions")
    .insert(payload);

  if (insertErr) throw insertErr;
}

/**
 * Borra todas las resoluciones del usuario actual
 */
export async function clearMyConflictResolutions() {
  const uid = await requireUserId();

  const { error } = await supabase
    .from("conflict_resolutions")
    .delete()
    .eq("user_id", uid);

  if (error) throw error;
}