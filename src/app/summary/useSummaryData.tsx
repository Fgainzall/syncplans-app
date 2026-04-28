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
import {
  getGrantedBrowserOrigin,
  readNestedLatLng,
  readSmartOriginFromStorage,
  resolveSafeRouteOriginForEta,
  toLatLng,
  writeSmartOriginToStorage,
  SMART_MOBILITY_MAX_URBAN_DISTANCE_METERS,
  type LatLng,
  type SmartOriginConfidence,
  type SmartOriginSource,
} from "@/lib/smartMobilityOrigin";

type UiToast = { title: string; subtitle?: string } | null;

export type SmartMobilityState = {
  available: boolean;
  loading: boolean;
  reason: "ready" | "no_event_location" | "no_origin" | "event_too_far" | "route_failed" | null;
  eventId: string | null;
  eventTitle: string | null;
  eventStartIso: string | null;
  destination: LatLng | null;
  origin: LatLng | null;
  etaSeconds: number | null;
  distanceMeters: number | null;
  bufferMinutes: number;
  leaveInMinutes: number | null;
  shouldLeaveNow: boolean;
  isLateRisk: boolean;
  mapsUrl: string | null;
  wazeUrl: string | null;
  calculatedAt: string | null;
  originSource: SmartOriginSource | null;
  originConfidence: SmartOriginConfidence | null;
  originUpdatedAt: string | null;
};

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
  smartMobility: SmartMobilityState;
  showToast: (title: string, subtitle?: string) => void;
  refreshSummary: () => Promise<void>;
};

const SMART_MOBILITY_BUFFER_MINUTES = 5;

const EMPTY_SMART_MOBILITY: SmartMobilityState = {
  available: false,
  loading: false,
  reason: null,
  eventId: null,
  eventTitle: null,
  eventStartIso: null,
  destination: null,
  origin: null,
  etaSeconds: null,
  distanceMeters: null,
  bufferMinutes: SMART_MOBILITY_BUFFER_MINUTES,
  leaveInMinutes: null,
  shouldLeaveNow: false,
  isLateRisk: false,
  mapsUrl: null,
  wazeUrl: null,
  calculatedAt: null,
  originSource: null,
  originConfidence: null,
  originUpdatedAt: null,
};
function getEventDestination(event: any): LatLng | null {
  if (!event || typeof event !== "object") return null;

  return (
    toLatLng(event.lat, event.lng) ||
    toLatLng(event.latitude, event.longitude) ||
    toLatLng(event.location_lat, event.location_lng) ||
    toLatLng(event.place_lat, event.place_lng) ||
    toLatLng(event.destination_lat, event.destination_lng) ||
    toLatLng(event.venue_lat, event.venue_lng) ||
    readNestedLatLng(event.location) ||
    readNestedLatLng(event.place) ||
    readNestedLatLng(event.destination) ||
    readNestedLatLng(event.venue) ||
    null
  );
}

