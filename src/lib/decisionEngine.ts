// src/lib/decisionEngine.ts

import type { Resolution } from "@/lib/conflictResolutionsDb";
import { conflictKey } from "@/lib/conflicts";
import { deriveEventStatus, type CanonicalEventStatus } from "@/lib/naming";

export type DecisionResolution = Resolution | null;

export type DecisionKind =
  | "keep_existing"
  | "replace_with_new"
  | "keep_both"
  | null;

export type ConflictDecisionStatus = "pending" | "resolved" | "ignored";

export type ConflictLike = {
  id?: string | null;
  existing?: any;
  incoming?: any;
};

export type ProposalResponseLike = {
  response?: string | null;
};

export type InviteLike = {
  status?: string | null;
  proposed_date?: string | null;
};

export type TrustSignalLike = {
  kind?: string | null;
  final_action?: string | null;
};

export type ConflictDecisionSnapshot = {
  status: ConflictDecisionStatus;
  resolution: DecisionResolution;
  decisionKind: DecisionKind;
  isIgnored: boolean;
  isResolved: boolean;
  isPending: boolean;
};

export type EventDecisionSnapshot = {
  status: CanonicalEventStatus;
  hasConflict: boolean;
  hasPendingProposal: boolean;
  hasAdjustedProposal: boolean;
  hasAcceptedProposal: boolean;
  hasPendingInvite: boolean;
  hasInviteProposedDate: boolean;
  hasTrustSignal: boolean;
  needsDecision: boolean;
  isConfirmed: boolean;
};

export type ConflictLogPayload = {
  decisionType: "keep_existing" | "replace_with_new" | "keep_both";
  finalAction: "keep_existing" | "replace_with_new" | "keep_both";
  decisionKind: "keep_existing" | "replace_with_new" | "keep_both";
};

function normalizeResolution(value: unknown): DecisionResolution {
  if (
    value === "keep_existing" ||
    value === "replace_with_new" ||
    value === "none"
  ) {
    return value;
  }
  return null;
}

function normalizeDecisionKind(
  resolution: DecisionResolution,
): DecisionKind {
  if (resolution === "keep_existing") return "keep_existing";
  if (resolution === "replace_with_new") return "replace_with_new";
  if (resolution === "none") return "keep_both";
  return null;
}

