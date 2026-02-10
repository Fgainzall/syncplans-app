// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type NotificationSettings = {
  notify_conflicts: boolean;
  notify_personal: boolean;
  notify_pair: boolean;
  notify_family: boolean;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_USER_NOTIF: NotificationSettings = {
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
 * Devuelve los ajustes de notificaciones por tipo de grupo
 * (personal / pareja / familia / conflictos).
 *
 * Si no existe fila en user_notification_settings, la crea con defaults.
 */
export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const uid = await requireUid();

  // Intentar leer fila existente
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Crear fila por defecto
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
      notify_conflicts: created.notify_conflicts,
      notify_personal: created.notify_personal,
      notify_pair: created.notify_pair,
      notify_family: created.notify_family,
      created_at: created.created_at,
      updated_at: created.updated_at,
    } as NotificationSettings;
  }

  // Normalizar por si hay nulls
  return {
    notify_conflicts:
      (data as any).notify_conflicts ?? DEFAULT_USER_NOTIF.notify_conflicts,
    notify_personal:
      (data as any).notify_personal ?? DEFAULT_USER_NOTIF.notify_personal,
    notify_pair: (data as any).notify_pair ?? DEFAULT_USER_NOTIF.notify_pair,
    notify_family:
      (data as any).notify_family ?? DEFAULT_USER_NOTIF.notify_family,
    created_at: (data as any).created_at,
    updated_at: (data as any).updated_at,
  };
}

/**
 * Actualiza los ajustes del usuario actual.
 * Recibe solo un patch parcial (como lo usas desde settings/notifications).
 */
export async function updateMyNotificationSettings(
  patch: Partial<NotificationSettings>
): Promise<void> {
  const uid = await requireUid();

  const payload = {
    user_id: uid,
    ...patch,
  };

  const { error } = await supabase
    .from("user_notification_settings")
    .upsert(payload, {
      onConflict: "user_id",
    });

  if (error) throw error;
}