function getEventStartIso(event: any): string | null {
  const raw =
    event?.start ??
    event?.start_at ??
    event?.startIso ??
    event?.starts_at ??
    null;

  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function findNextEventWithDestination(events: any[]): any | null {
  const now = Date.now();

  return (
    [...events]
      .filter((event) => {
        const startIso = getEventStartIso(event);
        if (!startIso) return false;

        const startMs = new Date(startIso).getTime();
        if (!Number.isFinite(startMs)) return false;

        if (startMs < now - 15 * 60 * 1000) return false;

        return Boolean(getEventDestination(event));
      })
      .sort((a, b) => {
        const aMs = new Date(getEventStartIso(a) || 0).getTime();
        const bMs = new Date(getEventStartIso(b) || 0).getTime();
        return aMs - bMs;
      })[0] ?? null
  );
}
function buildGoogleMapsUrl(origin: LatLng, destination: LatLng): string {
  return [
    "https://www.google.com/maps/dir/?api=1",
    `origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}`,
    `destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}`,
    "travelmode=driving",
  ].join("&");
}

function buildWazeUrl(destination: LatLng): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&navigate=yes`;
}

async function calculateSmartMobilityFromEvents(
  events: any[],
  signal?: AbortSignal,
): Promise<SmartMobilityState> {
  if (signal?.aborted) throw new DOMException("Smart Mobility aborted", "AbortError");

  const next = findNextEventWithDestination(events);

  if (!next) {
    return {
      ...EMPTY_SMART_MOBILITY,
      reason: "no_event_location",
    };
  }

  const destination = getEventDestination(next);
  const eventStartIso = getEventStartIso(next);

  if (!destination || !eventStartIso) {
    return {
      ...EMPTY_SMART_MOBILITY,
      reason: "no_event_location",
    };
  }

  // Fuente única: GPS concedido primero; localStorage solo si sigue siendo usable.
  const freshOrigin = await getGrantedBrowserOrigin({
    enableHighAccuracy: true,
    timeoutMs: 6000,
    maximumAgeMs: 3 * 60 * 1000,
  });

  if (signal?.aborted) throw new DOMException("Smart Mobility aborted", "AbortError");

  if (freshOrigin?.point) {
    writeSmartOriginToStorage({
      point: freshOrigin.point,
      source: "gps",
      accuracyM: freshOrigin.accuracyM,
      updatedAt: freshOrigin.updatedAt,
    });
  }

  const storedOrigin = readSmartOriginFromStorage();
  const resolvedOrigin = freshOrigin?.point ? freshOrigin : storedOrigin;
  const origin = resolvedOrigin?.point ?? null;

  if (!origin) {
    return {
      ...EMPTY_SMART_MOBILITY,
      reason: "no_origin",
      eventId: String(next.id ?? "") || null,
      eventTitle: String(next.title ?? "Próximo plan"),
      eventStartIso,
      destination,
      originSource: "missing",
      originConfidence: "missing",
      originUpdatedAt: null,
    };
  }

  const routeOrigin = resolveSafeRouteOriginForEta({
    origin,
    destination,
    maxDistanceMeters: SMART_MOBILITY_MAX_URBAN_DISTANCE_METERS,
  });

  if (!routeOrigin.canCalculateEta) {
    return {
      ...EMPTY_SMART_MOBILITY,
      reason: routeOrigin.reason === "event_too_far" ? "event_too_far" : "no_origin",
      eventId: String(next.id ?? "") || null,
      eventTitle: String(next.title ?? "Próximo plan"),
      eventStartIso,
      destination,
      origin,
      distanceMeters: routeOrigin.distanceMeters,
      mapsUrl: buildGoogleMapsUrl(origin, destination),
      wazeUrl: buildWazeUrl(destination),
      originSource: resolvedOrigin?.source ?? "missing",
      originConfidence: resolvedOrigin?.confidence ?? "missing",
      originUpdatedAt: resolvedOrigin?.updatedAt ?? null,
    };
  }

  try {
    const startMsForRoute = new Date(eventStartIso).getTime();
    const preferredDepartureMs = Number.isFinite(startMsForRoute)
      ? Math.max(Date.now(), startMsForRoute - 20 * 60 * 1000)
      : Date.now();

    const response = await fetch("/api/maps/route-eta", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: routeOrigin.origin ?? origin,
        destination,
        travelMode: "driving",
        departureTime: new Date(preferredDepartureMs).toISOString(),
        trafficModel: "best_guess",
      }),
    });

    if (signal?.aborted) throw new DOMException("Smart Mobility aborted", "AbortError");

    const json = await response.json().catch(() => null);

    if (signal?.aborted) throw new DOMException("Smart Mobility aborted", "AbortError");

    if (!response.ok || !json) {
      throw new Error(json?.code || "ROUTE_ETA_FAILED");
    }

    const etaSeconds = Number(json.etaSeconds ?? 0);
    const distanceMeters = Number(json.distanceMeters ?? 0);

    if (
      !Number.isFinite(etaSeconds) ||
      etaSeconds < 0 ||
      !Number.isFinite(distanceMeters) ||
      distanceMeters < 0
    ) {
      throw new Error("ROUTE_ETA_INVALID_RESULT");
    }

    if (distanceMeters > SMART_MOBILITY_MAX_URBAN_DISTANCE_METERS) {
      return {
        ...EMPTY_SMART_MOBILITY,
        reason: "event_too_far",
        eventId: String(next.id ?? "") || null,
        eventTitle: String(next.title ?? "Próximo plan"),
        eventStartIso,
        destination,
        origin,
        etaSeconds: Number.isFinite(etaSeconds) ? etaSeconds : null,
        distanceMeters,
        mapsUrl: buildGoogleMapsUrl(origin, destination),
        wazeUrl: buildWazeUrl(destination),
        calculatedAt: String(json.calculatedAt ?? new Date().toISOString()),
      };
    }

    const startMs = new Date(eventStartIso).getTime();
    const leaveAtMs = startMs - etaSeconds * 1000 - SMART_MOBILITY_BUFFER_MINUTES * 60 * 1000;
    const leaveInMinutes = Math.round((leaveAtMs - Date.now()) / 60_000);

    return {
      available: true,
      loading: false,
      reason: "ready",
      eventId: String(next.id ?? "") || null,
      eventTitle: String(next.title ?? "Próximo plan"),
      eventStartIso,
      destination,
      origin,
      etaSeconds: Number.isFinite(etaSeconds) ? etaSeconds : null,
      distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      bufferMinutes: SMART_MOBILITY_BUFFER_MINUTES,
      leaveInMinutes,
      shouldLeaveNow: leaveInMinutes <= 0,
      isLateRisk: leaveInMinutes <= -5,
      mapsUrl: buildGoogleMapsUrl(origin, destination),
      wazeUrl: buildWazeUrl(destination),
      calculatedAt: String(json.calculatedAt ?? new Date().toISOString()),
      originSource: resolvedOrigin?.source ?? null,
      originConfidence: resolvedOrigin?.confidence ?? null,
      originUpdatedAt: resolvedOrigin?.updatedAt ?? null,
    };
  } catch (error) {
    if (signal?.aborted) throw error;

    return {
      ...EMPTY_SMART_MOBILITY,
      reason: "route_failed",
      eventId: String(next.id ?? "") || null,
      eventTitle: String(next.title ?? "Próximo plan"),
      eventStartIso,
      destination,
      origin,
      mapsUrl: buildGoogleMapsUrl(origin, destination),
      wazeUrl: buildWazeUrl(destination),
      originSource: resolvedOrigin?.source ?? null,
      originConfidence: resolvedOrigin?.confidence ?? null,
      originUpdatedAt: resolvedOrigin?.updatedAt ?? null,
    };
  }
}

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
  const [smartMobility, setSmartMobility] = useState<SmartMobilityState>(EMPTY_SMART_MOBILITY);

  const toastTimeoutRef = useRef<number | null>(null);
  const inFlightLoadRef = useRef<Promise<void> | null>(null);
  const reloadQueuedRef = useRef(false);
  const refreshDebounceTimerRef = useRef<number | null>(null);
  const lastRefreshTriggerAtRef = useRef(0);
  const lastRefreshRef = useRef<number>(0);
  const loadGenerationRef = useRef(0);
  const smartMobilityAbortRef = useRef<AbortController | null>(null);
  const lastLoadErrorToastRef = useRef<{ key: string; at: number } | null>(null);
  const SECONDARY_REFRESH_GUARD_MS = 12000;

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

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      if (refreshDebounceTimerRef.current) {
        window.clearTimeout(refreshDebounceTimerRef.current);
        refreshDebounceTimerRef.current = null;
      }

      smartMobilityAbortRef.current?.abort();
      smartMobilityAbortRef.current = null;
    };
  }, []);

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

  const loadSummaryInternal = useCallback(async () => {
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;

    smartMobilityAbortRef.current?.abort();
    const smartMobilityController = new AbortController();
    smartMobilityAbortRef.current = smartMobilityController;

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

      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

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

      setSmartMobility((current) => ({
        ...current,
        loading: true,
      }));

      void (async () => {
        try {
          const nextSmartMobility = await calculateSmartMobilityFromEvents(
            safeEvents,
            smartMobilityController.signal,
          );

          if (
            smartMobilityController.signal.aborted ||
            loadGeneration !== loadGenerationRef.current
          ) {
            return;
          }

          setSmartMobility(nextSmartMobility ?? EMPTY_SMART_MOBILITY);
        } catch {
          if (
            smartMobilityController.signal.aborted ||
            loadGeneration !== loadGenerationRef.current
          ) {
            return;
          }

          setSmartMobility({
            ...EMPTY_SMART_MOBILITY,
            reason: "route_failed",
          });
        }
      })();
    } catch (e: any) {
      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

      setSmartMobility((current) => ({
        ...current,
        loading: false,
      }));

      const subtitle = e?.message || "Intenta nuevamente.";
      const key = `summary-load:${String(subtitle)}`;
      const now = Date.now();
      const last = lastLoadErrorToastRef.current;

      if (!last || last.key !== key || now - last.at > 2500) {
        showToast("No se pudo cargar", subtitle);
        lastLoadErrorToastRef.current = { key, at: now };
      }
    } finally {
      if (loadGeneration === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, [requireSessionOrRedirect, showToast]);

  const loadSummary = useCallback(async () => {
    if (inFlightLoadRef.current) {
      reloadQueuedRef.current = true;
      return inFlightLoadRef.current;
    }

    const runner = (async () => {
      do {
        reloadQueuedRef.current = false;
        await loadSummaryInternal();
      } while (reloadQueuedRef.current);
    })();

    inFlightLoadRef.current = runner;

    try {
      await runner;
    } finally {
      inFlightLoadRef.current = null;
    }
  }, [loadSummaryInternal]);

  const scheduleSummaryRefresh = useCallback(() => {
    if (typeof window === "undefined") {
      void loadSummary();
      return;
    }

    const now = Date.now();
    const elapsed = now - lastRefreshTriggerAtRef.current;
    const delay = elapsed < 420 ? 420 - elapsed : 0;

    if (refreshDebounceTimerRef.current) {
      window.clearTimeout(refreshDebounceTimerRef.current);
      refreshDebounceTimerRef.current = null;
    }

    refreshDebounceTimerRef.current = window.setTimeout(() => {
      const now = Date.now();
      lastRefreshTriggerAtRef.current = now;
      lastRefreshRef.current = now;
      refreshDebounceTimerRef.current = null;
      void loadSummary();
    }, delay);
  }, [loadSummary]);

  const shouldRefreshNow = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current < SECONDARY_REFRESH_GUARD_MS) {
      return false;
    }

    lastRefreshRef.current = now;
    return true;
  }, []);

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
        setSmartMobility((current) => ({ ...current, loading: true }));
        await loadSummary();
        lastRefreshRef.current = Date.now();

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
      scheduleSummaryRefresh();
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
  }, [scheduleSummaryRefresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => {
      if (!shouldRefreshNow()) return;
      scheduleSummaryRefresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!shouldRefreshNow()) return;
        scheduleSummaryRefresh();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [scheduleSummaryRefresh, shouldRefreshNow]);

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
    smartMobility,
    showToast,
    refreshSummary: loadSummary,
  };
}