function normalizeIgnoredKey(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

function hasOwn(obj: unknown, key: string): boolean {
  return !!obj && typeof obj === "object" && key in obj;
}

/**
 * Resuelve la resolución efectiva de un conflicto usando:
 * 1) conflict.id exacto
 * 2) stable conflictKey(existing, incoming)
 * 3) legacy key cx::<stableKey>
 */
export function resolveConflictResolution(
  conflict: ConflictLike,
  resolvedConflictMap?: Record<string, unknown> | null,
): DecisionResolution {
  if (!conflict || !resolvedConflictMap) return null;

  const byId =
    conflict.id && hasOwn(resolvedConflictMap, String(conflict.id))
      ? normalizeResolution(resolvedConflictMap[String(conflict.id)])
      : null;

  if (byId) return byId;

  const stableKey =
    conflict.existing && conflict.incoming
      ? conflictKey(conflict.existing, conflict.incoming)
      : null;

  const byStableKey =
    stableKey && hasOwn(resolvedConflictMap, stableKey)
      ? normalizeResolution(resolvedConflictMap[stableKey])
      : null;

  if (byStableKey) return byStableKey;

  const legacyKey = stableKey ? `cx::${stableKey}` : null;

  const byLegacyKey =
    legacyKey && hasOwn(resolvedConflictMap, legacyKey)
      ? normalizeResolution(resolvedConflictMap[legacyKey])
      : null;

  if (byLegacyKey) return byLegacyKey;

  return null;
}

/**
 * Ignorar NO es resolución.
 * Es una dimensión aparte de visibilidad/preferencia.
 */
export function isConflictIgnored(
  conflict: ConflictLike,
  ignoredConflictKeys?: Set<string> | string[] | null,
): boolean {
  if (!conflict?.existing || !conflict?.incoming || !ignoredConflictKeys) {
    return false;
  }

  const key = normalizeIgnoredKey(conflictKey(conflict.existing, conflict.incoming));
  if (!key) return false;

  if (ignoredConflictKeys instanceof Set) {
    return ignoredConflictKeys.has(key);
  }

  if (Array.isArray(ignoredConflictKeys)) {
    return ignoredConflictKeys.includes(key);
  }

  return false;
}

export function getConflictDecisionSnapshot(input: {
  conflict: ConflictLike;
  resolvedConflictMap?: Record<string, unknown> | null;
  ignoredConflictKeys?: Set<string> | string[] | null;
}): ConflictDecisionSnapshot {
  const { conflict, resolvedConflictMap, ignoredConflictKeys } = input;

  const resolution = resolveConflictResolution(conflict, resolvedConflictMap);
  const decisionKind = normalizeDecisionKind(resolution);
  const ignored = isConflictIgnored(conflict, ignoredConflictKeys);

  if (ignored) {
    return {
      status: "ignored",
      resolution,
      decisionKind,
      isIgnored: true,
      isResolved: false,
      isPending: false,
    };
  }

  if (resolution) {
    return {
      status: "resolved",
      resolution,
      decisionKind,
      isIgnored: false,
      isResolved: true,
      isPending: false,
    };
  }

  return {
    status: "pending",
    resolution: null,
    decisionKind: null,
    isIgnored: false,
    isResolved: false,
    isPending: true,
  };
}

function collectProposalStates(
  proposalResponses?: ProposalResponseLike[] | null,
) {
  const responses = Array.isArray(proposalResponses) ? proposalResponses : [];

  const hasPendingProposal = responses.some(
    (row) => row?.response === "pending",
  );

  const hasAdjustedProposal = responses.some(
    (row) => row?.response === "adjusted",
  );

  const hasAcceptedProposal = responses.some(
    (row) => row?.response === "accepted",
  );

  return {
    hasPendingProposal,
    hasAdjustedProposal,
    hasAcceptedProposal,
  };
}

function resolveInviteState(invite?: InviteLike | null) {
  const status = invite?.status ?? null;
  const hasInviteProposedDate =
    !!invite?.proposed_date && String(invite.proposed_date).trim().length > 0;

  const hasPendingInvite =
    status === "pending" ||
    status === "proposed" ||
    (status === "rejected" && hasInviteProposedDate);

  return {
    hasPendingInvite,
    hasInviteProposedDate,
  };
}

function hasActionableTrustSignal(
  trustSignal?: TrustSignalLike | null,
): boolean {
  if (!trustSignal) return false;
  return !!(trustSignal.kind || trustSignal.final_action);
}

/**
 * Snapshot canónico del estado visible de un evento.
 * Esta función no pinta UI.
 * Solo unifica semántica para Summary / Calendar / Events / Conflicts.
 */
export function getEventDecisionSnapshot(input: {
  conflictsCount?: number;
  proposalResponses?: ProposalResponseLike[] | null;
  invite?: InviteLike | null;
  trustSignal?: TrustSignalLike | null;
}): EventDecisionSnapshot {
  const conflictsCount = Number(input.conflictsCount ?? 0);
  const hasConflict = conflictsCount > 0;

  const {
    hasPendingProposal,
    hasAdjustedProposal,
    hasAcceptedProposal,
  } = collectProposalStates(input.proposalResponses);

  const { hasPendingInvite, hasInviteProposedDate } = resolveInviteState(
    input.invite,
  );

  const hasTrustSignal = hasActionableTrustSignal(input.trustSignal);

const responseStatuses = Array.isArray(input.proposalResponses)
  ? input.proposalResponses.map((row) => row?.response ?? null)
  : [];

const inviteStatus = input.invite?.status ?? null;

const status = deriveEventStatus({
  conflictsCount,
  responseStatuses,
  inviteStatus,
  hasInviteProposedDate,
  hasTrustSignal,
});

  const needsDecision =
    status === "conflicted" || status === "pending" || status === "adjusted";

  const isConfirmed =
    status === "confirmed" || status === "scheduled";

  return {
    status,
    hasConflict,
    hasPendingProposal,
    hasAdjustedProposal,
    hasAcceptedProposal,
    hasPendingInvite,
    hasInviteProposedDate,
    hasTrustSignal,
    needsDecision,
    isConfirmed,
  };
}

/**
 * Traducción canónica de resolución -> payload de log.
 * ActionsClient no debería seguir inventando esto localmente.
 */
export function buildConflictLogPayload(
  resolution: DecisionResolution,
): ConflictLogPayload {
  if (resolution === "keep_existing") {
    return {
      decisionType: "keep_existing",
      finalAction: "keep_existing",
      decisionKind: "keep_existing",
    };
  }

  if (resolution === "replace_with_new") {
    return {
      decisionType: "replace_with_new",
      finalAction: "replace_with_new",
      decisionKind: "replace_with_new",
    };
  }

  return {
    decisionType: "keep_both",
    finalAction: "keep_both",
    decisionKind: "keep_both",
  };
}

export function isConflictPending(snapshot: ConflictDecisionSnapshot): boolean {
  return snapshot.isPending;
}

export function isConflictResolved(snapshot: ConflictDecisionSnapshot): boolean {
  return snapshot.isResolved;
}

export function isEventNeedsDecision(snapshot: EventDecisionSnapshot): boolean {
  return snapshot.needsDecision;
}

export function isEventConfirmed(snapshot: EventDecisionSnapshot): boolean {
  return snapshot.isConfirmed;
}