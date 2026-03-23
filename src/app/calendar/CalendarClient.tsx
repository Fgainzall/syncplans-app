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
import AppHero from "@/components/AppHero";
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
  getMyConflictResolutionsMap,
  type Resolution,
} from "@/lib/conflictResolutionsDb";
import {
  getMyDeclinedEventIds,
  filterOutDeclinedEvents,
} from "@/lib/eventResponsesDb";

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
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hhmm = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(
      x.getMinutes()
    ).padStart(2, "0")}`;
  const cross = !sameDay(s, e);
  if (cross)
    return `${s.toLocaleDateString()} ${hhmm(
      s
    )} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}
function isValidIsoish(v: any) {
  if (!v || typeof v !== "string") return false;
  const t = new Date(v).getTime();
  return !Number.isNaN(t);
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
function normalizeForConflicts(gt: GroupType | null | undefined): GroupType {
  if (!gt) return "personal" as GroupType;
  return (gt === ("pair" as any) ? ("couple" as any) : gt) as GroupType;
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

   const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});

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

  const [enabledGroups, setEnabledGroups] = useState({
    personal: true,
    pair: true,
    family: true,
    other: true,
  });

  const [toast, setToast] =
    useState<null | { title: string; subtitle?: string }>(null);


  /* ✏️ ESTADO DEL MODAL DE EDICIÓN */
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleEditEvent = useCallback((e: CalendarEvent) => {
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

        const enriched: CalendarEvent[] = (rawEvents || [])
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

            if (!isValidIsoish(startRaw) || !isValidIsoish(endRaw)) return null;

            return {
              id: String(ev.id),
              title: ev.title ?? "Evento",
              start: String(startRaw),
              end: String(endRaw),
              notes: ev.notes ?? undefined,
              groupId: gid ? String(gid) : null,
              groupType: gt,
            } as CalendarEvent;
          })
          .filter(Boolean) as CalendarEvent[];

        const filtered = filterOutDeclinedEvents(
          enriched,
          nextDeclined ?? new Set<string>()
        );

        setEvents(filtered);
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
      const ok = confirm(
        `¿Eliminar el evento${
          title ? ` "${title}"` : ""
        }?\nEsta acción no se puede deshacer.`
      );
      if (!ok) return;

      try {
        setToast({ title: "Eliminando…", subtitle: "Aplicando cambios" });

        const result = await deleteEventsByIdsDetailed([eventId]);

        if (result.deletedCount !== 1) {
          if (result.blockedIds.length > 0) {
            throw new Error(
              "No pudiste eliminar ese evento con tu sesión actual. Puede pertenecer a otra persona o no estar permitido por permisos."
            );
          }

          throw new Error(
            "El evento no se eliminó realmente. No actualizamos la UI como si hubiera salido bien."
          );
        }

        await refreshCalendar({
          showToast: true,
          toastTitle: "Evento eliminado ✅",
          toastSubtitle: "Tu calendario ya está actualizado.",
        });
      } catch (e: any) {
        setToast({
          title: "No se pudo eliminar",
          subtitle: e?.message ?? "Revisa permisos o conexión.",
        });
        window.setTimeout(() => setToast(null), 2600);
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
    return () =>
      window.removeEventListener(
        "sp:active-group-changed",
        handler as any
      );
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
    const normalized: CalendarEvent[] = (Array.isArray(events)
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

  const conflictEventIdsInGrid = useMemo(() => {
    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    const set = new Set<string>();
    for (const c of conflicts) {
      const s = new Date(c.overlapStart).getTime();
      const e = new Date(c.overlapEnd).getTime();
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
      const s = new Date(c.overlapStart).getTime();
      const e = new Date(c.overlapEnd).getTime();
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
      const s = new Date(e.start).getTime();
      const en = new Date(e.end).getTime();
      return en >= a && s <= b;
    });
  }, [filteredEvents, gridStart, gridEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const e of visibleEvents) {
      const key = ymd(new Date(e.start));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      );
      map.set(k, arr);
    }
    return map;
  }, [visibleEvents]);

  const agendaEvents = useMemo(() => {
    const list = [...visibleEvents];
    list.sort(
      (a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
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

    const d = new Date(highlightedEvent.start);

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
  router.push("/conflicts/detected");
};

  const resolveNow = () =>
    router.push(
      `/conflicts/compare?i=${firstRelevantConflictIndex}`
    );

  const currentMonthIndex = anchor.getMonth();
  const currentYear = anchor.getFullYear();

  if (booting) {
    return (
      <MobileScaffold>
        <main style={styles.page}>
          <div style={styles.stickyTop}>
            <AppHero
              title="Calendario"
              subtitle="Una sola vista para tus eventos personales, de pareja y familia."
              mobileNav="bottom"
            />
          </div>

          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>
                Cargando tu calendario…
              </div>
              <div style={styles.loadingSub}>
                Preparando tus eventos y grupos
              </div>
            </div>
          </div>
        </main>
      </MobileScaffold>
    );
  }

  const monthTitle = prettyMonthRange(monthStart, monthEnd);

  return (
    <MobileScaffold>
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

      <main style={styles.page} className="spCal-shell">
        <div style={styles.stickyTop}>
<AppHero
  mobileNav="bottom"
  title="Calendario"
  subtitle={isMobile ? "" : "Organiza tu tiempo sin fricción."}
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
        </div>

       <section style={styles.overviewCard} className="spCal-overviewCard">
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

  <div style={styles.overviewMetaRow}>
    {!eventsLoaded ? (
      <div style={styles.statusPillNeutral}>
        <span style={styles.statusDotNeutral} />
        Revisando conflictos…
      </div>
    ) : conflictCount > 0 ? (
      <div style={styles.statusCluster}>
        <button onClick={openConflicts} style={styles.statusPillDanger}>
          <span style={styles.statusDotDanger} />
          {conflictCount} conflicto{conflictCount === 1 ? "" : "s"} activo
          {conflictCount === 1 ? "" : "s"}
        </button>

        <button onClick={resolveNow} style={styles.statusPillAction}>
          Resolver ahora
        </button>
      </div>
    ) : (
      <div style={styles.statusPillSuccess}>
        <span style={styles.statusDotSuccess} />
        Sin conflictos activos
      </div>
    )}

    <button onClick={handleRefresh} style={styles.overviewGhostBtn}>
      Actualizar
    </button>
  </div>
</section>
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
          <section
            style={styles.calendarCard}
            className="spCal-calendarCard"
          >
            <div
              className="spCal-monthScroller"
              style={styles.monthScroller}
            >
              <div
                style={styles.weekHeader}
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
    gridAutoRows: isMobile ? "110px" : "140px",
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
                  onEdit: handleEditEvent,
                  today,
                })}
              </div>
            </div>

            <div
              style={styles.dayPanel}
              className="spCal-dayPanel"
            >
              <div style={styles.dayPanelTop}>
                <div style={styles.dayPanelTitle}>
                  {prettyDay(selectedDay)}
                </div>

                <div style={styles.dayPanelActions}>
                  <button
                    onClick={() =>
                      openNewEventPersonal(selectedDay)
                    }
                    style={styles.ghostBtnSmallPersonal}
                  >
                    + Personal
                  </button>
                  <button
                    onClick={() =>
                      openNewEventGroup(selectedDay)
                    }
                    style={styles.ghostBtnSmallGroup}
                  >
                    + Grupo
                  </button>
                </div>
              </div>

              <div style={styles.dayList}>
                {(eventsByDay.get(ymd(selectedDay)) || []).length ===
                0 ? (
                  <div style={styles.emptyHint}>
                    No hay eventos este día.
                  </div>
                ) : (
                  (eventsByDay.get(ymd(selectedDay)) || []).map(
                    (e) => (
                      <EventRow
                        key={e.id ?? `${e.start}_${e.end}`}
                        e={e}
                        highlightId={highlightId}
                        setRef={setEventRef}
                        onDelete={handleDeleteEvent}
                        onEdit={handleEditEvent}
                        groupTypeById={groupTypeById}
                      />
                    )
                  )
                )}
              </div>
            </div>
          </section>
        ) : (
          <section style={styles.agendaCard}>
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
                  />
                ))
              )}
            </div>
          </section>
        )}

        <EventEditModal
          isOpen={isEditOpen}
          onClose={() => {
            setIsEditOpen(false);
            setEditingEvent(null);
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
          onSaved={async () => {
            setIsEditOpen(false);
            setEditingEvent(null);
            await refreshCalendar({
              showToast: true,
              toastTitle: "Evento actualizado ✅",
              toastSubtitle: "Tu calendario ya está al día.",
            });
          }}
        />
      </main>
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
}: {
  e: CalendarEvent;
  highlightId?: string | null;
  setRef?: (id: string) => (el: HTMLDivElement | null) => void;
  onDelete?: (id: string, title?: string) => void;
  onEdit?: (e: CalendarEvent) => void;
  groupTypeById?: Map<string, "pair" | "family" | "other">;
}) {
  const resolvedType: GroupType = e.groupId
    ? ((groupTypeById?.get(String(e.groupId)) ?? "pair") as any)
    : ("personal" as any);

  const meta = groupMeta(resolvedType);
  const isHighlighted =
    highlightId && String(e.id) === String(highlightId);

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
        <div style={styles.eventTop}>
          <div style={styles.eventTitle}>
            {e.title || "Sin título"}
          </div>

          <div style={styles.eventRight}>
            <div style={styles.eventTag}>
              <span
                style={{
                  ...styles.eventDot,
                  background: meta.dot,
                }}
              />
              {meta.label}
            </div>

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
          </div>
        </div>

        <div style={styles.eventTime}>
          {prettyTimeRange(e.start, e.end)}
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
  eventsByDay: Map<string, CalendarEvent[]>;
  openNewEventPersonal: (date?: Date) => void;
  openNewEventGroup: (date?: Date) => void;
  groupTypeById: Map<string, "pair" | "family" | "other">;
  onEdit: (e: CalendarEvent) => void;
  today: Date;
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
    onEdit,
    today,
  } = opts;

  const cells: React.ReactNode[] = [];
  let day = new Date(gridStart);

  while (day <= gridEnd) {
    const cellDate = new Date(day);

    const inMonth = cellDate.getMonth() === monthStart.getMonth();
    const isSelected = sameDay(cellDate, selectedDay);
    const isToday = sameDay(cellDate, today);

    const dayEvents = eventsByDay.get(ymd(cellDate)) || [];
    const top3 = dayEvents.slice(0, 3);

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
              ...(isToday ? styles.cellDayToday : {}),
            }}
          >
            {cellDate.getDate()}
          </div>

          <div style={styles.cellTopRight}>
            <div
              style={styles.cellQuickAdd}
              className="spCal-cellQuickAdd"
            >
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openNewEventPersonal(new Date(cellDate));
                }}
                style={styles.cellQuickBtnPersonal}
                aria-label="Crear evento personal"
                title="Crear evento personal"
              >
                +
              </button>

              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openNewEventGroup(new Date(cellDate));
                }}
                style={styles.cellQuickBtnGroup}
                aria-label="Crear evento de grupo"
                title="Crear evento de grupo"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div
          style={styles.cellEvents}
          className="spCal-cellEvents"
        >
          {dayEvents.length > 0 && (
            <div style={styles.cellCountRow}>
              <span style={styles.cellCount}>
                {dayEvents.length}
              </span>
            </div>
          )}

          {top3.map((e) => {
            const resolvedType: GroupType = e.groupId
              ? ((groupTypeById.get(String(e.groupId)) ?? "pair") as GroupType)
              : ("personal" as GroupType);

            const meta = groupMeta(resolvedType);

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
                <span style={styles.cellEventText}>
                  {e.title || "Evento"}
                </span>
              </div>
            );
          })}

          {dayEvents.length > 3 ? (
            <div
              style={styles.moreHint}
              className="spCal-moreHint"
            >
              +{dayEvents.length - 3} más
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
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
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
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.02)",
  overflow: "hidden",
  boxShadow: "0 30px 80px rgba(0,0,0,0.35)",
},

  monthScroller: {
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
  },

  weekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    padding: "10px 10px 0",
    minWidth: 720,
  },
  weekDay: {
    padding: "10px 10px",
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 850,
  },

