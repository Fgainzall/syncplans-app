// src/lib/notificationsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import {
  getMyNotificationSettings,
  type NotificationSettings as UserNotificationSettings,
} from "@/lib/userNotificationSettings";
import { computeVisibleConflicts, attachEvents } from "@/lib/conflicts";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import { normalizePreferenceGroupType } from "@/lib/naming";
import { getMyConflictResolutionsMap } from "@/lib/conflictResolutionsDb";
import { getIgnoredConflictKeys } from "@/lib/conflictPrefs";
import { getMyDeclinedEventIds } from "@/lib/eventResponsesDb";
import { filterIgnoredConflicts, type CalendarEvent, type ConflictItem } from "@/lib/conflicts";

export type NotificationType =
  | "event_created"
  | "event_deleted"
  | "event_rejected"
  | "conflict"
  | "conflict_detected"
  | "conflict_decision"
  | "conflict_auto_adjusted"
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
payload?: NotificationPayload | null;
  created_at: string;
  read_at: string | null;
};

export type CreateNotificationInput = {
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entity_id?: string | null;
  payload?: NotificationPayload | null;
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
type NotificationPayload = {
  event_id?: unknown;
  eventId?: unknown;
  incoming_event_id?: unknown;
  incomingEventId?: unknown;
  existing_event_id?: unknown;
  existingEventId?: unknown;
  targetEventId?: unknown;
  affectedEventId?: unknown;
  keptEventId?: unknown;
  eventIds?: unknown;
  event_ids?: unknown;
  [key: string]: unknown;
};

type NotificationDbRow = {
  id?: unknown;
  user_id?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  entity_id?: unknown;
  payload?: unknown;
  created_at?: unknown;
  read_at?: unknown;
};

type ConflictEventDbRow = {
  id?: unknown;
  title?: unknown;
  start?: unknown;
  start_at?: unknown;
  end?: unknown;
  end_at?: unknown;
  group_id?: unknown;
  owner_id?: unknown;
  created_by?: unknown;
  user_id?: unknown;
  type?: unknown;
  group_type?: unknown;
  groupType?: unknown;
  notes?: unknown;
  description?: unknown;
};

type NotificationEventLike = CalendarEvent;

type MutedGroupRow = {
  group_id?: string | null;
};

type NotificationGroupRow = {
  id?: string | null;
  type?: string | null;
};
const CONFLICT_NOTIFICATION_TYPES = [
  "conflict",
  "conflict_detected",
  "conflict_decision",
  "conflict_auto_adjusted",
] as const;

/* ======================================================
  Auth / normalización base
====================================================== */

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) {
    throw new Error("No hay sesión activa. Inicia sesión nuevamente.");
  }

  return uid;
}

function normalizeNotificationRow(row: CreateNotificationInput) {
  return {
    user_id: String(row.user_id ?? "").trim(),
    type: String(row.type ?? "").trim(),
    title: String(row.title ?? "").trim(),
    body: row.body ?? null,
    entity_id: row.entity_id ? String(row.entity_id).trim() : null,
    payload: row.payload ?? null,
  };
}

function uniqueNotificationKey(row: {
  user_id: string;
  type: string;
  entity_id: string | null;
  title: string;
  body: string | null;
}) {
  return [
    row.user_id,
    row.type,
    row.entity_id ?? "",
    row.title,
    row.body ?? "",
  ].join("::");
}

function isConflictNotificationType(value: unknown): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CONFLICT_NOTIFICATION_TYPES.includes(
    normalized as (typeof CONFLICT_NOTIFICATION_TYPES)[number]
  );
}

function normalizeNotificationRecord(row: NotificationDbRow): NotificationRow {
  return {
    id: String(row?.id ?? ""),
    user_id: String(row?.user_id ?? ""),
    type: String(row?.type ?? "") as NotificationType,
    title: String(row?.title ?? ""),
    body: row?.body == null ? null : String(row.body),
    entity_id: row?.entity_id == null ? null : String(row.entity_id),
    payload:
      row?.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as NotificationPayload)
        : null,
    created_at: String(row?.created_at ?? ""),
    read_at: row?.read_at == null ? null : String(row.read_at),
  };
}

function normalizeGroupTypeForPrefs(value: unknown): string {
  return normalizePreferenceGroupType(String(value ?? ""));
}

