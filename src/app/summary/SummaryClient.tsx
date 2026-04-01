"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import MobileScaffold from "@/components/MobileScaffold";

import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getMyEvents } from "@/lib/eventsDb";
import {
  computeVisibleConflicts,
  conflictKey,
  filterIgnoredConflicts,
  loadIgnoredConflictKeys,
  type CalendarEvent,
  type GroupType,
  type ConflictItem,
} from "@/lib/conflicts";
import {
  getMyConflictResolutionsMap,
  type Resolution,
} from "@/lib/conflictResolutionsDb";
import {
  filterOutDeclinedEvents,
  getMyDeclinedEventIds,
} from "@/lib/eventResponsesDb";
import { getUnreadConflictNotificationsSummary } from "@/lib/notificationsDb";
import {
  getRecentConflictResolutionLogs,
  type ConflictResolutionLogRow,
} from "@/lib/conflictResolutionsLogDb";

type Props = {
  highlightId: string | null;
  appliedToast: string | null;
};

type UiToast = { title: string; subtitle?: string } | null;

type SummaryEvent = {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  startIso: string | null;
  endIso: string | null;
  groupId: string | null;
  isExternal: boolean;
  raw: any;
};

type ConflictAlert = {
  count: number;
  latestEventId: string | null;
};

type RecentDecision = {
  id: string;
  title: string;
  subtitle: string;
  whenLabel: string;
  isFallback: boolean;
};

function safeDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDay(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function fmtTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function humanGroupName(g: GroupRow) {
  const n = String(g.name ?? "").trim();
  if (n) return n;

  const t = String(g.type ?? "").toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  if (t === "solo" || t === "personal") return "Personal";
  if (t === "other" || t === "shared") return "Compartido";

  return "Grupo";
}

function normalizeSummaryGroupType(
  raw: string | null | undefined
): GroupType {
  const value = String(raw ?? "").trim().toLowerCase();

  if (value === "pair" || value === "couple") return "pair";
  if (value === "family") return "family";
  if (value === "other" || value === "shared") return "other";
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

function buildConflictAlert(
  events: SummaryEvent[],
  groups: GroupRow[],
  resMap: Record<string, Resolution>
): ConflictAlert {
  if (!Array.isArray(events) || events.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const groupTypeById = new Map<string, string>();
  for (const group of groups ?? []) {
    const id = String(group?.id ?? "").trim();
    if (!id) continue;
    groupTypeById.set(id, String(group?.type ?? ""));
  }

  const conflictEvents: CalendarEvent[] = events
    .map((event) => {
      if (!event.startIso) return null;

      const derivedGroupType = event.groupId
        ? normalizeSummaryGroupType(groupTypeById.get(String(event.groupId)))
        : ("personal" as GroupType);

      return {
        id: event.id,
        title: event.title,
        start: event.startIso,
        end: event.endIso ?? event.startIso,
        groupId: event.groupId,
        groupType: derivedGroupType,
        description:
          typeof event.raw?.notes === "string" ? event.raw.notes : undefined,
      } satisfies CalendarEvent;
    })
    .filter(Boolean) as CalendarEvent[];

  if (conflictEvents.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const ignored = loadIgnoredConflictKeys();
  const allConflicts = computeVisibleConflicts(conflictEvents);
  const visibleConflicts = filterIgnoredConflicts(allConflicts, ignored);

  const pendingConflicts = visibleConflicts.filter(
    (conflict) => !resolutionForConflict(conflict, resMap)
  );

  if (pendingConflicts.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const eventsById = new Map(
    conflictEvents.map((event) => [String(event.id), event])
  );

  let latestEventId: string | null = null;
  let latestStartMs = -1;

  for (const conflict of pendingConflicts) {
    const candidates = [
      eventsById.get(String(conflict.existingEventId)),
      eventsById.get(String(conflict.incomingEventId)),
    ].filter(Boolean) as CalendarEvent[];

    for (const event of candidates) {
      const ms = new Date(event.start).getTime();
      if (Number.isNaN(ms)) continue;

      if (ms > latestStartMs) {
        latestStartMs = ms;
        latestEventId = String(event.id);
      }
    }
  }

  return {
    count: pendingConflicts.length,
    latestEventId,
  };
}

function useIsMobileWidth(maxWidth = 520) {
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

    // @ts-ignore
    mq.addListener(apply);
    return () => {
      // @ts-ignore
      mq.removeListener(apply);
    };
  }, [maxWidth]);

  return isMobile;
}

function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function getWeekMoodLabel(count: number): string {
  if (count === 0) return "Semana libre";
  if (count <= 3) return "Semana ligera";
  if (count <= 6) return "Semana activa";
  return "Semana movida";
}

function getWeekSubtitle(count: number): string {
  if (count === 0) return "Sin eventos próximos";
  if (count === 1) return "1 evento en 7 días";
  return `${count} eventos en 7 días`;
}

function buildAppliedToastMessage(raw: string | null): string | null {
  const safe = String(raw ?? "").trim();
  if (!safe) return null;
  return safe;
}

function formatDecisionTitle(log: ConflictResolutionLogRow): string {
  const finalAction = String(log.final_action ?? "").trim().toLowerCase();
  const decisionType = String(log.decision_type ?? "").trim().toLowerCase();

  if (finalAction === "fallback_keep_both") return "Ajuste automático";
  if (finalAction === "replace_with_new") return "Evento reemplazado";
  if (finalAction === "keep_existing") return "Se mantuvo el original";
  if (finalAction === "keep_both") return "Se conservaron ambos";
  if (decisionType === "replace_with_new") return "Evento reemplazado";
  if (decisionType === "keep_existing") return "Se mantuvo el original";
  return "Decisión aplicada";
}

function formatDecisionSubtitle(log: ConflictResolutionLogRow): string {
  const metadata =
    log.metadata && typeof log.metadata === "object" ? log.metadata : {};

  const source = String((metadata as Record<string, unknown>).source ?? "")
    .trim()
    .toLowerCase();

  const finalAction = String(log.final_action ?? "").trim().toLowerCase();

  if (finalAction === "fallback_keep_both") {
    return "No se pudo editar el otro evento.";
  }

  if (source === "preflight") return "Resuelto antes de guardar.";
  if (source === "actions") return "Resuelto desde conflictos.";
  return "Guardado en el historial.";
}

function formatRelativeDateLabel(iso: string | null | undefined): string {
  const date = safeDate(iso ?? null);
  if (!date) return "Fecha no disponible";

  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diffDays = Math.round(
    (startNow.getTime() - startTarget.getTime()) / 86400000
  );

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const timeLabel = `${hh}:${mm}`;

  if (diffDays === 0) return `Hoy · ${timeLabel}`;
  if (diffDays === 1) return `Ayer · ${timeLabel}`;
  if (diffDays > 1 && diffDays <= 6) return `Hace ${diffDays} días · ${timeLabel}`;

  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} · ${timeLabel}`;
}

function mapRecentDecision(log: ConflictResolutionLogRow): RecentDecision {
  const finalAction = String(log.final_action ?? "").trim().toLowerCase();

  return {
    id: String(log.id),
    title: formatDecisionTitle(log),
    subtitle: formatDecisionSubtitle(log),
    whenLabel: formatRelativeDateLabel(log.created_at),
    isFallback: finalAction === "fallback_keep_both",
  };
}

function normalizeEvent(e: any): SummaryEvent | null {
  const id = String(e?.id ?? "").trim();
  if (!id) return null;

  const startIso = (e?.start ?? e?.start_at ?? null) as string | null;
  const endIso = (e?.end ?? e?.end_at ?? null) as string | null;

  const start = safeDate(startIso);
  const end = safeDate(endIso);

  if (!start) return null;

  const groupIdRaw = e?.group_id ?? e?.groupId ?? null;
  const groupId = groupIdRaw ? String(groupIdRaw) : null;

  const title = e?.title ?? e?.name ?? e?.summary ?? "Evento";

  const isExternal =
    !!e?.is_external ||
    String(e?.source ?? "").toLowerCase() === "google" ||
    String(e?.provider ?? "").toLowerCase() === "google";

  return {
    id,
    title,
    start,
    end,
    startIso: startIso ? String(startIso) : null,
    endIso: endIso ? String(endIso) : null,
    groupId,
    isExternal,
    raw: e,
  };
}

function eventOverlapsWindow(
  event: SummaryEvent,
  windowStart: Date,
  windowEndExclusive: Date
) {
  const start = event.start;
  const end = event.end ?? event.start;

  if (!start || !end) return false;

  return (
    start.getTime() < windowEndExclusive.getTime() &&
    end.getTime() >= windowStart.getTime()
  );
}



type QuickCaptureParseResult = {
  title: string;
  start: Date;
  end: Date;
  understoodDate: boolean;
  understoodTime: boolean;
};

const QUICK_CAPTURE_DAY_MAP: Array<{ aliases: string[]; dayIndex: number }> = [
  { aliases: ["domingo"], dayIndex: 0 },
  { aliases: ["lunes"], dayIndex: 1 },
  { aliases: ["martes"], dayIndex: 2 },
  { aliases: ["miercoles", "miércoles"], dayIndex: 3 },
  { aliases: ["jueves"], dayIndex: 4 },
  { aliases: ["viernes"], dayIndex: 5 },
  { aliases: ["sabado", "sábado"], dayIndex: 6 },
];

function normalizeQuickCaptureText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function nextWeekday(base: Date, targetDayIndex: number) {
  const start = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    12,
    0,
    0,
    0
  );
  const current = start.getDay();
  let diff = targetDayIndex - current;
  if (diff < 0) diff += 7;
  if (diff === 0) diff = 7;
  start.setDate(start.getDate() + diff);
  return start;
}

// ==========================
// QUICK CAPTURE PARSER PRO V1
// ==========================

const DAYS_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

function normalizeText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getNextWeekday(base: Date, target: number) {
  const d = new Date(base);
  d.setHours(12, 0, 0, 0);

  const current = d.getDay();
  let diff = target - current;

  if (diff <= 0) diff += 7;

  d.setDate(d.getDate() + diff);
  return d;
}

function extractDate(text: string) {
  const normalized = normalizeText(text);

  // hoy
  if (/\bhoy\b/.test(normalized)) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return { date: d, token: /\bhoy\b/i, ok: true };
  }

  // mañana
  if (/\bmanana\b/.test(normalized)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return { date: d, token: /\bmanana\b/i, ok: true };
  }

  // días de semana
  for (const key of Object.keys(DAYS_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");

    if (regex.test(normalized)) {
      const date = getNextWeekday(new Date(), DAYS_MAP[key]);
      return { date, token: regex, ok: true };
    }
  }

  // fallback: hoy
  const fallback = new Date();
  fallback.setHours(12, 0, 0, 0);

  return { date: fallback, token: null, ok: false };
}

function extractTime(text: string) {
  const normalized = normalizeText(text);

  // 6am, 6 pm, 18:00, 6:30pm, etc
  const regex = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const match = normalized.match(regex);

  if (!match) {
    return { h: 19, m: 0, token: null, ok: false };
  }

  let h = Number(match[1]);
  let m = match[2] ? Number(match[2]) : 0;
  const ampm = (match[3] || "").toLowerCase();

  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  // si no hay am/pm → heurística humana
  if (!ampm && h >= 1 && h <= 7) {
    h += 12; // 6 → 18 (más probable)
  }

  if (h > 23 || m > 59) {
    return { h: 19, m: 0, token: null, ok: false };
  }

  return { h, m, token: match[0], ok: true };
}

function cleanTitle(original: string, dateToken: RegExp | null, timeToken: string | null) {
  let result = original;

  if (dateToken) {
    result = result.replace(dateToken, " ");
  }

  if (timeToken) {
    const escaped = timeToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "i"), " ");
  }

  return result.replace(/\s+/g, " ").trim();
}

function buildQuickCaptureResult(raw: string): QuickCaptureParseResult {
  const dateInfo = extractDate(raw);
  const timeInfo = extractTime(raw);

  const title = cleanTitle(raw, dateInfo.token, timeInfo.token) || raw || "Nuevo evento";

  const start = new Date(dateInfo.date);
  start.setHours(timeInfo.h, timeInfo.m, 0, 0);

  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 60);

  return {
    title,
    start,
    end,
    understoodDate: dateInfo.ok,
    understoodTime: timeInfo.ok,
  };
}

export default function SummaryClient({ highlightId, appliedToast }: Props) {
  const router = useRouter();
  const isMobile = useIsMobileWidth(520);

  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [loading, setLoading] = useState(false);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [unreadConflictAlert, setUnreadConflictAlert] = useState<ConflictAlert>({
    count: 0,
    latestEventId: null,
  });
  const [recentDecisions, setRecentDecisions] = useState<RecentDecision[]>([]);
  const [quickCaptureValue, setQuickCaptureValue] = useState("");
  const [quickCaptureBusy, setQuickCaptureBusy] = useState(false);
  const toastTimeoutRef = useRef<number | null>(null);

  const clearToastTimer = () => {
    if (typeof window === "undefined") return;
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
  };

  const showToast = useCallback((title: string, subtitle?: string) => {
    if (typeof window === "undefined") return;
    clearToastTimer();
    setToast({ title, subtitle });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3200);
  }, []);

  useEffect(() => {
    return () => clearToastTimer();
  }, []);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find((g) => String(g.id) === String(activeGroupId)) ?? null;
  }, [groups, activeGroupId]);

  const activeLabel = useMemo(() => {
    if (!activeGroupId) return "Personal";
    return activeGroup ? humanGroupName(activeGroup) : "Grupo";
  }, [activeGroupId, activeGroup]);

  const contextLabel = useMemo(() => {
    if (!activeGroupId) return "Personal";
    return activeLabel;
  }, [activeGroupId, activeLabel]);

  const normalizedEvents = useMemo(() => {
    const mapped = (events ?? [])
      .map(normalizeEvent)
      .filter(Boolean) as SummaryEvent[];

    return filterOutDeclinedEvents(mapped, declinedEventIds);
  }, [events, declinedEventIds]);

  const visibleEvents = useMemo(() => {
    return [...normalizedEvents].sort((a, b) => {
      const aMs = a.start?.getTime() ?? 0;
      const bMs = b.start?.getTime() ?? 0;
      return aMs - bMs;
    });
  }, [normalizedEvents]);

  const conflictAlert = useMemo(() => {
    const baseAlert = buildConflictAlert(visibleEvents, groups, resMap);

    return {
      count: Math.max(baseAlert.count, unreadConflictAlert.count),
      latestEventId:
        unreadConflictAlert.latestEventId ?? baseAlert.latestEventId ?? null,
    };
  }, [visibleEvents, groups, resMap, unreadConflictAlert]);

  const upcomingAll = useMemo(() => {
    const today = startOfTodayLocal();
    const windowEnd = addDays(today, 7);

    return visibleEvents.filter((e) =>
      eventOverlapsWindow(e, today, windowEnd)
    );
  }, [visibleEvents]);

  const upcomingStats = useMemo(() => {
    let personal = 0;
    let group = 0;
    let external = 0;

    for (const e of upcomingAll) {
      if (e.isExternal) external += 1;
      if (e.groupId) group += 1;
      else personal += 1;
    }

    return {
      total: upcomingAll.length,
      personal,
      group,
      external,
    };
  }, [upcomingAll]);

  const UPCOMING_LIMIT = isMobile ? 3 : 6;

  const upcoming = useMemo(
    () => upcomingAll.slice(0, UPCOMING_LIMIT),
    [upcomingAll, UPCOMING_LIMIT]
  );

  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;
  const remainingUpcoming =
    upcoming.length > 1 ? upcoming.slice(1) : ([] as SummaryEvent[]);

  const showSeeMore = !booting && upcomingAll.length > UPCOMING_LIMIT;

  const mood = useMemo(() => {
    if (booting) {
      return {
        title: "Cargando…",
        subtitle: "Preparando tu resumen",
        tone: "neutral" as const,
      };
    }

    const count = upcomingStats.total;

    if (count === 0) {
      return {
        title: getWeekMoodLabel(count),
        subtitle: getWeekSubtitle(count),
        tone: "clear" as const,
      };
    }

    if (count <= 3) {
      return {
        title: getWeekMoodLabel(count),
        subtitle: getWeekSubtitle(count),
        tone: "calm" as const,
      };
    }

    return {
      title: getWeekMoodLabel(count),
      subtitle: getWeekSubtitle(count),
      tone: "busy" as const,
    };
  }, [booting, upcomingStats]);

  async function requireSessionOrRedirect() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;

    const user = data.user;
    if (!user) {
      router.replace("/auth/login");
      return null;
    }

    return user;
  }

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
        unreadConflicts,
        recentDecisionLogs,
      ] = await Promise.all([
        getMyEvents(),
        getMyConflictResolutionsMap().catch(() => ({})),
        getMyDeclinedEventIds().catch(() => new Set<string>()),
        getUnreadConflictNotificationsSummary().catch(() => ({
          count: 0,
          latestEventId: null,
        })),
        getRecentConflictResolutionLogs(8).catch(() => []),
      ]);

      setEvents(Array.isArray(es) ? es : []);
      setResMap(conflictResolutions ?? {});
      setDeclinedEventIds(declined ?? new Set());
      setUnreadConflictAlert(
        unreadConflicts ?? { count: 0, latestEventId: null }
      );
      setRecentDecisions((recentDecisionLogs ?? []).map(mapRecentDecision));
    } catch (e: any) {
      showToast("No se pudo cargar", e?.message || "Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [router, showToast]);

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

    return () => {
      window.removeEventListener(
        "sp:active-group-changed",
        handler as EventListener
      );
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

  const title = "Resumen";
  const summarySubtitle = activeGroupId ? `Hoy · ${activeLabel}` : "Hoy · Personal";

  const moodAccentBorder =
    mood.tone === "clear"
      ? "rgba(34,197,94,0.85)"
      : mood.tone === "busy"
        ? "rgba(251,191,36,0.9)"
        : "rgba(56,189,248,0.9)";

  const moodAccentGlow =
    mood.tone === "clear"
      ? "rgba(34,197,94,0.35)"
      : mood.tone === "busy"
        ? "rgba(251,191,36,0.35)"
        : "rgba(56,189,248,0.35)";

  const openConflictCenter = useCallback(() => {
    if (conflictAlert.latestEventId) {
      router.push(
        `/conflicts/detected?eventId=${encodeURIComponent(
          conflictAlert.latestEventId
        )}`
      );
      return;
    }

    router.push("/conflicts/detected");
  }, [router, conflictAlert]);



  const handleQuickCaptureSubmit = useCallback(() => {
    const raw = quickCaptureValue.trim();
    if (!raw || quickCaptureBusy) return;

    setQuickCaptureBusy(true);

    try {
      const parsed = buildQuickCaptureResult(raw);
      const params = new URLSearchParams();
      const nextType = activeGroupId ? "group" : "personal";

      params.set("qc", "1");
      params.set("type", nextType);
      params.set("date", parsed.start.toISOString());
      params.set("title", parsed.title);
      params.set("duration", "60");

      if (activeGroupId) {
        params.set("groupId", activeGroupId);
        params.set("lock", "1");
      }

      if (parsed.understoodDate || parsed.understoodTime) {
        showToast(
          "Listo, lo preparo ✨",
          parsed.understoodDate && parsed.understoodTime
            ? "Abrimos el plan con fecha y hora sugeridas."
            : parsed.understoodDate
              ? "Abrimos el plan con el día sugerido para que completes la hora."
              : "Abrimos el plan con una hora sugerida para que la ajustes si quieres."
        );
      }

      router.push(`/events/new/details?${params.toString()}`);
    } finally {
      window.setTimeout(() => setQuickCaptureBusy(false), 180);
    }
  }, [activeGroupId, quickCaptureBusy, quickCaptureValue, router, showToast]);

  const handleQuickCaptureKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleQuickCaptureSubmit();
    },
    [handleQuickCaptureSubmit]
  );

  const visibleDecisions = useMemo(() => recentDecisions.slice(0, 3), [recentDecisions]);

  return (
    <div style={styles.page} className="spSum-page">
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

      <MobileScaffold
        maxWidth={1120}
        paddingDesktop="10px 0 110px"
        paddingMobile="10px 0 110px"
      >
        <Section style={styles.shell} className="spSum-shell">
          <PremiumHeader title={title} subtitle={summarySubtitle} />

          <Card style={styles.card} className="spSum-card">
            <div style={styles.captureHeaderRow}>
              <div>
                <div style={styles.captureEyebrow}>Quick Capture</div>
                <div style={styles.captureTitle}>¿Qué quieres planear?</div>
                <div style={styles.captureSub}>
                  Escríbelo simple y te dejo el plan listo para revisar.
                </div>
              </div>

              <div style={styles.captureHintPill}>{activeGroupId ? `Contexto · ${activeLabel}` : "Contexto · Personal"}</div>
            </div>

            <div style={styles.captureFieldWrap} className="spSum-captureFieldWrap">
              <input
                value={quickCaptureValue}
                onChange={(event) => setQuickCaptureValue(event.target.value)}
                onKeyDown={handleQuickCaptureKeyDown}
                placeholder="Ej: cena viernes 8pm"
                style={styles.captureInput}
                className="spSum-captureInput"
                autoCapitalize="sentences"
                autoCorrect="on"
                spellCheck
              />

              <button
                onClick={handleQuickCaptureSubmit}
                disabled={!quickCaptureValue.trim() || quickCaptureBusy}
                style={{
                  ...styles.captureButton,
                  ...(!quickCaptureValue.trim() || quickCaptureBusy
                    ? styles.captureButtonDisabled
                    : {}),
                }}
                className="spSum-captureButton"
              >
                {quickCaptureBusy ? "Preparando…" : "Seguir"}
              </button>
            </div>

            <div style={styles.captureExamplesRow}>
              <span style={styles.captureExamplePill}>cena viernes 8pm</span>
              <span style={styles.captureExamplePill}>doctor martes 10</span>
              <span style={styles.captureExamplePill}>fulbito sábado 6</span>
            </div>
          </Card>

          <Card style={styles.card} className="spSum-card">
            {conflictAlert.count > 0 ? (
              <button
                onClick={openConflictCenter}
                style={styles.conflictBanner}
                className="spSum-conflictBanner"
              >
                <div style={styles.conflictBannerLeft}>
                  <div style={styles.conflictBannerEyebrow}>Atención</div>
                  <div style={styles.conflictBannerTitle}>
                    {conflictAlert.count} conflicto{conflictAlert.count === 1 ? "" : "s"}
                  </div>
                  <div style={styles.conflictBannerSub}>Resolver ahora</div>
                </div>

                <div style={styles.conflictBannerCta}>Abrir →</div>
              </button>
            ) : null}

            <div
              style={{
                ...styles.stateRow,
                boxShadow: `0 0 18px ${moodAccentGlow}`,
                borderColor: moodAccentBorder,
              }}
            >
              <div style={styles.stateLeft}>
                <div style={styles.stateLabelRow}>
                  <span style={styles.statePill}>{contextLabel}</span>
                  {loading && !booting ? (
                    <span style={styles.stateLoadingBadge}>Actualizando…</span>
                  ) : null}
                </div>

                <div style={styles.stateMoodTitle}>{mood.title}</div>
                <div style={styles.stateMoodSub}>{mood.subtitle}</div>

                <div style={styles.stateStatsRow}>
                  <span style={styles.stateStat}>{upcomingStats.total} total</span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>{upcomingStats.personal} personal</span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>{upcomingStats.group} grupo</span>
                  {upcomingStats.external > 0 ? (
                    <>
                      <span style={styles.stateStatDot}>·</span>
                      <span style={styles.stateStat}>{upcomingStats.external} externo</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={styles.stateKpi}>
                <div style={styles.stateKpiLabel}>7 días</div>
                <div style={styles.stateKpiNumber}>{upcomingStats.total}</div>
                <div style={styles.stateKpiHint}>Eventos visibles</div>
              </div>
            </div>

            {booting ? (
              <div style={styles.loadingCard}>
                <div style={styles.loadingDot} />
                <div>
                  <div style={styles.loadingTitle}>Cargando…</div>
                  <div style={styles.loadingSub}>Resumen</div>
                </div>
              </div>
            ) : !nextEvent ? (
              <div style={styles.emptyBlock}>
                <div style={styles.emptyTitle}>Sin eventos próximos</div>
                <div style={styles.emptySub}>Crea uno nuevo o abre el calendario.</div>
                <button
                  onClick={() => router.push("/events/new/details?type=personal")}
                  style={styles.emptyBtn}
                >
                  Crear evento →
                </button>
              </div>
            ) : (
              <>
                <div style={styles.nextBlock}>
                  <div style={styles.nextLabel}>Sigue</div>
                  <button
                    onClick={() => router.push("/calendar")}
                    style={{
                      ...styles.nextCard,
                      ...(highlightId &&
                      String(nextEvent?.id ?? "") === String(highlightId)
                        ? styles.eventRowHighlight
                        : {}),
                    }}
                    className="spSum-eventRow"
                  >
                    {(() => {
                      const start = nextEvent.start as Date;
                      const end = nextEvent.end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      return (
                        <>
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>{nextEvent.title}</div>
                          </div>

                          <div style={styles.eventMeta}>
                            {nextEvent.isExternal ? (
                              <span style={styles.pill}>Externo</span>
                            ) : null}
                            {nextEvent.groupId ? (
                              <span style={styles.pillSoft}>Grupo</span>
                            ) : (
                              <span style={styles.pillSoft}>Personal</span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </button>
                </div>

                {remainingUpcoming.length > 0 && (
                  <div style={styles.eventsList} className="spSum-eventsList">
                    {remainingUpcoming.map((e) => {
                      const start = e.start as Date;
                      const end = e.end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      const isHighlighted =
                        highlightId && String(e.id ?? "") === String(highlightId);

                      return (
                        <button
                          key={e.id ?? `${e.title}-${start.toISOString()}`}
                          onClick={() => router.push("/calendar")}
                          style={{
                            ...styles.eventRow,
                            ...(isHighlighted ? styles.eventRowHighlight : {}),
                          }}
                          className="spSum-eventRow"
                        >
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>{e.title}</div>
                          </div>

                          <div style={styles.eventMeta}>
                            {e.isExternal ? <span style={styles.pill}>Externo</span> : null}
                            {e.groupId ? (
                              <span style={styles.pillSoft}>Grupo</span>
                            ) : (
                              <span style={styles.pillSoft}>Personal</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showSeeMore && (
                  <button
                    onClick={() => router.push("/calendar")}
                    style={styles.seeMoreBtn}
                    className="spSum-seeMore"
                  >
                    Ver calendario ({upcomingAll.length}) →
                  </button>
                )}
              </>
            )}
          </Card>

          <Card style={styles.card} className="spSum-card">
            <div style={styles.sectionHeadMini}>
              <div style={styles.sectionTitle}>Decisiones</div>
              <button
                onClick={() => router.push("/calendar")}
                style={styles.decisionsCta}
              >
                Calendario →
              </button>
            </div>

            {visibleDecisions.length === 0 ? (
              <div style={styles.decisionsEmpty}>
                <div style={styles.decisionsEmptyTitle}>Sin decisiones recientes</div>
                <div style={styles.decisionsEmptySub}>
                  Aquí aparecerán cuando resuelvas conflictos.
                </div>
              </div>
            ) : (
              <div style={styles.decisionsList}>
                {visibleDecisions.map((decision) => (
                  <div key={decision.id} style={styles.decisionRow}>
                    <div
                      style={{
                        ...styles.decisionIcon,
                        ...(decision.isFallback
                          ? styles.decisionIconFallback
                          : styles.decisionIconNormal),
                      }}
                    >
                      {decision.isFallback ? "⚠️" : "✓"}
                    </div>

                    <div style={styles.decisionContent}>
                      <div style={styles.decisionTopRow}>
                        <div style={styles.decisionTitle}>{decision.title}</div>
                        <div style={styles.decisionWhen}>{decision.whenLabel}</div>
                      </div>

                      <div style={styles.decisionSubtitle}>{decision.subtitle}</div>

                      <div
                        style={{
                          ...styles.decisionBadge,
                          ...(decision.isFallback
                            ? styles.decisionBadgeFallback
                            : styles.decisionBadgeManual),
                        }}
                      >
                        {decision.isFallback ? "Auto" : "Resuelto"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card style={styles.card} className="spSum-card">
            <div style={styles.sectionTitle}>Acciones</div>

            <div style={styles.quickGrid} className="spSum-quickGrid">
              <button
                onClick={() => router.push("/events/new/details?type=personal")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Crear evento</div>
                <div style={styles.quickSub}>Nuevo plan</div>
              </button>

              <button
                onClick={() => router.push("/calendar")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Abrir calendario</div>
                <div style={styles.quickSub}>Ver todo</div>
              </button>

              <button
                onClick={openConflictCenter}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Resolver conflictos</div>
                <div style={styles.quickSub}>Revisar ahora</div>
              </button>
            </div>
          </Card>
        </Section>
      </MobileScaffold>

      <style>{`
        @media (max-width: 520px) {
          .spSum-shell {
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-top: 14px !important;
            gap: 12px !important;
          }

          .spSum-card {
            border-radius: 18px !important;
            padding: 14px !important;
          }

          .spSum-eventsList {
            gap: 8px !important;
          }

          .spSum-eventRow {
            min-height: 70px !important;
            padding: 11px 12px !important;
          }

          .spSum-quickGrid {
            grid-template-columns: 1fr !important;
          }

          .spSum-captureFieldWrap {
            grid-template-columns: 1fr !important;
          }

          .spSum-captureInput {
            min-height: 52px !important;
          }

          .spSum-captureButton {
            width: 100% !important;
            min-height: 50px !important;
          }

          .spSum-quickCard {
            min-height: 88px !important;
            padding: 14px !important;
          }

          .spSum-seeMore {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "18px 18px 0",
    display: "flex",
    flexDirection: "column",
    gap: 16,
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
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(14px)",
  },

  captureHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  captureEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  captureTitle: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  captureSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.55,
    opacity: 0.74,
    maxWidth: 640,
  },
  captureHintPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.16)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(226,242,255,0.92)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  captureFieldWrap: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "stretch",
  },
  captureInput: {
    width: "100%",
    minHeight: 56,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,22,0.72)",
    color: "rgba(255,255,255,0.96)",
    padding: "0 16px",
    fontSize: 15,
    fontWeight: 700,
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
  },
  captureButton: {
    minWidth: 124,
    minHeight: 56,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    background: "linear-gradient(135deg, rgba(56,189,248,0.24), rgba(124,58,237,0.24))",
    color: "rgba(255,255,255,0.96)",
    fontSize: 14,
    fontWeight: 900,
    padding: "0 18px",
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(8,12,28,0.24)",
  },
  captureButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  captureExamplesRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  captureExamplePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.035)",
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.82,
  },
  conflictBanner: {
    width: "100%",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(251,191,36,0.20)",
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(239,68,68,0.06))",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
  },
  conflictBannerLeft: {
    display: "grid",
    gap: 4,
    textAlign: "left",
  },
  conflictBannerEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,230,160,0.9)",
  },
  conflictBannerTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  conflictBannerSub: {
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.76)",
  },
  conflictBannerCta: {
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  stateRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.03))",
    flexWrap: "wrap",
  },
  stateLeft: {
    flex: 1,
    minWidth: 240,
  },
  stateLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.9,
  },
  stateLoadingBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.10)",
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.9,
  },
  stateMoodTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.5px",
  },
  stateMoodSub: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.76,
    lineHeight: 1.45,
  },
  stateStatsRow: {
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  stateStat: {
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.88,
  },
  stateStatDot: {
    opacity: 0.34,
    fontWeight: 900,
  },
  stateKpi: {
    minWidth: 140,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  stateKpiLabel: {
    fontSize: 11,
    opacity: 0.62,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  stateKpiNumber: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-1px",
    lineHeight: 1,
  },
  stateKpiHint: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.68,
    lineHeight: 1.4,
  },
  loadingCard: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 0 8px rgba(56,189,248,0.10)",
    flexShrink: 0,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.68,
    marginTop: 2,
  },
  emptyBlock: {
    marginTop: 14,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.55,
    maxWidth: 640,
  },
  emptyBtn: {
    marginTop: 14,
    padding: "11px 14px",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(124,58,237,0.18))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  nextBlock: {
    marginTop: 16,
    display: "grid",
    gap: 8,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.7,
  },
  nextCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    textAlign: "left",
  },
  eventsList: {
    marginTop: 12,
    display: "grid",
    gap: 10,
  },
  eventRow: {
    width: "100%",
    minHeight: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    textAlign: "left",
  },
  eventRowHighlight: {
    border: "1px solid rgba(56,189,248,0.45)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.22) inset",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(124,58,237,0.10))",
  },
  eventLeft: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  eventWhen: {
    fontSize: 11,
    fontWeight: 850,
    opacity: 0.72,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
  },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    border: "1px solid rgba(56,189,248,0.22)",
    fontSize: 11,
    fontWeight: 900,
  },
  pillSoft: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 11,
    fontWeight: 900,
  },
  seeMoreBtn: {
    marginTop: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 14px",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  sectionHeadMini: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  decisionsCta: {
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
  },
  decisionsEmpty: {
    marginTop: 14,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
  },
  decisionsEmptyTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  decisionsEmptySub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.5,
    maxWidth: 620,
  },
  decisionsList: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  },
  decisionRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
  },
  decisionIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 15,
    fontWeight: 900,
  },
  decisionIconNormal: {
    border: "1px solid rgba(52,211,153,0.28)",
    background: "rgba(52,211,153,0.12)",
  },
  decisionIconFallback: {
    border: "1px solid rgba(251,191,36,0.28)",
    background: "rgba(251,191,36,0.14)",
  },
  decisionContent: {
    minWidth: 0,
    flex: 1,
    display: "grid",
    gap: 6,
  },
  decisionTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  decisionTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  decisionWhen: {
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.68,
    whiteSpace: "nowrap",
  },
  decisionSubtitle: {
    fontSize: 13,
    opacity: 0.76,
    lineHeight: 1.5,
  },
  decisionBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },
  decisionBadgeManual: {
    border: "1px solid rgba(52,211,153,0.25)",
    background: "rgba(52,211,153,0.12)",
    color: "rgba(187,247,208,0.95)",
  },
  decisionBadgeFallback: {
    border: "1px solid rgba(251,191,36,0.25)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.95)",
  },
  quickGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  quickCard: {
    minHeight: 100,
    display: "grid",
    alignContent: "start",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  quickSub: {
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.5,
  },
};