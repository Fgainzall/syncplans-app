// src/lib/userNotificationSettings.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * ✅ Interfaz que usa tu UI / settings / notificationsDb
 * La mantenemos IGUAL (notify_*) para no tocar 20 archivos.
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

/**
 * ✅ Defaults "lógicos" para la app.
 */
const DEFAULT_USER_NOTIF: Omit<
  NotificationSettings,
  "user_id" | "created_at" | "updated_at"
> = {
  notify_conflicts: true,
  notify_personal: true,
  notify_pair: true,
  notify_family: true,
};

/**
 * ✅ Columnas REALES en la tabla public.user_notification_settings (según tu screenshot).
 * - event_reminders (bool)
 * - conflict_alerts (bool)
 * - partner_updates (bool)
 * - family_updates (bool)
 * - weekly_summary (bool)
 * - quiet_hours_enabled (bool)
 * - quiet_from (text)
 * - quiet_to (text)
 */
type DbUserNotifRow = {
  user_id: string;

  updated_at?: string | null;

  event_reminders?: boolean | null;
  conflict_alerts?: boolean | null;
  partner_updates?: boolean | null;
  family_updates?: boolean | null;
  weekly_summary?: boolean | null;

  quiet_hours_enabled?: boolean | null;
  quiet_from?: string | null;
  quiet_to?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

/**
 * ✅ Mapeo DB -> UI (notify_*)
 */
function mapDbToUi(row: DbUserNotifRow): NotificationSettings {
  return {
    user_id: row.user_id,

    // ✅ conflictos -> conflict_alerts
    notify_conflicts:
      row.conflict_alerts ?? DEFAULT_USER_NOTIF.notify_conflicts,

    // ✅ personal -> event_reminders (lo más cercano)
    notify_personal:
      row.event_reminders ?? DEFAULT_USER_NOTIF.notify_personal,

    // ✅ pareja -> partner_updates
    notify_pair: row.partner_updates ?? DEFAULT_USER_NOTIF.notify_pair,

    // ✅ familia -> family_updates
    notify_family: row.family_updates ?? DEFAULT_USER_NOTIF.notify_family,

    updated_at: row.updated_at ?? null,
    created_at: null, // tu tabla no muestra created_at en screenshot; no lo asumimos
  };
}

/**
 * ✅ Mapeo UI (notify_*) -> DB (columnas reales)
 * Nota: NO tocamos weekly_summary aquí porque tú lo manejas por appSettings (settings.ts)
 */
function mapUiPatchToDb(
  patch: Partial<
    Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">
  >
): Partial<DbUserNotifRow> {
  const out: Partial<DbUserNotifRow> = {};

  if (typeof patch.notify_conflicts !== "undefined") {
    out.conflict_alerts = patch.notify_conflicts;
  }
  if (typeof patch.notify_personal !== "undefined") {
    out.event_reminders = patch.notify_personal;
  }
  if (typeof patch.notify_pair !== "undefined") {
    out.partner_updates = patch.notify_pair;
  }
  if (typeof patch.notify_family !== "undefined") {
    out.family_updates = patch.notify_family;
  }

  return out;
}

/**
 * Devuelve settings de notificaciones del usuario.
 * Si no existe fila en user_notification_settings, la crea con defaults (en columnas REALES).
 */
export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("user_notification_settings")
    // ✅ pedimos SOLO columnas reales (evita select * raro + TS)
    .select(
      "user_id, updated_at, event_reminders, conflict_alerts, partner_updates, family_updates, weekly_summary, quiet_hours_enabled, quiet_from, quiet_to"
    )
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // ✅ crear defaults usando columnas reales
    const insertPayload: DbUserNotifRow = {
      user_id: uid,
      event_reminders: DEFAULT_USER_NOTIF.notify_personal,
      conflict_alerts: DEFAULT_USER_NOTIF.notify_conflicts,
      partner_updates: DEFAULT_USER_NOTIF.notify_pair,
      family_updates: DEFAULT_USER_NOTIF.notify_family,
      // weekly_summary lo dejamos tal cual (si existe lógica aparte)
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert([insertPayload])
      .select(
        "user_id, updated_at, event_reminders, conflict_alerts, partner_updates, family_updates, weekly_summary, quiet_hours_enabled, quiet_from, quiet_to"
      )
      .single();

    if (insErr) throw insErr;

    return mapDbToUi(created as DbUserNotifRow);
  }

  return mapDbToUi(data as DbUserNotifRow);
}

/**
 * Update (patch) de settings del usuario actual (upsert por user_id).
 * ✅ Sigue recibiendo notify_* (UI), pero guarda en columnas reales.
 */
export async function updateMyNotificationSettings(
  patch: Partial<
    Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">
  >
): Promise<void> {
  const uid = await requireUid();

  const dbPatch = mapUiPatchToDb(patch);

  const payload: Partial<DbUserNotifRow> = {
    user_id: uid,
    ...dbPatch,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("user_notification_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}

/**
 * ✅ Alias de compatibilidad (por si algún archivo llama "upsertMyNotificationSettings")
 * No rompe nada si ya lo tenías en otro lugar.
 */
export async function upsertMyNotificationSettings(
  patch: Partial<
    Omit<NotificationSettings, "user_id" | "created_at" | "updated_at">
  >
): Promise<void> {
  return updateMyNotificationSettings(patch);
}