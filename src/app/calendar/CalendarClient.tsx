// src/app/calendar/CalendarClient.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import { EventEditModal } from "@/components/EventEditModal";
import { CalendarFilters } from "./CalendarFilters";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import {
  getEventsForGroupsInRange,
  deleteEventsByIdsDetailed,
} from "@/lib/eventsDb";
import {
  getActiveGroupIdFromDb,
  setActiveGroupIdInDb,
} from "@/lib/activeGroup";

import {
  type CalendarEvent,
  type GroupType,
  type ConflictItem,
  computeVisibleConflicts,
  conflictKey,
  filterIgnoredConflicts,
  isConflictStillRelevant,
  groupMeta,
} from "@/lib/conflicts";
import {
  formatRangeLabel,
  isValidDateLike,
  parseIsoLike,
  sameLocalDay,
  toDateMs,
  toYmdKey,
} from "@/lib/dateUtils";
import {
  getEventAudienceLabel,
  isGoogleEventWithExternalGuests,
  normalizeGroupType,
} from "@/lib/naming";
import { buildEventContext } from "@/lib/eventContext";
import { getEventStatusUi } from "@/lib/eventStatusUi";
import {
  getMyConflictResolutionsMap,
  type Resolution,
} from "@/lib/conflictResolutionsDb";
import {
  getMyDeclinedEventIds,
  declineEventForCurrentUser,
} from "@/lib/eventResponsesDb";
import {
  getLatestConflictTrustSignalsByEventIds,
  type ConflictTrustSignal,
} from "@/lib/conflictResolutionsLogDb";
import {
  getMyProposalResponsesForEvents,
  type ProposalResponseRow,
} from "@/lib/proposalResponsesDb";
import { filterVisibleEvents, isEventOwnedByUser } from "@/lib/tempeventVisibility";

type CalendarEventWithOwner = CalendarEvent & {
  user_id?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  external_attendees_count?: number | null;
};

type CalendarDbEventRow = {
  id?: unknown;
  title?: unknown;
  start?: unknown;
  start_at?: unknown;
  end?: unknown;
  end_at?: unknown;
  notes?: unknown;
  group_id?: unknown;
  groupId?: unknown;
  user_id?: unknown;
  owner_id?: unknown;
  created_by?: unknown;
  external_source?: unknown;
  external_id?: unknown;
  external_attendees_count?: unknown;
};

