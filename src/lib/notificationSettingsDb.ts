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

export async function getMyNotificationSettings(): Promise<NotificationSettings> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");

  // 1) intentamos leer
  const { data, error } = await supabase
    .from("user_notification_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  // 2) si no existe, la creamos con defaults (UX: cero fricción)
  if (!data) {
    const { data: created, error: insErr } = await supabase
      .from("user_notification_settings")
      .insert({ user_id: userId, ...DEFAULTS })
      .select("*")
      .single();

    if (insErr) throw insErr;
    return created as NotificationSettings;
  }

  return data as NotificationSettings;
}

export async function updateMyNotificationSettings(patch: Partial<Omit<NotificationSettings, "user_id" | "updated_at">>) {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  const userId = sessionData.session?.user?.id;
  if (!userId) throw new Error("No auth session");

  const { error } = await supabase
    .from("user_notification_settings")
    .update(patch)
    .eq("user_id", userId);

  if (error) throw error;
}
