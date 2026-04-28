// src/lib/groupNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type GroupNotificationSetting = {
  user_id: string;
  group_id: string;
  muted: boolean;
  created_at?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");

  return uid;
}

function normalizeGroupId(groupId: string): string {
  const safe = String(groupId ?? "").trim();
  if (!safe) {
    throw new Error("Group id inválido.");
  }
  return safe;
}

/**
 * Devuelve si este grupo está silenciado para el usuario actual.
 * Si no hay fila, asumimos muted = false.
 */
export async function getMyGroupMuteState(
  groupId: string
): Promise<boolean> {
  const uid = await requireUid();
  const safeGroupId = normalizeGroupId(groupId);

  const { data, error } = await supabase
    .from("group_notification_settings")
    .select("muted")
    .eq("user_id", uid)
    .eq("group_id", safeGroupId)
    .maybeSingle();

  if (error) throw error;

  if (!data) return false;

  return Boolean((data as { muted?: boolean | null }).muted);
}

/**
 * Marca un grupo como silenciado / no silenciado para el usuario actual.
 * Si no existe fila, hace upsert.
 */
export async function setMyGroupMuteState(
  groupId: string,
  muted: boolean
): Promise<void> {
  const uid = await requireUid();
  const safeGroupId = normalizeGroupId(groupId);

  const { error } = await supabase
    .from("group_notification_settings")
    .upsert(
      {
        user_id: uid,
        group_id: safeGroupId,
        muted,
      },
      {
        onConflict: "user_id,group_id",
      }
    );

  if (error) throw error;
}