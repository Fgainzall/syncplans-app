// src/app/calendar/day/CalendarDayClient.tsx

"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getMyGroups } from "@/lib/groupsDb";
import { getEventsForGroups } from "@/lib/eventsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

import {
  CalendarEvent,
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  attachEvents,
} from "@/lib/conflicts";

type Scope = "personal" | "active" | "all";
type Tab = "month" | "agenda";

// 👇 Alias para evitar que TS exija highlightId/appliedToast en este archivo
const AnyPremiumHeader = PremiumHeader as React.ComponentType<any>;

/* =========================
   Helpers (local, seguros)
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
  x.setDate(d.getDate() - diff);
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
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function prettyMonthRange(a: Date, b: Date) {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${a.getDate()} ${meses[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${meses[b.getMonth()]} ${b.getFullYear()}`;
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
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
}
function prettyTimeRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hhmm = (x: Date) => `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;
  const cross = !sameDay(s, e);
  if (cross) return `${s.toLocaleDateString()} ${hhmm(s)} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}

export default function CalendarDayClient(/* ... */) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // ✅ highlight support (desde notificaciones o links)
  const highlightId = sp.get("highlightEventId") ?? sp.get("eventId");

  // refs para scroll al evento en agenda (y también en panel día)
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
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [enabledGroups, setEnabledGroups] = useState<Record<GroupType, boolean>>({
    personal: true,
    pair: true,
    family: true,
    couple: true, // compat
  });

  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  const monthStart = useMemo(() => startOfMonth(anchor), [anchor]);
  const monthEnd = useMemo(() => endOfMonth(anchor), [anchor]);
  const gridStart = useMemo(() => startOfWeek(monthStart), [monthStart]);
  const gridEnd = useMemo(() => endOfWeek(monthEnd), [monthEnd]);

  /* =========================================================
     ✅ REFRESH BULLETPROOF (respeta scope + grupo activo)
     ========================================================= */
  const refreshCalendar = useCallback(
    async (opts?: { showToast?: boolean; toastTitle?: string; toastSubtitle?: string }) => {
      const showToast = opts?.showToast ?? false;

      try {
        if (showToast) {
          setToast({
            title: opts?.toastTitle ?? "Sincronizando…",
            subtitle: opts?.toastSubtitle ?? "Actualizando desde tus grupos",
          });
        }

        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        // 0) grupo activo (DB)
        const activeId = await getActiveGroupIdFromDb().catch(() => null);
        setActiveGroupId(activeId);

        // 1) grupos visibles por RLS
        const myGroups = await getMyGroups();
        setGroups(myGroups);

        const allGroupIds = myGroups.map((g: any) => g.id);

        // 2) decidir qué grupos pedimos según scope
        let groupIdsToFetch: string[] = [];

        if (scope === "active") {
          groupIdsToFetch = activeId ? [activeId] : allGroupIds;
        } else if (scope === "all") {
          groupIdsToFetch = allGroupIds;
        } else {
          // personal: pedimos todo y filtramos a personal (sin tocar backend)
          groupIdsToFetch = allGroupIds;
        }

        // 3) eventos de esos grupos (RLS manda)
        const raw = await getEventsForGroups(groupIdsToFetch);

        // 4) adaptar y mapear group_id -> groupType
        const typeByGroupId = new Map<string, string>(
          myGroups.map((g: any) => [g.id, g.type === "solo" ? "personal" : g.type])
        );

        const adapted: CalendarEvent[] = (raw ?? []).map((e: any) => {
          const gid = e.groupId ?? e.group_id ?? null;

          return {
            id: e.id,
            title: e.title,
            start: e.start,
            end: e.end,
            groupId: gid,
            groupType: (gid ? (typeByGroupId.get(gid) ?? "personal") : "personal") as any,
          };
        });

        // 5) filtro final si scope === personal
        const finalEvents = scope === "personal" ? adapted.filter((e) => (e.groupType ?? "personal") === "personal") : adapted;

        setEvents(finalEvents);
        setError(null);

        if (showToast) {
          setToast({ title: "Sincronizado ✅", subtitle: "Eventos actualizados con permisos reales." });
          window.setTimeout(() => setToast(null), 2400);
        }
      } catch (e: any) {
        setError(e?.message ?? "Error cargando calendario");
        if (showToast) {
          setToast({
            title: "No se pudo sincronizar",
            subtitle: e?.message ?? "Revisa tu sesión o conexión.",
          });
          window.setTimeout(() => setToast(null), 2800);
        }
      }
    },
    [router, scope]
  );

  // ✅ Toast premium al volver desde /conflicts/actions + REFRESH + limpia query
  useEffect(() => {
    const applied = sp.get("applied");
    if (applied !== "1") return;

    const deleted = Number(sp.get("deleted") ?? "0");
    const skipped = Number(sp.get("skipped") ?? "0");
    const appliedCount = Number(sp.get("appliedCount") ?? "0");

    setToast({
      title: "Cambios aplicados ✅",
      subtitle: `Aplicados: ${appliedCount} · Eliminados: ${deleted} · Saltados: ${skipped}`,
    });

    // ✅ recarga real para que el calendario refleje deletes
    refreshCalendar();

    const t = window.setTimeout(() => setToast(null), 4200);

    // Limpia query (para que no se repita al refresh)
    router.replace(pathname);

    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, pathname, refreshCalendar]);

  // Protección (sin bucle) + carga real
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

  // ---------- filtros base ----------  
  const filteredEvents = useMemo(() => {
    const isEnabled = (g?: GroupType | null) => {
      const key = (g ?? "personal") as GroupType;
      return !!enabledGroups[key];
    };

    return (Array.isArray(events) ? events : []).filter((e) => {
      const gt = (e.groupType ?? "personal") as GroupType;
      if (!isEnabled(gt)) return false;

      if (scope === "all") return true;
      if (scope === "personal") return gt === "personal";
      // active = ya viene recortado por refreshCalendar (pero dejamos el guard-rail)
      return true;
    });
  }, [events, scope, enabledGroups]);

  // ---------- visible in current month grid (para pintar) ----------  
  const visibleEvents = useMemo(() => {
    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    return filteredEvents.filter((e) => {
      const s = new Date(e.start).getTime();
      const en = new Date(e.end).getTime();
      return en >= a && s <= b;
    });
  }, [filteredEvents, gridStart, gridEnd]);

  // ---------- conflictos ----------  
  const attachedConflicts = useMemo(() => {
    const cx = computeVisibleConflicts(filteredEvents);
    return attachEvents(cx, filteredEvents);
  }, [filteredEvents]);

  const conflictCount = attachedConflicts.length;

  // Smart deep link: primer conflicto que cae dentro del rango del grid visible  
  const firstRelevantConflictIndex = useMemo(() => {
    if (attachedConflicts.length === 0) return 0;
    const a = gridStart.getTime();
    const b = gridEnd.getTime();

    const idx = attachedConflicts.findIndex((c: any) => {
      const s = new Date(c.overlapStart).getTime();
      const e = new Date(c.overlapEnd).getTime();
      return e >= a && s <= b;
    });

    return idx >= 0 ? idx : 0;
  }, [attachedConflicts, gridStart, gridEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of visibleEvents) {
      const key = ymd(new Date(e.start));
      const arr = map.get(key) || [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      map.set(k, arr);
    }
    return map;
  }, [visibleEvents]);

  const agendaEvents = useMemo(() => {
    const list = [...visibleEvents];
    list.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return list;
  }, [visibleEvents]);

  // ✅ highlight: buscar el evento y mover mes/día/tab  
  const highlightedEvent = useMemo(() => {
    if (!highlightId) return null;
    return filteredEvents.find((e) => String(e.id) === String(highlightId)) ?? null;
  }, [highlightId, filteredEvents]);

  useEffect(() => {
    if (!highlightedEvent) return;

    const d = new Date(highlightedEvent.start);

    setAnchor(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedDay(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setTab("agenda");

    setToast({
      title: "Evento encontrado ✨",
      subtitle: "Te llevé directo al evento desde la notificación.",
    });

    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [highlightedEvent]);

  // ✅ scroll a la card del evento (cuando ya está renderizado)  
  useEffect(() => {
    if (!highlightId) return;

    const t = window.setTimeout(() => {
      const el = eventRefs.current[String(highlightId)];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 140);

    return () => window.clearTimeout(t);
  }, [highlightId, tab, agendaEvents.length]);

  // ✅ limpiar query del highlight para que no se repita en refresh  
  useEffect(() => {
    if (!highlightId) return;
    const t = window.setTimeout(() => {
      router.replace(pathname);
    }, 3200);
    return () => window.clearTimeout(t);
  }, [highlightId, pathname, router]);

  const goPrevMonth = () => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const goNextMonth = () => setAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const t = new Date();
    setAnchor(t);
    setSelectedDay(t);
  };

  const toggleGroup = (g: GroupType) => setEnabledGroups((s) => ({ ...s, [g]: !s[g] }));

  const handleSync = async () => {
    await refreshCalendar({ showToast: true });
  };

  /* =========================================================
     2 BOTONES “CREAR EVENTO” (PERSONAL / GRUPO)
     ========================================================= */
  const openNewEventPersonal = (date?: Date) => {
    const d = date ?? selectedDay ?? new Date();
    router.push(`/events/new/details?type=personal&date=${encodeURIComponent(d.toISOString())}`);
  };

  const openNewEventGroup = (date?: Date) => {
    const d = date ?? selectedDay ?? new Date();
    router.push(`/events/new/details?type=group&date=${encodeURIComponent(d.toISOString())}`);
  };

  const openConflicts = () => router.push("/conflicts/detected");
  const resolveNow = () => router.push(`/conflicts/compare?i=${firstRelevantConflictIndex}`);

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          {/* 👇 Aquí usamos el alias que ignora el tipo exigente */}
          <AnyPremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando tu calendario…</div>
              <div style={styles.loadingSub}>Preparando tus eventos y grupos</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* keyframes del glow highlight */}
      <style>{`
        @keyframes spPulseGlow {
          0% { transform: translateZ(0) scale(1); box-shadow: none; }
          35% { transform: translateZ(0) scale(1.01); box-shadow: 0 0 0 6px rgba(56,189,248,0.22), 0 18px 60px rgba(0,0,0,0.35); }
          100% { transform: translateZ(0) scale(1); box-shadow: none; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <div style={styles.topRow}>
          {/* 👇 Igual aquí usamos el alias */}
          <AnyPremiumHeader />
          <div style={styles.topActions}>
            <button onClick={handleSync} style={styles.ghostBtn}>
              Sync
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.titleRow}>
              <h1 style={styles.h1}>Calendario</h1>

              {conflictCount > 0 ? (
                <div style={styles.conflictCluster}>
                  <button onClick={openConflicts} style={styles.conflictPill}>
                    <span style={styles.conflictDot} />
                    {conflictCount} conflicto{conflictCount === 1 ? "" : "s"}
                    <span style={styles.conflictArrow}>→</span>
                  </button>

                  <button onClick={resolveNow} style={styles.resolvePill}>
                    Resolver ahora ✨
                  </button>
                </div>
              ) : (
                <div style={styles.okPill}>
                  <span style={styles.okDot} />
                  Sin conflictos
                </div>
              )}
            </div>

            <div style={styles.sub}>
              Vista {tab === "month" ? "mensual" : "agenda"} · {prettyMonthRange(monthStart, monthEnd)}
              {scope === "active" && activeGroupId ? (
                <span style={{ marginLeft: 8, opacity: 0.75 }}>
                  · activo: <span style={{ fontFamily: "ui-monospace" }}>{activeGroupId.slice(0, 8)}…</span>
                </span>
              ) : null}
            </div>

            {error ? <div style={{ ...styles.emptyHint, borderStyle: "solid" }}>{error}</div> : null}
          </div>

          <div style={styles.heroRight}>
            <button onClick={() => openNewEventPersonal()} style={styles.primaryBtnPersonal}>
              + Personal
            </button>
            <button onClick={() => openNewEventGroup()} style={styles.primaryBtnGroup}>
              + Grupo
            </button>
          </div>
        </section>

        <section style={styles.filtersCard}>
          <div style={styles.filtersRow}>
            <div style={styles.segment}>
              <button
                onClick={() => setTab("month")}
                style={{ ...styles.segmentBtn, ...(tab === "month" ? styles.segmentOn : {}) }}
              >
                Mes
              </button>
              <button
                onClick={() => setTab("agenda")}
                style={{ ...styles.segmentBtn, ...(tab === "agenda" ? styles.segmentOn : {}) }}
              >
                Agenda
              </button>
            </div>

            <div style={styles.segment}>
              <button
                onClick={() => setScope("active")}
                style={{ ...styles.segmentBtn, ...(scope === "active" ? styles.segmentOn : {}) }}
              >
                Activo
              </button>
              <button
                onClick={() => setScope("personal")}
                style={{ ...styles.segmentBtn, ...(scope === "personal" ? styles.segmentOn : {}) }}
              >
                Personal
              </button>
              <button
                onClick={() => setScope("all")}
                style={{ ...styles.segmentBtn, ...(scope === "all" ? styles.segmentOn : {}) }}
              >
                Todo
              </button>
            </div>

            <div style={styles.navRow}>
              <button onClick={goPrevMonth} style={styles.iconBtn} aria-label="Mes anterior">
                ‹
              </button>
              <button onClick={goToday} style={styles.ghostBtnSmall}>
                Hoy
              </button>
              <button onClick={goNextMonth} style={styles.iconBtn} aria-label="Mes siguiente">
                ›
              </button>
            </div>
          </div>

          <div style={styles.groupRow}>
            {(["personal", "pair", "family"] as GroupType[]).map((g) => {
              const meta = groupMeta(g);
              const on = enabledGroups[g];
              return (
                <button
                  key={g}
                  onClick={() => toggleGroup(g)}
                  style={{
                    ...styles.groupChip,
                    borderColor: on ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)",
                    opacity: on ? 1 : 0.5,
                  }}
                >
                  <span style={{ ...styles.groupDot, background: meta.dot as any }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </section>

        {tab === "month" ? (
          <section style={styles.calendarCard}>
            <div style={styles.weekHeader}>
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
                <div key={d} style={styles.weekDay}>
                  {d}
                </div>
              ))}
            </div>

            <div style={styles.grid}>
              {renderMonthCells({
                gridStart,
                gridEnd,
                monthStart,
                selectedDay,
                setSelectedDay,
                eventsByDay,
                openNewEventPersonal,
                openNewEventGroup,
              })}
            </div>

            <div style={styles.dayPanel}>
              <div style={styles.dayPanelTop}>
                <div style={styles.dayPanelTitle}>{prettyDay(selectedDay)}</div>

                <div style={styles.dayPanelActions}>
                  <button onClick={() => openNewEventPersonal(selectedDay)} style={styles.ghostBtnSmallPersonal}>
                    + Personal
                  </button>
                  <button onClick={() => openNewEventGroup(selectedDay)} style={styles.ghostBtnSmallGroup}>
                    + Grupo
                  </button>
                </div>
              </div>

              <div style={styles.dayList}>
                {(eventsByDay.get(ymd(selectedDay)) || []).length === 0 ? (
                  <div style={styles.emptyHint}>No hay eventos este día.</div>
                ) : (
                  (eventsByDay.get(ymd(selectedDay)) || []).map((e) => (
                    <EventRow key={String(e.id)} e={e} highlightId={highlightId} setRef={setEventRef} />
                  ))
                )}
              </div>
            </div>
          </section>
        ) : (
          <section style={styles.agendaCard}>
            <div style={styles.agendaTop}>
              <div style={styles.agendaTitle}>Agenda del mes</div>
              <div style={styles.agendaSub}>
                Mostrando {agendaEvents.length} evento{agendaEvents.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.agendaList}>
              {agendaEvents.length === 0 ? (
                <div style={styles.emptyHint}>No hay eventos para mostrar con estos filtros.</div>
              ) : (
                agendaEvents.map((e) => (
                  <EventRow key={String(e.id)} e={e} highlightId={highlightId} setRef={setEventRef} />
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function EventRow({
  e,
  highlightId,
  setRef,
}: {
  e: CalendarEvent;
  highlightId?: string | null;
  setRef?: (id: string) => (el: HTMLDivElement | null) => void;
}) {
  const g = (e.groupType ?? "personal") as GroupType;
  const meta = groupMeta(g);
  const isHighlighted = highlightId && String(e.id) === String(highlightId);

  return (
    <div
      ref={setRef ? setRef(String(e.id)) : undefined}
      style={{
        ...styles.eventRow,
        border: isHighlighted ? "1px solid rgba(56,189,248,0.55)" : (styles.eventRow.border as any),
        background: isHighlighted ? "rgba(255,255,255,0.08)" : (styles.eventRow.background as any),
        animation: isHighlighted ? "spPulseGlow 2.6s ease-out" : undefined,
      }}
    >
      <div style={{ ...styles.eventBar, background: meta.dot as any }} />
      <div style={styles.eventBody}>
        <div style={styles.eventTop}>
          <div style={styles.eventTitle}>{e.title || "Sin título"}</div>
          <div style={styles.eventTag}>
            <span style={{ ...styles.eventDot, background: meta.dot as any }} />
            {meta.label}
          </div>
        </div>
        <div style={styles.eventTime}>{prettyTimeRange(e.start, e.end)}</div>
      </div>
    </div>
  );
}

function renderMonthCells(opts: {
  gridStart: Date;
  gridEnd: Date;
  monthStart: Date;
  selectedDay: Date;
  setSelectedDay: (d: Date) => void;
  eventsByDay: Map<string, CalendarEvent[]>;
  openNewEventPersonal: (date?: Date) => void;
  openNewEventGroup: (date?: Date) => void;
}) {
  const { gridStart, gridEnd, monthStart, selectedDay, setSelectedDay, eventsByDay, openNewEventPersonal, openNewEventGroup } =
    opts;

  const cells: React.ReactNode[] = [];
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = 0; i < totalDays; i++) {
    const day = addDays(gridStart, i);
    const inMonth = day.getMonth() === monthStart.getMonth();
    const isSelected = sameDay(day, selectedDay);

    const dayEvents = eventsByDay.get(ymd(day)) || [];
    const top3 = dayEvents.slice(0, 3);

    cells.push(
      <div
        key={day.toISOString()}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedDay(day)}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            setSelectedDay(day);
          }
        }}
        style={{
          ...styles.cell,
          opacity: inMonth ? 1 : 0.35,
          outline: isSelected ? "2px solid rgba(255,255,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
          background: isSelected ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        }}
      >
        <div style={styles.cellTop}>
          <div style={styles.cellDay}>{day.getDate()}</div>
          <div style={styles.cellTopRight}>
            {dayEvents.length > 0 ? <div style={styles.cellCount}>{dayEvents.length}</div> : null}

            <div style={styles.cellQuickAdd}>
              <button
                type="button"
                onClick={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  openNewEventPersonal(day);
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
                  openNewEventGroup(day);
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

        <div style={styles.cellEvents}>
          {top3.map((e) => {
            const meta = groupMeta((e.groupType ?? "personal") as GroupType);
            return (
              <div key={String(e.id)} style={styles.cellEventLine}>
                <span style={{ ...styles.miniDot, background: meta.dot as any }} />
                <span style={styles.cellEventText}>{e.title || "Evento"}</span>
              </div>
            );
          })}

          {dayEvents.length > 3 ? <div style={styles.moreHint}>+{dayEvents.length - 3} más</div> : null}
        </div>
      </div>
    );
  }

  return cells;
}

/* =========================
   Styles (Premium)
   ========================= */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
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
  toastTitle: { fontWeight: 900, fontSize: 13, color: "rgba(255,255,255,0.95)" },
  toastSub: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.70)", fontWeight: 650 },

  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 },
  topActions: { display: "flex", gap: 10, alignItems: "center" },

  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  heroLeft: { display: "flex", flexDirection: "column", gap: 6 },
  heroRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },

  titleRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  h1: { margin: 0, fontSize: 30, letterSpacing: "-0.5px" },
  sub: { fontSize: 13, opacity: 0.8 },

  conflictCluster: { display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" },

  filtersCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    marginBottom: 12,
  },
  filtersRow: { display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },

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

  groupRow: { display: "flex", gap: 10, paddingTop: 10, flexWrap: "wrap" },
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
  },
  groupDot: { width: 10, height: 10, borderRadius: 999 },

  calendarCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  weekHeader: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 10px 0" },
  weekDay: { padding: "10px 10px", fontSize: 12, opacity: 0.75 },

  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, padding: 10 },
  cell: {
    minHeight: 108,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 10,
    cursor: "pointer",
    textAlign: "left",
  },
  cellTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  cellTopRight: { display: "flex", alignItems: "center", gap: 10 },
  cellDay: { fontSize: 14, fontWeight: 700 },
  cellCount: {
    fontSize: 12,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
  },

  cellQuickAdd: { display: "flex", gap: 6, alignItems: "center" },
  cellQuickBtnPersonal: {
    width: 22,
    height: 22,
    borderRadius: 9,
    border: "1px solid rgba(250,204,21,0.40)",
    background: "rgba(250,204,21,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: "22px",
    textAlign: "center",
  },
  cellQuickBtnGroup: {
    width: 22,
    height: 22,
    borderRadius: 9,
    border: "1px solid rgba(96,165,250,0.40)",
    background: "rgba(96,165,250,0.12)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    lineHeight: "22px",
    textAlign: "center",
  },

  cellEvents: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  cellEventLine: { display: "flex", gap: 8, alignItems: "center" },
  miniDot: { width: 8, height: 8, borderRadius: 999, flex: "0 0 auto" },
  cellEventText: { fontSize: 12, opacity: 0.9, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  moreHint: { fontSize: 12, opacity: 0.6, marginTop: 4 },

  dayPanel: { borderTop: "1px solid rgba(255,255,255,0.08)", padding: 12 },
  dayPanelTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  dayPanelTitle: { fontSize: 14, fontWeight: 700, opacity: 0.95 },
  dayPanelActions: { display: "flex", gap: 8, alignItems: "center" },
  dayList: { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 },

  agendaCard: { borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", overflow: "hidden" },
  agendaTop: { padding: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  agendaTitle: { fontSize: 16, fontWeight: 800 },
  agendaSub: { marginTop: 4, fontSize: 12, opacity: 0.75 },
  agendaList: { padding: 12, display: "flex", flexDirection: "column", gap: 10 },

  eventRow: { display: "flex", gap: 10, padding: 12, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" },
  eventBar: { width: 6, borderRadius: 999 },
  eventBody: { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  eventTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  eventTitle: { fontSize: 14, fontWeight: 800, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" },
  eventTime: { fontSize: 12, opacity: 0.78 },
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
  },
  eventDot: { width: 8, height: 8, borderRadius: 999 },

  primaryBtnPersonal: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(250,204,21,0.30)",
    background: "linear-gradient(135deg, rgba(250,204,21,0.22), rgba(250,204,21,0.08))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtnGroup: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.30)",
    background: "linear-gradient(135deg, rgba(96,165,250,0.22), rgba(96,165,250,0.08))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },

  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 700,
  },
  ghostBtnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },

  ghostBtnSmallPersonal: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(250,204,21,0.22)",
    background: "rgba(250,204,21,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
    fontSize: 12,
  },
  ghostBtnSmallGroup: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(96,165,250,0.22)",
    background: "rgba(96,165,250,0.08)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
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
    fontWeight: 900,
    fontSize: 12,
  },
  conflictDot: { width: 10, height: 10, borderRadius: 999, background: "rgba(248,113,113,0.95)" },
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
    fontWeight: 900,
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
    fontWeight: 900,
    fontSize: 12,
  },
  okDot: { width: 10, height: 10, borderRadius: 999, background: "rgba(34,197,94,0.95)" },

  emptyHint: {
    padding: 14,
    borderRadius: 14,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
    opacity: 0.75,
    fontSize: 13,
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
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};