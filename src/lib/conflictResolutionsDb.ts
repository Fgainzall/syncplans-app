"use client";

import supabase from "@/lib/supabaseClient";
import { conflictKey } from "@/lib/conflicts";

export type Resolution = "keep_existing" | "replace_with_new" | "none";

export type ConflictResolutionRow = {
  conflict_id: string;
  resolution: Resolution;
  user_id: string;
  existing_event_id?: string | null;
  incoming_event_id?: string | null;
};

type UpsertConflictResolutionInput = {
  conflictId: string;
  existingEventId?: string;
  incomingEventId?: string;
  resolution: Resolution;
};

type DbConflictResolutionRow = {
  conflict_id?: string | null;
  resolution?: string | null;
  existing_event_id?: string | null;
  incoming_event_id?: string | null;
};

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

function normalizeResolution(value: unknown): Resolution | null {
  if (
    value === "keep_existing" ||
    value === "replace_with_new" ||
    value === "none"
  ) {
    return value;
  }

  return null;
}

function isSchemaColumnError(error: unknown) {
  const message = String(
    (error as { message?: unknown; details?: unknown; hint?: unknown })?.message ??
      (error as { details?: unknown })?.details ??
      (error as { hint?: unknown })?.hint ??
      ""
  ).toLowerCase();

  return (
    message.includes("column") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

function parseConflictPair(conflictId: string): [string, string] | null {
  const normalized = String(conflictId ?? "").trim();
  if (!normalized) return null;

  const parts = normalized.split("::").filter(Boolean);
  if (parts.length < 3) return null;

  // Soporta tanto cx::<a>::<b> como el legacy cx::cx::<a>::<b>.
  const last = parts[parts.length - 1];
  const beforeLast = parts[parts.length - 2];

  if (!beforeLast || !last) return null;
  return [beforeLast, last];
}

function addAlias(
  map: Record<string, Resolution>,
  key: string | null | undefined,
  resolution: Resolution | null
) {
  const safeKey = String(key ?? "").trim();
  if (!safeKey || !resolution) return;

  map[safeKey] = resolution;
}

function addConflictResolutionAliases(
  map: Record<string, Resolution>,
  row: DbConflictResolutionRow
) {
  const resolution = normalizeResolution(row.resolution);
  if (!resolution) return;

  const conflictId = String(row.conflict_id ?? "").trim();
  addAlias(map, conflictId, resolution);

  const parsedPair = parseConflictPair(conflictId);
  if (parsedPair) {
    addAlias(map, conflictKey(parsedPair[0], parsedPair[1]), resolution);
  }

  if (conflictId.startsWith("cx::cx::")) {
    addAlias(map, conflictId.slice(4), resolution);
  }

  const existingId = String(row.existing_event_id ?? "").trim();
  const incomingId = String(row.incoming_event_id ?? "").trim();

  if (existingId && incomingId) {
    addAlias(map, conflictKey(existingId, incomingId), resolution);
  }
}

/**
 * Devuelve un map de resoluciones del usuario actual.
 *
 * Importante: además de conflict_id exacto, devuelve aliases por par de eventos.
 * Esto protege el flujo cuando el conflicto se recalcula, llega desde una URL
 * vieja, o una decisión anterior fue guardada con un formato legacy.
 */
export async function getMyConflictResolutionsMap(): Promise<
  Record<string, Resolution>
> {
  const uid = await requireUserId();

  const primary = await supabase
    .from("conflict_resolutions")
    .select("conflict_id, resolution, existing_event_id, incoming_event_id")
    .eq("user_id", uid);

  let rows: DbConflictResolutionRow[] =
    (primary.data ?? []) as DbConflictResolutionRow[];
  let queryError = primary.error;

  if (queryError && isSchemaColumnError(queryError)) {
    const fallback = await supabase
      .from("conflict_resolutions")
      .select("conflict_id, resolution")
      .eq("user_id", uid);

    rows = (fallback.data ?? []) as DbConflictResolutionRow[];
    queryError = fallback.error;
  }

  if (queryError) throw queryError;

  const map: Record<string, Resolution> = {};

  for (const row of rows) {
    addConflictResolutionAliases(map, row);
  }

  return map;
}

async function upsertMinimalConflictResolution(payload: {
  conflict_id: string;
  user_id: string;
  resolution: Resolution;
}) {
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
 * Guarda o actualiza la resolución del conflicto para el usuario actual.
 *
 * Además del conflict_id, intenta persistir existing_event_id/incoming_event_id
 * cuando la tabla lo soporta. Si producción todavía no tiene esas columnas,
 * hace fallback al payload mínimo para no romper el flujo.
 */
export async function upsertConflictResolution(
  inputOrConflictId: UpsertConflictResolutionInput | string,
  maybeResolution?: Resolution
) {
  const uid = await requireUserId();

  const conflictId =
    typeof inputOrConflictId === "string"
      ? String(inputOrConflictId)
      : String(inputOrConflictId.conflictId);

  const resolution =
    typeof inputOrConflictId === "string"
      ? normalizeResolution(maybeResolution)
      : normalizeResolution(inputOrConflictId.resolution);

  const existingEventId =
    typeof inputOrConflictId === "string"
      ? ""
      : String(inputOrConflictId.existingEventId ?? "").trim();

  const incomingEventId =
    typeof inputOrConflictId === "string"
      ? ""
      : String(inputOrConflictId.incomingEventId ?? "").trim();

  const safeConflictId = conflictId.trim();

  if (!safeConflictId) {
    throw new Error("Falta conflict_id para guardar la resolución.");
  }

  if (!resolution) {
    throw new Error("Falta resolution para guardar la decisión.");
  }

  const minimalPayload = {
    conflict_id: safeConflictId,
    user_id: uid,
    resolution,
  };

  const fullPayload = {
    ...minimalPayload,
    existing_event_id: existingEventId || null,
    incoming_event_id: incomingEventId || null,
  };

  const { error } = await supabase
    .from("conflict_resolutions")
    .upsert(fullPayload, {
      onConflict: "conflict_id,user_id",
    });

  if (!error) return;

  if (isSchemaColumnError(error)) {
    await upsertMinimalConflictResolution(minimalPayload);
    return;
  }

  throw error;
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
