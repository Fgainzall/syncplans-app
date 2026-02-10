// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type NotificationSettings = {
  user_id: string;
  notify_conflicts: boolean;
  notify_personal: boolean;
  notify_pair: boolean;
  notify_family: boolean;
  updated_at: string;
};

const DEFAULTS = {
  notify_conflicts: true,
  notify_personal: true,
  notify_pair: true,
  notify_family: true,
};

export async function getMyNotificationSettings(): Promise<NotificationSettings | null> {
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Si no hay fila, devolvemos defaults en memoria
    return {
      user_id: userId,
      updated_at: new Date().toISOString(),
      ...DEFAULTS,
    };
  }

  return data as NotificationSettings;
}

export async function upsertMyNotificationSettings(
  patch: Partial<Omit<NotificationSettings, "user_id" | "updated_at">>
): Promise<NotificationSettings> {
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");

  // Hacemos upsert con defaults si no existe
  const insertPayload = { user_id: userId, ...DEFAULTS, ...patch };

  const { data, error } = await supabase
    .from("user_notification_settings")
    .upsert(insertPayload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as NotificationSettings;
}