type EnabledGroups = {
  personal: boolean;
  pair: boolean;
  family: boolean;
  other: boolean;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

type Scope = "personal" | "active" | "all";
type Tab = "month" | "agenda";

const MONTH_LABELS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/* =========================
   Helpers de fecha y formato
   ========================= */
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfWeek(d: Date) {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Monday-start
  const x = new Date(d);
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function sameDay(a: Date, b: Date) {
  return sameLocalDay(a, b);
}
function ymd(d: Date) {
  return toYmdKey(d);
}
function prettyMonthRange(a: Date, b: Date) {
  const meses = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  return `${a.getDate()} ${meses[a.getMonth()]} ${a.getFullYear()} – ${
    b.getDate()
  } ${meses[b.getMonth()]} ${b.getFullYear()}`;
}
function prettyDay(d: Date) {
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${
    meses[d.getMonth()]
  } ${d.getFullYear()}`;
}
function prettyTimeRange(startIso: string, endIso: string) {
  return formatRangeLabel(startIso, endIso);
}


const SHORT_MONTH_LABELS_ES = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function shortDateLabel(d: Date, includeYear = false) {
  const base = `${d.getDate()} ${SHORT_MONTH_LABELS_ES[d.getMonth()]}`;
  return includeYear ? `${base} ${d.getFullYear()}` : base;
}

function multiDayRangeLabel(event: CalendarEventWithOwner) {
  const range = getCalendarEventRange(event);
  if (!range) return prettyTimeRange(event.start, event.end);

  const includeYear = range.startDay.getFullYear() !== range.endDay.getFullYear();
  return `${shortDateLabel(range.startDay, includeYear)} – ${shortDateLabel(
    range.endDay,
    includeYear
  )}`;
}

function multiDayContextLabel(
  event: CalendarEventWithOwner,
  contextDate?: Date | null
) {
  if (!isMultiDayCalendarEvent(event)) return prettyTimeRange(event.start, event.end);

  const position = contextDate ? getEventDayPosition(event, contextDate) : "single";
  const prefix =
    position === "start"
      ? "Inicia"
      : position === "end"
      ? "Termina"
      : contextDate
      ? "En curso"
      : "Varios días";

  return `${prefix} · ${multiDayRangeLabel(event)}`;
}

type EventDayPosition = "single" | "start" | "middle" | "end";

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isValidDate(d: Date | null | undefined): d is Date {
  return !!d && Number.isFinite(d.getTime());
}

function isLocalMidnight(d: Date) {
  return (
    d.getHours() === 0 &&
    d.getMinutes() === 0 &&
    d.getSeconds() === 0 &&
    d.getMilliseconds() === 0
  );
}

function parseCalendarEventDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = parseIsoLike(value) ?? new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

function getVisualEventEndDate(start: Date, end: Date) {
  if (end.getTime() <= start.getTime()) return start;

  // All-day style ranges often save the end as midnight of the next day.
  // Visually, that means the event ends on the previous day.
  if (isLocalMidnight(end) && !sameDay(start, end)) {
    const adjusted = new Date(end);
    adjusted.setDate(adjusted.getDate() - 1);
    return adjusted;
  }

  return end;
}

function getCalendarEventRange(event: CalendarEventWithOwner) {
  const start = parseCalendarEventDate(event.start);
  const rawEnd = parseCalendarEventDate(event.end) ?? start;

  if (!start || !rawEnd) return null;

  const end = getVisualEventEndDate(start, rawEnd);
  const startDay = startOfDayLocal(start);
  const endDay = startOfDayLocal(end);

  return {
    start,
    end,
    startDay,
    endDay: endDay.getTime() < startDay.getTime() ? startDay : endDay,
  };
}

function isMultiDayCalendarEvent(event: CalendarEventWithOwner) {
  const range = getCalendarEventRange(event);
  if (!range) return false;
  return ymd(range.startDay) !== ymd(range.endDay);
}

function getEventDayPosition(
  event: CalendarEventWithOwner,
  cellDate: Date
): EventDayPosition {
  const range = getCalendarEventRange(event);
  if (!range) return "single";

  const startKey = ymd(range.startDay);
  const endKey = ymd(range.endDay);
  const cellKey = ymd(cellDate);

  if (startKey === endKey) return "single";
  if (cellKey === startKey) return "start";
  if (cellKey === endKey) return "end";
  return "middle";
}

function getMultiDayCellLabel(position: EventDayPosition) {
  if (position === "start") return "Inicia";
  if (position === "end") return "Termina";
  if (position === "middle") return "En curso";
  return null;
}

function getEventDayKeysInRange(
  event: CalendarEventWithOwner,
  rangeStart: Date,
  rangeEnd: Date
) {
  const eventRange = getCalendarEventRange(event);
  if (!eventRange) return [];

  const firstDay = new Date(
    Math.max(
      eventRange.startDay.getTime(),
      startOfDayLocal(rangeStart).getTime()
    )
  );
  const lastDay = new Date(
    Math.min(
      eventRange.endDay.getTime(),
      startOfDayLocal(rangeEnd).getTime()
    )
  );

  if (firstDay.getTime() > lastDay.getTime()) return [];

  const keys: string[] = [];
  const cursor = startOfDayLocal(firstDay);
  while (cursor.getTime() <= lastDay.getTime()) {
    keys.push(ymd(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return keys;
}

/** ✅ detecta móvil por ancho */
function useIsMobileWidth(maxWidth = 720) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(!!mq.matches);
    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    mq.addListener(apply);
    return () => {
      mq.removeListener(apply);
    };
  }, [maxWidth]);

  return isMobile;
}

/**
 * ✅ Normalización para conflictos:
 * El motor de conflictos trabaja con "couple" para pareja.
 */
function normalizeForConflicts(
  gt: string | null | undefined
): GroupType {
  return normalizeGroupType(gt ?? "personal");
}
function normalizeForEventEditModal(
  gt: GroupType | string | null | undefined
): "personal" | "family" | "pair" | "other" | "couple" {
  const raw = String(gt ?? "personal").toLowerCase();
  if (raw === "family") return "family";
  if (raw === "other" || raw === "shared") return "other";
  if (raw === "pair" || raw === "couple") return "couple";
  return "personal";
}
function resolutionForConflict(
  conflict: ConflictItem,
  resMap: Record<string, Resolution>
): Resolution | undefined {
  const exact = resMap[String(conflict.id)];
  if (exact) return exact;

  const a = String(conflict.existingEventId ?? "");
  const b = String(conflict.incomingEventId ?? "");
  if (!a || !b) return undefined;

  const stableKey = conflictKey(a, b);
  if (resMap[stableKey]) return resMap[stableKey];

  const [x, y] = [a, b].sort();
  const legacyPrefix = `cx::${x}::${y}::`;

  for (const key of Object.keys(resMap)) {
    if (key.startsWith(legacyPrefix)) return resMap[key];
  }

  return undefined;
}
function proposalResponseLabel(response: string | null | undefined): string | null {
  const safe = String(response ?? "").trim().toLowerCase();
  if (!safe) return null;
  if (safe === "pending") return "Pendiente";
  if (safe === "accepted") return "Aceptada";
  if (safe === "adjusted") return "Ajustada";
  return null;
}

function proposalResponseTone(
  response: string | null | undefined
): "pending" | "accepted" | "adjusted" | "neutral" {
  const safe = String(response ?? "").trim().toLowerCase();
  if (safe === "pending") return "pending";
  if (safe === "accepted") return "accepted";
  if (safe === "adjusted") return "adjusted";
  return "neutral";
}

function isStandaloneGoogleCalendarEvent(
  event: CalendarEventWithOwner | null | undefined
): boolean {
  if (!event) return false;

  const groupId = String(event.groupId ?? "").trim();
  if (groupId) return false;

  const externalSource = String(event.external_source ?? "")
    .trim()
    .toLowerCase();

  return externalSource === "google";
}

function getCalendarEventStatus(input: {
  eventId: string | null | undefined;
  inConflict?: boolean;
  proposalRow?: ProposalResponseRow | null;
  trustSignal?: ConflictTrustSignal | null;
}) {
  const key = String(input.eventId ?? "").trim();
  if (!key) return null;

  const ctx = buildEventContext({
    eventId: key,
    conflictEventIds: input.inConflict ? new Set([key]) : new Set(),
    proposalResponses: input.proposalRow ? [input.proposalRow] : [],
    trustSignal: input.trustSignal ?? null,
  });

  const status = ctx?.status ?? null;
  if (status === "scheduled") return null;
  return status;
}

function getTrustSignalLabel(
  trustSignal: ConflictTrustSignal | null | undefined,
  opts: { compact?: boolean } = {}
) {
  if (!trustSignal) return null;
  if (trustSignal.label === "auto_adjusted") {
    return opts.compact ? "Auto" : "Ajuste automático";
  }
  return "Resuelto";
}

function getCalendarStatusPresentation(input: {
  event?: CalendarEventWithOwner | null;
  eventId: string | null | undefined;
  inConflict?: boolean;
  proposalRow?: ProposalResponseRow | null;
  trustSignal?: ConflictTrustSignal | null;
  compact?: boolean;
  pendingStyle: React.CSSProperties;
  resolvedStyle: React.CSSProperties;
}) {
  const isStandaloneGoogle = isStandaloneGoogleCalendarEvent(input.event);

  if (isStandaloneGoogle) {
    return {
      status: null,
      label: null,
      style: input.resolvedStyle,
    };
  }

  const effectiveProposalRow = input.proposalRow ?? null;
  const proposalLabel = proposalResponseLabel(effectiveProposalRow?.response);
  const proposalTone = proposalResponseTone(effectiveProposalRow?.response);
  const trustLabel = getTrustSignalLabel(input.trustSignal, {
    compact: input.compact,
  });

  const calendarEventStatus = getCalendarEventStatus({
    eventId: input.eventId,
    inConflict: input.inConflict,
    proposalRow: effectiveProposalRow,
    trustSignal: input.trustSignal,
  });

  const statusUi = calendarEventStatus
    ? getEventStatusUi(calendarEventStatus, {
        conflictsCount: input.inConflict ? 1 : 0,
      })
    : null;

  const fallbackStatusStyle = proposalLabel
    ? input.pendingStyle
    : input.resolvedStyle;

  const derivedStatus =
    calendarEventStatus ??
    (proposalTone === "adjusted"
      ? "adjusted"
      : proposalTone === "pending"
      ? "pending"
      : trustLabel
      ? "resolved"
      : null);

  return {
    status: derivedStatus,
    label:
      (input.compact ? statusUi?.compactLabel : statusUi?.label) ??
      proposalLabel ??
      trustLabel,
    style: statusUi?.badgeStyle ?? fallbackStatusStyle,
  };
}

function getValueVisibilitySummary(input: {
  visibleEvents: CalendarEventWithOwner[];
  trustSignals: Record<string, ConflictTrustSignal>;
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  conflictEventIdsInGrid: Set<string>;
}) {
  let resolved = 0;
  let pending = 0;
  let adjusted = 0;

  for (const event of input.visibleEvents) {
    const trustSignal = input.trustSignals[String(event.id)];
    const proposalRow = isStandaloneGoogleCalendarEvent(event)
      ? null
      : input.proposalResponsesMap[String(event.id)];
    const isConflictEvent = input.conflictEventIdsInGrid.has(String(event.id));
    const proposalResponse = String(proposalRow?.response ?? "")
      .trim()
      .toLowerCase();

    if (proposalResponse === "adjusted") {
      adjusted += 1;
      continue;
    }

    if (proposalResponse === "pending") {
      pending += 1;
      continue;
    }

    if (trustSignal?.label === "auto_adjusted") {
      adjusted += 1;
      continue;
    }

    if (trustSignal?.label) {
      resolved += 1;
      continue;
    }

    if (isConflictEvent) {
      pending += 1;
    }
  }

  return {
    resolved,
    pending,
    adjusted,
    hasValue: resolved > 0 || adjusted > 0 || pending > 0,
  };
}

/** ✅ Props del Calendar */
type CalendarClientProps = {
  highlightId?: string | null;
  appliedToast?: {
    deleted: number;
    skipped: number;
    appliedCount: number;
  } | null;
};

const CALENDAR_SECONDARY_REFRESH_GUARD_MS = 12_000;
const CALENDAR_GOOGLE_AUTOSYNC_MIN_INTERVAL_MS = 5 * 60_000;

type GoogleConnectionState = "connected" | "needs_reauth" | "disconnected";

type GoogleStatusApiResponse = {
  ok?: boolean;
  connected?: boolean;
  connection_state?: GoogleConnectionState;
  error?: string;
  code?: string;
};

type GoogleSyncApiResponse = {
  ok?: boolean;
  imported?: number;
  error?: string;
  code?: string;
  message?: string;
};

type GoogleSyncRunResult = "synced" | "skipped" | "reauth" | "failed";

type GoogleSyncRunOptions = {
  force?: boolean;
  showToast?: boolean;
  reason?: string;
};

const CALENDAR_WARM_CACHE_MAX_AGE_MS = 2 * 60 * 1000;

type CalendarWarmCache = {
  cachedAt: number;
  events: CalendarEventWithOwner[];
  groups: GroupRow[];
  resMap: Record<string, Resolution>;
  trustSignals: Record<string, ConflictTrustSignal>;
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  activeGroupId: string | null;
  currentUserId: string | null;
  eventsLoaded: boolean;
  loadedRangeKey: string | null;
};

let calendarWarmCache: CalendarWarmCache | null = null;

function getFreshCalendarWarmCache(): CalendarWarmCache | null {
  if (!calendarWarmCache) return null;
  if (Date.now() - calendarWarmCache.cachedAt > CALENDAR_WARM_CACHE_MAX_AGE_MS) return null;

  return {
    ...calendarWarmCache,
    events: [...calendarWarmCache.events],
    groups: [...calendarWarmCache.groups],
    resMap: { ...calendarWarmCache.resMap },
    trustSignals: { ...calendarWarmCache.trustSignals },
    proposalResponsesMap: { ...calendarWarmCache.proposalResponsesMap },
  };
}

function writeCalendarWarmCache(patch: Partial<Omit<CalendarWarmCache, "cachedAt">>) {
  const previous = calendarWarmCache;

  calendarWarmCache = {
    cachedAt: Date.now(),
    events: patch.events ?? previous?.events ?? [],
    groups: patch.groups ?? previous?.groups ?? [],
    resMap: patch.resMap ?? previous?.resMap ?? {},
    trustSignals: patch.trustSignals ?? previous?.trustSignals ?? {},
    proposalResponsesMap: patch.proposalResponsesMap ?? previous?.proposalResponsesMap ?? {},
    activeGroupId: "activeGroupId" in patch ? (patch.activeGroupId ?? null) : (previous?.activeGroupId ?? null),
    currentUserId: "currentUserId" in patch ? (patch.currentUserId ?? null) : (previous?.currentUserId ?? null),
    eventsLoaded: patch.eventsLoaded ?? previous?.eventsLoaded ?? false,
    loadedRangeKey: "loadedRangeKey" in patch ? (patch.loadedRangeKey ?? null) : (previous?.loadedRangeKey ?? null),
  };
}

function isGoogleReauthCode(code: string | null | undefined): boolean {
  const normalized = String(code ?? "").toUpperCase();
  return (
    normalized.includes("REAUTH") ||
    normalized.includes("TOKEN_REFRESH") ||
    normalized.includes("GOOGLE_NO_ACCOUNT")
  );
}

/* =========================
   COMPONENTE PRINCIPAL
   ========================= */
export default function CalendarClient(
  {
    highlightId = null,
    appliedToast = null,
  }: CalendarClientProps = {}
) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobileWidth(820);
  const initialWarmCache = getFreshCalendarWarmCache();

  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hasWarmCacheAtMountRef = useRef(Boolean(initialWarmCache));
  const lastSecondaryRefreshAtRef = useRef(Date.now());
  const lastLoadedRangeKeyRef = useRef<string | null>(initialWarmCache?.loadedRangeKey ?? null);
  const lastGoogleAutoSyncAtRef = useRef(0);
  const googleSyncInFlightRef = useRef(false);

  const setEventRef = (id: string) => (el: HTMLDivElement | null) => {
    eventRefs.current[String(id)] = el;
  };

  const [booting, setBooting] = useState(() => !initialWarmCache);

  const [tab, setTab] = useState<Tab>("month");
  const [scope, setScope] = useState<Scope>("all");

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

   const [events, setEvents] = useState<CalendarEventWithOwner[]>(() => initialWarmCache?.events ?? []);
  const [groups, setGroups] = useState<GroupRow[]>(() => initialWarmCache?.groups ?? []);
const [, setDeclinedEventIds] = useState<Set<string>>(() => new Set());
  const [resMap, setResMap] = useState<Record<string, Resolution>>(
    () => initialWarmCache?.resMap ?? {}
  );
  const [trustSignals, setTrustSignals] = useState<
    Record<string, ConflictTrustSignal>
  >(() => initialWarmCache?.trustSignals ?? {});
  const [proposalResponsesMap, setProposalResponsesMap] = useState<
    Record<string, ProposalResponseRow>
  >(() => initialWarmCache?.proposalResponsesMap ?? {});

  const groupTypeById = useMemo(() => {
    const m = new Map<string, "pair" | "family" | "other">();

    for (const g of groups || []) {
      const id = String(g.id);
      const rawType = String(g.type ?? "").toLowerCase();

      if (rawType === "family") {
        m.set(id, "family");
      } else if (rawType === "other" || rawType === "shared") {
        m.set(id, "other");
      } else {
        m.set(id, "pair");
      }
    }

    return m;
  }, [groups]);

  const [error, setError] = useState<string | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(() => initialWarmCache?.eventsLoaded ?? false);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(
    () => initialWarmCache?.activeGroupId ?? null
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => initialWarmCache?.currentUserId ?? null
  );

  const [enabledGroups, setEnabledGroups] = useState<EnabledGroups>({
    personal: true,
    pair: true,
    family: true,
    other: true,
  });

  const [toast, setToast] =
    useState<null | { title: string; subtitle?: string }>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [hideError, setHideError] = useState<string | null>(null);

  /* ✏️ ESTADO DEL MODAL DE EDICIÓN */
 const [editingEvent, setEditingEvent] = useState<CalendarEventWithOwner | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

const handleEditEvent = useCallback((e: CalendarEventWithOwner) => {
  setDeleteError(null);
  setHideError(null);
  setEditingEvent(e);
  setIsEditOpen(true);
}, []);

  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);
  const monthEnd = useMemo(() => endOfMonth(anchor), [anchor]);
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const gridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);
  const visibleRangeKey = useMemo(
    () => `${gridStart.toISOString()}|${gridEnd.toISOString()}`,
    [gridStart, gridEnd]
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  /* =========================
     Carga de datos (DB)
     ========================= */
  const refreshCalendar = useCallback(
    async (
      opts: {
        showToast?: boolean;
        toastTitle?: string;
        toastSubtitle?: string;
      } = {}
    ) => {
      const showToastFlag = opts?.showToast ?? false;

      try {
        if (showToastFlag) {
          setToast({
            title: opts?.toastTitle ?? "Actualizando…",
            subtitle: opts?.toastSubtitle ?? "Recargando desde SyncPlans",
          });
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        setCurrentUserId(data.session.user.id ?? null);

        const myGroups = await getMyGroups();
        setGroups(myGroups);

        const persistedActive = await getActiveGroupIdFromDb().catch(() => null);

        let nextActiveGroupId: string | null =
          persistedActive &&
          myGroups.some((g) => String(g.id) === String(persistedActive))
            ? String(persistedActive)
            : null;

        if (!nextActiveGroupId && (myGroups?.length ?? 0) > 0) {
          nextActiveGroupId = String(myGroups[0].id);
          try {
            await setActiveGroupIdInDb(nextActiveGroupId);
          } catch {
            // no-op
          }
        }

        setActiveGroupId(nextActiveGroupId);

        const groupIds = (myGroups || []).map((g) => String(g.id));
        const rangeStartIso = gridStart.toISOString();
        const rangeEndIso = gridEnd.toISOString();

        const [rawEvents, nextResMap, nextDeclined] = await Promise.all([
          getEventsForGroupsInRange(
            groupIds,
            rangeStartIso,
            rangeEndIso
          ) as Promise<CalendarDbEventRow[]>,
          getMyConflictResolutionsMap().catch(() => ({})),
          getMyDeclinedEventIds().catch(() => new Set<string>()),
        ]);

        setResMap(nextResMap ?? {});
        setDeclinedEventIds(nextDeclined ?? new Set());


        const groupTypeByIdLocal = new Map<string, "family" | "pair" | "other">(
          (myGroups || []).map((g) => {
            const id = String(g.id);
            const rawType = String(g.type ?? "").toLowerCase();

            const normalized: "family" | "pair" | "other" =
              rawType === "family"
                ? "family"
                : rawType === "other" || rawType === "shared"
                ? "other"
                : "pair";

            return [id, normalized];
          })
        );

        const nextHiddenIds = new Set<string>();

        const enriched: CalendarEventWithOwner[] = (rawEvents || [])
          .map((ev: CalendarDbEventRow) => {
            const gid = ev.group_id ?? ev.groupId ?? null;

            let gt: GroupType = "personal" as GroupType;

            if (gid) {
              const t = groupTypeByIdLocal.get(String(gid));

              if (t === "family") {
                gt = "family" as GroupType;
              } else if (t === "other") {
                gt = "other" as GroupType;
              } else {
                gt = "pair" as GroupType;
              }
            } else {
              gt = "personal" as GroupType;
            }

            const startRaw = String(ev.start ?? ev.start_at ?? "");
            const endRaw = String(ev.end ?? ev.end_at ?? "");

            if (!isValidDateLike(startRaw) || !isValidDateLike(endRaw)) return null;

            return {
              id: String(ev.id),
              title: ev.title ?? "Evento",
              start: String(startRaw),
              end: String(endRaw),
              notes: ev.notes ?? undefined,
              groupId: gid ? String(gid) : null,
              groupType: gt,
              user_id: ev.user_id ?? null,
              owner_id: ev.owner_id ?? null,
              created_by: ev.created_by ?? null,
              external_source: ev.external_source ? String(ev.external_source) : null,
              external_id: ev.external_id ? String(ev.external_id) : null,
              external_attendees_count: Number.isFinite(Number(ev.external_attendees_count))
                ? Math.max(0, Math.trunc(Number(ev.external_attendees_count)))
                : 0,
            } as CalendarEventWithOwner;
          })
          .filter(Boolean) as CalendarEventWithOwner[];

        const filtered = filterVisibleEvents(enriched, {
          declinedIds: nextDeclined ?? new Set<string>(),
          hiddenIds: nextHiddenIds,
        });

        const nextTrustSignals = await getLatestConflictTrustSignalsByEventIds(
          filtered.map((event) => String(event.id))
        ).catch(() => ({}));

        const proposalResponses = await getMyProposalResponsesForEvents(
          filtered.map((event) => String(event.id)),
          data.session.user.id
        ).catch(() => ({}));

        setEvents(filtered);
        setTrustSignals(nextTrustSignals ?? {});
        const loadedRangeKey = `${rangeStartIso}|${rangeEndIso}`;
        const safeTrustSignals = nextTrustSignals ?? {};
        const safeProposalResponses = proposalResponses ?? {};

        setProposalResponsesMap(safeProposalResponses);
        lastLoadedRangeKeyRef.current = loadedRangeKey;
        setEventsLoaded(true);
        setError(null);
        writeCalendarWarmCache({
          events: filtered,
          groups: myGroups,
          resMap: nextResMap ?? {},
          trustSignals: safeTrustSignals,
          proposalResponsesMap: safeProposalResponses,
          activeGroupId: nextActiveGroupId,
          currentUserId: data.session.user.id ?? null,
          eventsLoaded: true,
          loadedRangeKey,
        });

        if (showToastFlag) {
          setToast({
            title: "Actualizado ✅",
            subtitle: "Tu calendario ya está al día.",
          });
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch (e: unknown) {
        setError(getErrorMessage(e) ?? "Error cargando calendario");
        setTrustSignals({});
        setProposalResponsesMap({});
        setEventsLoaded(true);

        if (showToastFlag) {
          setToast({
            title: "No se pudo actualizar",
            subtitle: getErrorMessage(e) ?? "Revisa tu sesión o conexión.",
          });
          window.setTimeout(() => setToast(null), 2800);
        }
      }
    },
    [gridEnd, gridStart, router]
  );

  const refreshCalendarRef = useRef(refreshCalendar);

  useEffect(() => {
    refreshCalendarRef.current = refreshCalendar;
  }, [refreshCalendar]);

  const runGoogleSyncAndRefresh = useCallback(
    async (opts: GoogleSyncRunOptions = {}): Promise<GoogleSyncRunResult> => {
      const force = opts.force ?? false;
      const showToastFlag = opts.showToast ?? false;

      if (googleSyncInFlightRef.current) {
        return "skipped";
      }

      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token ?? null;
        const userId = data.session?.user?.id ?? null;

        if (!token || !userId) {
          return "skipped";
        }

        const storageKey = `sp_google_calendar_last_auto_sync_at:${userId}`;
        const now = Date.now();

        if (!force && typeof window !== "undefined") {
          const persistedRaw = window.localStorage.getItem(storageKey);
          const persisted = Number(persistedRaw ?? "0");
          const lastAttempt = Math.max(
            Number.isFinite(persisted) ? persisted : 0,
            lastGoogleAutoSyncAtRef.current
          );

          if (now - lastAttempt < CALENDAR_GOOGLE_AUTOSYNC_MIN_INTERVAL_MS) {
            return "skipped";
          }

          lastGoogleAutoSyncAtRef.current = now;
          window.localStorage.setItem(storageKey, String(now));
        }

        googleSyncInFlightRef.current = true;

        const authHeaders: Record<string, string> = {
          Authorization: `Bearer ${token}`,
        };

        const statusRes = await fetch("/api/google/status", {
          method: "GET",
          headers: authHeaders,
          cache: "no-store",
        });

        const statusJson = (await statusRes.json().catch(() => ({}))) as GoogleStatusApiResponse;
        const connectionState =
          statusJson.connection_state ??
          (statusJson.connected ? "connected" : "disconnected");

        if (!statusRes.ok || connectionState !== "connected" || !statusJson.connected) {
          if (connectionState === "needs_reauth") {
            setToast({
              title: "Reconecta Google Calendar",
              subtitle: "La conexión existe, pero Google necesita renovar permisos.",
            });
            window.setTimeout(() => setToast(null), 3600);
            return "reauth";
          }

          return showToastFlag ? "failed" : "skipped";
        }

        if (force && typeof window !== "undefined") {
          lastGoogleAutoSyncAtRef.current = now;
          window.localStorage.setItem(storageKey, String(now));
        }

        if (showToastFlag) {
          setToast({
            title: "Sincronizando Google…",
            subtitle: "Importando cambios recientes de Google Calendar.",
          });
        }

        const syncRes = await fetch("/api/google/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          cache: "no-store",
        });

        const syncJson = (await syncRes.json().catch(() => ({}))) as GoogleSyncApiResponse;

        if (!syncRes.ok || !syncJson.ok) {
          const code = syncJson.code ?? null;
          const needsReauth = isGoogleReauthCode(code);

          if (showToastFlag || needsReauth) {
            setToast({
              title: needsReauth ? "Reconecta Google Calendar" : "No se pudo sincronizar Google",
              subtitle:
                syncJson.error ||
                (needsReauth
                  ? "Vuelve a conectar tu cuenta desde Panel o Ajustes."
                  : "Tus eventos de SyncPlans siguen disponibles."),
            });
            window.setTimeout(() => setToast(null), 3600);
          }

          return needsReauth ? "reauth" : "failed";
        }

        await refreshCalendar({ showToast: false });

        const imported = Number(syncJson.imported ?? 0);
        if (showToastFlag || imported > 0) {
          setToast({
            title: "Google Calendar actualizado ✅",
            subtitle:
              imported > 0
                ? `${imported} evento${imported === 1 ? "" : "s"} importado${imported === 1 ? "" : "s"} o actualizado${imported === 1 ? "" : "s"}.`
                : "Tus eventos externos ya están al día.",
          });
          window.setTimeout(() => setToast(null), 2800);
        }

        return "synced";
      } catch (error) {
        if (showToastFlag) {
          setToast({
            title: "No se pudo sincronizar Google",
            subtitle: getErrorMessage(error) || "Intenta nuevamente en unos segundos.",
          });
          window.setTimeout(() => setToast(null), 3200);
        }

        return "failed";
      } finally {
        googleSyncInFlightRef.current = false;
      }
    },
    [refreshCalendar]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      if (!editingEvent || !currentUserId) return;

      if (!isEventOwnedByUser(editingEvent, currentUserId)) {
        setDeleteError("No puedes eliminar este evento porque no te pertenece.");
        return;
      }

      try {
        setDeleteError(null);
        setHideError(null);

        const result = await deleteEventsByIdsDetailed([eventId]);

        if (result.deletedCount !== 1) {
  if (result.blockedIds.length > 0) {
    setDeleteError(
      "Este evento parece tuyo en la app, pero la base de datos no permitió eliminarlo. Revisa la policy de DELETE en Supabase."
    );
    return;
  }

  setDeleteError("El evento no se eliminó realmente.");
  return;
}

        setDeleteError(null);
        setIsEditOpen(false);
        setEditingEvent(null);

        await refreshCalendar({
          showToast: true,
          toastTitle: "Evento eliminado ✅",
          toastSubtitle: "Tu calendario ya está actualizado.",
        });
      } catch (e: unknown) {
        setDeleteError(
          getErrorMessage(e) ?? "No se pudo eliminar este evento con tu sesión actual."
        );
      }
    },
    [currentUserId, editingEvent, refreshCalendar]
  );


  const handleHideEvent = useCallback(
    async (eventId: string, groupId?: string | null) => {
      try {
        setHideError(null);
        setDeleteError(null);

        await declineEventForCurrentUser(
          String(eventId),
          groupId ? String(groupId) : null,
          "Hidden from calendar"
        );

        setIsEditOpen(false);
        setEditingEvent(null);

        await refreshCalendar({
          showToast: true,
          toastTitle: "Evento ocultado ✅",
          toastSubtitle: "Ya no lo verás en tu calendario ni en tu lista.",
        });
      } catch (e: unknown) {
        setHideError(
          getErrorMessage(e) ?? "No se pudo ocultar este evento para tu cuenta."
        );
      }
    },
    [refreshCalendar]
  );

  /* ✅ toast post-apply */
  useEffect(() => {
    if (!appliedToast) return;

    const { appliedCount, deleted, skipped } = appliedToast;

    const parts: string[] = [];
    if (appliedCount > 0)
      parts.push(
        `${appliedCount} decisión${
          appliedCount === 1 ? "" : "es"
        } aplicada${appliedCount === 1 ? "" : "s"}`
      );
    if (deleted > 0)
      parts.push(
        `${deleted} evento${
          deleted === 1 ? "" : "s"
        } eliminado${deleted === 1 ? "" : "s"}`
      );
    if (skipped > 0)
      parts.push(
        `${skipped} conflicto${
          skipped === 1 ? "" : "s"
        } saltado${skipped === 1 ? "" : "s"}`
      );

    const subtitle =
      parts.length > 0
        ? parts.join(" · ")
        : "No hubo cambios que aplicar en los conflictos.";

    setToast({ title: "Cambios aplicados ✅", subtitle });

    refreshCalendar();

    const t = window.setTimeout(() => setToast(null), 4200);
    router.replace(pathname);

    return () => window.clearTimeout(t);
  }, [appliedToast, pathname, refreshCalendar, router]);

  useEffect(() => {
    const handler = async () => {
      await refreshCalendar();
    };

    window.addEventListener("sp:active-group-changed", handler as EventListener);
    window.addEventListener("sp:events-changed", handler as EventListener);

    return () => {
      window.removeEventListener(
        "sp:active-group-changed",
        handler as EventListener
      );
      window.removeEventListener(
        "sp:events-changed",
        handler as EventListener
      );
    };
  }, [refreshCalendar]);

  useEffect(() => {
    const handler = async (event: Event) => {
      const customEvent = event as CustomEvent<{ imported?: number }>;
      const imported = Number(customEvent?.detail?.imported ?? 0);

      await refreshCalendar();

      setToast({
        title: "Google sincronizado ✅",
        subtitle:
          imported > 0
            ? `${imported} evento${imported === 1 ? "" : "s"} importado${
                imported === 1 ? "" : "s"
              } desde Google`
            : "Calendario actualizado con tus eventos de Google",
      });

      window.setTimeout(() => setToast(null), 2800);
    };

    window.addEventListener("sp:google-synced", handler as EventListener);

    return () => {
      window.removeEventListener("sp:google-synced", handler as EventListener);
    };
  }, [refreshCalendar]);

  useEffect(() => {
    if (booting) return;
    void runGoogleSyncAndRefresh({ reason: "calendar_open" });
  }, [booting, runGoogleSyncAndRefresh]);

  useEffect(() => {
    const shouldRefreshFromSecondaryTrigger = () => {
      const now = Date.now();

      if (
        now - lastSecondaryRefreshAtRef.current <
        CALENDAR_SECONDARY_REFRESH_GUARD_MS
      ) {
        return false;
      }

      lastSecondaryRefreshAtRef.current = now;
      return true;
    };

    const onFocus = () => {
      if (!shouldRefreshFromSecondaryTrigger()) return;
      void runGoogleSyncAndRefresh({ reason: "focus" });
      void refreshCalendar();
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!shouldRefreshFromSecondaryTrigger()) return;
      void runGoogleSyncAndRefresh({ reason: "visibility" });
      void refreshCalendar();
    };

    const onEventsChanged = () => {
      void refreshCalendar();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("sp:events-changed", onEventsChanged as EventListener);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("sp:events-changed", onEventsChanged as EventListener);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCalendar, runGoogleSyncAndRefresh]);

  useEffect(() => {
    if (booting || !eventsLoaded) return;
    if (lastLoadedRangeKeyRef.current === visibleRangeKey) return;

    void refreshCalendar();
  }, [booting, eventsLoaded, refreshCalendar, visibleRangeKey]);

  /* Boot inicial */
  useEffect(() => {
    let alive = true;

    (async () => {
      const shouldShowInitialBoot = !hasWarmCacheAtMountRef.current;
      if (shouldShowInitialBoot) setBooting(true);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      try {
        await refreshCalendarRef.current();
        lastSecondaryRefreshAtRef.current = Date.now();
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  /* =========================
     Conflictos
     ========================= */
  const conflicts = useMemo(() => {
    const normalized: CalendarEventWithOwner[] = (Array.isArray(events)
      ? events
      : []
    ).map((e) => ({
      ...e,
      groupType: normalizeForConflicts(e.groupType),
    }));

    const all = computeVisibleConflicts(normalized);
    const visible = filterIgnoredConflicts(all);

    return visible.filter(
      (conflict) => isConflictStillRelevant(conflict) && !resolutionForConflict(conflict, resMap),
    );
  }, [events, resMap]);

  const conflictCount = conflicts.length;
  const latestConflictEventId = useMemo(() => {
    if (!conflicts.length) return null;

    let latestId: string | null = null;
    let latestStartMs = -1;

    for (const conflict of conflicts) {
      const candidates = [
        events.find((e) => String(e.id) === String(conflict.existingEventId)),
        events.find((e) => String(e.id) === String(conflict.incomingEventId)),
      ].filter(Boolean) as CalendarEventWithOwner[];

      for (const event of candidates) {
        const ms = toDateMs(event.start);
        if (Number.isNaN(ms)) continue;

        if (ms > latestStartMs) {
          latestStartMs = ms;
          latestId = String(event.id);
        }
      }
    }

    return latestId;
  }, [conflicts, events]);
  const conflictEventIdsInGrid = useMemo(() => {
    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    const set = new Set<string>();
    for (const c of conflicts) {
      const s = toDateMs(c.overlapStart);
      const e = toDateMs(c.overlapEnd);
      const intersects = e >= a && s <= b;
      if (!intersects) continue;

      set.add(String(c.existingEventId));
      set.add(String(c.incomingEventId));
    }
    return set;
  }, [conflicts, gridStart, gridEnd]);

  const firstRelevantConflictIndex = useMemo(() => {
    if (conflicts.length === 0) return 0;

    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    const idx = conflicts.findIndex((c) => {
      const s = toDateMs(c.overlapStart);
      const e = toDateMs(c.overlapEnd);
      return e >= a && s <= b;
    });

    return idx >= 0 ? idx : 0;
  }, [conflicts, gridStart, gridEnd]);

  const conflictLead = useMemo(() => {
    if (conflicts.length === 0) return null;

    const target = conflicts[firstRelevantConflictIndex] ?? conflicts[0];
    if (!target) return null;

    const existing = events.find(
      (event) => String(event.id) === String(target.existingEventId)
    );
    const incoming = events.find(
      (event) => String(event.id) === String(target.incomingEventId)
    );

    const titleA = existing?.title?.trim() || 'Plan existente';
    const titleB = incoming?.title?.trim() || 'Plan nuevo';
    const referenceEvent = incoming ?? existing ?? null;
    const referenceDate = referenceEvent
      ? parseIsoLike(referenceEvent.start) ?? new Date(referenceEvent.start)
      : null;
    const when =
      referenceEvent && referenceDate
        ? `${prettyDay(referenceDate)} · ${prettyTimeRange(referenceEvent.start, referenceEvent.end)}`
        : null;

    return {
      titleA,
      titleB,
      when,
    };
  }, [conflicts, firstRelevantConflictIndex, events]);

  /* =========================
     Filtros y vistas
     ========================= */
  const filteredEvents = useMemo(() => {
    const isEnabled = (g?: GroupType | null) => {
      const key = String(g ?? "personal") as keyof EnabledGroups;
      return !!enabledGroups[key];
    };

    return (Array.isArray(events) ? events : []).filter((e) => {
      const gt = (e.groupType ?? "personal") as GroupType;

      if (!isEnabled(gt)) return false;

      if (scope === "all") return true;

      if (scope === "personal") {
        return gt === "personal" && !isGoogleEventWithExternalGuests(e);
      }

      // scope === "active"
      const inConflict = conflictEventIdsInGrid.has(String(e.id));
      if (inConflict) return true;

      if (gt === "personal") return true;

      if (!activeGroupId) {
        return false;
      }

      return String(e.groupId ?? "") === String(activeGroupId);
    });
  }, [
    events,
    scope,
    enabledGroups,
    activeGroupId,
    conflictEventIdsInGrid,
  ]);

  const visibleEvents = useMemo(() => {
    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    return filteredEvents.filter((e) => {
      const s = toDateMs(e.start);
      const en = toDateMs(e.end);
      return en >= a && s <= b;
    });
  }, [filteredEvents, gridStart, gridEnd]);

const valueVisibility = useMemo(() => {
  return getValueVisibilitySummary({
    visibleEvents,
    trustSignals,
    proposalResponsesMap,
    conflictEventIdsInGrid,
  });
}, [visibleEvents, trustSignals, proposalResponsesMap, conflictEventIdsInGrid]);
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventWithOwner[]>();

    for (const event of visibleEvents) {
      const dayKeys = getEventDayKeysInRange(event, gridStart, gridEnd);

      for (const key of dayKeys) {
        const arr = map.get(key) || [];
        if (!arr.some((existing) => String(existing.id) === String(event.id))) {
          arr.push(event);
        }
        map.set(key, arr);
      }
    }

    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => {
        const aMulti = isMultiDayCalendarEvent(a);
        const bMulti = isMultiDayCalendarEvent(b);
        if (aMulti !== bMulti) return aMulti ? -1 : 1;

        const aStart = toDateMs(a.start);
        const bStart = toDateMs(b.start);
        if (aStart !== bStart) return aStart - bStart;

        const aDuration = toDateMs(a.end) - toDateMs(a.start);
        const bDuration = toDateMs(b.end) - toDateMs(b.start);
        return bDuration - aDuration;
      });
      map.set(key, arr);
    }

    return map;
  }, [visibleEvents, gridStart, gridEnd]);

  const agendaEvents = useMemo(() => {
    const list = [...visibleEvents];
    list.sort(
      (a, b) =>
        toDateMs(a.start) - toDateMs(b.start)
    );
    return list;
  }, [visibleEvents]);

  const highlightedEvent = useMemo(() => {
    if (!highlightId) return null;
    return (
      filteredEvents.find(
        (e) => String(e.id) === String(highlightId)
      ) ?? null
    );
  }, [highlightId, filteredEvents]);

  useEffect(() => {
    if (!highlightedEvent) return;

    const d = parseIsoLike(highlightedEvent.start) ?? new Date(highlightedEvent.start);

    setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(
      new Date(d.getFullYear(), d.getMonth(), d.getDate())
    );
    setTab("agenda");

    setToast({
      title: "Evento encontrado ✨",
      subtitle: "Te llevé directo al evento desde la notificación.",
    });

    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [highlightedEvent]);

  useEffect(() => {
    if (!highlightId) return;

    const t = window.setTimeout(() => {
      const el = eventRefs.current[String(highlightId)];
      if (el)
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 140);

    return () => window.clearTimeout(t);
  }, [highlightId, tab, agendaEvents.length]);

  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      router.replace(pathname);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [highlightId, pathname, router]);

  const goPrevMonth = () =>
    setAnchor(
      (d) => new Date(d.getFullYear(), d.getMonth() - 1, 1)
    );
  const goNextMonth = () =>
    setAnchor(
      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1)
    );
  const goToday = () => {
    const t = new Date();
    setAnchor(t);
    setSelectedDay(t);
  };

  const toggleGroup = (g: GroupType) =>
    setEnabledGroups((s) => {
      const key = String(g) as keyof EnabledGroups;
      return { ...s, [key]: !s[key] };
    });

  const handleRefresh = async () => {
    const googleResult = await runGoogleSyncAndRefresh({
      force: true,
      showToast: true,
      reason: "manual_refresh",
    });

    if (googleResult === "skipped") {
      await refreshCalendar({
        showToast: true,
        toastTitle: "Actualizado ✅",
        toastSubtitle: "Tu calendario de SyncPlans ya está al día.",
      });
    }
  };

  const openNewEventPersonal = (date?: Date) => {
    const d = date ?? selectedDay ?? new Date();
    router.push(
      `/events/new/details?type=personal&date=${encodeURIComponent(
        d.toISOString()
      )}`
    );
  };

  const openNewEventGroup = (date?: Date) => {
    const d = date ?? selectedDay ?? new Date();
    router.push(
      `/events/new/details?type=group&date=${encodeURIComponent(
        d.toISOString()
      )}`
    );
  };

  const openConflicts = () => {
    if (latestConflictEventId) {
      router.push(
        `/conflicts/detected?eventId=${encodeURIComponent(latestConflictEventId)}`
      );
      return;
    }

    router.push("/conflicts/detected");
  };

  const resolveNow = () =>
    router.push(`/conflicts/compare?i=${firstRelevantConflictIndex}`);

  const currentMonthIndex = anchor.getMonth();
  const currentYear = anchor.getFullYear();

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Calendario"
            subtitle="El calendario acompaña la coordinación. Aquí ubicas rápido qué necesita decisión."
            rightSlot={
              <button
                onClick={handleRefresh}
                style={{
                  ...styles.ghostBtn,
                  padding: isMobile ? "6px 10px" : "10px 12px",
                  fontSize: isMobile ? 12 : 14,
                }}
              >
                Actualizar
              </button>
            }
          />

          <Card style={styles.loadingCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Sincronizando tu calendario…</div>
                <div style={styles.loadingSub}>
                  Cargando lo esencial primero
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  const monthTitle = prettyMonthRange(monthStart, monthEnd);
  const overviewStatusText = !eventsLoaded
    ? "Revisando señales…"
    : conflictCount > 0
      ? `${conflictCount} choque${conflictCount === 1 ? "" : "s"} abierto${conflictCount === 1 ? "" : "s"}`
      : "Sin choques abiertos";

  const valueSignalParts: string[] = [];
  if (valueVisibility.resolved > 0) {
    valueSignalParts.push(
      `${valueVisibility.resolved} resuelto${valueVisibility.resolved === 1 ? "" : "s"}`
    );
  }
  if (valueVisibility.adjusted > 0) {
    valueSignalParts.push(
      `${valueVisibility.adjusted} ajustado${valueVisibility.adjusted === 1 ? "" : "s"}`
    );
  }
  if (valueVisibility.pending === 0) {
    valueSignalParts.push("Nada pendiente");
  }

  const valueSignalSummary = valueSignalParts.length
    ? valueSignalParts.join(" · ")
    : "Sin señales abiertas";
  const valueSignalTitle = valueVisibility.pending > 0
    ? `${valueVisibility.pending} decisión${valueVisibility.pending === 1 ? "" : "es"} pendiente${valueVisibility.pending === 1 ? "" : "s"}`
    : "Todo claro por ahora";

  return (
    <MobileScaffold maxWidth={1120} style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <Section>
        <PremiumHeader
          title="Calendario"
          subtitle="El calendario acompaña la coordinación. Aquí ves rápido qué necesita decisión y qué ya quedó claro."
          rightSlot={
            <button
              onClick={handleRefresh}
              style={{
                ...styles.ghostBtn,
                padding: isMobile ? "6px 10px" : "10px 12px",
                fontSize: isMobile ? 12 : 14,
              }}
            >
              Actualizar
            </button>
          }
        />

        <Card style={styles.overviewCard} className="spCal-overviewCard">
          <div style={styles.overviewTop}>
            <div style={styles.overviewLeft}>
              <div style={styles.overviewEyebrow}>Vista actual</div>
              <h2 style={styles.overviewTitle}>{monthTitle}</h2>
              <div style={styles.overviewSub}>
                {error ? error : overviewStatusText}
              </div>
            </div>

            <div style={styles.overviewActions}>
              <button
                onClick={() => openNewEventPersonal()}
                style={styles.primaryBtnPersonal}
              >
                + Personal
              </button>
              <button
                onClick={() => openNewEventGroup()}
                style={styles.primaryBtnGroup}
              >
                + Compartido
              </button>
            </div>
          </div>

          {!eventsLoaded || conflictCount > 0 ? (
            <div
              style={{
                ...styles.overviewMetaRow,
                ...(isMobile ? styles.overviewMetaRowMobile : null),
              }}
            >
              {!eventsLoaded ? (
                <div style={styles.statusPillNeutral}>
                  <span style={styles.statusDotNeutral} />
                  Revisando…
                </div>
              ) : (
                <div style={styles.statusCluster}>
                  <button onClick={openConflicts} style={styles.statusPillDanger}>
                    <span style={styles.statusDotDanger} />
                    {conflictCount} choque{conflictCount === 1 ? "" : "s"} abierto{conflictCount === 1 ? "" : "s"}
                  </button>

                  <button onClick={resolveNow} style={styles.statusPillAction}>
                    Resolver ahora
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </Card>

        {conflictCount > 0 ? (
          <button type="button" onClick={resolveNow} style={styles.conflictBanner}>
            <div style={styles.conflictBannerLeft}>
              <div style={styles.conflictBannerEyebrow}>Conflicto pendiente</div>
              <div style={styles.conflictBannerTitle}>
                {conflictCount === 1
                  ? 'Hay una decisión abierta en este calendario'
                  : `Hay ${conflictCount} decisiones abiertas en este calendario`}
              </div>
              <div style={styles.conflictBannerSub}>
                {conflictLead
                  ? `${conflictLead.titleA} vs ${conflictLead.titleB}${
                      conflictLead.when ? ` · ${conflictLead.when}` : ''
                    }.`
                  : 'Hay un cruce visible entre dos planes.'}{' '}
                El calendario te ayuda a ubicarlo rápido; la resolución vive en Conflictos para que salgas con una sola decisión clara.
              </div>
            </div>

            <div style={styles.conflictBannerCta}>
              {conflictCount === 1 ? 'Resolver ahora' : 'Revisar choques'}
            </div>
          </button>
        ) : null}

        {valueVisibility.hasValue ? (
          <Card
            style={{
              ...styles.valueRailCard,
              ...(valueVisibility.pending > 0 ? styles.valueRailCardPending : null),
            }}
          >
            <div style={styles.valueRailTop}>
              <div style={styles.valueRailCopy}>
                <div style={styles.valueRailEyebrow}>Señales compartidas</div>
                <div style={styles.valueRailTitle}>{valueSignalTitle}</div>
                <div style={styles.valueRailSub}>{valueSignalSummary}</div>
              </div>

              {valueVisibility.pending > 0 ? (
                <div style={styles.valueRailActions}>
                  <button
                    type="button"
                    onClick={openConflicts}
                    style={styles.valueRailBtn}
                  >
                    Resolver
                  </button>
                </div>
              ) : null}
            </div>
          </Card>
        ) : null}

        {isMobile ? (
          <MobileCalendarControls
            tab={tab}
            scope={scope}
            onChangeTab={setTab}
            onChangeScope={setScope}
            enabledGroups={enabledGroups}
            onToggleGroup={toggleGroup}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onToday={goToday}
            currentMonthIndex={currentMonthIndex}
            currentYear={currentYear}
          />
        ) : (
          <CalendarFilters
            tab={tab}
            scope={scope}
            onChangeTab={setTab}
            onChangeScope={setScope}
            enabledGroups={enabledGroups}
            onToggleGroup={toggleGroup}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onToday={goToday}
            currentMonthIndex={currentMonthIndex}
            currentYear={currentYear}
            onChangeMonthYear={(year, monthIndex) => {
              setAnchor(new Date(year, monthIndex, 1));
            }}
          />
        )}

        {tab === "month" ? (
          <Card style={styles.calendarCard} className="spCal-calendarCard">
            <div className="spCal-monthScroller" style={styles.monthScroller}>
          <div
  style={{
    ...styles.weekHeader,
    gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
    minWidth: isMobile ? 700 : 700,
    padding: styles.weekHeader.padding,
  }}
  className="spCal-weekHeader"
>
                {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map(
                  (d) => (
                    <div key={d} style={styles.weekDay}>
                      {d}
                    </div>
                  )
                )}
              </div>

<div
  style={{
    ...styles.grid,
    gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
    minWidth: isMobile ? 700 : 700,
    gap: 12,
    padding: 12,
    gridAutoRows: isMobile ? "minmax(112px, auto)" : "minmax(140px, auto)",
  }}
  className="spCal-grid"
>
                {renderMonthCells({
                  gridStart,
                  gridEnd,
                  monthStart,
                  selectedDay,
                  setSelectedDay,
                  eventsByDay,
                  openNewEventPersonal,
                  openNewEventGroup,
                  groupTypeById,
                  trustSignals,
                  proposalResponsesMap,
                  conflictEventIdsInGrid,
                  onEdit: handleEditEvent,
                  today,
                  isMobile,
                })}
              </div>
            </div>

            <div style={styles.dayPanel} className="spCal-dayPanel">
              <div style={styles.dayPanelTop}>
                <div style={styles.dayPanelTitle}>{prettyDay(selectedDay)}</div>

                <div style={styles.dayPanelActions}>
                  <button
                    onClick={() => openNewEventPersonal(selectedDay)}
                    style={styles.ghostBtnSmallPersonal}
                  >
                    + Plan personal
                  </button>
                  <button
                    onClick={() => openNewEventGroup(selectedDay)}
                    style={styles.ghostBtnSmallGroup}
                  >
                    + Plan compartido
                  </button>
                </div>
              </div>

              <div style={styles.dayList}>
                {(eventsByDay.get(ymd(selectedDay)) || []).length === 0 ? (
                  <div style={styles.emptyHint}>Nada abierto este día. Puedes dejar un plan claro desde aquí.</div>
                ) : (
                  (eventsByDay.get(ymd(selectedDay)) || []).map((e) => (
                    <EventRow
                      key={e.id ?? `${e.start}_${e.end}`}
                      e={e}
                      highlightId={highlightId}
                      setRef={setEventRef}
                      onDelete={handleDeleteEvent}
                      onEdit={handleEditEvent}
                      groupTypeById={groupTypeById}
                      currentUserId={currentUserId}
                      trustSignal={trustSignals[String(e.id)]}
                      isMobile={isMobile}
                      contextDate={selectedDay}
                      proposalResponsesMap={proposalResponsesMap}
                      inConflict={conflictEventIdsInGrid.has(String(e.id))}
                    />
                  ))
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card style={styles.agendaCard}>
            <div style={styles.agendaTop}>
              <div style={styles.agendaTitle}>Seguimiento visible</div>
              <div style={styles.agendaSub}>
                Mostrando {agendaEvents.length} evento
                {agendaEvents.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.agendaList}>
              {agendaEvents.length === 0 ? (
                <div style={styles.emptyHint}>
                  No hay nada por revisar con estos filtros ahora mismo.
                </div>
              ) : (
                agendaEvents.map((e) => (
                  <EventRow
                    key={e.id ?? `${e.start}_${e.end}`}
                    e={e}
                    highlightId={highlightId}
                    setRef={setEventRef}
                    onDelete={handleDeleteEvent}
                    onEdit={handleEditEvent}
                    groupTypeById={groupTypeById}
                    currentUserId={currentUserId}
                    isMobile={isMobile}
                    proposalResponsesMap={proposalResponsesMap}
                    inConflict={conflictEventIdsInGrid.has(String(e.id))}
                  />
                ))
              )}
            </div>
          </Card>
        )}

        <EventEditModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setEditingEvent(null);
            setDeleteError(null);
            setHideError(null);
          }}
initialEvent={
  editingEvent
    ? {
        id: editingEvent.id,
        title: editingEvent.title,
        start: editingEvent.start,
        end: editingEvent.end,
        description: editingEvent.notes,
        groupType: normalizeForEventEditModal(editingEvent.groupType),
        groupId: editingEvent.groupId ?? null,
      }
    : undefined
}
          groups={groups?.map((g) => ({ id: g.id, type: g.type }))}
canDelete={!!editingEvent && isEventOwnedByUser(editingEvent, currentUserId)}
canHide={!!(editingEvent && currentUserId && !isEventOwnedByUser(editingEvent, currentUserId))}
     onDelete={
  editingEvent && currentUserId && isEventOwnedByUser(editingEvent, currentUserId)
    ? async () => {
        await handleDeleteEvent(editingEvent.id);
      }
    : undefined
}
onHide={
  editingEvent && currentUserId && !isEventOwnedByUser(editingEvent, currentUserId)
    ? async () => {
        await handleHideEvent(editingEvent.id, editingEvent.groupId ?? null);
      }
    : undefined
}
          deleteError={deleteError}
          hideError={hideError}
          onSaved={async () => {
            setIsEditOpen(false);
            setEditingEvent(null);
            setDeleteError(null);
            setHideError(null);
            await refreshCalendar({
              showToast: true,
              toastTitle: "Evento actualizado ✅",
              toastSubtitle: "Tu calendario ya está al día.",
            });
          }}
        />
      </Section>
    </MobileScaffold>
  );
}

function MobileCalendarControls({
  tab,
  scope,
  onChangeTab,
  onChangeScope,
  enabledGroups,
  onToggleGroup,
  onPrevMonth,
  onNextMonth,
  onToday,
  currentMonthIndex,
  currentYear,
}: {
  tab: Tab;
  scope: Scope;
  onChangeTab: (tab: Tab) => void;
  onChangeScope: (scope: Scope) => void;
  enabledGroups: EnabledGroups;
  onToggleGroup: (group: GroupType) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  currentMonthIndex: number;
  currentYear: number;
}) {
  const monthLabel = `${MONTH_LABELS_ES[currentMonthIndex] ?? "Mes"} ${currentYear}`;

  const tabItems: Array<{ value: Tab; label: string }> = [
    { value: "month", label: "Calendario" },
    { value: "agenda", label: "Seguimiento" },
  ];

  const scopeItems: Array<{ value: Scope; label: string }> = [
    { value: "all", label: "Todo" },
    { value: "personal", label: "Personal" },
    { value: "active", label: "Compartido" },
  ];

  const legendItems: Array<{
    key: keyof EnabledGroups;
    label: string;
    dot: string;
    group: GroupType;
  }> = [
    { key: "personal", label: "Personal", dot: "#facc15", group: "personal" as GroupType },
    { key: "pair", label: "Pareja", dot: "#fb7185", group: "pair" as GroupType },
    { key: "family", label: "Familia", dot: "#60a5fa", group: "family" as GroupType },
  ];

  return (
    <Card style={styles.mobileControlsCard}>
      <div style={styles.mobileSegmentTwo}>
        {tabItems.map((item) => {
          const active = tab === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChangeTab(item.value)}
              style={{
                ...styles.mobileSegmentBtn,
                ...(active ? styles.mobileSegmentBtnActive : null),
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={styles.mobileSegmentThree}>
        {scopeItems.map((item) => {
          const active = scope === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => onChangeScope(item.value)}
              style={{
                ...styles.mobileScopeBtn,
                ...(active ? styles.mobileSegmentBtnActive : null),
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div style={styles.mobileMonthRow}>
        <div style={styles.mobileMonthPill}>
          <button
            type="button"
            onClick={onPrevMonth}
            style={styles.mobileArrowBtn}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <div style={styles.mobileMonthLabel}>{monthLabel}</div>
          <button
            type="button"
            onClick={onNextMonth}
            style={styles.mobileArrowBtn}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>

        <button type="button" onClick={onToday} style={styles.mobileTodayBtn}>
          Hoy
        </button>
      </div>

      <div style={styles.mobileLegendRow}>
        {legendItems.map((item) => {
          const active = enabledGroups[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggleGroup(item.group)}
              style={{
                ...styles.mobileLegendChip,
                ...(active ? styles.mobileLegendChipActive : null),
              }}
            >
              <span style={{ ...styles.mobileLegendDot, background: item.dot }} />
              <span style={styles.mobileLegendText}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/* =========================
   EventRow
   ========================= */
function EventRow({
  e,
  highlightId,
  setRef,
  onDelete,
  onEdit,
  groupTypeById,
  currentUserId,
  trustSignal,
  isMobile,
  contextDate,
  proposalResponsesMap,
  inConflict = false,
}: {
  e: CalendarEventWithOwner;
  highlightId?: string | null;
  setRef?: (id: string) => (el: HTMLDivElement | null) => void;
  onDelete?: (id: string, title?: string) => void;
  onEdit?: (e: CalendarEventWithOwner) => void;
  currentUserId?: string | null;
  groupTypeById?: Map<string, "pair" | "family" | "other">;
  trustSignal?: ConflictTrustSignal | null;
  isMobile?: boolean;
  contextDate?: Date | null;
  proposalResponsesMap?: Record<string, ProposalResponseRow>;
  inConflict?: boolean;
}) {
  const resolvedType: GroupType = e.groupId
    ? ((groupTypeById?.get(String(e.groupId)) ?? "pair") as GroupType)
    : ("personal" as GroupType);

  const meta = groupMeta(resolvedType);
  const audienceLabel = getEventAudienceLabel(e, { groupLabel: meta.label });
  const isHighlighted =
    highlightId && String(e.id) === String(highlightId);
  const canDelete = isEventOwnedByUser(e, currentUserId);
  const isMultiDay = isMultiDayCalendarEvent(e);
  const proposalRow = proposalResponsesMap?.[String(e.id)];
  const statusPresentation = getCalendarStatusPresentation({
    event: e,
    eventId: e.id,
    inConflict,
    proposalRow,
    trustSignal,
    pendingStyle: styles.eventTrustBadgePending,
    resolvedStyle: styles.eventTrustBadgeResolved,
  });
  const statusLabel = statusPresentation.label;
  const statusStyle = statusPresentation.style;

  return (
    <div
      ref={setRef ? setRef(String(e.id)) : undefined}
      style={{
        ...styles.eventRow,
        ...(isMultiDay ? styles.eventRowMultiDay : null),
        border: isHighlighted
          ? "1px solid rgba(56,189,248,0.55)"
          : isMultiDay
          ? styles.eventRowMultiDay.border
          : styles.eventRow.border,
        background: isHighlighted
          ? "rgba(255,255,255,0.08)"
          : isMultiDay
          ? styles.eventRowMultiDay.background
          : styles.eventRow.background,
      }}
      className="spCal-chip"
      onClick={(ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        onEdit?.(e);
      }}
    >
      <div style={{ ...styles.eventBar, background: meta.dot }} />
      <div style={styles.eventBody}>
        <div
          style={{
            ...styles.eventTop,
            ...(isMobile ? styles.eventTopMobile : null),
          }}
        >
          <div
            style={{
              ...styles.eventMain,
              ...(isMobile ? styles.eventMainMobile : null),
            }}
          >
            <div style={styles.eventTitle}>{e.title || "Sin título"}</div>

            <div
              style={
                isMultiDay
                  ? { ...styles.eventTime, ...styles.eventTimeMultiDay }
                  : styles.eventTime
              }
            >
              {isMultiDay
                ? multiDayContextLabel(e, contextDate)
                : prettyTimeRange(e.start, e.end)}
            </div>
          </div>

          <div
            style={{
              ...styles.eventRight,
              ...(isMobile ? styles.eventRightMobile : null),
            }}
          >
            <div style={styles.eventMetaPills}>
              <div
                style={{
                  ...styles.eventTag,
                  ...(isMobile ? styles.eventTagMobile : null),
                }}
              >
                <span
                  style={{
                    ...styles.eventDot,
                    background: meta.dot,
                  }}
                />
                <span style={styles.eventTagText}>{audienceLabel}</span>
              </div>

              {isMultiDay ? (
                <div style={styles.eventMultiDayBadge}>Varios días</div>
              ) : null}

              {statusLabel ? (
                <div
                  style={{
                    ...styles.eventTrustBadge,
                    ...statusStyle,
                    ...(isMobile ? styles.eventTrustBadgeMobile : null),
                  }}
                >
                  {statusLabel}
                </div>
              ) : null}
            </div>

            <div style={styles.eventActionGroup}>
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  onEdit?.(e);
                }}
                style={{
                  ...styles.editBtn,
                  ...(isMobile ? styles.eventIconBtnMobile : null),
                }}
                aria-label="Editar evento"
                title="Editar evento"
              >
                ✏️
              </button>

              {canDelete ? (
                <button
                  type="button"
                  onClick={(ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    onDelete?.(String(e.id), e.title);
                  }}
                  style={{
                    ...styles.deleteBtn,
                    ...(isMobile ? styles.eventIconBtnMobile : null),
                  }}
                  aria-label="Eliminar evento"
                  title="Eliminar evento"
                >
                  🗑️
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Celdas del mes
   ========================= */
function renderMonthCells(opts: {
  gridStart: Date;
  gridEnd: Date;
  monthStart: Date;
  selectedDay: Date;
  setSelectedDay: (d: Date) => void;
 eventsByDay: Map<string, CalendarEventWithOwner[]>;
  openNewEventPersonal: (date?: Date) => void;
  openNewEventGroup: (date?: Date) => void;
  groupTypeById: Map<string, "pair" | "family" | "other">;
  trustSignals: Record<string, ConflictTrustSignal>;
  proposalResponsesMap: Record<string, ProposalResponseRow>;
  conflictEventIdsInGrid: Set<string>;
  onEdit: (e: CalendarEventWithOwner) => void;
  today: Date;
  isMobile: boolean;
}) {
  const {
    gridStart,
    gridEnd,
    monthStart,
    selectedDay,
    setSelectedDay,
    eventsByDay,
    openNewEventPersonal,
    groupTypeById,
    trustSignals,
    proposalResponsesMap,
    conflictEventIdsInGrid,
    onEdit,
    today,
    isMobile,
  } = opts;

  const cells: React.ReactNode[] = [];
  const day = new Date(gridStart);

  while (day <= gridEnd) {
    const cellDate = new Date(day);

    const inMonth = cellDate.getMonth() === monthStart.getMonth();
    const isSelected = sameDay(cellDate, selectedDay);
    const isToday = sameDay(cellDate, today);

    const dayEvents = eventsByDay.get(ymd(cellDate)) || [];
const visibleLimit = isMobile ? 2 : 3;
const visibleEvents = dayEvents.slice(0, visibleLimit);
const hiddenCount = Math.max(dayEvents.length - visibleLimit, 0);
    const dayHasConflict = dayEvents.some((event) =>
      conflictEventIdsInGrid.has(String(event.id))
    );

    const isWeekend =
      cellDate.getDay() === 0 || cellDate.getDay() === 6;
    const dayKey = ymd(cellDate);

cells.push(
  <div
    key={dayKey}
    role="button"
    tabIndex={0}
    onClick={() => setSelectedDay(new Date(cellDate))}
    onKeyDown={(ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        setSelectedDay(new Date(cellDate));
      }
    }}
    style={{
      ...styles.cell,
      minHeight: isMobile ? 112 : 140,
      padding: styles.cell.padding,
      borderRadius: styles.cell.borderRadius,
      opacity: inMonth ? 1 : 0.38,
      outline: isSelected
        ? "2px solid rgba(255,255,255,0.22)"
        : "1px solid rgba(255,255,255,0.08)",
      background: isSelected
        ? "rgba(255,255,255,0.06)"
        : isWeekend
        ? "rgba(148,163,184,0.05)"
        : "rgba(255,255,255,0.03)",
      borderColor: isToday
        ? "rgba(56,189,248,0.35)"
        : "rgba(255,255,255,0.08)",
    }}
    className="spCal-cell"
  >
    <div style={styles.cellTop} className="spCal-cellTop">
      <div
        style={{
          ...styles.cellDay,
          fontSize: styles.cellDay.fontSize,
          ...(isToday ? styles.cellDayToday : {}),
        }}
      >
        {cellDate.getDate()}
      </div>

      <div style={styles.cellTopRight}>
        {dayHasConflict ? <span style={styles.cellConflictDot} /> : null}
        <button
          type="button"
          onClick={(ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openNewEventPersonal(new Date(cellDate));
          }}
          style={{
            ...styles.cellQuickBtnPersonal,
            width: styles.cellQuickBtnPersonal.width,
            height: styles.cellQuickBtnPersonal.height,
            borderRadius: 999,
            fontSize: styles.cellQuickBtnPersonal.fontSize,
            lineHeight: styles.cellQuickBtnPersonal.lineHeight,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          aria-label="Crear evento"
          title="Crear evento"
        >
          +
        </button>
      </div>
    </div>

    <div style={styles.cellEvents} className="spCal-cellEvents">
      {dayEvents.length > 0 && (
        <div style={{ ...styles.cellCountRow, marginBottom: isMobile ? 2 : 4 }}>
          <span
            style={{
              ...styles.cellCount,
              fontSize: styles.cellCount.fontSize,
              padding: styles.cellCount.padding,
            }}
          >
            {dayEvents.length}
          </span>
        </div>
      )}

     {visibleEvents.map((e) => {
        const resolvedType: GroupType = e.groupId
          ? ((groupTypeById.get(String(e.groupId)) ?? "pair") as GroupType)
          : ("personal" as GroupType);

        const meta = groupMeta(resolvedType);
        const trustSignal = trustSignals[String(e.id)];
        const proposalRow = proposalResponsesMap[String(e.id)];
        const isConflictEvent = conflictEventIdsInGrid.has(String(e.id));
        const cellStatusPresentation = getCalendarStatusPresentation({
          event: e,
          eventId: e.id,
          inConflict: isConflictEvent,
          proposalRow,
          trustSignal,
          compact: true,
          pendingStyle: styles.cellTrustPillPending,
          resolvedStyle: styles.cellTrustPillResolved,
        });
        const cellStatusLabel = cellStatusPresentation.label;
        const cellStatusStyle = cellStatusPresentation.style;
        const showCellStatusPill =
          cellStatusPresentation.status === "resolved" ||
          cellStatusPresentation.status === "adjusted";
        const dayPosition = getEventDayPosition(e, cellDate);
        const multiDayLabel = getMultiDayCellLabel(dayPosition);
        const isMultiDay = dayPosition !== "single";
        const displayTitle = e.title || "Evento";

        return (
          <div
            key={e.id ?? `${e.start}_${e.end}`}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              onEdit(e);
            }}
            style={{
              ...styles.cellEventLine,
              ...(isMultiDay ? styles.cellEventLineMultiDay : null),
              ...(dayPosition === "start" ? styles.cellEventLineMultiDayStart : null),
              ...(dayPosition === "middle" ? styles.cellEventLineMultiDayMiddle : null),
              ...(dayPosition === "end" ? styles.cellEventLineMultiDayEnd : null),
              ...(isConflictEvent ? styles.cellEventLineConflict : null),
              cursor: "pointer",
            }}
            className="spCal-chip"
          >
            <span
              style={{
                ...styles.miniDot,
                background: meta.dot,
              }}
            />
            <span
              style={{
                ...styles.cellEventText,
                fontSize: styles.cellEventText.fontSize,
              }}
            >
              {displayTitle}
            </span>

            {isMultiDay && multiDayLabel ? (
              <span style={styles.cellMultiDayPill}>{multiDayLabel}</span>
            ) : null}

            {showCellStatusPill && cellStatusLabel ? (
              <span
                style={{
                  ...styles.cellTrustPill,
                  ...cellStatusStyle,
                }}
              >
                {cellStatusLabel}
              </span>
            ) : null}
          </div>
        );
      })}

    {hiddenCount > 0 ? (
  <div
    className="spCal-moreHint"
    style={{
      ...styles.moreHint,
      fontSize: styles.moreHint.fontSize,
    }}
  >
    +{hiddenCount} más
  </div>
) : null}
    </div>
  </div>
);
    day.setDate(day.getDate() + 1);
  }

  return cells;
}
/* =========================
   Styles
   ========================= */
const styles: Record<string, React.CSSProperties> = {
 page: {
  minHeight: "100%",
  overflowX: "hidden",
  background:
    "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.20), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.16), transparent 60%), linear-gradient(180deg, #050816 0%, #060a18 42%, #050816 100%)",
  color: "rgba(255,255,255,0.94)",
},

  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backdropFilter: "blur(16px)",
    background:
      "linear-gradient(180deg, rgba(5,8,22,0.82), rgba(5,8,22,0.48))",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 360,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(180deg, rgba(11,16,32,0.88), rgba(7,11,22,0.74))",
    boxShadow: "0 30px 80px rgba(0,0,0,0.48)",
    backdropFilter: "blur(18px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
    color: "rgba(255,255,255,0.95)",
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
    fontWeight: 650,
  },

  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0, 0, 0, 0.35)",
    marginBottom: 12,
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  heroRight: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontSize: 30,
    letterSpacing: "-0.6px",
    fontWeight: 950,
  },
  sub: { fontSize: 13, opacity: 0.82 },

  conflictCluster: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  filtersCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    marginBottom: 12,
  },
  filtersRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },

  mobileControlsCard: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.022))",
    padding: 10,
    marginBottom: 12,
    boxShadow: "0 18px 50px rgba(0,0,0,0.24)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    overflow: "hidden",
  },
  mobileSegmentTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 6,
  },
  mobileSegmentThree: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  mobileSegmentBtn: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.035)",
    color: "rgba(248,250,252,0.92)",
    padding: "9px 8px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mobileScopeBtn: {
    minWidth: 0,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.035)",
    color: "rgba(248,250,252,0.90)",
    padding: "8px 6px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mobileSegmentBtnActive: {
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.22), rgba(59,130,246,0.11))",
    border: "1px solid rgba(96,165,250,0.34)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  mobileMonthRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 8,
    alignItems: "center",
  },
  mobileMonthPill: {
    minWidth: 0,
    minHeight: 42,
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.20)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.11), rgba(59,130,246,0.055))",
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr) 34px",
    alignItems: "center",
    padding: "4px",
  },
  mobileArrowBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1,
  },
  mobileMonthLabel: {
    minWidth: 0,
    textAlign: "center",
    fontSize: 15,
    fontWeight: 950,
    color: "rgba(248,250,252,0.96)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mobileTodayBtn: {
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.045)",
    color: "rgba(248,250,252,0.94)",
    padding: "0 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
  mobileLegendRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 6,
  },
  mobileLegendChip: {
    minWidth: 0,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.025)",
    color: "rgba(226,232,240,0.72)",
    padding: "8px 7px",
    fontSize: 11,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    cursor: "pointer",
    overflow: "hidden",
  },
  mobileLegendChipActive: {
    color: "rgba(248,250,252,0.95)",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  mobileLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  mobileLegendText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  segment: {
    display: "flex",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    overflow: "hidden",
    background: "rgba(255,255,255,0.03)",
  },
  segmentBtn: {
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(255,255,255,0.86)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 850,
  },
  segmentOn: { background: "rgba(255,255,255,0.08)" },

  navRow: { display: "flex", gap: 8, alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 18,
  },

  groupRow: {
    display: "flex",
    gap: 10,
    paddingTop: 10,
    flexWrap: "wrap",
  },
  groupChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    fontWeight: 850,
  },
  groupDot: { width: 10, height: 10, borderRadius: 999 },

calendarCard: {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.042), rgba(255,255,255,0.024))",
  overflow: "visible",
  boxShadow: "0 34px 90px rgba(0,0,0,0.38)",
},
 monthScroller: {
  width: "100%",
  overflowX: "auto",
  overflowY: "visible",
  WebkitOverflowScrolling: "touch",
  overscrollBehaviorX: "contain",
  scrollbarWidth: "thin",
},

weekHeader: {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
  padding: "10px 10px 0",
  minWidth: 700,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))",
},
  weekDay: {
    padding: "10px 10px",
    fontSize: 12,
    opacity: 0.82,
    fontWeight: 900,
    letterSpacing: "0.03em",
    color: "rgba(226,232,240,0.9)",
  },

grid: {
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(92px, 1fr))",
  gap: 12,
  padding: 12,
  minWidth: 700,
},

cell: {
  minHeight:112,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.032), rgba(255,255,255,0.018))",
  padding: "10px 10px 8px",
  cursor: "pointer",
  textAlign: "left",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  gap: 6,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
  transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
},

  cellTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 2,
  },
  cellTopRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    flexWrap: "nowrap",
    flexShrink: 0,
  },
  cellConflictDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(248,113,113,0.98)",
    boxShadow: "0 0 0 4px rgba(248,113,113,0.10)",
    flexShrink: 0,
  },
  cellDay: {
    fontSize: 13,
    fontWeight: 950,
    opacity: 0.98,
    color: "rgba(248,250,252,0.96)",
    letterSpacing: "-0.02em",
  },
  cellDayToday: {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.38)",
    background: "rgba(56,189,248,0.14)",
    boxShadow: "0 0 0 1px rgba(125,211,252,0.08) inset",
  },

  cellCount: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.055)",
    color: "rgba(226,232,240,0.92)",
    opacity: 0.96,
    fontWeight: 900,
    flexShrink: 0,
  },
  cellCountRow: {
    marginBottom: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  cellQuickAdd: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    flexShrink: 0,
  },
  cellQuickBtnPersonal: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.46)",
    background:
      "linear-gradient(180deg, rgba(250,204,21,0.18), rgba(250,204,21,0.10))",
    color: "rgba(255,255,255,0.97)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
    lineHeight: "20px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(250,204,21,0.12)",
    flexShrink: 0,
  },
  cellQuickBtnGroup: {
    width: 20,
    height: 20,
    borderRadius: 8,
    border: "1px solid rgba(96,165,250,0.46)",
    background:
      "linear-gradient(180deg, rgba(96,165,250,0.18), rgba(96,165,250,0.10))",
    color: "rgba(255,255,255,0.97)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 11,
    lineHeight: "20px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(96,165,250,0.12)",
    flexShrink: 0,
  },

 cellEvents: {
  marginTop: 0,
  display: "flex",
  flexDirection: "column",
  gap: 3,
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  justifyContent: "flex-start",
},
  cellEventLine: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    borderRadius: 10,
    padding: "2px 4px",
  },
  cellEventLineMultiDay: {
    minHeight: 24,
    border: "1px solid rgba(56,189,248,0.20)",
    background:
      "linear-gradient(90deg, rgba(56,189,248,0.16), rgba(99,102,241,0.10))",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.03)",
  },
  cellEventLineMultiDayStart: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  cellEventLineMultiDayMiddle: {
    borderRadius: 8,
    opacity: 0.96,
  },
  cellEventLineMultiDayEnd: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  cellEventLineConflict: {
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(127,29,29,0.18)",
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flex: "0 0 auto",
  },
cellEventText: {
  fontSize: 12,
  opacity: 0.98,
  color: "rgba(241,245,249,0.94)",
  fontWeight: 850,
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
},
  moreHint: {
    fontSize: 12,
    opacity: 0.78,
    color: "rgba(191,219,254,0.88)",
    marginTop: 4,
    fontWeight: 800,
  },
  cellMultiDayPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 6px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(8,47,73,0.42)",
    color: "rgba(186,230,253,0.94)",
    fontSize: 10,
    fontWeight: 950,
    whiteSpace: "nowrap",
    marginLeft: "auto",
  },
  cellTrustPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 6px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 900,
    whiteSpace: "nowrap",
    marginLeft: "auto",
  },
  cellTrustPillResolved: {
    border: "1px solid rgba(52,211,153,0.24)",
    background: "rgba(52,211,153,0.12)",
    color: "rgba(187,247,208,0.96)",
  },
  cellTrustPillAuto: {
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.12)",
    color: "rgba(224,242,254,0.96)",
  },
  cellTrustPillPending: {
    border: "1px solid rgba(251,191,36,0.24)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.96)",
  },

dayPanel: {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.008))",
  padding: 14,
},
  dayPanelTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  dayPanelTitle: {
    fontSize: 14,
    fontWeight: 900,
    opacity: 0.95,
  },
  dayPanelActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  dayList: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  agendaCard: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.022))",
    overflow: "hidden",
    boxShadow: "0 22px 70px rgba(0,0,0,0.30)",
  },
  agendaTop: {
    padding: 14,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  agendaTitle: { fontSize: 16, fontWeight: 950 },
  agendaSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 750,
  },
  agendaList: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

eventRow: {
  display: "flex",
  gap: 12,
  padding: 16,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
  transition: "background 160ms ease, border-color 160ms ease, transform 160ms ease",
},
eventRowMultiDay: {
  border: "1px solid rgba(56,189,248,0.18)",
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(99,102,241,0.07) 48%, rgba(255,255,255,0.03))",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,0.035), 0 18px 50px rgba(2,132,199,0.08)",
},
  eventBar: { width: 6, borderRadius: 999 },
eventBody: {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
},
eventMain: {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
},
eventTop: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  width: "100%",
  minWidth: 0,
},
eventRight: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  flexShrink: 0,
  alignSelf: "flex-start",
  marginLeft: 8,
  maxWidth: "100%",
},
eventMetaPills: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  flexWrap: "wrap",
  flex: "1 1 auto",
},
eventActionGroup: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  flexShrink: 0,
},
eventTitle: {
  fontSize: 15,
  fontWeight: 950,
  letterSpacing: "-0.2px",
  color: "rgba(248,250,252,0.97)",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
  minWidth: 0,
},
  eventTime: {
    fontSize: 12,
    opacity: 0.9,
    color: "rgba(191,219,254,0.78)",
    fontWeight: 750,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  eventTimeMultiDay: {
    color: "rgba(186,230,253,0.94)",
    opacity: 0.98,
    fontWeight: 850,
  },
eventTag: {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.045)",
  color: "rgba(226,232,240,0.94)",
  opacity: 0.98,
  whiteSpace: "nowrap",
  fontWeight: 850,
  maxWidth: "100%",
  minWidth: 0,
},
  eventTagText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  },
  eventDot: { width: 8, height: 8, borderRadius: 999, flexShrink: 0 },
  eventMultiDayBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(8,47,73,0.55)",
    color: "rgba(186,230,253,0.96)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  eventTrustBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  eventTrustBadgeResolved: {
    border: "1px solid rgba(52,211,153,0.24)",
    background: "rgba(52,211,153,0.12)",
    color: "rgba(187,247,208,0.96)",
  },
  eventTrustBadgeAuto: {
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.12)",
    color: "rgba(224,242,254,0.96)",
  },
  eventTrustBadgePending: {
    border: "1px solid rgba(251,191,36,0.24)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.96)",
  },

  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.48)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.20), rgba(59,130,246,0.12))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 8px 20px rgba(59,130,246,0.10)",
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.32)",
    background:
      "linear-gradient(180deg, rgba(248,113,113,0.14), rgba(248,113,113,0.08))",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 8px 20px rgba(248,113,113,0.08)",
  },

primaryBtnPersonal: {
  flex: "1 1 140px",
  minWidth: 0,
  minHeight: 42,
  borderRadius: 14,
  padding: "10px 12px",
  border: "1px solid rgba(250,204,21,0.28)",
  background: "linear-gradient(180deg, rgba(250,204,21,0.15), rgba(250,204,21,0.07))",
  color: "rgba(255,255,255,0.96)",
  fontSize: 13,
  fontWeight: 850,
  cursor: "pointer",
},
primaryBtnGroup: {
  flex: "1 1 140px",
  minWidth: 0,
  minHeight: 42,
  borderRadius: 14,
  padding: "10px 12px",
  border: "1px solid rgba(96,165,250,0.28)",
  background: "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(59,130,246,0.08))",
  color: "rgba(255,255,255,0.96)",
  fontSize: 13,
  fontWeight: 850,
  cursor: "pointer",
},

 ghostBtn: {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.92)",
  cursor: "pointer",
  fontWeight: 850,
},

  ghostBtnSmallPersonal: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(250,204,21,0.22)",
    background: "rgba(250,204,21,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },
  ghostBtnSmallGroup: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(96,165,250,0.22)",
    background: "rgba(96,165,250,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },

  conflictPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(248,113,113,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
  },
  conflictDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(248,113,113,0.95)",
  },
  conflictArrow: { opacity: 0.8 },

  resolvePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
  },

  okPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.10)",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 950,
    fontSize: 12,
  },
  okDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(34,197,94,0.95)",
  },

  emptyHint: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
    opacity: 0.8,
    fontSize: 13,
    fontWeight: 700,
  },

  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  loadingCard: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.25)",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 950 },
  loadingSub: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
    fontWeight: 700,
  },

  conflictBanner: {
    width: "100%",
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 20,
    border: "1px solid rgba(248,113,113,0.28)",
    background:
      "linear-gradient(180deg, rgba(248,113,113,0.14), rgba(244,63,94,0.08))",
    padding: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    cursor: "pointer",
    color: "rgba(255,255,255,0.94)",
    textAlign: "left",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
  },
  conflictBannerLeft: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  conflictBannerEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    opacity: 0.72,
  },
  conflictBannerTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.3px",
  },
  conflictBannerSub: {
    fontSize: 12,
    opacity: 0.8,
    lineHeight: 1.45,
  },
  conflictBannerCta: {
    flexShrink: 0,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 900,
  },
valueRailCard: {
  borderRadius: 16,
  border: "1px solid rgba(52,211,153,0.16)",
  background:
    "linear-gradient(135deg, rgba(20,83,45,0.34), rgba(15,23,42,0.72))",
  boxShadow: "0 12px 34px rgba(0,0,0,0.14)",
  padding: "10px 12px",
  marginBottom: 8,
},
valueRailCardPending: {
  border: "1px solid rgba(96,165,250,0.24)",
  background:
    "linear-gradient(135deg, rgba(30,64,175,0.30), rgba(15,23,42,0.76))",
},
valueRailTop: {
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "center",
  flexWrap: "wrap",
},
valueRailCopy: {
  minWidth: 0,
  flex: "1 1 320px",
  display: "grid",
  gap: 2,
},
valueRailEyebrow: {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(134,239,172,0.90)",
},
valueRailTitle: {
  fontSize: 15,
  lineHeight: 1.2,
  fontWeight: 900,
  letterSpacing: "-0.02em",
  color: "rgba(255,255,255,0.98)",
},
valueRailSub: {
  fontSize: 12,
  lineHeight: 1.35,
  color: "rgba(220,252,231,0.78)",
},
valueRailActions: {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
},
valueRailBtn: {
  borderRadius: 999,
  border: "1px solid rgba(74,222,128,0.24)",
  background: "rgba(34,197,94,0.16)",
  padding: "8px 12px",
  fontSize: 12,
  color: "rgba(255,255,255,0.96)",
  fontWeight: 900,
  cursor: "pointer",
},
overviewCard: {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.018))",
  boxShadow: "0 14px 42px rgba(0,0,0,0.18)",
  padding: "10px 12px",
  marginBottom: 8,
},

overviewTop: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
},

overviewLeft: {
  minWidth: 0,
  flex: "1 1 280px",
},

overviewEyebrow: {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  color: "rgba(191,219,254,0.72)",
  marginBottom: 6,
},

overviewTitle: {
  margin: 0,
  fontSize: "clamp(17px, 2.4vw, 22px)",
  lineHeight: 1.08,
  fontWeight: 950,
  color: "#F8FAFC",
  letterSpacing: -0.4,
},

overviewSub: {
  marginTop: 5,
  fontSize: 12,
  lineHeight: 1.35,
  color: "rgba(226,232,240,0.72)",
},

overviewActions: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  width: "100%",
},

overviewMetaRow: {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  gap: 8,
  width: "100%",
  marginTop: 10,
},

statusCluster: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  width: "100%",
},

statusPillNeutral: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "#E2E8F0",
  fontSize: 12,
  fontWeight: 800,
},

statusPillSuccess: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(34,197,94,0.24)",
  background: "rgba(34,197,94,0.10)",
  color: "#DCFCE7",
  fontSize: 12,
  fontWeight: 900,
},

statusPillDanger: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 44,
  width: "100%",
  textAlign: "center",
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(251,113,133,0.28)",
  background: "rgba(127,29,29,0.18)",
  color: "#FECACA",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
},

statusPillAction: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  width: "100%",
  textAlign: "center",
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(56,189,248,0.28)",
  background: "rgba(127,29,29,0.18)",
  color: "#E0F2FE",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
},

statusDotNeutral: {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "rgba(148,163,184,0.86)",
},

statusDotSuccess: {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#22C55E",
},

statusDotDanger: {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#F87171",
},

overviewGhostBtn: {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.05)",
  color: "#E2E8F0",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
},
overviewMetaRowMobile: {
  flexDirection: "column",
  alignItems: "stretch",
  gap: 12,
},
  statusPillSuccessMobile: {
    width: "100%",
    justifyContent: "center",
    textAlign: "center",
  },
  overviewGhostBtnMobile: {
    width: "100%",
    justifyContent: "center",
  },
  eventTopMobile: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 8,
  },
  eventMainMobile: {
    gap: 2,
  },
  eventRightMobile: {
    width: "100%",
    marginLeft: 0,
    gap: 10,
    display: "flex",
    flexWrap: "nowrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 2,
    minWidth: 0,
  },
  eventTagMobile: {
    maxWidth: 120,
    padding: "6px 9px",
  },
  eventTrustBadgeMobile: {
    maxWidth: 138,
    padding: "6px 9px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  eventIconBtnMobile: {
    width: 36,
    height: 36,
    borderRadius: 13,
    flexShrink: 0,
  },


  eventTrustBadgeConflict: {
    background: "rgba(127,29,29,0.90)",
    borderColor: "rgba(252,165,165,0.28)",
    color: "rgba(254,226,226,0.98)",
  },
  cellTrustPillConflict: {
    background: "rgba(127,29,29,0.90)",
    borderColor: "rgba(252,165,165,0.28)",
    color: "rgba(254,226,226,0.98)",
  },
};