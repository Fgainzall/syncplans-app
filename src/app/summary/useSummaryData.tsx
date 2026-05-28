import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import { getProfilesMapByIds } from "@/lib/profilesDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getMyEventsForSummary } from "@/lib/eventsDb";
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
import { getRecentConflictResolutionLogs } from "@/lib/conflictResolutionsLogDb";
import {
  buildAppliedToastMessage,
  mapRecentDecision,
  normalizeEvent,  type RecentDecision,
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

type SummaryRawEvent = Record<string, unknown> & {
  id?: string | number | null;
  title?: string | null;
  start?: string | Date | null;
  start_at?: string | Date | null;
  startIso?: string | Date | null;
  starts_at?: string | Date | null;
  end?: string | Date | null;
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  location_lat?: unknown;
  location_lng?: unknown;
  place_lat?: unknown;
  place_lng?: unknown;
  destination_lat?: unknown;
  destination_lng?: unknown;
  venue_lat?: unknown;
  venue_lng?: unknown;
  location?: unknown;
  place?: unknown;
  destination?: unknown;
  venue?: unknown;
};

type ProposalProfileMap = Awaited<ReturnType<typeof getProfilesMapByIds>>;

function getErrorMessage(error: unknown, fallback = "Intenta nuevamente."): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? fallback);
  }
  return fallback;
}

function toDateInput(value: unknown): string | number | Date | null {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    return value;
  }
  return null;
}

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
  events: SummaryRawEvent[];
  declinedEventIds: Set<string>;
  ignoredConflictKeys: Set<string>;
  resMap: Record<string, Resolution>;
  recentDecisions: RecentDecision[];
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  proposalResponseGroupsMap: Record<string, ProposalResponseRow[]>;
  proposalProfilesMap: ProposalProfileMap;
  smartMobility: SmartMobilityState;
  conflictDataReady: boolean;
  showToast: (title: string, subtitle?: string) => void;
  refreshSummary: () => Promise<void>;
};

const SMART_MOBILITY_BUFFER_MINUTES = 5;
const SMART_MOBILITY_LOOKAHEAD_HOURS = 24;
const SUMMARY_EVENTS_PAST_DAYS = 2;
const SUMMARY_EVENTS_FUTURE_DAYS = 45;

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

const SUMMARY_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type SummaryWarmCache = {
  cachedAt: number;
  groups: GroupRow[];
  activeGroupId: string | null;
  events: SummaryRawEvent[];
  declinedEventIds: Set<string>;
  ignoredConflictKeys: Set<string>;
  resMap: Record<string, Resolution>;
  recentDecisions: RecentDecision[];
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  proposalResponseGroupsMap: Record<string, ProposalResponseRow[]>;
  smartMobility: SmartMobilityState;
};

let summaryWarmCache: SummaryWarmCache | null = null;

function cloneSummaryWarmCache(cache: SummaryWarmCache): SummaryWarmCache {
  return {
    ...cache,
    groups: [...cache.groups],
    events: [...cache.events],
    declinedEventIds: new Set(cache.declinedEventIds),
    ignoredConflictKeys: new Set(cache.ignoredConflictKeys),
    resMap: { ...cache.resMap },
    recentDecisions: [...cache.recentDecisions],
    proposalResponsesMap: { ...cache.proposalResponsesMap },
    proposalResponseGroupsMap: { ...cache.proposalResponseGroupsMap },
    smartMobility: { ...cache.smartMobility, loading: false },
  };
}

function getFreshSummaryWarmCache(): SummaryWarmCache | null {
  if (!summaryWarmCache) return null;
  if (Date.now() - summaryWarmCache.cachedAt > SUMMARY_WARM_CACHE_MAX_AGE_MS) return null;
  return cloneSummaryWarmCache(summaryWarmCache);
}

