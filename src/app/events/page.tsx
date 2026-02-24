// src/app/events/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import AppHero from "@/components/AppHero";
import MobileScaffold from "@/components/MobileScaffold";

import {
  getMyEvents,
  deleteEventsByIds,
  type DbEventRow,
} from "@/lib/eventsDb";
import {
  getGroupTypeLabel,
  getMyGroups,
  type GroupRow,
} from "@/lib/groupsDb";
import { groupMeta } from "@/lib/conflicts";

type ViewMode = "upcoming" | "history" | "all";
type Scope = "personal" | "groups" | "all";

type FilterState = {
  view: ViewMode;
  scope: Scope;
  query: string;
};

type EventWithGroup = DbEventRow & {
  group?: GroupRow | null;
};

export default function EventsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<EventWithGroup[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);

  const [filters, setFilters] = useState<FilterState>({
    view: "upcoming",
    scope: "all",
    query: "",
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [sendingDigest, setSendingDigest] = useState(false);
  const [toast, setToast] = useState<
    | null
    | {
        title: string;
        subtitle?: string;
      }
  >(null);

  /* ============================
     Boot inicial y carga de datos
     ============================ */
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
        await refreshData(false);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function refreshData(withToast: boolean) {
    try {
      if (withToast) {
        setToast({
          title: "Actualizando…",
          subtitle: "Cargando eventos y grupos",
        });
      }

      setLoading(true);

 const [eventsData, myGroups] = await Promise.all([
  getMyEvents(), // ✅ devuelve DbEventRow[]
  getMyGroups(), // ✅ devuelve grupos
]);

const groupsArray = (myGroups || []) as GroupRow[];

const eventsWithGroup: EventWithGroup[] = ((eventsData || []) as DbEventRow[]).map(
  (e: DbEventRow) => {
    const group =
      e.group_id != null
        ? groupsArray.find(
            (g) => String(g.id) === String(e.group_id),
          ) || null
        : null;

    return { ...e, group };
  },
);
      setGroups(groupsArray);
      setEvents(eventsWithGroup);
      setSelectedIds(new Set());

      if (withToast) {
        setToast({
          title: "Eventos actualizados ✅",
          subtitle: "Tu lista está al día.",
        });
        window.setTimeout(() => setToast(null), 2600);
      }
    } catch (e: any) {
      console.error("Error refrescando eventos", e);
      setToast({
        title: "No se pudo actualizar",
        subtitle: e?.message ?? "Revisa tu conexión o sesión.",
      });
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setLoading(false);
    }
  }

  /* ============================
     Digest manual (recordatorio de hoy)
     ============================ */
  async function sendTodayDigest() {
    if (sendingDigest) return;
    setSendingDigest(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

    const todayEvents = events.filter((e: EventWithGroup) => {
  const start = new Date(e.start);
  start.setHours(0, 0, 0, 0);
  return (
    start.getTime() === today.getTime() &&
    (filters.scope === "all" ||
      (filters.scope === "personal" && !e.group_id) ||
      (filters.scope === "groups" && !!e.group_id))
  );
});
      if (todayEvents.length === 0) {
        setToast({
          title: "Nada para hoy",
          subtitle: "No hay eventos para enviar en el recordatorio.",
        });
        window.setTimeout(() => setToast(null), 2600);
        return;
      }

      const { error } = await supabase.functions.invoke(
        "send-today-digest",
        {
          body: { events: todayEvents },
        },
      );

      if (error) {
        throw error;
      }

      setToast({
        title: "Recordatorio enviado ✅",
        subtitle: `Se envió un resumen con ${todayEvents.length} evento${
          todayEvents.length === 1 ? "" : "s"
        }.`,
      });
      window.setTimeout(() => setToast(null), 2600);
    } catch (e: any) {
      console.error("Error enviando digest", e);
      setToast({
        title: "No se pudo enviar",
        subtitle: e?.message ?? "Inténtalo más tarde.",
      });
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setSendingDigest(false);
    }
  }

  /* ============================
     Filtros y derivados
     ============================ */
const filteredEvents = useMemo(() => {
  const now = new Date();

  return events.filter((e: EventWithGroup) => {
    const start = new Date(e.start);

    if (filters.scope === "personal" && e.group_id) {
      return false;
    }
    if (filters.scope === "groups" && !e.group_id) {
      return false;
    }

    if (filters.view === "upcoming" && start < now) {
      return false;
    }
    if (filters.view === "history" && start >= now) {
      return false;
    }

    if (!filters.query.trim()) return true;

    const q = filters.query.toLowerCase();
    const target = `${e.title ?? ""} ${e.notes ?? ""} ${
      e.group ? e.group.name ?? "" : ""
    }`.toLowerCase();

    return target.includes(q);
  });
}, [events, filters]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, EventWithGroup[]>();

    for (const e of filteredEvents) {
      const d = new Date(e.start);
      const key = d.toISOString().slice(0, 10);

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(e);
    }

    for (const [key, arr] of map.entries()) {
      arr.sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime(),
      );
      map.set(key, arr);
    }

    const sortedKeys = [...map.keys()].sort();
    return sortedKeys.map((k) => ({ dateKey: k, events: map.get(k)! }));
  }, [filteredEvents]);

  const hasSelection = selectedIds.size > 0;

  async function handleDeleteSelected() {
    if (!hasSelection) return;

    const count = selectedIds.size;
    const ok = confirm(
      `¿Eliminar ${count} evento${
        count === 1 ? "" : "s"
      } seleccionado${count === 1 ? "" : "s"}?`,
    );
    if (!ok) return;

    try {
      setToast({
        title: "Eliminando…",
        subtitle: "Aplicando cambios",
      });

      await deleteEventsByIds([...selectedIds]);

      setSelectedIds(new Set());

      await refreshData(false);

      setToast({
        title: "Eventos eliminados ✅",
        subtitle: "Tu lista está actualizada.",
      });
      window.setTimeout(() => setToast(null), 2600);
    } catch (e: any) {
      console.error("Error eliminando eventos", e);
      setToast({
        title: "No se pudo eliminar",
        subtitle: e?.message ?? "Inténtalo más tarde.",
      });
      window.setTimeout(() => setToast(null), 2600);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  const totalEvents = events.length;
  const totalGroups = groups.length;

  const headerSubtitle =
    totalEvents === 0
      ? "Tus eventos, sin ruido."
      : `Tienes ${totalEvents} evento${
          totalEvents === 1 ? "" : "s"
        } en tu agenda.`;

  /* ============================
     RENDER
     ============================ */
  if (booting) {
    return (
      <MobileScaffold>
        <main style={S.pageShell}>
          <div style={S.stickyTop}>
          <AppHero
  title="Eventos"
  subtitle="Mira y gestiona tu lista de eventos personales y compartidos."
  mobileNav="bottom"
/>
          </div>

          <section style={S.card}>
            <div style={S.loadingRow}>
              <div style={S.loadingDot} />
              <div>
                <div style={S.loadingTitle}>
                  Cargando tus eventos…
                </div>
                <div style={S.loadingSub}>
                  Preparando tu lista para hoy
                </div>
              </div>
            </div>
          </section>
        </main>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold>
      {toast && (
        <div style={S.toastWrap}>
          <div style={S.toastCard}>
            <div style={S.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={S.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <main style={S.pageShell}>
        <div style={S.stickyTop}>
          {/* ✅ APP MODE en móvil: bottom bar + sin nav larga arriba */}
          <AppHero
            title="Eventos"
            subtitle={headerSubtitle}
            mobileNav="bottom"
            rightSlot={
              <button
                style={S.primary}
                onClick={() =>
                  router.push("/events/new/details?type=personal")
                }
              >
                + Evento
              </button>
            }
          />
        </div>

        {/* ✅ 1 card principal */}
        <section style={S.card} className="spEvt-card">
          <div style={S.titleRow}>
            <div>
              <div style={S.kicker}>Tu agenda, capa por capa</div>
              <h1 style={S.h1}>Lista de eventos</h1>
              <p style={S.sub}>
                Mira tus próximos eventos personales y de grupos en un
                solo lugar. Desde aquí puedes editar, filtrar y eliminar
                sin perder claridad.
              </p>
            </div>

            <div style={S.factBox} className="spEvt-factBox">
              <div style={S.factLabel}>Resumen rápido</div>
              <div style={S.factRow}>
                <span style={S.factDotPersonal} />
                <span>
                  {events.filter((e) => !e.group_id).length} personales
                </span>
              </div>
              <div style={S.factRow}>
                <span style={S.factDotGroup} />
                <span>
                  {events.filter((e) => !!e.group_id).length} en grupos
                </span>
              </div>

              {totalGroups > 0 && (
                <div style={S.factHint}>
                  Tienes {totalGroups} grupo
                  {totalGroups === 1 ? "" : "s"} conectado
                  {totalGroups === 1 ? "" : "s"} a tu agenda.
                </div>
              )}
            </div>
          </div>

          {/* Filtros y acciones */}
          <div style={S.filters} className="spEvt-filters">
            <div style={S.tabs}>
              <div style={S.segment}>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.view === "upcoming"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      view: "upcoming",
                    }))
                  }
                >
                  Próximos
                </button>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.view === "history"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      view: "history",
                    }))
                  }
                >
                  Historial
                </button>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.view === "all"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({ ...f, view: "all" }))
                  }
                >
                  Todos
                </button>
              </div>

              <div style={S.segment}>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.scope === "all"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({ ...f, scope: "all" }))
                  }
                >
                  Todo
                </button>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.scope === "personal"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      scope: "personal",
                    }))
                  }
                >
                  Personal
                </button>
                <button
                  type="button"
                  style={{
                    ...S.segmentBtn,
                    ...(filters.scope === "groups"
                      ? S.segmentBtnActive
                      : {}),
                  }}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      scope: "groups",
                    }))
                  }
                >
                  Grupos
                </button>
              </div>
            </div>

            <input
              style={S.search}
              className="spEvt-search"
              placeholder="Buscar por título, notas o grupo…"
              value={filters.query}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  query: e.target.value,
                }))
              }
            />
          </div>

          {events.length > 0 && (
            <button
              type="button"
              onClick={sendTodayDigest}
              disabled={sendingDigest}
              style={{
                ...S.digestChip,
                ...(sendingDigest
                  ? { opacity: 0.6, cursor: "default" }
                  : null),
              }}
              className="spEvt-digestChip"
            >
              {sendingDigest
                ? "Enviando recordatorio…"
                : "Enviar recordatorio de hoy"}
            </button>
          )}

          {/* Herramientas de selección */}
          <div style={S.toolsRow}>
            <div style={S.toolsLeft}>
              {hasSelection ? (
                <>
                  <button
                    type="button"
                    style={S.toolBtn}
                    onClick={clearSelection}
                  >
                    Limpiar selección
                  </button>
                  <button
                    type="button"
                    style={S.toolBtnDanger}
                    onClick={handleDeleteSelected}
                  >
                    Eliminar seleccionados
                  </button>
                </>
              ) : (
                <span style={S.toolsHint}>
                  Toca el icono de casilla para seleccionar varios
                  eventos y aplicar acciones en bloque.
                </span>
              )}
            </div>

            <button
              type="button"
              style={S.toolBtnGhost}
              onClick={() => refreshData(true)}
            >
              Actualizar lista
            </button>
          </div>

          {/* Lista de eventos */}
          {loading ? (
            <div style={S.loadingList}>
              <div style={S.loadingRow}>
                <div style={S.loadingDot} />
                <div>
                  <div style={S.loadingTitle}>
                    Cargando eventos…
                  </div>
                  <div style={S.loadingSub}>
                    Un momento, por favor.
                  </div>
                </div>
              </div>
            </div>
          ) : groupedByDate.length === 0 ? (
            <div style={S.emptyState} className="spEvt-empty">
              <h2 style={S.emptyTitle}>No hay eventos aquí aún</h2>
              <p style={S.emptySub}>
                Empieza creando tu primer evento. Más adelante podrás
                verlos por fecha, editar y detectar conflictos.
              </p>
              <button
                type="button"
                style={S.primary}
                onClick={() =>
                  router.push("/events/new/details?type=personal")
                }
              >
                Crear evento
              </button>
            </div>
          ) : (
            <div style={S.list} className="spEvt-list">
              {groupedByDate.map(({ dateKey, events }) => (
                <div
                  key={dateKey}
                  style={S.section}
                  className="spEvt-section"
                >
                  <div style={S.sectionHeader}>
                    <div style={S.sectionDate}>
                      {formatDateNice(dateKey)}
                    </div>
                    <div style={S.sectionCount}>
                      {events.length} evento
                      {events.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  <div style={S.sectionBody}>
                    {events.map((e) => (
                      <EventRow
                        key={e.id}
                        e={e}
                        selected={selectedIds.has(String(e.id))}
                        toggleSelection={toggleSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </MobileScaffold>
  );
}

function EventRow({
  e,
  selected,
  toggleSelection,
}: {
  e: EventWithGroup;
  selected: boolean;
  toggleSelection: (id: string) => void;
}) {
  const meta = groupMeta(
    e.group_id ? (e.group?.type as any) ?? "pair" : "personal",
  );

  const start = new Date(e.start);
  const end = new Date(e.end);

  const timeLabel =
    start.toDateString() === end.toDateString()
      ? `${formatTime(start)} — ${formatTime(end)}`
      : `${formatDateShort(start)} ${formatTime(
          start,
        )} → ${formatDateShort(end)} ${formatTime(end)}`;

  return (
    <div style={S.eventRow} className="spEvt-row">
      <button
        type="button"
        onClick={() => toggleSelection(String(e.id))}
        style={{
          ...S.checkbox,
          ...(selected ? S.checkboxOn : {}),
        }}
        aria-pressed={selected}
      >
        {selected ? "✓" : ""}
      </button>

      <div
        style={{
          ...S.eventCard,
          borderColor: selected
            ? "rgba(56,189,248,0.55)"
            : (S.eventCard.border as string),
          boxShadow: selected
            ? "0 0 0 1px rgba(56,189,248,0.35)"
            : (S.eventCard.boxShadow as string),
        }}
      >
        <div style={S.eventTop}>
          <div style={S.eventTitleRow}>
            <div style={S.eventDotWrap}>
              <span
                style={{
                  ...S.eventDot,
                  background: meta.dot,
                }}
              />
            </div>
            <div>
              <div style={S.eventTitle}>
                {e.title || "Sin título"}
              </div>
              <div style={S.eventGroup}>
                {e.group_id
                  ? getGroupTypeLabel(e.group?.type as any)
                  : "Personal"}
                {e.group?.name ? ` • ${e.group.name}` : ""}
              </div>
            </div>
          </div>

          <div style={S.eventTime}>{timeLabel}</div>
        </div>

        {e.notes && (
          <div style={S.eventNotes}>{e.notes}</div>
        )}
      </div>
    </div>
  );
}

/* ============================
   Helpers de formato
   ============================ */
function formatDateNice(isoDateKey: string) {
  const d = new Date(isoDateKey);
  const formatter = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatter.format(d);
}

function formatDateShort(d: Date) {
  const formatter = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  });
  return formatter.format(d);
}

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* ============================
   Styles
   ============================ */
const S: Record<string, React.CSSProperties> = {
  pageShell: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 56px",
  },

  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backdropFilter: "blur(16px)",
    background:
      "linear-gradient(180deg, rgba(5,8,22,0.92), rgba(5,8,22,0.78))",
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
    background: "rgba(7,11,22,0.92)",
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

  card: {
    marginTop: 14,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,25,0.90)",
    boxShadow:
      "0 22px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(15,23,42,0.60)",
    padding: "18px 16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.95)",
    fontWeight: 800,
    marginBottom: 6,
  },
  h1: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
    fontWeight: 950,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(209,213,219,0.96)",
    maxWidth: 420,
  },

  factBox: {
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.55)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.28), transparent 55%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.20), transparent 55%), rgba(15,23,42,0.95)",
    minWidth: 220,
  },
  factLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.16em",
    color: "rgba(226,232,240,0.9)",
    marginBottom: 6,
    fontWeight: 800,
  },
  factRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "rgba(241,245,249,0.95)",
    marginBottom: 4,
  },
  factDotPersonal: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(250,204,21,0.98)",
  },
  factDotGroup: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(96,165,250,0.98)",
  },
  factHint: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(226,232,240,0.9)",
  },

  filters: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    display: "inline-flex",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.96)",
    overflow: "hidden",
  },
  segmentBtn: {
    padding: "8px 11px",
    fontSize: 12,
    background: "transparent",
    border: "none",
    color: "rgba(209,213,219,0.9)",
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(56,189,248,0.55))",
    color: "white",
  },

  search: {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.60)",
    background: "rgba(15,23,42,0.96)",
    padding: "9px 12px",
    color: "rgba(248,250,252,0.98)",
    fontSize: 13,
    outline: "none",
  },

  digestChip: {
    marginTop: 10,
    alignSelf: "flex-start",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.96)",
    color: "#e5e7eb",
    fontWeight: 800,
    fontSize: 12,
    cursor: "pointer",
  },

  toolsRow: {
    marginTop: 6,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  toolsLeft: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  toolsHint: {
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },

  toolBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },
  toolBtnDanger: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(254,242,242,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },
  toolBtnGhost: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },

  list: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  section: {
    borderRadius: 18,
    border: "1px solid rgba(31,41,55,0.95)",
    background: "rgba(17,24,39,0.96)",
    padding: 10,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionDate: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(243,244,246,0.98)",
  },
  sectionCount: {
    fontSize: 12,
    color: "rgba(156,163,175,0.96)",
  },
  sectionBody: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  eventRow: {
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxOn: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    borderColor: "transparent",
  },

  eventCard: {
    flex: 1,
    borderRadius: 14,
    border: "1px solid rgba(31,41,55,0.98)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.16), transparent 55%), rgba(15,23,42,0.98)",
    padding: "10px 11px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
  },
  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  eventTitleRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  eventDotWrap: {
    marginTop: 3,
  },
  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
  eventGroup: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(156,163,175,0.96)",
  },
  eventTime: {
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
    fontWeight: 700,
  },
  eventNotes: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
  },

  emptyState: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px dashed rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.92)",
    padding: 16,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 950,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(209,213,219,0.96)",
    marginBottom: 10,
  },

  loadingList: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(30,64,175,0.8)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.22), transparent 55%), rgba(15,23,42,0.96)",
    padding: 14,
  },
  loadingRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 20px rgba(56,189,248,0.70)",
  },
  loadingTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  loadingSub: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
  },

  primary: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.85)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
};