import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { getRouteEta, type TravelMode } from "@/lib/maps";
import {
  chooseBestSmartOrigin,
  resolveSafeRouteOriginForEta,
  type LatLng as SmartLatLng,
} from "@/lib/smartMobilityOrigin";
import { formatSmartTime } from "@/lib/timeFormat";

export type LeaveAlertsSummary = {
  scanned: number;
  eligible: number;
  sent: number;
  skippedSettings: number;
  skippedDeduped: number;
  skippedInvalidEvent: number;
  skippedPastEvent: number;
  skippedNotDue: number;
  recalculated: number;
  updatedEvents: number;
  pushAttempted: number;
  pushSent: number;
  pushFailed: number;
  errors: number;
};

type AdminClient = SupabaseClient;

type UserSettingsRow = {
  user_id: string | null;
  event_reminders: boolean | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
  last_known_at?: string | null;
};

type ExistingLeaveAlertRow = {
  user_id: string | null;
  entity_id: string | null;
};

type LeaveAlertEventRow = {
  id: string;
  title: string | null;
  user_id: string | null;
  start: string | null;
  leave_time: string | null;
  location_label?: string | null;
  location_address?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  travel_mode?: string | null;
  travel_eta_seconds?: number | null;
};

type PushSubscriptionRow = {
  user_id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  updated_at?: string | null;
};

type LatLng = {
  lat: number;
  lng: number;
};

type RecalculateResult = {
  leaveTimeIso: string | null;
  etaSeconds: number | null;
  recalculated: boolean;
  updated: boolean;
  originSource: string;
};

type LeaveAlertUrgency = "leave_soon" | "leave_now" | "late";

type NotificationInsertRow = {
  user_id: string;
  type: typeof LEAVE_ALERT_TYPE;
  title: string;
  body: string;
  entity_id: string;
  payload: Record<string, unknown>;
};

type PushSendSummary = {
  attempted: number;
  sent: number;
  failed: number;
};

const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
).trim();

const VAPID_PUBLIC_KEY = String(
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
).trim();
const VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY ?? "").trim();
const VAPID_SUBJECT = String(
  process.env.VAPID_SUBJECT ?? "mailto:no-reply@syncplansapp.com",
).trim();

export const LEAVE_ALERT_TYPE = "leave_alert";

const DEFAULT_LOOKAHEAD_MINUTES = 15;
const MAX_LOOKAHEAD_MINUTES = 180;
const LEAVE_BUFFER_SECONDS = 5 * 60;
const RECALCULATE_UPDATE_THRESHOLD_MS = 60_000;
const LEAVE_ALERT_GRACE_MINUTES = 3;
const PAST_EVENT_GRACE_MINUTES = 10;

function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  return (
    !!point &&
    Number.isFinite(Number(point.lat)) &&
    Number.isFinite(Number(point.lng)) &&
    Number(point.lat) >= -90 &&
    Number(point.lat) <= 90 &&
    Number(point.lng) >= -180 &&
    Number(point.lng) <= 180 &&
    !(
      Math.abs(Number(point.lat)) < 0.000001 &&
      Math.abs(Number(point.lng)) < 0.000001
    )
  );
}

function clampLookaheadMinutes(value: unknown): number {
  const parsed = Number(value ?? DEFAULT_LOOKAHEAD_MINUTES);
  if (!Number.isFinite(parsed)) return DEFAULT_LOOKAHEAD_MINUTES;
  return Math.max(1, Math.min(MAX_LOOKAHEAD_MINUTES, Math.round(parsed)));
}

function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function isEventTooFarPast(startIso: string | null | undefined): boolean {
  const startMs = parseIsoMs(startIso);
  if (startMs === null) return true;

  return startMs < Date.now() - PAST_EVENT_GRACE_MINUTES * 60 * 1000;
}

function isLeaveTimeInsideSendWindow(
  leaveTimeIso: string | null | undefined,
  lookaheadMinutes: number,
): boolean {
  const leaveMs = parseIsoMs(leaveTimeIso);
  if (leaveMs === null) return false;

  const now = Date.now();
  const lower = now - LEAVE_ALERT_GRACE_MINUTES * 60 * 1000;
  const upper = now + lookaheadMinutes * 60 * 1000;

  return leaveMs >= lower && leaveMs <= upper;
}

