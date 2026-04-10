// src/lib/decisionEngine.ts

import { conflictKey } from "@/lib/conflicts";
import { deriveEventStatus } from "@/lib/naming";

import {
  DecisionResolution,
  DecisionKind,
  ConflictDecisionStatus,
  ConflictLike,
  ProposalResponseLike,
  InviteLike,
  TrustSignalLike,
  ConflictDecisionSnapshot,
  EventDecisionSnapshot,
  ConflictLogPayload,
} from "@/lib/decisionTypes";

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

export function resolveConflictResolution(
  conflict: ConflictLike,
  resolvedConflictMap?: Record<string, unknown> | null,
): DecisionResolution {
  if (!conflict || !resolvedConflictMap) return null;

  const byId =
    conflict.id && resolvedConflictMap[String(conflict.id)]
      ? normalizeResolution(resolvedConflictMap[String(conflict.id)])
      : null;

  if (byId) return byId;

  const stableKey =
    conflict.existing && conflict.incoming
      ? conflictKey(conflict.existing, conflict.incoming)
      : null;

  const byStable =
    stableKey && resolvedConflictMap[stableKey]
      ? normalizeResolution(resolvedConflictMap[stableKey])
      : null;

  if (byStable) return byStable;

  const legacyKey = stableKey ? `cx::${stableKey}` : null;

  const byLegacy =
    legacyKey && resolvedConflictMap[legacyKey]
      ? normalizeResolution(resolvedConflictMap[legacyKey])
      : null;

  if (byLegacy) return byLegacy;

  return null;
}

export function getConflictDecisionSnapshot(input: {
  conflict: ConflictLike;
  resolvedConflictMap?: Record<string, unknown> | null;
}): ConflictDecisionSnapshot {
  const resolution = resolveConflictResolution(
    input.conflict,
    input.resolvedConflictMap,
  );

  const decisionKind = normalizeDecisionKind(resolution);

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

export function getEventDecisionSnapshot(input: {
  conflictsCount?: number;
  proposalResponses?: ProposalResponseLike[] | null;
  invite?: InviteLike | null;
  trustSignal?: TrustSignalLike | null;
}): EventDecisionSnapshot {
  const conflictsCount = Number(input.conflictsCount ?? 0);

  const responseStatuses = Array.isArray(input.proposalResponses)
    ? input.proposalResponses.map((r) => r?.response ?? null)
    : [];

  const inviteStatus = input.invite?.status ?? null;
  const hasInviteProposedDate = !!input.invite?.proposed_date;

  const hasTrustSignal = !!(
    input.trustSignal?.kind || input.trustSignal?.final_action
  );

  const status = deriveEventStatus({
    conflictsCount,
    responseStatuses,
    inviteStatus,
    hasInviteProposedDate,
    hasTrustSignal,
  });

  const hasPendingProposal = responseStatuses.includes("pending");
  const hasAdjustedProposal = responseStatuses.includes("adjusted");
  const hasAcceptedProposal = responseStatuses.includes("accepted");

  return {
    status,
    hasConflict: conflictsCount > 0,
    hasPendingProposal,
    hasAdjustedProposal,
    hasAcceptedProposal,
    hasPendingInvite: inviteStatus === "pending",
    hasInviteProposedDate,
    hasTrustSignal,
    needsDecision:
      status === "conflicted" ||
      status === "pending" ||
      status === "adjusted",
    isConfirmed:
      status === "confirmed" || status === "scheduled",
  };
}

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