grid: {
  display: "grid",
  gridTemplateColumns: "repeat(7, 1fr)",
  gap: 12, // antes 10
  padding: 12,
  minWidth: 720,
},

cell: {
  height: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.04)", // 🔥 menos ruido
  background: "rgba(255,255,255,0.025)",
  padding: "10px 10px 8px",
  cursor: "pointer",
  textAlign: "left",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  transition: "all 160ms ease",
},
":hover": {
  background: "rgba(255,255,255,0.05)",
  transform: "translateY(-1px)",
},
  cellTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cellTopRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    flexWrap: "wrap",
  },
  cellDay: { fontSize: 13, fontWeight: 900, opacity: 0.92 },
  cellDayToday: {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.12)",
  },

  cellCount: {
    fontSize: 11,
    padding: "1px 6px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 850,
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
    borderRadius: 8,
    border: "1px solid rgba(250,204,21,0.40)",
    background: "rgba(250,204,21,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 11,
    lineHeight: "20px",
    textAlign: "center",
    flexShrink: 0,
  },
  cellQuickBtnGroup: {
    width: 20,
    height: 20,
    borderRadius: 8,
    border: "1px solid rgba(96,165,250,0.40)",
    background: "rgba(96,165,250,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 11,
    lineHeight: "20px",
    textAlign: "center",
    flexShrink: 0,
  },

 cellEvents: {
  marginTop: 6,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flexGrow: 1,
  minHeight: 0,
  overflow: "hidden",
},
  cellEventLine: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flex: "0 0 auto",
  },
