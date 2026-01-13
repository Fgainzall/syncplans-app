// src/lib/settingsDb.ts
import supabase from "@/lib/supabaseClient";

export type ConflictDefaultResolution = "ask_me" | "keep_existing" | "replace_with_new";
export type PermMode = "owner_only" | "shared_read" | "shared_write";

export type UserSettingsRow = {
  user_id: string;

  notif_enabled: boolean;
  notif_event_invites: boolean;
  notif_conflicts: boolean;
  notif_weekly_summary: boolean;

  conflict_default_resolution: ConflictDefaultResolution;
  conflict_warn_before_save: boolean;

  perm_personal: PermMode;
  perm_pair: PermMode;
  perm_family: PermMode;

  created_at: string;
  updated_at: string;
};

export type UserSettingsPatch = Partial<Omit<UserSettingsRow, "user_id" | "created_at" | "updated_at">>;

const DEFAULTS: Omit<UserSettingsRow, "user_id" | "created_at" | "updated_at"> = {
  notif_enabled: true,
  notif_event_invites: true,
  notif_conflicts: true,
  notif_weekly_summary: true,

  conflict_default_resolution: "ask_me",
  conflict_warn_before_save: true,

  perm_personal: "owner_only",
  perm_pair: "shared_write",
  perm_family: "shared_read",
};

export async function getOrCreateMyUserSettings(): Promise<UserSettingsRow> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const uid = authData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  // Try fetch
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as UserSettingsRow;

  // Create defaults
  const { data: created, error: insErr } = await supabase
    .from("user_settings")
    .insert([{ user_id: uid, ...DEFAULTS }])
    .select("*")
    .single();

  if (insErr) throw insErr;
  return created as UserSettingsRow;
}

export async function updateMyUserSettings(patch: UserSettingsPatch): Promise<UserSettingsRow> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;
  const uid = authData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .update(patch)
    .eq("user_id", uid)
    .select("*")
    .single();

  if (error) throw error;
  return data as UserSettingsRow;
}
