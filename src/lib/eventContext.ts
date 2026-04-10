// src/lib/eventContext.ts

import type { ConflictTrustSignal } from "@/lib/conflictResolutionsLogDb";
import { getEventDecisionSnapshot } from "@/lib/decisionEngine";
import { getEventStatusUi } from "@/lib/eventStatusUi";
import type { PublicInviteRow } from "@/lib/invitationsDb";
import type { ProposalResponseRow } from "@/lib/proposalResponsesDb";

export type EventContextInput = {
  eventId: string | null | undefined;
  conflictEventIds?: Set<string> | null;
  proposalResponses?: ProposalResponseRow[] | null;
  invite?: Pick<PublicInviteRow, "status" | "proposed_date"> | null;
  trustSignal?: ConflictTrustSignal | null;
};

export type EventContext = {
  eventId: string;
  inConflict: boolean;
  conflictsCount: number;
  proposalResponses: ProposalResponseRow[];
  primaryProposalResponse: ProposalResponseRow | null;
  invite: Pick<PublicInviteRow, "status" | "proposed_date"> | null;
  trustSignal: ConflictTrustSignal | null;
  decision: ReturnType<typeof getEventDecisionSnapshot>;
  status: ReturnType<typeof getEventDecisionSnapshot>["status"] | null;
  statusUi: ReturnType<typeof getEventStatusUi> | null;
};

function normalizeEventId(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

export function buildEventContext(input: EventContextInput): EventContext | null {
  const eventId = normalizeEventId(input.eventId);
  if (!eventId) return null;

  const proposalResponses = Array.isArray(input.proposalResponses)
    ? input.proposalResponses
    : [];

  const inConflict = !!input.conflictEventIds?.has(eventId);
  const conflictsCount = inConflict ? 1 : 0;

  const decision = getEventDecisionSnapshot({
    conflictsCount,
    proposalResponses,
    invite: input.invite
      ? {
          status: input.invite.status ?? null,
          proposed_date: input.invite.proposed_date ?? null,
        }
      : null,
    trustSignal: input.trustSignal ?? null,
  });

  const status = decision.status === "scheduled" ? null : decision.status;

  return {
    eventId,
    inConflict,
    conflictsCount,
    proposalResponses,
    primaryProposalResponse: proposalResponses[0] ?? null,
    invite: input.invite ?? null,
    trustSignal: input.trustSignal ?? null,
    decision,
    status,
    statusUi: status
      ? getEventStatusUi(status, { conflictsCount })
      : null,
  };
}

export function buildEventContextMap(
  eventIds: Array<string | null | undefined>,
  input: {
    conflictEventIds?: Set<string> | null;
    proposalResponseGroupsMap?: Record<string, ProposalResponseRow[]> | null;
    invitesByEventId?: Record<
      string,
      Pick<PublicInviteRow, "status" | "proposed_date"> | null | undefined
    > | null;
    trustSignalsByEventId?: Record<
      string,
      ConflictTrustSignal | null | undefined
    > | null;
  }
): Record<string, EventContext> {
  const result: Record<string, EventContext> = {};

  for (const rawEventId of Array.isArray(eventIds) ? eventIds : []) {
    const eventId = normalizeEventId(rawEventId);
    if (!eventId) continue;

    const context = buildEventContext({
      eventId,
      conflictEventIds: input.conflictEventIds ?? null,
      proposalResponses: input.proposalResponseGroupsMap?.[eventId] ?? [],
      invite: input.invitesByEventId?.[eventId] ?? null,
      trustSignal: input.trustSignalsByEventId?.[eventId] ?? null,
    });

    if (context) {
      result[eventId] = context;
    }
  }

  return result;
}