cellEventText: {
  fontSize: 12,
  opacity: 0.95,
  fontWeight: 800, // 🔥 más peso
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
},
  moreHint: {
    fontSize: 12,
    opacity: 0.65,
    marginTop: 4,
    fontWeight: 750,
  },

dayPanel: {
  borderTop: "1px solid rgba(255,255,255,0.05)",
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
  },

  dayList: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  agendaCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
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
  border: "1px solid rgba(255,255,255,0.05)",
  background: "rgba(255,255,255,0.03)",
  transition: "all 160ms ease",
},
  eventBar: { width: 6, borderRadius: 999 },
  eventBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  eventTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eventRight: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
eventTitle: {
  fontSize: 15, // 🔥 sube un poco
  fontWeight: 950,
  letterSpacing: "-0.2px",
  overflow: "hidden",
  whiteSpace: "nowrap",
  textOverflow: "ellipsis",
},
  eventTime: {
    fontSize: 12,
    opacity: 0.78,
    fontWeight: 700,
  },
  eventTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    opacity: 0.95,
    whiteSpace: "nowrap",
    fontWeight: 850,
  },
  eventDot: { width: 8, height: 8, borderRadius: 999 },

  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(59,130,246,0.45)",
    background: "rgba(59,130,246,0.16)",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 950,
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.10)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 950,
  },

  primaryBtnPersonal: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(250,204,21,0.30)",
    background:
      "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.08))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 950,
  },
  primaryBtnGroup: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.30)",
    background:
      "linear-gradient(135deg, rgba(96,165,250,0.22), rgba(96,165,250,0.08))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 950,
  },

 ghostBtn: {
  padding: "8px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "rgba(255,255,255,0.9)",
  cursor: "pointer",
  fontWeight: 800,
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
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.04)",
  background: "rgba(255,255,255,0.02)",
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
  letterSpacing: 0.5,
  textTransform: "uppercase",
  color: "rgba(148,163,184,0.86)",
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
  color: "rgba(191,219,254,0.82)",
},

overviewActions: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
},

overviewMetaRow: {
  marginTop: 10,
  paddingTop: 10,
  borderTop: "1px solid rgba(148,163,184,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
},

statusCluster: {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
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
  gap: 8,
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.28)",
  background: "rgba(248,113,113,0.12)",
  color: "#FECACA",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
},

statusPillAction: {
  minHeight: 38,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid rgba(56,189,248,0.24)",
  background: "rgba(56,189,248,0.12)",
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
};