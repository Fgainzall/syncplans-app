
import { useEffect, useState } from "react";
import supabase from "@/lib/supabaseClient";
import {
  getLatestConflictTrustSignalsByEventIds,
  type ConflictTrustSignal,
} from "@/lib/conflictResolutionsLogDb";
import {
  getLatestPublicInvitesByEventIds,
  type PublicInviteRow,
} from "@/lib/invitationsDb";
import {
  getMyProposalResponsesForEvents,
  getProposalResponsesForEvents,
  type ProposalResponseRow,
} from "@/lib/proposalResponsesDb";
import { getProfilesMapByIds, type Profile } from "@/lib/profilesDb";
import {
  buildConflictsByEventId,
  type ConflictByEventId,
  type TimelineEvent,
} from "./eventsTimelineHelpers";

export type InviteStateByEventId = Record<string, PublicInviteRow | null>;
export type TrustSignalByEventId = Record<string, ConflictTrustSignal | null>;
export type ProposalResponseByEventId = Record<string, ProposalResponseRow | null>;
export type ProposalResponsesGroupByEventId = Record<string, ProposalResponseRow[]>;

type UseEventsTimelineDataReturn = {
  currentUserId: string | null;
  inviteStateByEventId: InviteStateByEventId;
  inviteStatesLoading: boolean;
  trustSignalsByEventId: TrustSignalByEventId;
  proposalResponsesByEventId: ProposalResponseByEventId;
  proposalResponseGroupsByEventId: ProposalResponsesGroupByEventId;
  proposalProfilesById: Record<string, Profile>;
  conflictsByEventId: ConflictByEventId;
  refreshTick: number;
};

