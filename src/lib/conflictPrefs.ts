"use client";

import supabase from "@/lib/supabaseClient";
import { conflictKey } from "@/lib/conflicts";

export type ConflictPreferenceStatus = "accepted" | "ignored" | "pending";

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

type ConflictPreferenceRow = {
  id?: string;
  user_id: string;
  conflict_key: string;
  event_a_id?: string | null;
  event_b_id?: string | null;
  status: ConflictPreferenceStatus;
  created_at?: string;
  updated_at?: string;
};

export async function getConflictPreferenceKeys(
  status: ConflictPreferenceStatus
): Promise<Set<string>> {
  const userId = await getCurrentUserId();
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from("conflict_preferences")
    .select("conflict_key")
    .eq("user_id", userId)
    .eq("status", status);

  if (error) throw error;

  const keys = new Set<string>();

  for (const row of data ?? []) {
    if (row?.conflict_key) {
      keys.add(String(row.conflict_key));
    }
  }

  return keys;
}

export async function getAcceptedConflictKeys(): Promise<Set<string>> {
  return getConflictPreferenceKeys("accepted");
}

export async function getIgnoredConflictKeys(): Promise<Set<string>> {
  const [ignored, accepted] = await Promise.all([
    getConflictPreferenceKeys("ignored"),
    getConflictPreferenceKeys("accepted"),
  ]);

  // Compatibilidad legacy: en versiones anteriores algunas decisiones
  // aplicadas quedaban como accepted. Para efectos de conflictos visibles,
  // accepted también debe dejar de aparecer como pendiente.
  return new Set([...ignored, ...accepted]);
}

export async function setConflictPreference(
  aId: string,
  bId: string,
  status: ConflictPreferenceStatus
) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const safeA = String(aId ?? "").trim();
  const safeB = String(bId ?? "").trim();

  if (!safeA || !safeB) return;

  const payload: ConflictPreferenceRow = {
    user_id: userId,
    conflict_key: conflictKey(safeA, safeB),
    event_a_id: safeA,
    event_b_id: safeB,
    status,
  };

  const { error } = await supabase
    .from("conflict_preferences")
    .upsert(payload, {
      onConflict: "user_id,conflict_key",
    });

  if (error) throw error;
}

export async function acceptConflict(aId: string, bId: string) {
  await setConflictPreference(aId, bId, "accepted");
}

export async function ignoreConflict(aId: string, bId: string) {
  await setConflictPreference(aId, bId, "ignored");
}

export async function unacceptConflict(aId: string, bId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const key = conflictKey(aId, bId);

  const { error } = await supabase
    .from("conflict_preferences")
    .delete()
    .eq("user_id", userId)
    .eq("conflict_key", key);

  if (error) throw error;
}

export async function unignoreConflict(aId: string, bId: string) {
  await unacceptConflict(aId, bId);
}