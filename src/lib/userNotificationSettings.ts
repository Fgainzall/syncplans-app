// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * 👇 Esta es la "API" que usa tu UI (lo que tú quieres mostrar)
 * Internamente la mapeamos a las columnas reales de la DB:
 *
 * notify_personal  -> event_reminders
 * notify_pair      -> partner_updates
 * notify_family    -> family_updates
 * notify_conflicts -> conflict_alerts
 */
export type NotificationSettings = {
  user_id?: string;

  notify_conflicts: boolean;
  notify_personal: boolean;
  notify_pair: boolean;
  notify_family: boolean;

  created_at?: string | null;
  updated_at?: string | null;
};

// Defaults UI
const DEFAULT_UI: Omit<
  NotificationSettings,
  "user_id" | "created_at" | "updated_at"
> = {
  notify_conflicts: true,
  notify_personal: true,
  notify_pair: true,
  notify_family: true,
};

// Tipado mínimo del row real en DB (según tu screenshot)
type DbUserNotifRow = {
  user_id: string;
  event_reminders: boolean | null;
  conflict_alerts: boolean | null;
  partner_updates: boolean | null;
  family_updates: boolean | null;
  // existen en tu tabla, pero aquí no los usamos todavía:
  weekly_summary?: boolean | null;
  quiet_hours_enabled?: boolean | null;
  quiet_from?: string | null;
  quiet_to?: string | null;

  created_at?: string | null;
  updated_at?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function fromDb(row: DbUserNotifRow, uid: string): NotificationSettings {
  return {
    user_id: uid,
    notify_personal: row.event_reminders ?? DEFAULT_UI.notify_personal,
    notify_conflicts: row.conflict_alerts ?? DEFAULT_UI.notify_conflicts,
    notify_pair: row.partner_updates ?? DEFAULT_UI.notify_pair,
    notify_family: row.family_updates ?? DEFAULT_UI.notify_family,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function toDbPatch(
  patch: Partial<
    Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">
  >
): Partial<DbUserNotifRow> {
  const db: Partial<DbUserNotifRow> = {};

  if (typeof patch.notify_personal !== "undefined")
    db.event_reminders = patch.notify_personal;

  if (typeof patch.notify_conflicts !== "undefined")
    db.conflict_alerts = patch.notify_conflicts;

  if (typeof patch.notify_pair !== "undefined")
    db.partner_updates = patch.notify_pair;

  if (typeof patch.notify_family !== "undefined")
    db.family_updates = patch.notify_family;

  return db;
}

/**
 * Devuelve settings de notificaciones del usuario.
 * Si no existe fila en user_notification_settings, la crea con defaults.
 */
export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select(
      "user_id, event_reminders, conflict_alerts, partner_updates, family_updates, created_at, updated_at"
    )
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // crear defaults usando columnas reales
    const insertPayload: DbUserNotifRow = {
      user_id: uid,
      event_reminders: DEFAULT_UI.notify_personal,
      conflict_alerts: DEFAULT_UI.notify_conflicts,
      partner_updates: DEFAULT_UI.notify_pair,
      family_updates: DEFAULT_UI.notify_family,
    };

    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert([insertPayload])
      .select(
        "user_id, event_reminders, conflict_alerts, partner_updates, family_updates, created_at, updated_at"
      )
      .single();

    if (insErr) throw insErr;

    return fromDb(created as DbUserNotifRow, uid);
  }

  return fromDb(data as DbUserNotifRow, uid);
}

/**
 * Update (patch) de settings del usuario actual (upsert por user_id).
 */
export async function updateMyNotificationSettings(
  patch: Partial<
    Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">
  >
): Promise<void> {
  const uid = await requireUid();

  const payload: Partial<DbUserNotifRow> = {
    user_id: uid,
    ...toDbPatch(patch),
  };

  const { error } = await supabase
    .from("user_notification_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}