// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type NotificationSettings = {
  user_id?: string;

  notify_conflicts: boolean;
  notify_personal: boolean;
  notify_pair: boolean;
  notify_family: boolean;

  created_at?: string | null;
  updated_at?: string | null;
};

const DEFAULT_USER_NOTIF: Omit<NotificationSettings, "user_id" | "created_at" | "updated_at"> =
  {
    notify_conflicts: true,
    notify_personal: true,
    notify_pair: true,
    notify_family: true,
  };

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

/**
 * Devuelve settings de notificaciones del usuario.
 * Si no existe fila en user_notification_settings, la crea con defaults.
 */
export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // crear defaults
    const insertPayload = {
      user_id: uid,
      ...DEFAULT_USER_NOTIF,
    };

    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert([insertPayload])
      .select("*")
      .single();

    if (insErr) throw insErr;

    return {
      user_id: uid,
      notify_conflicts: created.notify_conflicts ?? DEFAULT_USER_NOTIF.notify_conflicts,
      notify_personal: created.notify_personal ?? DEFAULT_USER_NOTIF.notify_personal,
      notify_pair: created.notify_pair ?? DEFAULT_USER_NOTIF.notify_pair,
      notify_family: created.notify_family ?? DEFAULT_USER_NOTIF.notify_family,
      created_at: created.created_at ?? null,
      updated_at: created.updated_at ?? null,
    };
  }

  // normalizar nulls
  return {
    user_id: uid,
    notify_conflicts: (data as any).notify_conflicts ?? DEFAULT_USER_NOTIF.notify_conflicts,
    notify_personal: (data as any).notify_personal ?? DEFAULT_USER_NOTIF.notify_personal,
    notify_pair: (data as any).notify_pair ?? DEFAULT_USER_NOTIF.notify_pair,
    notify_family: (data as any).notify_family ?? DEFAULT_USER_NOTIF.notify_family,
    created_at: (data as any).created_at ?? null,
    updated_at: (data as any).updated_at ?? null,
  };
}

/**
 * Update (patch) de settings del usuario actual (upsert por user_id).
 */
export async function updateMyNotificationSettings(
  patch: Partial<Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">>
): Promise<void> {
  const uid = await requireUid();

  const payload = {
    user_id: uid,
    ...patch,
  };

  const { error } = await supabase
    .from("user_notification_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}