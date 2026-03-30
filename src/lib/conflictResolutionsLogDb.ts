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