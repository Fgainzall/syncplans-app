// src/lib/learningSignals.tsx

import supabase from "@/lib/supabaseClient";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getMyGroups, normalizeGroupType, type GroupRow } from "@/lib/groupsDb";
import type {
  LearningSignal,
  LearningSignalType,
} from "@/lib/learningTypes";

export type LearningProposalResponseRow = {
  id: string;
  event_id: string;
  user_id: string;
  response: "accepted" | "adjusted" | "pending";
  created_at: string;
  updated_at: string;
};

export type LearningEventResponseRow = {
  id: string;
  event_id: string;
  user_id: string;
  group_id: string | null;
  response_status: "pending" | "accepted" | "declined";
  comment: string | null;
  created_at: string;
  updated_at: string;
};

export type LearningConflictLogRow = {
  id: string;
  conflict_id: string;
  group_id: string | null;
  decided_by: string;
  decision_type: string;
  final_action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LearningSourceSnapshot = {
  nowIso: string;
  events: DbEventRow[];
  groups: GroupRow[];
  proposalResponses: LearningProposalResponseRow[];
  eventResponses: LearningEventResponseRow[];
  conflictLogs: LearningConflictLogRow[];
};

export type LoadLearningSourceSnapshotOptions = {
  daysBack?: number;
  limitConflictLogs?: number;
};

export type BuildLearningSignalsOptions = {
  includePending?: boolean;
};
type LearningProposalResponseInput = {
  id?: unknown;
  event_id?: unknown;
  user_id?: unknown;
  response?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type LearningEventResponseInput = {
  id?: unknown;
  event_id?: unknown;
  user_id?: unknown;
  group_id?: unknown;
  response_status?: unknown;
  comment?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type LearningConflictLogInput = {
  id?: unknown;
  conflict_id?: unknown;
  group_id?: unknown;
  decided_by?: unknown;
  decision_type?: unknown;
  final_action?: unknown;
  reason?: unknown;
  metadata?: unknown;
  created_at?: unknown;
};
function clampDaysBack(value: number | undefined): number {
  if (!Number.isFinite(value)) return 120;
  return Math.min(Math.max(Math.trunc(Number(value)), 7), 365);
}

function clampConflictLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 300;
  return Math.min(Math.max(Math.trunc(Number(value)), 50), 1000);
}

function normalizeIso(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function buildCutoffIso(daysBack?: number): string {
  const safeDaysBack = clampDaysBack(daysBack);
  const now = new Date();
  now.setDate(now.getDate() - safeDaysBack);
  return now.toISOString();
}

function normalizeEventId(value: unknown): string {
  return String(value ?? "").trim();
}

function buildGroupTypeMap(groups: GroupRow[]): Record<string, string> {
  return (Array.isArray(groups) ? groups : []).reduce<Record<string, string>>(
    (acc, group) => {
      const id = String(group?.id ?? "").trim();
      if (!id) return acc;
      acc[id] = normalizeGroupType(group?.type ?? null);
      return acc;
    },
    {},
  );
}

function resolveEventGroupType(
  event: Pick<DbEventRow, "group_id">,
  groupTypeMap: Record<string, string>,
): string {
  const groupId = String(event?.group_id ?? "").trim();
  if (!groupId) return "personal";
  return groupTypeMap[groupId] ?? "other";
}

function inferSignalWeight(type: LearningSignalType): number {
  switch (type) {
    case "proposal_accepted":
    case "event_accepted":
      return 1;
    case "proposal_adjusted":
    case "conflict_resolved":
      return 0.85;
    case "conflict_auto_adjusted":
      return 0.75;
    case "event_declined":
      return 0.65;
    case "proposal_pending":
    case "event_created":
    default:
      return 0.4;
  }
}

function parseConflictSignalType(finalAction: string): LearningSignalType {
  const normalized = String(finalAction ?? "").trim().toLowerCase();

  if (normalized.includes("auto") || normalized.includes("fallback")) {
    return "conflict_auto_adjusted";
  }

  return "conflict_resolved";
}

function extractEventIdsFromConflictMetadata(
  metadata: Record<string, unknown>,
): string[] {
  const candidates = [
    metadata["existing_event_id"],
    metadata["incoming_event_id"],
    metadata["target_event_id"],
    metadata["affected_event_id"],
    metadata["kept_event_id"],
    metadata["blocked_event_id"],
  ];

  return Array.from(
    new Set(
      candidates
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function mapProposalResponseRow(
  row: LearningProposalResponseInput
): LearningProposalResponseRow | null {
  const eventId = normalizeEventId(row?.event_id);
  const userId = String(row?.user_id ?? "").trim();
  const response = String(row?.response ?? "").trim();

  if (!eventId || !userId) return null;
  if (
    response !== "accepted" &&
    response !== "adjusted" &&
    response !== "pending"
  ) {
    return null;
  }

  const createdAt = normalizeIso(row?.created_at);
  const updatedAt = normalizeIso(row?.updated_at);

  return {
    id: String(row?.id ?? ""),
    event_id: eventId,
    user_id: userId,
    response,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function mapEventResponseRow(
  row: LearningEventResponseInput
): LearningEventResponseRow | null {
  const eventId = normalizeEventId(row?.event_id);
  const userId = String(row?.user_id ?? "").trim();
  const responseStatus = String(row?.response_status ?? "").trim();

  if (!eventId || !userId) return null;
  if (
    responseStatus !== "pending" &&
    responseStatus !== "accepted" &&
    responseStatus !== "declined"
  ) {
    return null;
  }

  const createdAt = normalizeIso(row?.created_at);
  const updatedAt = normalizeIso(row?.updated_at);

  return {
    id: String(row?.id ?? ""),
    event_id: eventId,
    user_id: userId,
    group_id: row?.group_id ? String(row.group_id).trim() : null,
    response_status: responseStatus,
    comment: row?.comment ? String(row.comment) : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function mapConflictLogRow(
  row: LearningConflictLogInput
): LearningConflictLogRow | null {
  const conflictId = String(row?.conflict_id ?? "").trim();
  const decidedBy = String(row?.decided_by ?? "").trim();
  const createdAt = normalizeIso(row?.created_at);

  if (!conflictId || !decidedBy || !createdAt) return null;

  return {
    id: String(row?.id ?? ""),
    conflict_id: conflictId,
    group_id: row?.group_id ? String(row.group_id).trim() : null,
    decided_by: decidedBy,
    decision_type: String(row?.decision_type ?? "").trim(),
    final_action: String(row?.final_action ?? "").trim(),
    reason: row?.reason ? String(row.reason) : null,
metadata:
  row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? (row.metadata as Record<string, unknown>)
    : {},
    created_at: createdAt,
  };
}

async function loadProposalResponsesForEvents(
  eventIds: string[],
): Promise<LearningProposalResponseRow[]> {
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from("proposal_responses")
    .select("id, event_id, user_id, response, created_at, updated_at")
    .in("event_id", eventIds)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map(mapProposalResponseRow)
    .filter(Boolean) as LearningProposalResponseRow[];
}

async function loadEventResponsesForEvents(
  eventIds: string[],
): Promise<LearningEventResponseRow[]> {
  if (eventIds.length === 0) return [];

  const { data, error } = await supabase
    .from("event_responses")
    .select(
      "id, event_id, user_id, group_id, response_status, comment, created_at, updated_at",
    )
    .in("event_id", eventIds)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? [])
    .map(mapEventResponseRow)
    .filter(Boolean) as LearningEventResponseRow[];
}

async function loadRecentConflictLogs(
  cutoffIso: string,
  limitConflictLogs: number,
): Promise<LearningConflictLogRow[]> {
  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .select(
      "id, conflict_id, group_id, decided_by, decision_type, final_action, reason, metadata, created_at",
    )
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: false })
    .limit(limitConflictLogs);

  if (error) throw error;

  return (data ?? [])
    .map(mapConflictLogRow)
    .filter(Boolean) as LearningConflictLogRow[];
}

export async function loadLearningSourceSnapshot(
  options?: LoadLearningSourceSnapshotOptions,
): Promise<LearningSourceSnapshot> {
  const cutoffIso = buildCutoffIso(options?.daysBack);
  const limitConflictLogs = clampConflictLimit(options?.limitConflictLogs);

  const [events, groups] = await Promise.all([getMyEvents(), getMyGroups()]);

  const filteredEvents = (events ?? []).filter((event) => {
    const startIso = normalizeIso(event?.start);
    if (!startIso) return false;
    return startIso >= cutoffIso;
  });

  const eventIds = Array.from(
    new Set(
      filteredEvents
        .map((event) => String(event?.id ?? "").trim())
        .filter(Boolean),
    ),
  );

  const [proposalResponses, eventResponses, conflictLogs] = await Promise.all([
    loadProposalResponsesForEvents(eventIds),
    loadEventResponsesForEvents(eventIds),
    loadRecentConflictLogs(cutoffIso, limitConflictLogs),
  ]);

  return {
    nowIso: new Date().toISOString(),
    events: filteredEvents,
    groups: groups ?? [],
    proposalResponses,
    eventResponses,
    conflictLogs,
  };
}

export function buildLearningSignalsFromSnapshot(
  snapshot: LearningSourceSnapshot,
  options?: BuildLearningSignalsOptions,
): LearningSignal[] {
  const includePending = Boolean(options?.includePending);
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const groupTypeMap = buildGroupTypeMap(snapshot?.groups ?? []);
  const eventMap = events.reduce<Record<string, DbEventRow>>((acc, event) => {
    const id = String(event?.id ?? "").trim();
    if (!id) return acc;
    acc[id] = event;
    return acc;
  }, {});

  const signals: LearningSignal[] = [];

  for (const event of events) {
    const start = normalizeIso(event?.start);
    const end = normalizeIso(event?.end);
    const createdAt =
      normalizeIso(event?.created_at) ||
      normalizeIso(event?.updated_at) ||
      start;

    if (!start || !end || !createdAt) continue;

    signals.push({
      type: "event_created",
      userId: event?.created_by
        ? String(event.created_by).trim()
        : event?.owner_id
          ? String(event.owner_id).trim()
          : event?.user_id
            ? String(event.user_id).trim()
            : undefined,
      groupId: event?.group_id ? String(event.group_id).trim() : undefined,
      groupType: resolveEventGroupType(event, groupTypeMap),
      title: event?.title ?? null,
      start,
      end,
      weight: inferSignalWeight("event_created"),
      createdAt,
    });
  }

  for (const response of snapshot?.proposalResponses ?? []) {
    if (!includePending && response.response === "pending") continue;

    const event = eventMap[response.event_id];
    if (!event) continue;

    const type: LearningSignalType =
      response.response === "accepted"
        ? "proposal_accepted"
        : response.response === "adjusted"
          ? "proposal_adjusted"
          : "proposal_pending";

    signals.push({
      type,
      userId: response.user_id,
      groupId: event.group_id ? String(event.group_id).trim() : undefined,
      groupType: resolveEventGroupType(event, groupTypeMap),
      title: event.title ?? null,
      start: normalizeIso(event.start),
      end: normalizeIso(event.end),
      weight: inferSignalWeight(type),
      createdAt: response.updated_at || response.created_at,
    });
  }

  for (const response of snapshot?.eventResponses ?? []) {
    const event = eventMap[response.event_id];
    if (!event) continue;
    if (!includePending && response.response_status === "pending") continue;

    const type: LearningSignalType =
      response.response_status === "accepted"
        ? "event_accepted"
        : response.response_status === "declined"
          ? "event_declined"
          : "event_created";

    if (type === "event_created") continue;

    signals.push({
      type,
      userId: response.user_id,
      groupId: event.group_id ? String(event.group_id).trim() : undefined,
      groupType: resolveEventGroupType(event, groupTypeMap),
      title: event.title ?? null,
      start: normalizeIso(event.start),
      end: normalizeIso(event.end),
      weight: inferSignalWeight(type),
      createdAt: response.updated_at || response.created_at,
    });
  }

  for (const log of snapshot?.conflictLogs ?? []) {
    const eventIds = extractEventIdsFromConflictMetadata(log.metadata);

    for (const eventId of eventIds) {
      const event = eventMap[eventId];
      if (!event) continue;

      const type = parseConflictSignalType(log.final_action);

      signals.push({
        type,
        userId: log.decided_by,
        groupId:
          log.group_id ??
          (event.group_id ? String(event.group_id).trim() : undefined),
        groupType: resolveEventGroupType(event, groupTypeMap),
        title: event.title ?? null,
        start: normalizeIso(event.start),
        end: normalizeIso(event.end),
        weight: inferSignalWeight(type),
        createdAt: log.created_at,
      });
    }
  }

  return signals
    .filter(
      (signal) =>
        signal.start &&
        signal.end &&
        signal.createdAt &&
        !Number.isNaN(new Date(signal.start).getTime()) &&
        !Number.isNaN(new Date(signal.end).getTime()) &&
        !Number.isNaN(new Date(signal.createdAt).getTime()),
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
}

export async function getLearningSignals(
  options?: LoadLearningSourceSnapshotOptions & BuildLearningSignalsOptions,
): Promise<LearningSignal[]> {
  const snapshot = await loadLearningSourceSnapshot(options);
  return buildLearningSignalsFromSnapshot(snapshot, options);
}