// src/lib/notificationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import {
  getMyNotificationSettings,
  type NotificationSettings as UserNotificationSettings,
} from "./userNotificationSettings";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "conflict"
  | "conflict_detected"
  | "group_message"
  | "group_invite" // 👈 nuevo tipo para invitaciones
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
 * - Respeta grupos silenciados (group_notification_settings.muted = true).
 * - Respeta user_notification_settings (personal / pareja / familia / conflictos).
 */
export async function getMyNotifications(
  limit = 20
): Promise<NotificationRow[]> {
  const uid = await requireUid();

  // 1) Leemos en paralelo:
  //    - grupos silenciados
  //    - preferencias globales de notificaciones del usuario
  const [{ data: mutedRows, error: mutedErr }, userNotif] = await Promise.all([
    supabase
      .from("group_notification_settings")
      .select("group_id, muted")
      .eq("user_id", uid)
      .eq("muted", true),
    getMyNotificationSettings(),
  ]);

  if (mutedErr) throw mutedErr;

  const mutedGroupIds = (mutedRows ?? [])
    .map((r: any) => r.group_id as string)
    .filter(Boolean);

  // 2) Base query de notificaciones NO LEÍDAS
  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .is("read_at", null) // 👈 solo no leídas
    .order("created_at", { ascending: false })
    .limit(limit);

  // 3) Si hay grupos silenciados, excluirlos por entity_id
  //    (para group_message, entity_id = group_id)
  if (mutedGroupIds.length > 0) {
    // Supabase espera un string tipo ('id1','id2',...)
    const list = `(${mutedGroupIds.map((id) => `"${id}"`).join(",")})`;
    query = query.not("entity_id", "in", list);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as NotificationRow[];
  if (!userNotif) return rows;

  // 4) Para notificaciones de grupo, miramos el tipo de grupo (pair/family/solo/other)
  const groupIdsFromNotifications = Array.from(
    new Set(
      rows
        .filter(
          (n) =>
            String(n.type || "").toLowerCase() === "group_message" &&
            n.entity_id
        )
        .map((n) => String(n.entity_id))
    )
  );

  let groupTypeMap: Record<string, string | null> = {};

  if (groupIdsFromNotifications.length > 0) {
    const { data: groups, error: gErr } = await supabase
      .from("groups")
      .select("id, type")
      .in("id", groupIdsFromNotifications);

    if (gErr) throw gErr;

    groupTypeMap = Object.fromEntries(
      (groups ?? []).map((g: any) => [String(g.id), g.type as string | null])
    );
  }

  // 5) Filtro final según preferencias del usuario
  const filtered = rows.filter((n) =>
    shouldKeepNotification(n, userNotif, groupTypeMap)
  );

  return filtered;
}

/**
 * Lógica de filtrado por preferencias:
 * - notify_conflicts → conflictos
 * - notify_personal / notify_pair / notify_family → según tipo de grupo
 */
function shouldKeepNotification(
  n: NotificationRow,
  prefs: UserNotificationSettings,
  groupTypeMap: Record<string, string | null>
): boolean {
  const t = String(n.type || "").toLowerCase();

  // 1) Conflictos → notify_conflicts
  if (t === "conflict" || t === "conflict_detected") {
    if (!prefs.notify_conflicts) return false;
    // Si sí quiere conflictos, la dejamos pasar
    return true;
  }

  // 2) Mensajes de grupo → miramos el tipo de grupo
  if (t === "group_message") {
    const gid = n.entity_id ? String(n.entity_id) : null;
    const gType = gid ? groupTypeMap[gid] : null;
    const gt = (gType || "").toLowerCase();

    if ((gt === "pair" || gt === "couple") && !prefs.notify_pair) return false;
    if (gt === "family" && !prefs.notify_family) return false;
    if ((gt === "solo" || gt === "personal") && !prefs.notify_personal)
      return false;

    // other / desconocido → por ahora la dejamos pasar
    return true;
  }

  // 3) Todo lo demás lo tratamos como "personal"
  if (!prefs.notify_personal) return false;

  return true;
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
    .is("read_at", null);

  if (error) throw error;
}

/**
 * 🧹 "Eliminar" en UI = soft delete:
 * simplemente marcamos como leída para que no vuelva a aparecer
 * en el inbox (getMyNotifications solo trae read_at = NULL).
 */
export async function deleteNotification(id: string) {
  await markNotificationRead(id);
}

/**
 * 🧹 "Eliminar todo" = marcar TODAS como leídas.
 * Así vaciamos el panel manteniendo histórico en la BD.
 */
export async function deleteAllNotifications() {
  await markAllRead();
}

/**
 * Routing inteligente desde una notificación
 */
export function notificationHref(n: NotificationRow): string {
  const t = String(n.type || "").toLowerCase();

  // Conflictos
  if (t === "conflict" || t === "conflict_detected") {
    if (n.entity_id) {
      return `/conflicts/compare?eventId=${encodeURIComponent(n.entity_id)}`;
    }
    return "/conflicts/detected";
  }

  // Mensajes de grupo → ir a la página del grupo
  if (t === "group_message") {
    if (n.entity_id) {
      return `/groups/${encodeURIComponent(n.entity_id)}`;
    }
    return "/groups";
  }

  // Invitaciones de grupo → ir al flujo de aceptación
  if (t === "group_invite") {
    if (n.entity_id) {
      return `/invitations/accept?invite=${encodeURIComponent(n.entity_id)}`;
    }
    return "/invitations";
  }

  // Fallback
  return "/calendar";
}
