import supabase from "@/lib/supabaseClient";

export type ConflictResolutionLogRow = {
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

export type CreateConflictResolutionLogInput = {
  conflictId: string;
  groupId?: string | null;
  decidedBy: string;
  decisionType: string;
  finalAction: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};

function mapRow(row: any): ConflictResolutionLogRow {
  return {
    id: String(row.id),
    conflict_id: String(row.conflict_id),
    group_id: row.group_id ? String(row.group_id) : null,
    decided_by: String(row.decided_by),
    decision_type: String(row.decision_type),
    final_action: String(row.final_action),
    reason: row.reason ?? null,
    metadata:
      row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    created_at: String(row.created_at),
  };
}

export async function createConflictResolutionLog(
  input: CreateConflictResolutionLogInput
): Promise<ConflictResolutionLogRow> {
  const payload = {
    conflict_id: input.conflictId,
    group_id: input.groupId ?? null,
    decided_by: input.decidedBy,
    decision_type: input.decisionType,
    final_action: input.finalAction,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw error;

  return mapRow(data);
}

export async function getConflictResolutionLogsByConflictId(
  conflictId: string
): Promise<ConflictResolutionLogRow[]> {
  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .select("*")
    .eq("conflict_id", conflictId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function getConflictResolutionLogsByGroupId(
  groupId: string
): Promise<ConflictResolutionLogRow[]> {
  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export async function getRecentConflictResolutionLogs(
  limit = 10
): Promise<ConflictResolutionLogRow[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(Math.trunc(limit), 1), 50)
    : 10;

  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw error;

  return (data ?? []).map(mapRow);
}

export type ConflictTrustSignal = {
  eventId: string;
  label: "resolved" | "auto_adjusted";
  finalAction: string;
  decisionType: string;
  conflictId: string | null;
  createdAt: string;
};

function extractEventIdsFromLogMetadata(
  metadata: Record<string, unknown>
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
        .filter(Boolean)
    )
  );
}

function trustLabelFromFinalAction(
  finalAction: string
): "resolved" | "auto_adjusted" {
  const normalized = String(finalAction ?? "").trim().toLowerCase();

  if (normalized.includes("fallback") || normalized.includes("auto")) {
    return "auto_adjusted";
  }

  return "resolved";
}

export async function getLatestConflictTrustSignalsByEventIds(
  eventIds: string[]
): Promise<Record<string, ConflictTrustSignal>> {
  const safeEventIds = Array.from(
    new Set(
      (eventIds ?? [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (safeEventIds.length === 0) return {};

  const { data, error } = await supabase
    .from("conflict_resolutions_log")
    .select("id, conflict_id, decision_type, final_action, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(250);

  if (error) throw error;

  const targetSet = new Set(safeEventIds);
  const result: Record<string, ConflictTrustSignal> = {};

  for (const row of data ?? []) {
    const metadata =
      row?.metadata && typeof row.metadata === "object" ? row.metadata : {};

    const ids = extractEventIdsFromLogMetadata(
      metadata as Record<string, unknown>
    );
    const matchingIds = ids.filter((id) => targetSet.has(id));

    if (matchingIds.length === 0) continue;

    for (const eventId of matchingIds) {
      if (result[eventId]) continue;

      result[eventId] = {
        eventId,
        label: trustLabelFromFinalAction(String(row?.final_action ?? "")),
        finalAction: String(row?.final_action ?? ""),
        decisionType: String(row?.decision_type ?? ""),
        conflictId: row?.conflict_id ? String(row.conflict_id) : null,
        createdAt: String(row?.created_at ?? ""),
      };
    }
  }

  return result;
}