function extractEventIdsFromPayload(
  payload: NotificationPayload | null | undefined,
  entityId?: string | null
): string[] {
  const eventIds = Array.isArray(payload?.event_ids)
    ? payload.event_ids
    : Array.isArray(payload?.eventIds)
      ? payload.eventIds
      : [];

  return Array.from(
    new Set(
      [
        entityId ?? null,
        payload?.event_id,
        payload?.eventId,
        payload?.incoming_event_id,
        payload?.incomingEventId,
        payload?.existing_event_id,
        payload?.existingEventId,
        payload?.targetEventId,
        payload?.affectedEventId,
        payload?.keptEventId,
        ...eventIds,
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeConflictEventFromDb(row: ConflictEventDbRow): CalendarEvent | null {
  const id = String(row?.id ?? "").trim();
  const start = String(row?.start ?? row?.start_at ?? "").trim();
  const end = String(row?.end ?? row?.end_at ?? start).trim();

  if (!id || !start || !end) return null;

  return {
    id,
    title: String(row?.title ?? "Sin título"),
    start,
    end,
    groupId: row?.group_id ? String(row.group_id) : null,
    groupType: normalizeGroupTypeForPrefs(row?.group_type ?? row?.groupType ?? "personal"),
    description:
      typeof row?.notes === "string"
        ? row.notes
        : typeof row?.description === "string"
          ? row.description
          : undefined,
  } satisfies CalendarEvent;
}

function resolutionForConflictId(
  conflict: Pick<ConflictItem, "id">,
  resMap: Record<string, string>
): string | null {
  const direct = String(resMap?.[String(conflict.id)] ?? "").trim();
  return direct || null;
}

async function getLiveConflictSummary(): Promise<{
  count: number;
  latestEventId: string | null;
}> {
  const [{ events }, resMap, ignoredConflictKeys, declinedEventIds] =
    await Promise.all([
      loadEventsFromDb(),
      getMyConflictResolutionsMap().catch(() => ({})),
      getIgnoredConflictKeys().catch(() => new Set<string>()),
      getMyDeclinedEventIds().catch(() => new Set<string>()),
    ]);

  const usableEvents = (Array.isArray(events) ? events : [])
    .map(normalizeConflictEventFromDb)
    .filter(Boolean)
    .filter((event) => !declinedEventIds.has(String(event!.id))) as CalendarEvent[];

  if (usableEvents.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const computed = filterIgnoredConflicts(
    computeVisibleConflicts(usableEvents),
    ignoredConflictKeys
  ).filter((conflict) => !resolutionForConflictId(conflict, resMap));

  if (computed.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const eventsById = new Map(usableEvents.map((event) => [String(event.id), event]));
  let latestEventId: string | null = null;
  let latestStartMs = -1;

  for (const conflict of computed) {
    const candidates = [
      eventsById.get(String(conflict.existingEventId)),
      eventsById.get(String(conflict.incomingEventId)),
    ].filter(Boolean) as CalendarEvent[];

    for (const event of candidates) {
      const ms = new Date(event.start).getTime();
      if (Number.isNaN(ms)) continue;
      if (ms > latestStartMs) {
        latestStartMs = ms;
        latestEventId = String(event.id);
      }
    }
  }

  return {
    count: computed.length,
    latestEventId,
  };
}

/* ======================================================
  Creación
====================================================== */

export async function createNotifications(
  rows: CreateNotificationInput[]
): Promise<number> {
  await requireUid();

  const cleaned = (rows ?? [])
    .map(normalizeNotificationRow)
    .filter((row) => row.user_id && row.type && row.title);

  if (cleaned.length === 0) return 0;

  const deduped = Array.from(
    new Map(cleaned.map((row) => [uniqueNotificationKey(row), row])).values()
  );

  const { error } = await supabase.from("notifications").insert(deduped);

  if (error) {
    console.error("[createNotifications] insert error", error, deduped);
    throw error;
  }

  return deduped.length;
}

export async function createNotification(
  row: CreateNotificationInput
): Promise<number> {
  return createNotifications([row]);
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

function buildAttachedConflicts(events: NotificationEventLike[]): AttachedConflict[] {
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
   events.find((e) => String(e.id) === safeEventId) ?? null;

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
      (c) =>
        c.existingEvent?.groupId &&
        String(c.existingEvent.groupId) === safeGroupId
    )?.existingEvent ??
    related.find(
      (c) =>
        c.incomingEvent?.groupId &&
        String(c.incomingEvent.groupId) === safeGroupId
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

export async function createConflictDecisionNotification(input: {
  userId: string;
  decisionLabel: string;
  entityId?: string | null;
payload?: NotificationPayload | null;
}) {
  return createNotification({
    user_id: input.userId,
    type: "conflict_decision",
    title: "Se tomó una decisión sobre un conflicto",
    body: input.decisionLabel,
    entity_id: input.entityId ?? null,
    payload: {
      ...(input.payload ?? {}),
      source: "conflict_decision",
    },
  });
}

export async function createConflictAutoAdjustedNotification(input: {
  userId: string;
  decisionLabel: string;
  entityId?: string | null;
payload?: NotificationPayload | null;
}) {
  return createNotification({
    user_id: input.userId,
    type: "conflict_auto_adjusted",
    title: "Se aplicó un ajuste automático",
    body: input.decisionLabel,
    entity_id: input.entityId ?? null,
    payload: {
      ...(input.payload ?? {}),
      source: "conflict_auto_adjusted",
      fallback_applied: true,
    },
  });
}

/* ======================================================
  Lectura
====================================================== */

export async function getMyNotifications(
  limit = 20
): Promise<NotificationRow[]> {
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

const mutedGroupIds = ((mutedRows ?? []) as MutedGroupRow[])
  .map((r) => String(r.group_id ?? "").trim())
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

  const rows = Array.isArray(data)
    ? data.map(normalizeNotificationRecord)
    : [];

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
   ((groups ?? []) as NotificationGroupRow[]).map((g) => [
  String(g.id ?? ""),
  normalizeGroupTypeForPrefs(g.type ?? null),
])
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

  if (
    t === "conflict" ||
    t === "conflict_detected" ||
    t === "conflict_decision" ||
    t === "conflict_auto_adjusted"
  ) {
    return !!prefs.notify_conflicts;
  }

  if (t === "event_rejected") {
    if (prefs.notify_conflicts) return true;
    if (prefs.notify_personal) return true;
    return false;
  }

  if (t === "group_message") {
    const gid = n.entity_id ? String(n.entity_id) : null;
    const gt = gid ? normalizeGroupTypeForPrefs(groupTypeMap[gid]) : "";

    if (gt === "pair" && !prefs.notify_pair) return false;
    if (gt === "family" && !prefs.notify_family) return false;

    if (
      (gt === "personal" ||
        gt === "other" ||
        gt === "shared" ||
        gt === "solo") &&
      !prefs.notify_personal
    ) {
      return false;
    }

    return true;
  }

  if (t === "group_invite") {
    return true;
  }

  if (t === "event_created" || t === "event_deleted") {
    return !!prefs.notify_personal;
  }

  return !!prefs.notify_personal;
}

/* ======================================================
  Marcar leídas
====================================================== */

export async function markNotificationRead(id: string) {
  const uid = await requireUid();

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", uid);

  if (error) throw error;
}

export async function markNotificationsRead(ids: string[]) {
  const uid = await requireUid();

  const safeIds = Array.from(
    new Set(
      (ids ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (safeIds.length === 0) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", uid)
    .in("id", safeIds)
    .is("read_at", null);

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

/* ======================================================
  Helpers de conflicto
====================================================== */

export async function getUnreadConflictNotifications(): Promise<
  NotificationRow[]
> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .in("type", [...CONFLICT_NOTIFICATION_TYPES])
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Array.isArray(data) ? data.map(normalizeNotificationRecord) : [];
}

export async function getUnreadConflictNotificationsSummary(): Promise<{
  count: number;
  latestEventId: string | null;
}> {
  await requireUid();
  return getLiveConflictSummary();
}

export async function markConflictNotificationsAsRead(options?: {
  eventIds?: string[];
  notificationIds?: string[];
}) {
  const explicitNotificationIds = Array.from(
    new Set(
      (options?.notificationIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (explicitNotificationIds.length > 0) {
    await markNotificationsRead(explicitNotificationIds);
    return;
  }

  const targetEventIds = Array.from(
    new Set(
      (options?.eventIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );

  const unread = await getUnreadConflictNotifications();
  if (unread.length === 0) return;

  if (targetEventIds.length === 0) {
    await markNotificationsRead(unread.map((n) => n.id));
    return;
  }

  const targetSet = new Set(targetEventIds);

  const idsToMark = unread
    .filter((notification) => {
      const relatedEventIds = extractEventIdsFromPayload(
        notification.payload ?? null,
        notification.entity_id ?? null
      );

      return relatedEventIds.some((eventId) => targetSet.has(eventId));
    })
    .map((notification) => notification.id);

  if (idsToMark.length === 0) return;

  await markNotificationsRead(idsToMark);
}

export function extractConflictEventIdsFromNotification(
  notification: NotificationRow | null | undefined
): string[] {
  if (!notification) return [];
  if (!isConflictNotificationType(notification.type)) return [];

  return extractEventIdsFromPayload(
    notification.payload ?? null,
    notification.entity_id ?? null
  );
}

/* ======================================================
  "Delete" UX = mark as read
====================================================== */

export async function deleteNotification(id: string) {
  await markNotificationRead(id);
}

export async function deleteAllNotifications() {
  await markAllRead();
}

/* ======================================================
  Navegación
====================================================== */

export function notificationHref(n: NotificationRow): string {
  const t = String(n.type || "").toLowerCase();

  if (
    t === "conflict" ||
    t === "conflict_detected" ||
    t === "conflict_decision" ||
    t === "conflict_auto_adjusted"
  ) {
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
    const eventId = n.payload?.event_id || n.entity_id || null;

    if (eventId) {
      return `/calendar?highlight=${encodeURIComponent(String(eventId))}`;
    }

    return "/calendar";
  }

  return "/calendar";
}