export function useEventsTimelineData(
  events: TimelineEvent[]
): UseEventsTimelineDataReturn {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteStateByEventId, setInviteStateByEventId] =
    useState<InviteStateByEventId>({});
  const [inviteStatesLoading, setInviteStatesLoading] = useState(false);
  const [trustSignalsByEventId, setTrustSignalsByEventId] =
    useState<TrustSignalByEventId>({});
  const [proposalResponsesByEventId, setProposalResponsesByEventId] =
    useState<ProposalResponseByEventId>({});
  const [proposalResponseGroupsByEventId, setProposalResponseGroupsByEventId] =
    useState<ProposalResponsesGroupByEventId>({});
 const [proposalProfilesById, setProposalProfilesById] = useState<Record<string, Profile>>(
  {}
);
  const [conflictsByEventId, setConflictsByEventId] = useState<ConflictByEventId>({});
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) {
        console.error("[useEventsTimelineData] getUser error", error);
        return;
      }

      setCurrentUserId(data.user?.id ?? null);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      setRefreshTick((prev) => prev + 1);
    };

    window.addEventListener("sp:events-changed", handler as EventListener);

    return () => {
      window.removeEventListener("sp:events-changed", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    try {
      setConflictsByEventId(buildConflictsByEventId(events));
    } catch (error) {
      console.error("[useEventsTimelineData] compute conflicts error", error);
      setConflictsByEventId({});
    }
  }, [events, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadTrustSignals() {
      const eventIds = Array.from(
        new Set(events.map((ev) => String(ev.id ?? "").trim()).filter(Boolean))
      );

      if (eventIds.length === 0) {
        setTrustSignalsByEventId({});
        return;
      }

      try {
        const data = await getLatestConflictTrustSignalsByEventIds(eventIds);

        if (!cancelled) {
          const fallback: TrustSignalByEventId = {};
          for (const id of eventIds) fallback[id] = data[id] ?? null;
          setTrustSignalsByEventId(fallback);
        }
      } catch (error) {
        console.error("[useEventsTimelineData] loadTrustSignals error", error);
        if (!cancelled) {
          const fallback: TrustSignalByEventId = {};
          for (const id of eventIds) fallback[id] = null;
          setTrustSignalsByEventId(fallback);
        }
      }
    }

    void loadTrustSignals();

    return () => {
      cancelled = true;
    };
  }, [events, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadInviteStates() {
      const eventIds = Array.from(
        new Set(events.map((ev) => String(ev.id ?? "").trim()).filter(Boolean))
      );

      if (eventIds.length === 0) {
        setInviteStateByEventId({});
        return;
      }

      try {
        setInviteStatesLoading(true);
        const data = await getLatestPublicInvitesByEventIds(eventIds);

        if (!cancelled) {
          setInviteStateByEventId(data);
        }
      } catch (error) {
        console.error("[useEventsTimelineData] loadInviteStates error", error);
        if (!cancelled) {
          const fallback: InviteStateByEventId = {};
          for (const id of eventIds) fallback[id] = null;
          setInviteStateByEventId(fallback);
        }
      } finally {
        if (!cancelled) {
          setInviteStatesLoading(false);
        }
      }
    }

    void loadInviteStates();

    return () => {
      cancelled = true;
    };
  }, [events, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposalResponses() {
      const eventIds = Array.from(
        new Set(events.map((ev) => String(ev.id ?? "").trim()).filter(Boolean))
      );

      if (eventIds.length === 0 || !currentUserId) {
        setProposalResponsesByEventId({});
        return;
      }

      try {
        const data = await getMyProposalResponsesForEvents(eventIds, currentUserId);

        if (!cancelled) {
          const fallback: ProposalResponseByEventId = {};
          for (const id of eventIds) fallback[id] = data[id] ?? null;
          setProposalResponsesByEventId(fallback);
        }
      } catch (error) {
        console.error("[useEventsTimelineData] loadProposalResponses error", error);
        if (!cancelled) {
          const fallback: ProposalResponseByEventId = {};
          for (const id of eventIds) fallback[id] = null;
          setProposalResponsesByEventId(fallback);
        }
      }
    }

    void loadProposalResponses();

    return () => {
      cancelled = true;
    };
  }, [events, currentUserId, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposalResponseGroups() {
      const eventIds = Array.from(
        new Set(events.map((ev) => String(ev.id ?? "").trim()).filter(Boolean))
      );

      if (eventIds.length === 0) {
        setProposalResponseGroupsByEventId({});
        return;
      }

      try {
        const data = await getProposalResponsesForEvents(eventIds);

        if (!cancelled) {
          const fallback: ProposalResponsesGroupByEventId = {};
          for (const id of eventIds) fallback[id] = data[id] ?? [];
          setProposalResponseGroupsByEventId(fallback);
        }
      } catch (error) {
        console.error("[useEventsTimelineData] loadProposalResponseGroups error", error);
        if (!cancelled) {
          const fallback: ProposalResponsesGroupByEventId = {};
          for (const id of eventIds) fallback[id] = [];
          setProposalResponseGroupsByEventId(fallback);
        }
      }
    }

    void loadProposalResponseGroups();

    return () => {
      cancelled = true;
    };
  }, [events, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    async function loadProposalProfiles() {
      const userIds = Array.from(
        new Set(
          Object.values(proposalResponseGroupsByEventId)
            .flat()
            .map((row) => String(row?.user_id ?? "").trim())
            .filter(Boolean)
        )
      );

      if (userIds.length === 0) {
        setProposalProfilesById({});
        return;
      }

      try {
        const data = await getProfilesMapByIds(userIds);
        if (!cancelled) {
          setProposalProfilesById(data ?? {});
        }
      } catch (error) {
        console.error("[useEventsTimelineData] loadProposalProfiles error", error);
        if (!cancelled) {
          setProposalProfilesById({});
        }
      }
    }

    void loadProposalProfiles();

    return () => {
      cancelled = true;
    };
  }, [proposalResponseGroupsByEventId, refreshTick]);

  return {
    currentUserId,
    inviteStateByEventId,
    inviteStatesLoading,
    trustSignalsByEventId,
    proposalResponsesByEventId,
    proposalResponseGroupsByEventId,
    proposalProfilesById,
    conflictsByEventId,
    refreshTick,
  };
}