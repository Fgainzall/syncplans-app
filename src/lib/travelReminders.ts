import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRouteEta, type TravelMode } from "@/lib/maps";
export type LeaveAlertsSummary = {
  scanned: number;
  eligible: number;
  sent: number;
  skippedSettings: number;
  skippedDeduped: number;
  errors: number;
};

type AdminClient = SupabaseClient;

type UserSettingsRow = {
  user_id: string | null;
  event_reminders: boolean | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
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
  location_lat?: number | null;
  location_lng?: number | null;
  travel_mode?: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const LEAVE_ALERT_TYPE = "leave_alert";
const DEFAULT_LIMA_ORIGIN = {
  lat: -12.1097,
  lng: -77.0359,
};

type LatLng = {
  lat: number;
  lng: number;
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

function resolveSmartOrigin(settings: UserSettingsRow | null): LatLng {
  const lastKnown = {
    lat: Number(settings?.last_known_lat),
    lng: Number(settings?.last_known_lng),
  };

  if (isValidLatLng(lastKnown)) return lastKnown;

  return DEFAULT_LIMA_ORIGIN;
}

function resolveEventDestination(eventRow: LeaveAlertEventRow): LatLng | null {
  const destination = {
    lat: Number(eventRow.location_lat),
    lng: Number(eventRow.location_lng),
  };

  return isValidLatLng(destination) ? destination : null;
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
function normalizeCronTravelMode(value: string | null | undefined): TravelMode {
  if (value === "walking") return "walking";
  if (value === "bicycling") return "bicycling";
  if (value === "transit") return "transit";
  return "driving";
}

function calculateLeaveTimeIso(startIso: string | null, etaSeconds: number): string | null {
  if (!startIso) return null;

  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return null;

  const LEAVE_BUFFER_SECONDS = 5 * 60;
  return new Date(
    start.getTime() - etaSeconds * 1000 - LEAVE_BUFFER_SECONDS * 1000
  ).toISOString();
}

async function recalculateLeaveTimeForEvent(input: {
  client: AdminClient;
  eventRow: LeaveAlertEventRow;
  userSettings: UserSettingsRow | null;
}): Promise<{
  leaveTimeIso: string | null;
  etaSeconds: number | null;
  recalculated: boolean;
}> {
  const destination = resolveEventDestination(input.eventRow);
  if (!destination) {
    return {
      leaveTimeIso: input.eventRow.leave_time,
      etaSeconds: null,
      recalculated: false,
    };
  }

  const origin = resolveSmartOrigin(input.userSettings);
  const travelMode = normalizeCronTravelMode(input.eventRow.travel_mode);

  const route = await getRouteEta({
    origin,
    destination,
    travelMode,
    departureTime: input.eventRow.start,
  });

  const nextLeaveTimeIso = calculateLeaveTimeIso(
    input.eventRow.start,
    route.etaSeconds
  );

  if (!nextLeaveTimeIso) {
    return {
      leaveTimeIso: input.eventRow.leave_time,
      etaSeconds: route.etaSeconds,
      recalculated: false,
    };
  }

  const previous = input.eventRow.leave_time
    ? new Date(input.eventRow.leave_time).getTime()
    : NaN;

  const next = new Date(nextLeaveTimeIso).getTime();

  const shouldUpdate =
    Number.isFinite(next) &&
    (!Number.isFinite(previous) || Math.abs(next - previous) > 60_000);

  if (shouldUpdate) {
    await input.client
      .from("events")
      .update({
        travel_eta_seconds: route.etaSeconds,
        leave_time: nextLeaveTimeIso,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.eventRow.id);
  }

  return {
    leaveTimeIso: nextLeaveTimeIso,
    etaSeconds: route.etaSeconds,
    recalculated: true,
  };
}
function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function leaveAlertTitle(eventTitle: string | null): string {
  const cleanTitle = String(eventTitle ?? "").trim();
  if (!cleanTitle) return "Es hora de salir";
  return `Es hora de salir: ${cleanTitle}`;
}

function leaveAlertBody(eventStartIso: string | null, leaveTimeIso: string | null): string {
  const startDate = eventStartIso ? new Date(eventStartIso) : null;
  const leaveDate = leaveTimeIso ? new Date(leaveTimeIso) : null;

  const startText =
    startDate && !Number.isNaN(startDate.getTime())
      ? startDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
      : "pronto";

  const leaveText =
    leaveDate && !Number.isNaN(leaveDate.getTime())
      ? leaveDate.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })
      : "ahora";

  return `Salida sugerida ${leaveText}. Tu evento empieza a las ${startText}.`;
}

async function getCandidateEvents(
  client: AdminClient,
  lookaheadMinutes: number
): Promise<LeaveAlertEventRow[]> {
  const nowIso = new Date().toISOString();
  const upperIso = isoMinutesFromNow(lookaheadMinutes);

  const { data, error } = await client
    .from("events")
    .select("id, title, user_id, start, leave_time, location_lat, location_lng, travel_mode")
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
    .select("user_id, event_reminders, last_known_lat, last_known_lng")
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

export async function runLeaveAlerts(
  opts?: { lookaheadMinutes?: number }
): Promise<LeaveAlertsSummary> {
  const lookaheadMinutesRaw = Number(opts?.lookaheadMinutes ?? 15);
  const lookaheadMinutes = Number.isFinite(lookaheadMinutesRaw)
    ? Math.max(1, Math.min(120, Math.round(lookaheadMinutesRaw)))
    : 15;

  const client = getAdminClient();
  const events = await getCandidateEvents(client, lookaheadMinutes);

  const summary: LeaveAlertsSummary = {
    scanned: events.length,
    eligible: 0,
    sent: 0,
    skippedSettings: 0,
    skippedDeduped: 0,
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

    if (!userId || !eventId) continue;

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
let recalculatedEtaSeconds: number | null = null;
let recalculated = false;

try {
  const result = await recalculateLeaveTimeForEvent({
    client,
    eventRow,
    userSettings,
  });

  recalculatedLeaveTimeIso = result.leaveTimeIso;
  recalculatedEtaSeconds = result.etaSeconds;
  recalculated = result.recalculated;
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
  body: leaveAlertBody(eventRow.start, recalculatedLeaveTimeIso),
  entity_id: eventId,
  payload: {
    source: "cron_leave_alerts",
    event_id: eventId,
    leave_time: recalculatedLeaveTimeIso,
    event_start: eventRow.start,
    eta_seconds: recalculatedEtaSeconds,
    recalculated,
  },
});
  }

  if (rowsToInsert.length === 0) return summary;

  const { error } = await client.from("notifications").insert(rowsToInsert);

  if (error) {
    summary.errors = rowsToInsert.length;
    throw error;
  }

  summary.sent = rowsToInsert.length;
  return summary;
}