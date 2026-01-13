import supabase from "@/lib/supabaseClient";

export type ConflictDefaultResolution = "ask_me" | "keep_existing" | "replace_with_new";
export type PermMode = "owner_only" | "shared_read" | "shared_write";

export type NotificationSettings = {
  // Notificaciones
  eventReminders: boolean;
  conflictAlerts: boolean;
  partnerUpdates: boolean;
  familyUpdates: boolean;
  weeklySummary: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietFrom: string; // "HH:MM"
  quietTo: string;   // "HH:MM"

  // Conflictos
  conflictWarnBeforeSave: boolean;
  conflictDefaultResolution: ConflictDefaultResolution;

  // Permisos
  permPersonal: PermMode;
  permPair: PermMode;
  permFamily: PermMode;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  eventReminders: true,
  conflictAlerts: true,
  partnerUpdates: true,
  familyUpdates: true,
  weeklySummary: true,

  quietHoursEnabled: false,
  quietFrom: "22:00",
  quietTo: "07:30",

  conflictWarnBeforeSave: true,
  conflictDefaultResolution: "ask_me",

  permPersonal: "owner_only",
  permPair: "shared_write",
  permFamily: "shared_read",
};

function clampTime(t: string, fallback: string) {
  if (!t || typeof t !== "string") return fallback;
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return fallback;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return fallback;
  if (hh < 0 || hh > 23) return fallback;
  if (mm < 0 || mm > 59) return fallback;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizeSettings(x: Partial<NotificationSettings> | null | undefined): NotificationSettings {
  const v = x ?? {};
  return {
    eventReminders: v.eventReminders ?? DEFAULT_SETTINGS.eventReminders,
    conflictAlerts: v.conflictAlerts ?? DEFAULT_SETTINGS.conflictAlerts,
    partnerUpdates: v.partnerUpdates ?? DEFAULT_SETTINGS.partnerUpdates,
    familyUpdates: v.familyUpdates ?? DEFAULT_SETTINGS.familyUpdates,
    weeklySummary: v.weeklySummary ?? DEFAULT_SETTINGS.weeklySummary,

    quietHoursEnabled: v.quietHoursEnabled ?? DEFAULT_SETTINGS.quietHoursEnabled,
    quietFrom: clampTime(v.quietFrom ?? DEFAULT_SETTINGS.quietFrom, DEFAULT_SETTINGS.quietFrom),
    quietTo: clampTime(v.quietTo ?? DEFAULT_SETTINGS.quietTo, DEFAULT_SETTINGS.quietTo),

    conflictWarnBeforeSave: v.conflictWarnBeforeSave ?? DEFAULT_SETTINGS.conflictWarnBeforeSave,
    conflictDefaultResolution: (v.conflictDefaultResolution ?? DEFAULT_SETTINGS.conflictDefaultResolution) as ConflictDefaultResolution,

    permPersonal: (v.permPersonal ?? DEFAULT_SETTINGS.permPersonal) as PermMode,
    permPair: (v.permPair ?? DEFAULT_SETTINGS.permPair) as PermMode,
    permFamily: (v.permFamily ?? DEFAULT_SETTINGS.permFamily) as PermMode,
  };
}

type DbRow = {
  user_id: string;

  event_reminders: boolean | null;
  conflict_alerts: boolean | null;
  partner_updates: boolean | null;
  family_updates: boolean | null;
  weekly_summary: boolean | null;

  quiet_hours_enabled: boolean | null;
  quiet_from: string | null;
  quiet_to: string | null;

  conflict_warn_before_save: boolean | null;
  conflict_default_resolution: string | null;

  perm_personal: string | null;
  perm_pair: string | null;
  perm_family: string | null;
};

function fromDb(row: DbRow): NotificationSettings {
  return normalizeSettings({
    eventReminders: row.event_reminders ?? DEFAULT_SETTINGS.eventReminders,
    conflictAlerts: row.conflict_alerts ?? DEFAULT_SETTINGS.conflictAlerts,
    partnerUpdates: row.partner_updates ?? DEFAULT_SETTINGS.partnerUpdates,
    familyUpdates: row.family_updates ?? DEFAULT_SETTINGS.familyUpdates,
    weeklySummary: row.weekly_summary ?? DEFAULT_SETTINGS.weeklySummary,

    quietHoursEnabled: row.quiet_hours_enabled ?? DEFAULT_SETTINGS.quietHoursEnabled,
    quietFrom: row.quiet_from ?? DEFAULT_SETTINGS.quietFrom,
    quietTo: row.quiet_to ?? DEFAULT_SETTINGS.quietTo,

    conflictWarnBeforeSave: row.conflict_warn_before_save ?? DEFAULT_SETTINGS.conflictWarnBeforeSave,
    conflictDefaultResolution: (row.conflict_default_resolution as any) ?? DEFAULT_SETTINGS.conflictDefaultResolution,

    permPersonal: (row.perm_personal as any) ?? DEFAULT_SETTINGS.permPersonal,
    permPair: (row.perm_pair as any) ?? DEFAULT_SETTINGS.permPair,
    permFamily: (row.perm_family as any) ?? DEFAULT_SETTINGS.permFamily,
  });
}

function toDb(uid: string, s: NotificationSettings): Partial<DbRow> {
  const n = normalizeSettings(s);
  return {
    user_id: uid,
    event_reminders: n.eventReminders,
    conflict_alerts: n.conflictAlerts,
    partner_updates: n.partnerUpdates,
    family_updates: n.familyUpdates,
    weekly_summary: n.weeklySummary,

    quiet_hours_enabled: n.quietHoursEnabled,
    quiet_from: n.quietFrom,
    quiet_to: n.quietTo,

    conflict_warn_before_save: n.conflictWarnBeforeSave,
    conflict_default_resolution: n.conflictDefaultResolution,

    perm_personal: n.permPersonal,
    perm_pair: n.permPair,
    perm_family: n.permFamily,
  };
}

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

export async function getSettingsFromDb(): Promise<NotificationSettings> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    const payload = toDb(uid, DEFAULT_SETTINGS);
    const { data: created, error: insErr } = await supabase
      .from("user_settings")
      .insert([payload])
      .select("*")
      .single();

    if (insErr) throw insErr;
    return fromDb(created as DbRow);
  }

  return fromDb(data as DbRow);
}

export async function saveSettingsToDb(next: NotificationSettings): Promise<void> {
  const uid = await requireUid();
  const payload = toDb(uid, next);

  const { error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) throw error;
}

export async function resetSettingsToDb(): Promise<NotificationSettings> {
  const uid = await requireUid();
  const payload = toDb(uid, DEFAULT_SETTINGS);

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return fromDb(data as DbRow);
}