function writeSummaryWarmCache(patch: Partial<Omit<SummaryWarmCache, "cachedAt">>) {
  const previous = summaryWarmCache;

  summaryWarmCache = {
    cachedAt: Date.now(),
    groups: patch.groups ?? previous?.groups ?? [],
    activeGroupId: "activeGroupId" in patch ? (patch.activeGroupId ?? null) : (previous?.activeGroupId ?? null),
    events: patch.events ?? previous?.events ?? [],
    declinedEventIds: patch.declinedEventIds ?? previous?.declinedEventIds ?? new Set<string>(),
    ignoredConflictKeys: patch.ignoredConflictKeys ?? previous?.ignoredConflictKeys ?? new Set<string>(),
    resMap: patch.resMap ?? previous?.resMap ?? {},
    recentDecisions: patch.recentDecisions ?? previous?.recentDecisions ?? [],
    proposalResponsesMap: patch.proposalResponsesMap ?? previous?.proposalResponsesMap ?? {},
    proposalResponseGroupsMap: patch.proposalResponseGroupsMap ?? previous?.proposalResponseGroupsMap ?? {},
    smartMobility: { ...(patch.smartMobility ?? previous?.smartMobility ?? EMPTY_SMART_MOBILITY), loading: false },
  };
}
function getEventDestination(event: SummaryRawEvent | null | undefined): LatLng | null {
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

function getEventStartIso(event: SummaryRawEvent | null | undefined): string | null {
  const raw =
    event?.start ??
    event?.start_at ??
    event?.startIso ??
    event?.starts_at ??
    null;

  const dateInput = toDateInput(raw);
  if (!dateInput) return null;

  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function getEventEndIso(event: SummaryRawEvent | null | undefined): string | null {
  const raw =
    event?.end ??
    event?.end_at ??
    event?.endIso ??
    event?.ends_at ??
    null;

  const dateInput = toDateInput(raw);
  if (!dateInput) return null;

  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isMultiDaySummaryEvent(event: SummaryRawEvent | null | undefined): boolean {
  const startIso = getEventStartIso(event);
  const endIso = getEventEndIso(event);
  if (!startIso || !endIso) return false;

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return end.getTime() > start.getTime() && !isSameCalendarDay(start, end);
}

function findNextEventWithDestination(events: SummaryRawEvent[]): SummaryRawEvent | null {
  const now = Date.now();

  return (
    [...events]
      .filter((event) => {
        const startIso = getEventStartIso(event);
        if (!startIso) return false;

        const startMs = new Date(startIso).getTime();
        if (!Number.isFinite(startMs)) return false;

        // Los eventos de varios días usan ubicación como contexto de disponibilidad,
        // no como una cita puntual para calcular una salida diaria.
        if (isMultiDaySummaryEvent(event)) return false;

        if (startMs < now - 15 * 60 * 1000) return false;

        const latestUsefulStartMs = now + SMART_MOBILITY_LOOKAHEAD_HOURS * 60 * 60 * 1000;
        if (startMs > latestUsefulStartMs) return false;

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
  events: SummaryRawEvent[],
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
  const initialWarmCache = getFreshSummaryWarmCache();

  const [booting, setBooting] = useState(() => !initialWarmCache);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>(() => initialWarmCache?.groups ?? []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    () => initialWarmCache?.activeGroupId ?? null
  );
  const [events, setEvents] = useState<SummaryRawEvent[]>(() => initialWarmCache?.events ?? []);
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set(initialWarmCache?.declinedEventIds ?? [])
  );
  const [ignoredConflictKeys, setIgnoredConflictKeys] = useState<Set<string>>(
    () => new Set(initialWarmCache?.ignoredConflictKeys ?? [])
  );
  const [resMap, setResMap] = useState<Record<string, Resolution>>(
    () => initialWarmCache?.resMap ?? {}
  );
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>(
    () => initialWarmCache?.recentDecisions ?? []
  );
  const [proposalResponsesMap, setProposalResponsesMap] = useState<
    Record<string, ProposalResponseRow>
  >(() => initialWarmCache?.proposalResponsesMap ?? {});
  const [proposalResponseGroupsMap, setProposalResponseGroupsMap] = useState<
    Record<string, ProposalResponseRow[]>
  >(() => initialWarmCache?.proposalResponseGroupsMap ?? {});
  const [proposalProfilesMap, setProposalProfilesMap] = useState<
    ProposalProfileMap
  >({});
  const [smartMobility, setSmartMobility] = useState<SmartMobilityState>(
    () => initialWarmCache?.smartMobility ?? EMPTY_SMART_MOBILITY
  );
  const [conflictDataReady, setConflictDataReady] = useState(false);

  const hasWarmCacheAtMountRef = useRef(Boolean(initialWarmCache));
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

  const getCurrentUserIdOrRedirect = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const userId = String(data.user?.id ?? "").trim();

    if (!userId) {
      router.replace("/auth/login");
      return null;
    }

    return userId;
  }, [router]);

  const loadSummaryInternal = useCallback(async () => {
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;

    smartMobilityAbortRef.current?.abort();
    const smartMobilityController = new AbortController();
    smartMobilityAbortRef.current = smartMobilityController;

    setLoading(true);
    setConflictDataReady(false);

    try {
      const [gs, es] = await Promise.all([
        getMyGroups(),
        getMyEventsForSummary({
          pastDays: SUMMARY_EVENTS_PAST_DAYS,
          futureDays: SUMMARY_EVENTS_FUTURE_DAYS,
        }),
      ]);

      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

      // getMyGroups() ya trae is_active desde groupsDb. Evitamos una llamada extra
      // a active_group durante el arranque de Summary.
      const validActive =
        gs.find((g) => Boolean(g.is_active))?.id ??
        (gs.length === 1 ? String(gs[0]?.id ?? "") || null : null);

      const safeEvents = (Array.isArray(es) ? es : []) as SummaryRawEvent[];
      const proposalEventIds = safeEvents
        .map(normalizeEvent)
        .filter(Boolean)
        .map((event) => String(event!.id))
        .filter(Boolean);

      // Primer paint rápido: lo indispensable para que Resumen aparezca sin esperar
      // conflictos, respuestas, logs o movilidad inteligente.
      setGroups(gs);
      setActiveGroupId(validActive);
      setEvents(safeEvents);
      writeSummaryWarmCache({
        groups: gs,
        activeGroupId: validActive,
        events: safeEvents,
      });

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

          const safeSmartMobility = nextSmartMobility ?? EMPTY_SMART_MOBILITY;
          setSmartMobility(safeSmartMobility);
          writeSummaryWarmCache({ smartMobility: safeSmartMobility });
        } catch {
          if (
            smartMobilityController.signal.aborted ||
            loadGeneration !== loadGenerationRef.current
          ) {
            return;
          }

          const failedSmartMobility = {
            ...EMPTY_SMART_MOBILITY,
            reason: "route_failed" as const,
          };
          setSmartMobility(failedSmartMobility);
          writeSummaryWarmCache({ smartMobility: failedSmartMobility });
        }
      })();

      void (async () => {
        try {
          const [
            conflictResolutions,
            declined,
            ignored,
            recentDecisionLogs,
            proposalResponses,
            proposalResponseGroups,
          ] = await Promise.all([
            getMyConflictResolutionsMap().catch(() => ({})),
            getMyDeclinedEventIds().catch(() => new Set<string>()),
            getIgnoredConflictKeys().catch(() => new Set<string>()),
            getRecentConflictResolutionLogs(8).catch(() => []),
            (async () => {
              const userId = await getCurrentUserIdOrRedirect().catch(() => null);
              if (!userId) return {};
              return getMyProposalResponsesForEvents(proposalEventIds, userId).catch(
                () => ({})
              );
            })(),
            getProposalResponsesForEvents(proposalEventIds).catch(() => ({})),
          ]);

          if (loadGeneration !== loadGenerationRef.current) {
            return;
          }

          setResMap(conflictResolutions ?? {});
          setDeclinedEventIds(declined ?? new Set());
          setIgnoredConflictKeys(ignored ?? new Set());
          const safeRecentDecisions = (recentDecisionLogs ?? []).map(mapRecentDecision);
          const safeProposalResponses = proposalResponses ?? {};
          const safeProposalResponseGroups = proposalResponseGroups ?? {};

          setRecentDecisions(safeRecentDecisions);
          setProposalResponsesMap(safeProposalResponses);
          setProposalResponseGroupsMap(safeProposalResponseGroups);
          writeSummaryWarmCache({
            declinedEventIds: declined ?? new Set(),
            ignoredConflictKeys: ignored ?? new Set(),
            resMap: conflictResolutions ?? {},
            recentDecisions: safeRecentDecisions,
            proposalResponsesMap: safeProposalResponses,
            proposalResponseGroupsMap: safeProposalResponseGroups,
          });
          setConflictDataReady(true);
        } catch {
          // Datos secundarios: no deben bloquear ni tumbar el primer render.
          // Si no cargan, mantenemos ocultos los conflictos para no mostrar falsos positivos.
          setConflictDataReady(false);
        }
      })();
    } catch (e: unknown) {
      if (loadGeneration !== loadGenerationRef.current) {
        return;
      }

      setSmartMobility((current) => ({
        ...current,
        loading: false,
      }));

      const subtitle = getErrorMessage(e, "Intenta nuevamente.");
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
  }, [getCurrentUserIdOrRedirect, showToast]);

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
        const shouldShowInitialBoot = !hasWarmCacheAtMountRef.current;
        if (shouldShowInitialBoot) setBooting(true);
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
    recentDecisions,
    proposalResponsesMap,
    proposalResponseGroupsMap,
    proposalProfilesMap,
    smartMobility,
    conflictDataReady,
    showToast,
    refreshSummary: loadSummary,
  };
}