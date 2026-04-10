// src/lib/decisionTypes.ts

import type { Resolution } from "@/lib/conflictResolutionsDb";
import type { CanonicalEventStatus } from "@/lib/naming";
import type { ProposalResponseStatus } from "@/lib/proposalResponsesDb";
import type { PublicInviteStatus } from "@/lib/invitationsDb";

export type DecisionResolution = Resolution | null;

export type DecisionKind =
  | "keep_existing"
  | "replace_with_new"
  | "keep_both"
  | null;

export type ConflictDecisionStatus = "pending" | "resolved" | "ignored";

export type ConflictLike = {
  id?: string | null;
  existing?: string | null;
  incoming?: string | null;
};

export type ProposalResponseLike = {
  response?: ProposalResponseStatus | string | null;
};

export type InviteLike = {
  status?: PublicInviteStatus | string | null;
  proposed_date?: string | null;
};

export type TrustSignalLike = {
  kind?: string | null;
  final_action?: string | null;
  label?: string | null;
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