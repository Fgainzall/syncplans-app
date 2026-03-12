// src/lib/notificationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import {
  getMyNotificationSettings,
  type NotificationSettings as UserNotificationSettings,
} from "@/lib/userNotificationSettings";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "event_rejected"
  | "conflict"
  | "conflict_detected"
  | "group_message"
  | "group_invite"
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

export type CreateNotificationInput = {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entity_id?: string | null;
  payload?: any | null;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("No auth session");
  return uid;
}

export async function createNotifications(
  rows: CreateNotificationInput[]
): Promise<number> {
  await requireUid();

  const cleaned = (rows ?? [])
    .map((row) => ({
      user_id: String(row.user_id ?? "").trim(),
      type: String(row.type ?? "").trim(),
      title: String(row.title ?? "").trim(),
      body: row.body ?? null,
      entity_id: row.entity_id ?? null,
      payload: row.payload ?? null,
    }))
    .filter((row) => row.user_id && row.type && row.title);

  if (cleaned.length === 0) return 0;

  const { error } = await supabase.from("notifications").insert(cleaned);
  if (error) throw error;

  return cleaned.length;
}

export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const uid = await requireUid();

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

  let query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mutedGroupIds.length > 0) {
    const list = `(${mutedGroupIds
      .map((id) => `'${String(id).replace(/'/g, "''")}'`)
      .join(",")})`;
    query = query.not("entity_id", "in", list);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as NotificationRow[];
  if (!userNotif) return rows;

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

  return rows.filter((n) => shouldKeepNotification(n, userNotif, groupTypeMap));
}

function shouldKeepNotification(
  n: NotificationRow,
  prefs: UserNotificationSettings,
  groupTypeMap: Record<string, string | null>
): boolean {
  const t = String(n.type || "").toLowerCase();

  if (t === "conflict" || t === "conflict_detected") {
    if (!prefs.notify_conflicts) return false;
    return true;
  }

  if (t === "group_message") {
    const gid = n.entity_id ? String(n.entity_id) : null;
    const gType = gid ? groupTypeMap[gid] : null;
    const gt = (gType || "").toLowerCase();

    if ((gt === "pair" || gt === "couple") && !prefs.notify_pair) return false;
    if (gt === "family" && !prefs.notify_family) return false;
    if ((gt === "solo" || gt === "personal") && !prefs.notify_personal)
      return false;

    return true;
  }

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

export async function deleteNotification(id: string) {
  await markNotificationRead(id);
}

export async function deleteAllNotifications() {
  await markAllRead();
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

  if (t === "group_invite") {
    if (n.entity_id) {
      return `/invitations/accept?invite=${encodeURIComponent(n.entity_id)}`;
    }
    return "/invitations";
  }

  if (t === "event_rejected") {
    return "/calendar";
  }

  return "/calendar";
}