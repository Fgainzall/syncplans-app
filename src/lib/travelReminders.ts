import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const LEAVE_ALERT_TYPE = "leave_alert";

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
    .select("id, title, user_id, start, leave_time")
    .not("leave_time", "is", null)
    .gte("leave_time", nowIso)
    .lte("leave_time", upperIso)
    .order("leave_time", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as LeaveAlertEventRow[]).filter((row) => !!row.user_id);
}

async function getUsersWithEventRemindersEnabled(
  client: AdminClient,
  userIds: string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set<string>();

  const { data, error } = await client
    .from("user_settings")
    .select("user_id, event_reminders")
    .in("user_id", userIds);

  if (error) throw error;

  const enabled = new Set<string>();

  for (const row of (data ?? []) as UserSettingsRow[]) {
    const userId = String(row.user_id ?? "").trim();
    if (!userId) continue;

    const remindersEnabled = row.event_reminders !== false;
    if (remindersEnabled) enabled.add(userId);
  }

  return enabled;
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

  const [enabledUsers, alreadySentKeys] = await Promise.all([
    getUsersWithEventRemindersEnabled(client, userIds),
    getAlreadySentKeys(client, userIds, eventIds),
  ]);

  const rowsToInsert: Array<Record<string, unknown>> = [];

  for (const eventRow of events) {
    const userId = String(eventRow.user_id ?? "").trim();
    const eventId = String(eventRow.id ?? "").trim();

    if (!userId || !eventId) continue;

    if (!enabledUsers.has(userId)) {
      summary.skippedSettings += 1;
      continue;
    }

    const dedupeKey = `${userId}:${eventId}`;
    if (alreadySentKeys.has(dedupeKey)) {
      summary.skippedDeduped += 1;
      continue;
    }

    summary.eligible += 1;
    rowsToInsert.push({
      user_id: userId,
      type: LEAVE_ALERT_TYPE,
      title: leaveAlertTitle(eventRow.title),
      body: leaveAlertBody(eventRow.start, eventRow.leave_time),
      entity_id: eventId,
      payload: {
        source: "cron_leave_alerts",
        event_id: eventId,
        leave_time: eventRow.leave_time,
        event_start: eventRow.start,
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