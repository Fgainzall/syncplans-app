// src/lib/settingsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type ConflictDefaultResolution =
  | "ask_me"
  | "keep_existing"
  | "replace_with_new";

export type PermMode = "owner_only" | "shared_read" | "shared_write";

export type UserSettingsRow = {
  user_id: string;

  notif_enabled: boolean;
  notif_event_invites: boolean;
  notif_conflicts: boolean;
  notif_weekly_summary: boolean;

  conflict_default_resolution: ConflictDefaultResolution;
  conflict_warn_before_save: boolean;

  perm_mode_pair: PermMode;
  perm_mode_family: PermMode;

  created_at: string;
  updated_at: string;
};

const DEFAULT_SETTINGS: Omit<
  UserSettingsRow,
  "user_id" | "created_at" | "updated_at"
> = {
  notif_enabled: true,
  notif_event_invites: true,
  notif_conflicts: true,
  notif_weekly_summary: true,

  conflict_default_resolution: "ask_me",
  conflict_warn_before_save: true,

  perm_mode_pair: "shared_write",
  perm_mode_family: "shared_write",
};

export async function getMySettings(): Promise<UserSettingsRow> {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw authErr;

  const uid = authData.user?.id;
  if (!uid) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Si no existe fila, devolvemos defaults en memoria
    const now = new Date().toISOString();
    return {
      user_id: uid,
      created_at: now,
      updated_at: now,
      ...DEFAULT_SETTINGS,
    };
  }

  return data as UserSettingsRow;
}

export async function updateMySettings(
  patch: Partial<Omit<UserSettingsRow, "user_id" | "created_at" | "updated_at">>
): Promise<UserSettingsRow> {
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
