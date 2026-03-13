// src/lib/notificationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import {
  getMyNotificationSettings,
  type NotificationSettings as UserNotificationSettings,
} from "@/lib/userNotificationSettings";
import { computeVisibleConflicts, attachEvents } from "@/lib/conflicts";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";

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

export type ConflictNotificationResult = {
  created: number;
  conflictCount: number;
  targetEventId: string | null;
};

type AttachedConflict = {
  id: string;
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;
  existingEvent?: {
    id: string;
    title?: string;
    groupId?: string | null;
  } | null;
  incomingEvent?: {
    id: string;
    title?: string;
    groupId?: string | null;
  } | null;
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

async function hasUnreadConflictNotificationForEvent(
  uid: string,
  eventId: string
): Promise<boolean> {
  if (!eventId) return false;

  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", uid)
    .eq("type", "conflict_detected")
    .eq("entity_id", eventId)
    .is("read_at", null)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

function buildAttachedConflicts(
  events: any[]
): AttachedConflict[] {
  const cx = computeVisibleConflicts(events);
  return attachEvents(cx, events) as unknown as AttachedConflict[];
}

export async function createConflictNotificationForEvent(
  eventId: string
): Promise<ConflictNotificationResult> {
  const uid = await requireUid();
  const safeEventId = String(eventId ?? "").trim();

  if (!safeEventId) {
    return { created: 0, conflictCount: 0, targetEventId: null };
  }

  const { events } = await loadEventsFromDb();
  const attached = buildAttachedConflicts(events);

  const related = attached.filter(
    (c) =>
      String(c.existingEventId) === safeEventId ||
      String(c.incomingEventId) === safeEventId
  );

  if (related.length === 0) {
    return { created: 0, conflictCount: 0, targetEventId: safeEventId };
  }

  const targetEvent =
    events.find((e: any) => String(e.id) === safeEventId) ?? null;

  const alreadyExists = await hasUnreadConflictNotificationForEvent(
    uid,
    safeEventId
  );

  if (alreadyExists) {
    return {
      created: 0,
      conflictCount: related.length,
      targetEventId: safeEventId,
    };
  }

  const count = related.length;
  const title =
    count === 1
      ? "Se detectó 1 conflicto nuevo"
      : `Se detectaron ${count} conflictos nuevos`;

  const body = targetEvent?.title
    ? `“${targetEvent.title}” se cruza con otro horario. Revísalo ahora.`
    : "Tu nuevo evento se cruza con otro horario. Revísalo ahora.";

  const created = await createNotifications([
    {
      user_id: uid,
      type: "conflict_detected",
      title,
      body,
      entity_id: safeEventId,
      payload: {
        source: "event_save",
        event_id: safeEventId,
        conflict_count: count,
        conflict_ids: related.map((c) => c.id),
      },
    },
  ]);

  return {
    created,
    conflictCount: count,
    targetEventId: safeEventId,
  };
}

export async function createConflictNotificationForGroup(
  groupId: string
): Promise<ConflictNotificationResult> {
  const uid = await requireUid();
  const safeGroupId = String(groupId ?? "").trim();

  if (!safeGroupId) {
    return { created: 0, conflictCount: 0, targetEventId: null };
  }

  const { events } = await loadEventsFromDb();
  const attached = buildAttachedConflicts(events);

  const related = attached.filter((c) => {
    const aGroupId = c.existingEvent?.groupId ?? null;
    const bGroupId = c.incomingEvent?.groupId ?? null;

    return (
      (aGroupId && String(aGroupId) === safeGroupId) ||
      (bGroupId && String(bGroupId) === safeGroupId)
    );
  });

  if (related.length === 0) {
    return { created: 0, conflictCount: 0, targetEventId: null };
  }

  const targetEvent =
    related.find(
      (c) => c.existingEvent?.groupId && String(c.existingEvent.groupId) === safeGroupId
    )?.existingEvent ??
    related.find(
      (c) => c.incomingEvent?.groupId && String(c.incomingEvent.groupId) === safeGroupId
    )?.incomingEvent ??
    null;

  const targetEventId = targetEvent?.id ? String(targetEvent.id) : null;

  if (targetEventId) {
    const alreadyExists = await hasUnreadConflictNotificationForEvent(
      uid,
      targetEventId
    );

    if (alreadyExists) {
      return {
        created: 0,
        conflictCount: related.length,
        targetEventId,
      };
    }
  }

  const count = related.length;
  const title =
    count === 1
      ? "Al unirte se detectó 1 conflicto"
      : `Al unirte se detectaron ${count} conflictos`;

  const body = targetEvent?.title
    ? `“${targetEvent.title}” entra en conflicto con tu agenda actual. Revísalo ahora.`
    : "Tu nuevo grupo trae eventos que chocan con tu agenda actual. Revísalo ahora.";

  const created = await createNotifications([
    {
      user_id: uid,
      type: "conflict_detected",
      title,
      body,
      entity_id: targetEventId,
      payload: {
        source: "invite_accept",
        group_id: safeGroupId,
        event_id: targetEventId,
        conflict_count: count,
        conflict_ids: related.map((c) => c.id),
      },
    },
  ]);

  return {
    created,
    conflictCount: count,
    targetEventId,
  };
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
export async function getUnreadConflictNotificationsSummary(): Promise<{
  count: number;
  latestEventId: string | null;
}> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("notifications")
    .select("entity_id, created_at")
    .eq("user_id", uid)
    .in("type", ["conflict", "conflict_detected"])
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  const latestEventId =
    rows.find((r: any) => r?.entity_id)?.entity_id
      ? String(rows.find((r: any) => r?.entity_id)?.entity_id)
      : null;

  return {
    count: rows.length,
    latestEventId,
  };
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