function normalizeCronTravelMode(value: string | null | undefined): TravelMode {
  if (value === "walking") return "walking";
  if (value === "bicycling") return "bicycling";
  if (value === "transit") return "transit";
  return "driving";
}

function resolveSmartOrigin(settings: UserSettingsRow | null) {
  const lat = Number(settings?.last_known_lat);
  const lng = Number(settings?.last_known_lng);

  const point =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? ({ lat, lng } satisfies SmartLatLng)
      : null;

  return chooseBestSmartOrigin([
    {
      point,
      source: "last_known",
      updatedAt: settings?.last_known_at ?? null,
      accuracyM: null,
    },
  ]);
}

function resolveEventDestination(eventRow: LeaveAlertEventRow): LatLng | null {
  const destination = {
    lat: Number(eventRow.location_lat),
    lng: Number(eventRow.location_lng),
  };

  return isValidLatLng(destination) ? destination : null;
}

function calculateLeaveTimeIso(
  startIso: string | null,
  etaSeconds: number | null,
): string | null {
  if (!startIso || !Number.isFinite(Number(etaSeconds))) return null;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  return new Date(
    start.getTime() - Number(etaSeconds) * 1000 - LEAVE_BUFFER_SECONDS * 1000,
  ).toISOString();
}

function formatTimeEsPe(
  iso: string | null | undefined,
  fallback: string,
): string {
  return formatSmartTime(iso, fallback);
}

function formatMinutesHuman(totalMinutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(totalMinutes ?? 0)));

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function etaMinutesLabel(etaSeconds: number | null): string | null {
  if (!Number.isFinite(Number(etaSeconds))) return null;
  const minutes = Math.max(1, Math.round(Number(etaSeconds) / 60));
  return formatMinutesHuman(minutes);
}

function getLeaveAlertUrgency(leaveTimeIso: string | null | undefined): LeaveAlertUrgency {
  const leaveMs = parseIsoMs(leaveTimeIso);
  if (leaveMs === null) return "leave_now";

  const minutesUntilLeave = Math.round((leaveMs - Date.now()) / 60_000);

  if (minutesUntilLeave > 1) return "leave_soon";
  if (minutesUntilLeave < -3) return "late";
  return "leave_now";
}

function cleanEventTitle(eventTitle: string | null | undefined): string {
  const clean = String(eventTitle ?? "").trim();
  return clean || "tu evento";
}

function leaveAlertTitle(input: {
  eventTitle: string | null;
  leaveTimeIso: string | null;
}): string {
  const eventTitle = cleanEventTitle(input.eventTitle);
  const urgency = getLeaveAlertUrgency(input.leaveTimeIso);
  const leaveMs = parseIsoMs(input.leaveTimeIso);

  if (urgency === "leave_soon" && leaveMs !== null) {
    const minutesUntilLeave = Math.max(1, Math.round((leaveMs - Date.now()) / 60_000));
    return `Sal en ${formatMinutesHuman(minutesUntilLeave)}: ${eventTitle}`;
  }

  if (urgency === "late") return `Vas tarde: ${eventTitle}`;
  return `Sal ahora: ${eventTitle}`;
}

function leaveAlertBody(input: {
  eventStartIso: string | null;
  leaveTimeIso: string | null;
  etaSeconds: number | null;
  destinationLabel?: string | null;
}): string {
  const urgency = getLeaveAlertUrgency(input.leaveTimeIso);
  const startText = formatTimeEsPe(input.eventStartIso, "pronto");
  const leaveText = formatTimeEsPe(input.leaveTimeIso, "ahora");
  const destination = String(input.destinationLabel ?? "").trim();
  const eta = etaMinutesLabel(input.etaSeconds);

  const routeText = eta ? `Ruta aprox. ${eta}.` : "Ruta calculada con tráfico actualizado.";
  const destinationText = destination ? ` hacia ${destination}` : "";

  if (urgency === "leave_soon") {
    return `${routeText} Salida sugerida: ${leaveText}${destinationText}. Evento a las ${startText}.`;
  }

  if (urgency === "late") {
    const leaveMs = parseIsoMs(input.leaveTimeIso);
    const lateMinutes = leaveMs === null ? null : Math.max(1, Math.round((Date.now() - leaveMs) / 60_000));
    const lateText = lateMinutes ? ` Vas ${lateTextMinutes(lateMinutes)} tarde aprox.` : " Vas tarde.";
    return `${routeText}${lateText} Evento a las ${startText}.`;
  }

  return `${routeText} Sal ahora${destinationText}. Evento a las ${startText}.`;
}

function lateTextMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  return formatMinutesHuman(minutes);
}

function canSendWebPush(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
}

function configureWebPush() {
  if (!canSendWebPush()) {
    throw new Error("Missing VAPID env vars");
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

function toWebPushSubscription(row: PushSubscriptionRow) {
  if (!row.endpoint || !row.p256dh || !row.auth) return null;

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function getWebPushStatusCode(error: unknown): number | null {
  const maybeError = error as
    | {
        statusCode?: unknown;
        status?: unknown;
        code?: unknown;
      }
    | null
    | undefined;

  const raw =
    maybeError?.statusCode ??
    maybeError?.status ??
    maybeError?.code ??
    null;

  const status = Number(raw);
  if (!Number.isFinite(status)) return null;

  return Math.round(status);
}

function isExpiredPushSubscriptionError(error: unknown): boolean {
  const status = getWebPushStatusCode(error);
  return status === 404 || status === 410;
}

async function deletePushSubscriptionByEndpoint(
  client: AdminClient,
  endpoint: string | null | undefined,
): Promise<void> {
  const cleanEndpoint = String(endpoint ?? "").trim();
  if (!cleanEndpoint) return;

  const { error } = await client
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", cleanEndpoint);

  if (error) {
    console.error("[travelReminders] Failed to delete expired push subscription", {
      endpoint: cleanEndpoint.slice(0, 96),
      error,
    });
  }
}

function logSkippedLeaveAlert(input: {
  reason: string;
  eventId: string;
  userId: string;
  leaveTimeIso?: string | null;
  startIso?: string | null;
}) {
  console.info("[travelReminders] Leave alert skipped", {
    reason: input.reason,
    eventId: input.eventId,
    userId: input.userId,
    leaveTime: input.leaveTimeIso ?? null,
    eventStart: input.startIso ?? null,
  });
}

export function getAdminClient(): AdminClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase admin env vars");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getCandidateEvents(
  client: AdminClient,
  lookaheadMinutes: number,
): Promise<LeaveAlertEventRow[]> {
  const lowerIso = isoMinutesAgo(LEAVE_ALERT_GRACE_MINUTES);
  const upperIso = isoMinutesFromNow(lookaheadMinutes);

  const { data, error } = await client
    .from("events")
    .select(
      "id, title, user_id, start, leave_time, location_label, location_address, location_lat, location_lng, travel_mode, travel_eta_seconds",
    )
    .not("leave_time", "is", null)
    .gte("leave_time", lowerIso)
    .lte("leave_time", upperIso)
    .order("leave_time", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as LeaveAlertEventRow[]).filter((row) => !!row.user_id);
}

async function getUserSettingsByUserId(
  client: AdminClient,
  userIds: string[],
): Promise<Map<string, UserSettingsRow>> {
  if (userIds.length === 0) return new Map<string, UserSettingsRow>();

  const { data, error } = await client
    .from("user_settings")
    .select(
      "user_id, event_reminders, last_known_lat, last_known_lng, last_known_at",
    )
    .in("user_id", userIds);

  if (error) throw error;

  const byUserId = new Map<string, UserSettingsRow>();

  for (const row of (data ?? []) as UserSettingsRow[]) {
    const userId = String(row.user_id ?? "").trim();
    if (!userId) continue;
    byUserId.set(userId, row);
  }

  return byUserId;
}

async function getAlreadySentKeys(
  client: AdminClient,
  userIds: string[],
  eventIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0 || eventIds.length === 0) return new Set<string>();

  const { data, error } = await client
    .from("notifications")
    .select("user_id, entity_id")
    .eq("type", LEAVE_ALERT_TYPE)
    .in("user_id", userIds)
    .in("entity_id", eventIds);

  if (error) throw error;

  return new Set(
    ((data ?? []) as ExistingLeaveAlertRow[])
      .map((row) => {
        const userId = String(row.user_id ?? "").trim();
        const entityId = String(row.entity_id ?? "").trim();
        if (!userId || !entityId) return "";
        return `${userId}:${entityId}`;
      })
      .filter(Boolean),
  );
}

async function getPushSubscriptionsByUserId(
  client: AdminClient,
  userIds: string[],
): Promise<Map<string, PushSubscriptionRow[]>> {
  if (userIds.length === 0) return new Map<string, PushSubscriptionRow[]>();

  const { data, error } = await client
    .from("push_subscriptions")
    .select("user_id, endpoint, p256dh, auth, updated_at")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const byUserId = new Map<string, PushSubscriptionRow[]>();

  for (const row of (data ?? []) as PushSubscriptionRow[]) {
    const userId = String(row.user_id ?? "").trim();
    if (!userId || !row.endpoint || !row.p256dh || !row.auth) continue;

    const existing = byUserId.get(userId) ?? [];
    existing.push(row);
    byUserId.set(userId, existing);
  }

  return byUserId;
}

async function recalculateLeaveTimeForEvent(input: {
  client: AdminClient;
  eventRow: LeaveAlertEventRow;
  userSettings: UserSettingsRow | null;
}): Promise<RecalculateResult> {
  const destination = resolveEventDestination(input.eventRow);

  if (!destination) {
    return {
      leaveTimeIso: input.eventRow.leave_time,
      etaSeconds: Number.isFinite(Number(input.eventRow.travel_eta_seconds))
        ? Number(input.eventRow.travel_eta_seconds)
        : null,
      recalculated: false,
      updated: false,
      originSource: "missing_destination",
    };
  }

  const origin = resolveSmartOrigin(input.userSettings);

  const routeOrigin = resolveSafeRouteOriginForEta({
    origin: origin.point,
    destination,
  });

  if (!routeOrigin.canCalculateEta || !routeOrigin.origin) {
    return {
      leaveTimeIso: input.eventRow.leave_time,
      etaSeconds: Number.isFinite(Number(input.eventRow.travel_eta_seconds))
        ? Number(input.eventRow.travel_eta_seconds)
        : null,
      recalculated: false,
      updated: false,
      originSource: origin.source || routeOrigin.reason,
    };
  }

  const travelMode = normalizeCronTravelMode(input.eventRow.travel_mode);

  const route = await getRouteEta({
    origin: routeOrigin.origin,
    destination,
    travelMode,
    departureTime: input.eventRow.start,
  });

  const etaSeconds = Number(route.etaSeconds);
  const nextLeaveTimeIso = calculateLeaveTimeIso(input.eventRow.start, etaSeconds);

  if (!nextLeaveTimeIso) {
    return {
      leaveTimeIso: input.eventRow.leave_time,
      etaSeconds: Number.isFinite(etaSeconds) ? etaSeconds : null,
      recalculated: false,
      updated: false,
      originSource: origin.source,
    };
  }

  const previous = input.eventRow.leave_time
    ? new Date(input.eventRow.leave_time).getTime()
    : NaN;
  const next = new Date(nextLeaveTimeIso).getTime();

  const shouldUpdate =
    Number.isFinite(next) &&
    (!Number.isFinite(previous) ||
      Math.abs(next - previous) > RECALCULATE_UPDATE_THRESHOLD_MS);

  if (shouldUpdate) {
    const { error } = await input.client
      .from("events")
      .update({
        travel_eta_seconds: etaSeconds,
        leave_time: nextLeaveTimeIso,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.eventRow.id);

    if (error) throw error;
  }

  return {
    leaveTimeIso: nextLeaveTimeIso,
    etaSeconds,
    recalculated: true,
    updated: shouldUpdate,
    originSource: origin.source,
  };
}

async function sendPushForLeaveAlerts(
  client: AdminClient,
  rows: NotificationInsertRow[],
): Promise<PushSendSummary> {
  const summary: PushSendSummary = {
    attempted: 0,
    sent: 0,
    failed: 0,
  };

  if (rows.length === 0) return summary;

  if (!canSendWebPush()) {
    console.warn("[travelReminders] Web Push skipped: missing VAPID env vars");
    return summary;
  }

  configureWebPush();

  const userIds = Array.from(
    new Set(rows.map((row) => String(row.user_id ?? "").trim()).filter(Boolean)),
  );

  const subscriptionsByUserId = await getPushSubscriptionsByUserId(client, userIds);

  const sendJobs: Promise<unknown>[] = [];

  for (const row of rows) {
    const subscriptions = subscriptionsByUserId.get(row.user_id) ?? [];
    if (subscriptions.length === 0) continue;

    const pushEventId =
      typeof row.payload.event_id === "string" ? row.payload.event_id.trim() : "";

    const targetUrl = pushEventId
      ? `/events/new/details?eventId=${encodeURIComponent(pushEventId)}&from=leave_alert`
      : "/summary";

    const payload = JSON.stringify({
      title: row.title,
      body: row.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      url: targetUrl,
      tag: `${LEAVE_ALERT_TYPE}:${row.entity_id}`,
      renotify: true,
      requireInteraction: true,
      data: {
        type: LEAVE_ALERT_TYPE,
        source: "cron_leave_alerts",
        url: targetUrl,
        notification_type: LEAVE_ALERT_TYPE,
        ...row.payload,
      },
    });

    for (const subscriptionRow of subscriptions) {
      const subscription = toWebPushSubscription(subscriptionRow);
      if (!subscription) continue;

      summary.attempted += 1;

      sendJobs.push(
        webpush
          .sendNotification(subscription, payload)
          .then(() => {
            summary.sent += 1;
          })
          .catch(async (error) => {
            summary.failed += 1;

            const statusCode = getWebPushStatusCode(error);
            const isExpiredSubscription = isExpiredPushSubscriptionError(error);

            console.error("[travelReminders] Web Push send failed", {
              userId: row.user_id,
              eventId: row.entity_id,
              statusCode,
              expiredSubscription: isExpiredSubscription,
              error,
            });

            if (isExpiredSubscription) {
              await deletePushSubscriptionByEndpoint(client, subscriptionRow.endpoint);
            }
          }),
      );
    }
  }

  await Promise.all(sendJobs);
  return summary;
}

export async function runLeaveAlerts(opts?: {
  lookaheadMinutes?: number;
}): Promise<LeaveAlertsSummary> {
  const lookaheadMinutes = clampLookaheadMinutes(opts?.lookaheadMinutes);
  const client = getAdminClient();
  const events = await getCandidateEvents(client, lookaheadMinutes);

  const summary: LeaveAlertsSummary = {
    scanned: events.length,
    eligible: 0,
    sent: 0,
    skippedSettings: 0,
    skippedDeduped: 0,
    skippedInvalidEvent: 0,
    skippedPastEvent: 0,
    skippedNotDue: 0,
    recalculated: 0,
    updatedEvents: 0,
    pushAttempted: 0,
    pushSent: 0,
    pushFailed: 0,
    errors: 0,
  };

  if (events.length === 0) return summary;

  const userIds = Array.from(
    new Set(events.map((e) => String(e.user_id ?? "").trim()).filter(Boolean)),
  );
  const eventIds = Array.from(
    new Set(events.map((e) => String(e.id ?? "").trim()).filter(Boolean)),
  );

  const [settingsByUserId, alreadySentKeys] = await Promise.all([
    getUserSettingsByUserId(client, userIds),
    getAlreadySentKeys(client, userIds, eventIds),
  ]);

  const rowsToInsert: NotificationInsertRow[] = [];

  for (const eventRow of events) {
    const userId = String(eventRow.user_id ?? "").trim();
    const eventId = String(eventRow.id ?? "").trim();

    if (!userId || !eventId || !eventRow.start || !eventRow.leave_time) {
      summary.skippedInvalidEvent += 1;
      continue;
    }

    if (isEventTooFarPast(eventRow.start)) {
      summary.skippedPastEvent += 1;
      logSkippedLeaveAlert({
        reason: "event_too_far_past",
        eventId,
        userId,
        leaveTimeIso: eventRow.leave_time,
        startIso: eventRow.start,
      });
      continue;
    }

    const userSettings = settingsByUserId.get(userId) ?? null;

    if (userSettings?.event_reminders === false) {
      summary.skippedSettings += 1;
      logSkippedLeaveAlert({
        reason: "user_disabled_event_reminders",
        eventId,
        userId,
        leaveTimeIso: eventRow.leave_time,
        startIso: eventRow.start,
      });
      continue;
    }

    const dedupeKey = `${userId}:${eventId}`;
    if (alreadySentKeys.has(dedupeKey)) {
      summary.skippedDeduped += 1;
      logSkippedLeaveAlert({
        reason: "already_sent_for_event",
        eventId,
        userId,
        leaveTimeIso: eventRow.leave_time,
        startIso: eventRow.start,
      });
      continue;
    }

    let recalculatedLeaveTimeIso = eventRow.leave_time;
    let recalculatedEtaSeconds = Number.isFinite(Number(eventRow.travel_eta_seconds))
      ? Number(eventRow.travel_eta_seconds)
      : null;
    let recalculated = false;
    let updated = false;
    let originSource: RecalculateResult["originSource"] | null = null;

    try {
      const result = await recalculateLeaveTimeForEvent({
        client,
        eventRow,
        userSettings,
      });

      recalculatedLeaveTimeIso = result.leaveTimeIso ?? eventRow.leave_time;
      recalculatedEtaSeconds = result.etaSeconds;
      recalculated = result.recalculated;
      updated = result.updated;
      originSource = result.originSource;

      if (recalculated) summary.recalculated += 1;
      if (updated) summary.updatedEvents += 1;
    } catch (error) {
      summary.errors += 1;
      console.error("[travelReminders] ETA recalculation failed", {
        eventId,
        userId,
        error,
      });
    }

    if (!isLeaveTimeInsideSendWindow(recalculatedLeaveTimeIso, lookaheadMinutes)) {
      summary.skippedNotDue += 1;
      logSkippedLeaveAlert({
        reason: "recalculated_leave_time_outside_window",
        eventId,
        userId,
        leaveTimeIso: recalculatedLeaveTimeIso,
        startIso: eventRow.start,
      });
      continue;
    }

    summary.eligible += 1;

    const urgencyStatus = getLeaveAlertUrgency(recalculatedLeaveTimeIso);

    rowsToInsert.push({
      user_id: userId,
      type: LEAVE_ALERT_TYPE,
      title: leaveAlertTitle({
        eventTitle: eventRow.title,
        leaveTimeIso: recalculatedLeaveTimeIso,
      }),
      body: leaveAlertBody({
        eventStartIso: eventRow.start,
        leaveTimeIso: recalculatedLeaveTimeIso,
        etaSeconds: recalculatedEtaSeconds,
        destinationLabel: eventRow.location_label || eventRow.location_address,
      }),
      entity_id: eventId,
      payload: {
        source: "cron_leave_alerts",
        event_id: eventId,
        event_title: eventRow.title,
        destination_label: eventRow.location_label ?? null,
        destination_address: eventRow.location_address ?? null,
        leave_time: recalculatedLeaveTimeIso,
        event_start: eventRow.start,
        eta_seconds: recalculatedEtaSeconds,
        travel_mode: normalizeCronTravelMode(eventRow.travel_mode),
        recalculated,
        updated,
        origin_source: originSource,
        urgency_status: urgencyStatus,
        action_label: "Abrir ruta",
      },
    });
  }

  if (rowsToInsert.length === 0) return summary;

  const { error } = await client.from("notifications").insert(rowsToInsert);

  if (error) {
    summary.errors += rowsToInsert.length;
    throw error;
  }

  summary.sent = rowsToInsert.length;

  try {
    const pushSummary = await sendPushForLeaveAlerts(client, rowsToInsert);
    summary.pushAttempted = pushSummary.attempted;
    summary.pushSent = pushSummary.sent;
    summary.pushFailed = pushSummary.failed;
  } catch (error) {
    summary.errors += 1;
    console.error("[travelReminders] Web Push batch failed", error);
  }

  return summary;
}