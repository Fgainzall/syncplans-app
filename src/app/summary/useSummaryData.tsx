import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { getProfilesMapByIds } from "@/lib/profilesDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getMyEvents } from "@/lib/eventsDb";
import {
  getMyProposalResponsesForEvents,
  getProposalResponsesForEvents,
  type ProposalResponseRow,
} from "@/lib/proposalResponsesDb";
import {
  getMyConflictResolutionsMap,
  type Resolution,
} from "@/lib/conflictResolutionsDb";
import { getIgnoredConflictKeys } from "@/lib/conflictPrefs";
import { getMyDeclinedEventIds } from "@/lib/eventResponsesDb";
import { getUnreadConflictNotificationsSummary } from "@/lib/notificationsDb";
import { getRecentConflictResolutionLogs } from "@/lib/conflictResolutionsLogDb";
import {
  buildAppliedToastMessage,
  mapRecentDecision,
  normalizeEvent,
  type ConflictAlert,
  type RecentDecision,
} from "./summaryHelpers";

type UiToast = { title: string; subtitle?: string } | null;

type UseSummaryDataInput = {
  appliedToast: string | null;
};

type UseSummaryDataReturn = {
  booting: boolean;
  loading: boolean;
  toast: UiToast;
  groups: GroupRow[];
  activeGroupId: string | null;
  events: any[];
  declinedEventIds: Set<string>;
  ignoredConflictKeys: Set<string>;
  resMap: Record<string, Resolution>;
  unreadConflictAlert: ConflictAlert;
  recentDecisions: RecentDecision[];
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  proposalResponseGroupsMap: Record<string, ProposalResponseRow[]>;
  proposalProfilesMap: Record<string, any>;
  showToast: (title: string, subtitle?: string) => void;
  refreshSummary: () => Promise<void>;
};

export function useSummaryData({
  appliedToast,
}: UseSummaryDataInput): UseSummaryDataReturn {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [ignoredConflictKeys, setIgnoredConflictKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [unreadConflictAlert, setUnreadConflictAlert] = useState<ConflictAlert>({
    count: 0,
    latestEventId: null,
  });
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([]);
  const [proposalResponsesMap, setProposalResponsesMap] = useState<
    Record<string, ProposalResponseRow>
  >({});
  const [proposalResponseGroupsMap, setProposalResponseGroupsMap] = useState<
    Record<string, ProposalResponseRow[]>
  >({});
  const [proposalProfilesMap, setProposalProfilesMap] = useState<
    Record<string, any>
  >({});

  const toastTimeoutRef = useRef<number | null>(null);

  const clearToastTimer = useCallback(() => {
    if (typeof window === "undefined") return;

    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  }, []);

  const showToast = useCallback(
    (title: string, subtitle?: string) => {
      if (typeof window === "undefined") return;

      clearToastTimer();
      setToast({ title, subtitle });

      toastTimeoutRef.current = window.setTimeout(() => {
        setToast(null);
        toastTimeoutRef.current = null;
      }, 3200);
    },
    [clearToastTimer]
  );

  useEffect(() => {
    return () => clearToastTimer();
  }, [clearToastTimer]);

  const requireSessionOrRedirect = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const user = data.user;

    if (!user) {
      router.replace("/auth/login");
      return null;
    }

    return user;
  }, [router]);

 const loadSummary = useCallback(async () => {
  setLoading(true);

  try {
    const user = await requireSessionOrRedirect();
    if (!user) return;

    const gs = await getMyGroups();

    setGroups(gs);
      const activeId = await getActiveGroupIdFromDb().catch(() => null);

      const validActive =
        activeId && gs.some((g) => String(g.id) === String(activeId))
          ? String(activeId)
          : null;

      setActiveGroupId(validActive);

      const [
        es,
        conflictResolutions,
        declined,
        ignored,
        unreadConflicts,
        recentDecisionLogs,
      ] = await Promise.all([
        getMyEvents(),
        getMyConflictResolutionsMap().catch(() => ({})),
        getMyDeclinedEventIds().catch(() => new Set<string>()),
        getIgnoredConflictKeys().catch(() => new Set<string>()),
        getUnreadConflictNotificationsSummary().catch(() => ({
          count: 0,
          latestEventId: null,
        })),
        getRecentConflictResolutionLogs(8).catch(() => []),
      ]);

      const safeEvents = Array.isArray(es) ? es : [];
      const proposalEventIds = safeEvents
        .map(normalizeEvent)
        .filter(Boolean)
        .map((event) => String(event!.id))
        .filter(Boolean);

      const [proposalResponses, proposalResponseGroups] = await Promise.all([
        getMyProposalResponsesForEvents(proposalEventIds, user.id).catch(
          () => ({})
        ),
        getProposalResponsesForEvents(proposalEventIds).catch(() => ({})),
      ]);

      setEvents(safeEvents);
      setResMap(conflictResolutions ?? {});
      setDeclinedEventIds(declined ?? new Set());
      setIgnoredConflictKeys(ignored ?? new Set());
      setUnreadConflictAlert(
        unreadConflicts ?? { count: 0, latestEventId: null }
      );
      setRecentDecisions((recentDecisionLogs ?? []).map(mapRecentDecision));
      setProposalResponsesMap(proposalResponses ?? {});
      setProposalResponseGroupsMap(proposalResponseGroups ?? {});
    } catch (e: any) {
      showToast("No se pudo cargar", e?.message || "Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [requireSessionOrRedirect, showToast]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfiles() {
      const userIds = Array.from(
        new Set(
          Object.values(proposalResponseGroupsMap)
            .flat()
            .map((row) => String(row?.user_id ?? "").trim())
            .filter(Boolean)
        )
      );

      if (userIds.length === 0) {
        setProposalProfilesMap({});
        return;
      }

      try {
        const data = await getProfilesMapByIds(userIds);

        if (!cancelled) {
          setProposalProfilesMap(data ?? {});
        }
      } catch {
        if (!cancelled) {
          setProposalProfilesMap({});
        }
      }
    }

    void loadProfiles();

    return () => {
      cancelled = true;
    };
  }, [proposalResponseGroupsMap]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        await loadSummary();

        const cleanToast = buildAppliedToastMessage(appliedToast);
        if (cleanToast) {
          showToast("Listo ✅", cleanToast);
        }
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadSummary, appliedToast, showToast]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      void loadSummary();
    };

    window.addEventListener("sp:active-group-changed", handler as EventListener);
    window.addEventListener("sp:events-changed", handler as EventListener);

    return () => {
      window.removeEventListener(
        "sp:active-group-changed",
        handler as EventListener
      );
      window.removeEventListener("sp:events-changed", handler as EventListener);
    };
  }, [loadSummary]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => {
      void loadSummary();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadSummary();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadSummary]);

  return {
    booting,
    loading,
    toast,
    groups,
    activeGroupId,
    events,
    declinedEventIds,
    ignoredConflictKeys,
    resMap,
    unreadConflictAlert,
    recentDecisions,
    proposalResponsesMap,
    proposalResponseGroupsMap,
    proposalProfilesMap,
    showToast,
    refreshSummary: loadSummary,
  };
}