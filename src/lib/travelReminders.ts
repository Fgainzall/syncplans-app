import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRouteEta, type TravelMode } from "@/lib/maps";

export type LeaveAlertsSummary = {
  scanned: number;
  eligible: number;
  sent: number;
  skippedSettings: number;
  skippedDeduped: number;
  skippedInvalidEvent: number;
  recalculated: number;
  updatedEvents: number;
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

type LatLng = {
  lat: number;
  lng: number;
};

type RecalculateResult = {
  leaveTimeIso: string | null;
  etaSeconds: number | null;
  recalculated: boolean;
  updated: boolean;
  originSource: "last_known" | "fallback_lima";
};

const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
).trim();

export const LEAVE_ALERT_TYPE = "leave_alert";

const DEFAULT_LOOKAHEAD_MINUTES = 15;
const MAX_LOOKAHEAD_MINUTES = 180;
const LEAVE_BUFFER_SECONDS = 5 * 60;
const RECALCULATE_UPDATE_THRESHOLD_MS = 60_000;
const DEFAULT_LIMA_ORIGIN: LatLng = {
  lat: -12.1097,
  lng: -77.0359,
};

function isValidLatLng(point: LatLng | null | undefined): point is LatLng {
  return (
    !!point &&
    Number.isFinite(Number(point.lat)) &&
    Number.isFinite(Number(point.lng)) &&
    Number(point.lat) >= -90 &&
    Number(point.lat) <= 90 &&
    Number(point.lng) >= -180 &&
    Number(point.lng) <= 180
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

function normalizeCronTravelMode(value: string | null | undefined): TravelMode {
  if (value === "walking") return "walking";
  if (value === "bicycling") return "bicycling";
  if (value === "transit") return "transit";
  return "driving";
}

function resolveSmartOrigin(settings: UserSettingsRow | null): {
  point: LatLng;
  source: RecalculateResult["originSource"];
} {
  const lastKnown = {
    lat: Number(settings?.last_known_lat),
    lng: Number(settings?.last_known_lng),
  };

  if (isValidLatLng(lastKnown)) {
    return { point: lastKnown, source: "last_known" };
  }

  return { point: DEFAULT_LIMA_ORIGIN, source: "fallback_lima" };
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
  etaSeconds: number | null
): string | null {
  if (!startIso || !Number.isFinite(Number(etaSeconds))) return null;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  return new Date(
    start.getTime() - Number(etaSeconds) * 1000 - LEAVE_BUFFER_SECONDS * 1000
  ).toISOString();
}

function formatTimeEsPe(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return fallback;

  return date.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function leaveAlertTitle(eventTitle: string | null): string {
  const cleanTitle = String(eventTitle ?? "").trim();
  if (!cleanTitle) return "Ya es momento de salir";
  return `Ya es momento de salir: ${cleanTitle}`;
}

function leaveAlertBody(input: {
  eventStartIso: string | null;
  leaveTimeIso: string | null;
  etaSeconds: number | null;
  destinationLabel?: string | null;
}): string {
  const startText = formatTimeEsPe(input.eventStartIso, "pronto");
  const leaveText = formatTimeEsPe(input.leaveTimeIso, "ahora");
  const destination = String(input.destinationLabel ?? "").trim();

  const etaMinutes = Number.isFinite(Number(input.etaSeconds))
    ? Math.max(1, Math.round(Number(input.etaSeconds) / 60))
    : null;

  const etaText = etaMinutes ? ` Tardarás aprox. ${etaMinutes} min.` : "";
  const destinationText = destination ? ` hacia ${destination}` : "";

  return `Salida sugerida: ${leaveText}${destinationText}. Tu evento empieza a las ${startText}.${etaText}`;
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
  lookaheadMinutes: number
): Promise<LeaveAlertEventRow[]> {
  const nowIso = new Date().toISOString();
  const upperIso = isoMinutesFromNow(lookaheadMinutes);

  const { data, error } = await client
    .from("events")
    .select(
      "id, title, user_id, start, leave_time, location_label, location_address, location_lat, location_lng, travel_mode, travel_eta_seconds"
    )
    .not("leave_time", "is", null)
    .gte("leave_time", nowIso)
    .lte("leave_time", upperIso)
    .order("leave_time", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as LeaveAlertEventRow[]).filter((row) => !!row.user_id);
}

async function getUserSettingsByUserId(
  client: AdminClient,
  userIds: string[]
): Promise<Map<string, UserSettingsRow>> {
  if (userIds.length === 0) return new Map<string, UserSettingsRow>();

  const { data, error } = await client
    .from("user_settings")
    .select("user_id, event_reminders, last_known_lat, last_known_lng, last_known_at")
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
  eventIds: string[]
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
      .filter(Boolean)
  );
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
      originSource: "fallback_lima",
    };
  }

  const origin = resolveSmartOrigin(input.userSettings);
  const travelMode = normalizeCronTravelMode(input.eventRow.travel_mode);

  const route = await getRouteEta({
    origin: origin.point,
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
    recalculated: 0,
    updatedEvents: 0,
    errors: 0,
  };

  if (events.length === 0) return summary;

  const userIds = Array.from(
    new Set(events.map((e) => String(e.user_id ?? "").trim()).filter(Boolean))
  );
  const eventIds = Array.from(
    new Set(events.map((e) => String(e.id ?? "").trim()).filter(Boolean))
  );

  const [settingsByUserId, alreadySentKeys] = await Promise.all([
    getUserSettingsByUserId(client, userIds),
    getAlreadySentKeys(client, userIds, eventIds),
  ]);

  const rowsToInsert: Array<Record<string, unknown>> = [];

  for (const eventRow of events) {
    const userId = String(eventRow.user_id ?? "").trim();
    const eventId = String(eventRow.id ?? "").trim();

    if (!userId || !eventId || !eventRow.start || !eventRow.leave_time) {
      summary.skippedInvalidEvent += 1;
      continue;
    }

    const userSettings = settingsByUserId.get(userId) ?? null;

    if (userSettings?.event_reminders === false) {
      summary.skippedSettings += 1;
      continue;
    }

    const dedupeKey = `${userId}:${eventId}`;
    if (alreadySentKeys.has(dedupeKey)) {
      summary.skippedDeduped += 1;
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

    summary.eligible += 1;

    rowsToInsert.push({
      user_id: userId,
      type: LEAVE_ALERT_TYPE,
      title: leaveAlertTitle(eventRow.title),
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
  return summary;
}