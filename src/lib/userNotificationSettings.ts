// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * API “bonita” que usa tu UI
 *
 * notify_personal  -> event_reminders
 * notify_pair      -> partner_updates
 * notify_family    -> derivado/fallback (porque hoy NO existe family_updates en DB)
 * notify_conflicts -> conflict_alerts
 */
export type NotificationSettings = {
  user_id?: string;

  notify_conflicts: boolean;
  notify_personal: boolean;
  notify_pair: boolean;
  notify_family: boolean;

  updated_at?: string | null;
};

const DEFAULT_UI: Omit<NotificationSettings, "user_id" | "updated_at"> = {
  notify_conflicts: true,
  notify_personal: true,
  notify_pair: true,
  notify_family: true,
};

/**
 * Row real en DB, alineado con tu esquema actual:
 * - user_id
 * - updated_at
 * - event_reminders
 * - conflict_alerts
 * - partner_updates
 *
 * OJO:
 * family_updates NO existe hoy en tu tabla real.
 */
type DbUserNotifRow = {
  user_id: string;
  event_reminders: boolean | null;
  conflict_alerts: boolean | null;
  partner_updates: boolean | null;
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
  const notifyPersonal =
    row.event_reminders ?? DEFAULT_UI.notify_personal;

  const notifyConflicts =
    row.conflict_alerts ?? DEFAULT_UI.notify_conflicts;

  const notifyPair =
    row.partner_updates ?? DEFAULT_UI.notify_pair;

  /**
   * Como hoy no existe family_updates en DB,
   * hacemos fallback conservador:
   * - si el usuario desactiva personales, familia también cae
   * - si no, queda en true por defecto
   *
   * Esto evita mentirle al sistema sobre una columna que no existe.
   */
  const notifyFamily = notifyPersonal;

  return {
    user_id: uid,
    notify_personal: notifyPersonal,
    notify_conflicts: notifyConflicts,
    notify_pair: notifyPair,
    notify_family: notifyFamily,
    updated_at: row.updated_at ?? null,
  };
}

function toDbPatch(
  patch: Partial<Omit<NotificationSettings, "user_id" | "updated_at">>
): Partial<DbUserNotifRow> {
  const db: Partial<DbUserNotifRow> = {};

  if (typeof patch.notify_personal !== "undefined") {
    db.event_reminders = patch.notify_personal;
  }

  if (typeof patch.notify_conflicts !== "undefined") {
    db.conflict_alerts = patch.notify_conflicts;
  }

  if (typeof patch.notify_pair !== "undefined") {
    db.partner_updates = patch.notify_pair;
  }

  /**
   * NO escribimos notify_family porque tu esquema actual
   * no tiene family_updates.
   *
   * Cuando migres la BD para soportarlo de verdad,
   * aquí sí lo conectamos.
   */

  return db;
}

export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("user_id, event_reminders, conflict_alerts, partner_updates, updated_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const insertPayload: DbUserNotifRow = {
      user_id: uid,
      event_reminders: DEFAULT_UI.notify_personal,
      conflict_alerts: DEFAULT_UI.notify_conflicts,
      partner_updates: DEFAULT_UI.notify_pair,
    };

    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert([insertPayload])
      .select("user_id, event_reminders, conflict_alerts, partner_updates, updated_at")
      .single();

    if (insErr) throw insErr;

    return fromDb(created as DbUserNotifRow, uid);
  }

  return fromDb(data as DbUserNotifRow, uid);
}

export async function updateMyNotificationSettings(
  patch: Partial<Omit<NotificationSettings, "user_id" | "updated_at">>
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