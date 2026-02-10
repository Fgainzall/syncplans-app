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

const DEFAULTS: Omit<
  NotificationSettings,
  "user_id" | "updated_at"
> = {
  notify_conflicts: true,
  notify_personal: true,
  notify_pair: true,
  notify_family: true,
};

type DbRow = {
  user_id: string;
  notify_conflicts: boolean | null;
  notify_personal: boolean | null;
  notify_pair: boolean | null;
  notify_family: boolean | null;
  updated_at: string;
};

function fromDb(row: DbRow): NotificationSettings {
  return {
    user_id: row.user_id,
    notify_conflicts: row.notify_conflicts ?? DEFAULTS.notify_conflicts,
    notify_personal: row.notify_personal ?? DEFAULTS.notify_personal,
    notify_pair: row.notify_pair ?? DEFAULTS.notify_pair,
    notify_family: row.notify_family ?? DEFAULTS.notify_family,
    updated_at: row.updated_at,
  };
}

async function requireUid(): Promise<string> {
  const { data: sessionData, error: sessionErr } =
    await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");
  return userId;
}

export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const userId = await requireUid();

  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  // Si no hay fila, la creamos con defaults
  if (!data) {
    const insertPayload = { user_id: userId, ...DEFAULTS };

    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert(insertPayload)
      .select("*")
      .single();

    if (insErr) throw insErr;
    return fromDb(created as DbRow);
  }

  return fromDb(data as DbRow);
}

export async function updateMyNotificationSettings(
  patch: Partial<Omit<NotificationSettings, "user_id" | "updated_at">>
) {
  const userId = await requireUid();

  const { error } = await supabase
    .from("user_notification_settings")
    .update(patch)
    .eq("user_id", userId);

  if (error) throw error;
}
