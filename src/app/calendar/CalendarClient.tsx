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
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import MobileScaffold from "@/components/MobileScaffold";
import { EventEditModal } from "@/components/EventEditModal";
import { CalendarFilters } from "./CalendarFilters";
import { getMyGroups } from "@/lib/groupsDb";
import {
  getEventsForGroups,
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
  deriveEventStatus,
  normalizeGroupType,
  normalizeProposalResponse,
  getProposalResponseLabel,
  getProposalResponseTone,
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
};

type Scope = "personal" | "active" | "all";
type Tab = "month" | "agenda";

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
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
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
    } else {
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
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

function getCalendarEventStatus(input: {
  eventId: string | null | undefined;
  inConflict?: boolean;
  proposalRow?: ProposalResponseRow | null;
  trustSignal?: ConflictTrustSignal | null;
}) {
  const key = String(input.eventId ?? "").trim();
  if (!key) return null;

const trustLabel = String(input.trustSignal?.label ?? "").trim().toLowerCase();
const isResolvedByTrust =
  trustLabel === "resolved" || trustLabel === "auto_adjusted";

const safeProposalRow =
  input.proposalRow?.response === "pending" ? null : input.proposalRow;

const ctx = buildEventContext({
  eventId: key,
  conflictEventIds:
    !isResolvedByTrust && input.inConflict ? new Set([key]) : new Set(),
  proposalResponses: safeProposalRow ? [safeProposalRow] : [],
  trustSignal: input.trustSignal ?? null,
});

  const status = ctx?.status ?? null;
  if (status === "scheduled") return null;
  return status;
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

  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setEventRef = (id: string) => (el: HTMLDivElement | null) => {
    eventRefs.current[String(id)] = el;
  };

  const [booting, setBooting] = useState(true);

  const [tab, setTab] = useState<Tab>("month");
  const [scope, setScope] = useState<Scope>("all");

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

   const [events, setEvents] = useState<CalendarEventWithOwner[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [trustSignals, setTrustSignals] = useState<
    Record<string, ConflictTrustSignal>
  >({});
  const [proposalResponsesMap, setProposalResponsesMap] = useState<
    Record<string, ProposalResponseRow>
  >({});

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
  const [eventsLoaded, setEventsLoaded] = useState(false);

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [enabledGroups, setEnabledGroups] = useState({
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
          myGroups.some((g: any) => String(g.id) === String(persistedActive))
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

        const groupIds = (myGroups || []).map((g: any) => String(g.id));

        const [rawEvents, nextResMap, nextDeclined] = await Promise.all([
          getEventsForGroups(groupIds) as Promise<any[]>,
          getMyConflictResolutionsMap().catch(() => ({})),
          getMyDeclinedEventIds().catch(() => new Set<string>()),
        ]);

        setResMap(nextResMap ?? {});
        setDeclinedEventIds(nextDeclined ?? new Set());


        const groupTypeByIdLocal = new Map<string, "family" | "pair" | "other">(
          (myGroups || []).map((g: any) => {
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
          .map((ev: any) => {
            const gid = ev.group_id ?? ev.groupId ?? null;

            let gt: GroupType = "personal" as any;

            if (gid) {
              const t = groupTypeByIdLocal.get(String(gid));

              if (t === "family") {
                gt = "family" as any;
              } else if (t === "other") {
                gt = "other" as any;
              } else {
                gt = "pair" as any;
              }
            } else {
              gt = "personal" as any;
            }

            const startRaw = ev.start ?? ev.start_at ?? null;
            const endRaw = ev.end ?? ev.end_at ?? null;

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
        setProposalResponsesMap(proposalResponses ?? {});
        setEventsLoaded(true);
        setError(null);

        if (showToastFlag) {
          setToast({
            title: "Actualizado ✅",
            subtitle: "Tu calendario ya está al día.",
          });
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando calendario");
        setTrustSignals({});
        setProposalResponsesMap({});
        setEventsLoaded(true);

        if (showToastFlag) {
          setToast({
            title: "No se pudo actualizar",
            subtitle: e?.message ?? "Revisa tu sesión o conexión.",
          });
          window.setTimeout(() => setToast(null), 2800);
        }
      }
    },
    [router]
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string, title?: string) => {
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
      } catch (e: any) {
        setDeleteError(
          e?.message ?? "No se pudo eliminar este evento con tu sesión actual."
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
      } catch (e: any) {
        setHideError(
          e?.message ?? "No se pudo ocultar este evento para tu cuenta."
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

    window.addEventListener("sp:active-group-changed", handler as any);
    window.addEventListener("sp:events-changed", handler as any);

    return () => {
      window.removeEventListener(
        "sp:active-group-changed",
        handler as any
      );
      window.removeEventListener(
        "sp:events-changed",
        handler as any
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
    return;
  }, [refreshCalendar]);

  useEffect(() => {
    const onFocus = () => {
      void refreshCalendar();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshCalendar();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refreshCalendar]);

  /* Boot inicial */
  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      try {
        await refreshCalendar();
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, refreshCalendar]);

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

    return visible.filter((conflict) => !resolutionForConflict(conflict, resMap));
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

  /* =========================
     Filtros y vistas
     ========================= */
  const filteredEvents = useMemo(() => {
    const isEnabled = (g?: GroupType | null) => {
      const key = (g ?? "personal") as any;
      return !!(enabledGroups as any)[key];
    };

    return (Array.isArray(events) ? events : []).filter((e) => {
      const gt = (e.groupType ?? "personal") as any;

      if (!isEnabled(gt)) return false;

      if (scope === "all") return true;

      if (scope === "personal") {
        return gt === "personal";
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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventWithOwner[]>();

    for (const e of visibleEvents) {
      const key = toYmdKey(parseIsoLike(e.start) ?? new Date(e.start));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort(
        (a, b) =>
          toDateMs(a.start) - toDateMs(b.start)
      );
      map.set(k, arr);
    }
    return map;
  }, [visibleEvents]);

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
    setEnabledGroups((s: any) => ({ ...s, [g]: !s[g] }));

  const handleRefresh = async () => {
    await refreshCalendar({
      showToast: true,
      toastTitle: "Actualizando…",
      toastSubtitle: "Recargando desde SyncPlans",
    });
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
            subtitle="Visualiza tu tiempo con claridad y detecta choques rápido."
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
                <div style={styles.loadingTitle}>Cargando tu calendario…</div>
                <div style={styles.loadingSub}>
                  Preparando tus eventos y grupos
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  const monthTitle = prettyMonthRange(monthStart, monthEnd);

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
          subtitle="Visualiza tu tiempo con claridad y detecta choques rápido."
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
              <h2 style={styles.overviewTitle}>
                {tab === "month" ? "Vista mensual" : "Vista agenda"}
              </h2>
              <div style={styles.overviewSub}>
                {monthTitle}
                {error ? ` · ${error}` : ""}
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
                + Grupo
              </button>
            </div>
          </div>

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
            ) : conflictCount > 0 ? (
              <div style={styles.statusCluster}>
                <button onClick={openConflicts} style={styles.statusPillDanger}>
                  <span style={styles.statusDotDanger} />
                  {conflictCount} conflicto{conflictCount === 1 ? "" : "s"}
                </button>

                <button onClick={resolveNow} style={styles.statusPillAction}>
                  Revisar
                </button>
              </div>
            ) : (
              <div
                style={{
                  ...styles.statusPillSuccess,
                  ...(isMobile ? styles.statusPillSuccessMobile : null),
                }}
              >
                <span style={styles.statusDotSuccess} />
                Sin conflictos
              </div>
            )}

            <button
              onClick={handleRefresh}
              style={{
                ...styles.overviewGhostBtn,
                ...(isMobile ? styles.overviewGhostBtnMobile : null),
              }}
            >
              Actualizar
            </button>
          </div>
        </Card>
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

        {tab === "month" ? (
          <Card style={styles.calendarCard} className="spCal-calendarCard">
            <div className="spCal-monthScroller" style={styles.monthScroller}>
          <div
  style={{
    ...styles.weekHeader,
    minWidth: 700,
    padding: isMobile ? "8px 8px 0" : styles.weekHeader.padding,
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
    minWidth: 700,
    gap: isMobile ? 8 : 12,
    padding: isMobile ? 10 : 12,
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
                    + Personal
                  </button>
                  <button
                    onClick={() => openNewEventGroup(selectedDay)}
                    style={styles.ghostBtnSmallGroup}
                  >
                    + Grupo
                  </button>
                </div>
              </div>

              <div style={styles.dayList}>
                {(eventsByDay.get(ymd(selectedDay)) || []).length === 0 ? (
                  <div style={styles.emptyHint}>No hay eventos este día.</div>
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
              <div style={styles.agendaTitle}>Agenda del mes</div>
              <div style={styles.agendaSub}>
                Mostrando {agendaEvents.length} evento
                {agendaEvents.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.agendaList}>
              {agendaEvents.length === 0 ? (
                <div style={styles.emptyHint}>
                  No hay eventos para mostrar con estos filtros.
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
        groupType:
          editingEvent.groupType === "pair"
            ? ("couple" as any)
            : editingEvent.groupType,
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
        await handleDeleteEvent(editingEvent.id, editingEvent.title);
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
  proposalResponsesMap?: Record<string, ProposalResponseRow>;
  inConflict?: boolean;
}) {
  const resolvedType: GroupType = e.groupId
    ? ((groupTypeById?.get(String(e.groupId)) ?? "pair") as any)
    : ("personal" as any);

  const meta = groupMeta(resolvedType);
  const isHighlighted =
    highlightId && String(e.id) === String(highlightId);
  const canDelete = isEventOwnedByUser(e, currentUserId);
  const trustLabel = trustSignal
    ? trustSignal.label === "auto_adjusted"
      ? "Ajuste automático"
      : "Resuelto"
    : null;
const proposalRow = proposalResponsesMap?.[String(e.id)];
const proposalLabel =
  proposalRow?.response === "pending"
    ? null
    : proposalResponseLabel(proposalRow?.response);
const isActuallyPending =
  proposalRow?.response === "pending" ||
  (!proposalRow && inConflict); // fallback solo si no hay respuesta

const calendarEventStatus = getCalendarEventStatus({
  eventId: e.id,
  inConflict: isActuallyPending,
  proposalRow,
  trustSignal,
});
  const statusUi = calendarEventStatus
    ? getEventStatusUi(calendarEventStatus, {
        conflictsCount: inConflict ? 1 : 0,
      })
    : null;
  const fallbackStatusStyle = proposalLabel
    ? styles.eventTrustBadgePending
    : styles.eventTrustBadgeResolved;
  const statusLabel = statusUi?.label ?? proposalLabel ?? trustLabel;
  const statusStyle = statusUi?.badgeStyle ?? fallbackStatusStyle;

  return (
    <div
      ref={setRef ? setRef(String(e.id)) : undefined}
      style={{
        ...styles.eventRow,
        border: isHighlighted
          ? "1px solid rgba(56,189,248,0.55)"
          : (styles.eventRow.border as any),
        background: isHighlighted
          ? "rgba(255,255,255,0.08)"
          : (styles.eventRow.background as any),
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

            <div style={styles.eventTime}>{prettyTimeRange(e.start, e.end)}</div>
          </div>

          <div
            style={{
              ...styles.eventRight,
              ...(isMobile ? styles.eventRightMobile : null),
            }}
          >
            <div style={styles.eventTag}>
              <span
                style={{
                  ...styles.eventDot,
                  background: meta.dot,
                }}
              />
              {meta.label}
            </div>

            {statusLabel ? (
              <div
                style={{
                  ...styles.eventTrustBadge,
                  ...statusStyle,
                }}
              >
                {statusLabel}
              </div>
            ) : null}

            <button
              type="button"
              onClick={(ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                onEdit?.(e);
              }}
              style={styles.editBtn}
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
                style={styles.deleteBtn}
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
    openNewEventGroup,
    groupTypeById,
    trustSignals,
    proposalResponsesMap,
    conflictEventIdsInGrid,
    onEdit,
    today,
    isMobile,
  } = opts;

  const cells: React.ReactNode[] = [];
  let day = new Date(gridStart);

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
      padding: isMobile ? "9px 8px 8px" : styles.cell.padding,
      borderRadius: isMobile ? 16 : styles.cell.borderRadius,
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
          fontSize: isMobile ? 11 : styles.cellDay.fontSize,
          ...(isToday
            ? {
                ...styles.cellDayToday,
                padding: isMobile ? "1px 6px" : styles.cellDayToday.padding,
              }
            : {}),
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
            width: isMobile ? 24 : styles.cellQuickBtnPersonal.width,
            height: isMobile ? 24 : styles.cellQuickBtnPersonal.height,
            borderRadius: 999,
            fontSize: isMobile ? 14 : styles.cellQuickBtnPersonal.fontSize,
            lineHeight: isMobile ? "24px" : styles.cellQuickBtnPersonal.lineHeight,
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
              fontSize: isMobile ? 10 : styles.cellCount.fontSize,
              padding: isMobile ? "1px 5px" : styles.cellCount.padding,
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
        const trustShortLabel = trustSignal
          ? trustSignal.label === "auto_adjusted"
            ? "Auto"
            : "Resuelto"
          : null;
        const proposalRow = proposalResponsesMap[String(e.id)];

const proposalLabel =
  proposalRow?.response === "pending"
    ? null
    : proposalResponseLabel(proposalRow?.response);

const isConflictEvent = conflictEventIdsInGrid.has(String(e.id));

const isActuallyPending =
  proposalRow?.response === "pending" ||
  (!proposalRow && isConflictEvent);

const calendarEventStatus = getCalendarEventStatus({
  eventId: e.id,
  inConflict: isActuallyPending,
  proposalRow:
    proposalRow?.response === "pending" ? null : proposalRow,
  trustSignal,
});
        const cellStatusUi = calendarEventStatus
          ? getEventStatusUi(calendarEventStatus, {
              conflictsCount: isConflictEvent ? 1 : 0,
            })
          : null;
        const fallbackCellStatusStyle = proposalLabel
          ? styles.cellTrustPillPending
          : styles.cellTrustPillResolved;
        const cellStatusLabel =
          cellStatusUi?.compactLabel ?? proposalLabel ?? trustShortLabel;
        const cellStatusStyle =
          cellStatusUi?.badgeStyle ?? fallbackCellStatusStyle;

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
                fontSize: isMobile ? 11 : styles.cellEventText.fontSize,
              }}
            >
              {e.title || "Evento"}
            </span>

            {cellStatusLabel ? (
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
      fontSize: isMobile ? 11 : styles.moreHint.fontSize,
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
    gap: 4,
  },
  cellTopRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
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
    gap: 4,
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
  padding: 14,
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.06)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.025)",
  transition: "background 160ms ease, border-color 160ms ease, transform 160ms ease",
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
  },
eventTag: {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
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
},
  eventDot: { width: 8, height: 8, borderRadius: 999 },

  eventTrustBadge: {
    display: "inline-flex",
    alignItems: "center",
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
  flex: "1 1 160px",
  minWidth: 0,
  borderRadius: 18,
  padding: "14px 16px",
  border: "1px solid rgba(250,204,21,0.34)",
  background: "linear-gradient(180deg, rgba(250,204,21,0.20), rgba(250,204,21,0.10))",
  color: "rgba(255,255,255,0.96)",
  fontSize: 15,
  fontWeight: 800,
  cursor: "pointer",
},
primaryBtnGroup: {
  flex: "1 1 160px",
  minWidth: 0,
  borderRadius: 18,
  padding: "14px 16px",
  border: "1px solid rgba(96,165,250,0.34)",
  background: "linear-gradient(180deg, rgba(59,130,246,0.22), rgba(59,130,246,0.12))",
  color: "rgba(255,255,255,0.96)",
  fontSize: 15,
  fontWeight: 800,
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
overviewCard: {
  borderRadius: 18,
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.022))",
  boxShadow: "0 20px 60px rgba(0,0,0,0.24)",
  padding: "10px 12px",
  marginBottom: 8,
},

overviewTop: {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 14,
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
  fontSize: "clamp(20px, 3vw, 28px)",
  lineHeight: 1.08,
  fontWeight: 950,
  color: "#F8FAFC",
  letterSpacing: -0.6,
},

overviewSub: {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(226,232,240,0.76)",
},

overviewActions: {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
  width: "100%",
},

overviewMetaRow: {
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  justifyContent: "flex-start",
  gap: 12,
  width: "100%",
  marginTop: 12,
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
    gap: 4,
  },
  eventRightMobile: {
    width: "100%",
    marginLeft: 0,
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-start",
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