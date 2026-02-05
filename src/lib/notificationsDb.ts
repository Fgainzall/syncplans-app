// src/lib/notificationsDb.ts
import supabase from "@/lib/supabaseClient";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "conflict"            // ✅ DB actual
  | "conflict_detected"   // ✅ compat
  | "group_message"       // 💬 mensajes de grupo
  | string;

export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  entity_id: string | null; // para conflictos: event_id, para mensajes: message_id (fallback)
  created_at: string;
  read_at: string | null;

  // Campos opcionales si los agregas en la DB para mensajes de grupo
  group_id?: string | null;
  message_id?: string | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("No auth session");
  return uid;
}

export async function getMyNotifications(
  limit = 20
): Promise<NotificationRow[]> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
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

  // Marcamos TODAS las notificaciones de este usuario como leídas
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid);

  if (error) throw error;
}

/** Borra una notificación concreta (por id) del usuario actual */
export async function deleteNotification(id: string) {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) throw error;
}

/** Borra TODAS las notificaciones del usuario actual */
export async function deleteAllNotifications() {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", uid);

  if (error) throw error;
}

/**
 * Routing inteligente
 */
export function notificationHref(n: NotificationRow): string {
  const t = String(n.type || "").toLowerCase();

  // 🔺 Conflictos
  if (t === "conflict" || t === "conflict_detected") {
    if (n.entity_id) {
      return `/conflicts/compare?eventId=${encodeURIComponent(n.entity_id)}`;
    }
    return "/conflicts/detected";
  }

  // 💬 Mensajes de grupo
  if (t === "group_message") {
    const asAny = n as any;
    const groupId: string | null =
      asAny.group_id ?? null;

    // message_id preferente; entity_id como fallback
    const messageId: string | null =
      asAny.message_id ?? n.entity_id ?? null;

    if (groupId && messageId) {
      return `/groups/${groupId}?msg=${encodeURIComponent(messageId)}`;
    }
    if (groupId) {
      return `/groups/${groupId}`;
    }
    return "/groups";
  }

  // Default
  return "/calendar";
}
