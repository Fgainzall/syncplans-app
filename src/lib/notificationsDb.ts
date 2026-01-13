import supabase from "@/lib/supabaseClient";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "conflict" // ✅ DB actual
  | "conflict_detected" // ✅ compat
  | string;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null; // para conflictos: event_id
  created_at: string;
  read_at: string | null;
};

export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}

/**
 * Routing inteligente
 */
export function notificationHref(n: NotificationRow): string {
  const t = String(n.type || "").toLowerCase();

  if (t === "conflict" || t === "conflict_detected") {
    if (n.entity_id) {
      return `/conflicts/compare?eventId=${encodeURIComponent(n.entity_id)}`;
    }
    return "/conflicts/detected";
  }

  return "/calendar";
}
