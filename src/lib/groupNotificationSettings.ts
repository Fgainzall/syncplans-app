// src/lib/groupNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type GroupNotificationSetting = {
  user_id: string;
  group_id: string;
  muted: boolean;
  updated_at: string;
};

/**
 * Devuelve si este grupo está silenciado para el usuario actual.
 * Si no hay fila, asumimos muted = false (no silenciado).
 */
export async function getMyGroupMuteState(
  groupId: string
): Promise<boolean> {
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");

  const { data, error } = await supabase
    .from("group_notification_settings")
    .select("muted")
    .eq("user_id", userId)
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) throw error;

  // Si no hay fila, por defecto no está silenciado
  if (!data) return false;

  return Boolean((data as any).muted);
}

/**
 * Marca un grupo como silenciado / no silenciado para el usuario actual.
 * Si no existe fila, hace upsert.
 */
export async function setMyGroupMuteState(
  groupId: string,
  muted: boolean
): Promise<void> {
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");

  const { error } = await supabase
    .from("group_notification_settings")
    .upsert(
      {
        user_id: userId,
        group_id: groupId,
        muted,
      },
      {
        onConflict: "user_id,group_id",
        ignoreDuplicates: false,
      }
    );

  if (error) throw error;
}
