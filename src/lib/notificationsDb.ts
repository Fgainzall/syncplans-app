import supabase from "@/lib/supabaseClient";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "conflict"
  | "conflict_detected"
  | "group_message"
  | string;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null;
  payload?: any | null;
  created_at: string;
  read_at: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("No auth session");
  return uid;
}

/**
 * 🔔 SOLO NOTIFICACIONES NO LEÍDAS (Inbox Zero)
 */
export async function getMyNotifications(
  limit = 20
): Promise<NotificationRow[]> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .is("read_at", null) // 👈 CLAVE: nunca traer leídas
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", uid);

  if (error) throw error;
}

export async function markAllRead() {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .is("read_at", null); // opcional pero prolijo

  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) throw error;
}

export async function deleteAllNotifications() {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", uid);

  if (error) throw error;
}

export function notificationHref(n: NotificationRow): string {
  const t = String(n.type || "").toLowerCase();

  if (t === "conflict" || t === "conflict_detected") {
    if (n.entity_id) {
      return `/conflicts/compare?eventId=${encodeURIComponent(n.entity_id)}`;
    }
    return "/conflicts/detected";
  }

  if (t === "group_message") {
    if (n.entity_id) {
      return `/groups/${encodeURIComponent(n.entity_id)}`;
    }
    return "/groups";
  }

  return "/calendar";
}
