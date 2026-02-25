// src/app/events/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import MobileScaffold from "@/components/MobileScaffold";
import EventsHero from "@/components/events/EventsHero";
import EventsFiltersBar from "@/components/events/EventsFiltersBar";
import EventsEmptyState from "@/components/events/EventsEmptyState";
import EventsTimelineList from "@/components/events/EventsTimelineList";

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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sendingDigest, setSendingDigest] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ===== CARGA INICIAL =====

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        const [eventsRes, groupsRes] = await Promise.all([
          getMyEvents().catch((err) => {
            console.error("Error getMyEvents en /events:", err);
            return [] as DbEventRow[];
          }),
          getMyGroups().catch((err) => {
            console.error("Error getMyGroups en /events:", err);
            return [] as GroupRow[];
          }),
        ]);

        if (!alive) return;

        const groupsById = new Map(
          groupsRes.map((g) => [String(g.id), g]),
        );

        const withGroup: EventWithGroup[] = eventsRes.map((e) => ({
          ...e,
          group: e.group_id
            ? groupsById.get(String(e.group_id)) ?? null
            : null,
        }));

        setEvents(withGroup);
        setGroups(groupsRes);
      } catch (err) {
        console.error("Error booting events:", err);
      } finally {
        if (!alive) return;
        setBooting(false);
        setLoading(false);
      }
    }

    void boot();

    return () => {
      alive = false;
    };
  }, [router]);

  // ===== DERIVADOS =====

  const totalGroups = groups.length;

  const filteredEvents = useMemo(() => {
    let list = [...events];

    const now = new Date();

    if (filters.view === "upcoming") {
      list = list.filter((e) => new Date(e.start) >= now);
      list.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    } else if (filters.view === "history") {
      list = list.filter((e) => new Date(e.end) < now);
      list.sort((a, b) => +new Date(b.start) - +new Date(a.start));
    } else {
      list.sort((a, b) => +new Date(a.start) - +new Date(b.start));
    }

    if (filters.scope === "personal") {
      list = list.filter((e) => !e.group_id);
    } else if (filters.scope === "groups") {
      list = list.filter((e) => !!e.group_id);
    }

    const q = filters.query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const title = (e.title ?? "").toLowerCase();
        const notes = (e.notes ?? "").toLowerCase();
        const groupName = (e.group?.name ?? "").toLowerCase();
        return (
          title.includes(q) ||
          notes.includes(q) ||
          groupName.includes(q)
        );
      });
    }

    return list;
  }, [events, filters]);

  const groupedByDate = useMemo(() => {
    const groupsMap = new Map<string, EventWithGroup[]>();

    for (const e of filteredEvents) {
      const start = new Date(e.start);
      const key = start.toISOString().slice(0, 10);
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(e);
    }

    const entries = Array.from(groupsMap.entries()).sort(
      ([a], [b]) => (a < b ? -1 : 1),
    );

    return entries.map(([dateKey, list]) => ({
      dateKey,
      events: list,
    }));
  }, [filteredEvents]);

  const headerSubtitle = useMemo(() => {
    if (events.length === 0) {
      return "Mira y gestiona tu lista de eventos personales y compartidos.";
    }

    const personal = events.filter((e) => !e.group_id).length;
    const groupEvents = events.filter((e) => !!e.group_id).length;

    return `Tu lista combina ${personal} evento${
      personal === 1 ? "" : "s"
    } personales y ${groupEvents} en grupos. Filtra, revisa y limpia sin perder contexto.`;
  }, [events]);

  const conflictsNow = 0;

  // ===== HANDLERS =====

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

  async function refreshData() {
    try {
      setLoading(true);

      const [eventsRes, groupsRes] = await Promise.all([
        getMyEvents().catch((err) => {
          console.error("Error refrescando getMyEvents:", err);
          return [] as DbEventRow[];
        }),
        getMyGroups().catch((err) => {
          console.error("Error refrescando getMyGroups:", err);
          return [] as GroupRow[];
        }),
      ]);

      const groupsById = new Map(
        groupsRes.map((g) => [String(g.id), g]),
      );

      const withGroup: EventWithGroup[] = eventsRes.map((e) => ({
        ...e,
        group: e.group_id
          ? groupsById.get(String(e.group_id)) ?? null
          : null,
      }));

      setEvents(withGroup);
      setGroups(groupsRes);
    } catch (err: any) {
      console.error("Error refrescando eventos:", err);
      setToast({
        type: "error",
        message:
          err?.message ||
          "No se pudieron refrescar los eventos. Intenta de nuevo.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;

    if (
      !window.confirm(
        `¿Eliminar ${selectedIds.size} evento${
          selectedIds.size === 1 ? "" : "s"
        } de tu lista? Esta acción no se puede deshacer.`,
      )
    ) {
      return;
    }

    try {
      setDeleting(true);

      const idsArray = Array.from(selectedIds);
      await deleteEventsByIds(idsArray);

      setEvents((prev) =>
        prev.filter((e) => !idsArray.includes(String(e.id))),
      );
      setSelectedIds(new Set());
      setToast({
        type: "success",
        message: "Eventos eliminados correctamente.",
      });
    } catch (err: any) {
      console.error("Error al eliminar eventos:", err);
      setToast({
        type: "error",
        message:
          err?.message ||
          "No se pudieron eliminar esos eventos. Intenta de nuevo.",
      });
    } finally {
      setDeleting(false);
    }
  }

  async function sendTodayDigest() {
    try {
      setSendingDigest(true);
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setToast({
        type: "success",
        message: "Se envió un resumen simulado de tus eventos de hoy.",
      });
    } catch (err: any) {
      console.error("Error enviando digest:", err);
      setToast({
        type: "error",
        message:
          err?.message ||
          "No se pudo enviar el resumen hoy. Intenta nuevamente.",
      });
    } finally {
      setSendingDigest(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const anySelected = selectedIds.size > 0;

  // ===== ESTADO BOOTING =====

  if (booting) {
    return (
      <MobileScaffold>
        <main style={S.pageShell}>
          <div style={S.stickyTop}>
            <EventsHero
              subtitle="Mira y gestiona tu lista de eventos personales y compartidos."
              showCreateButton={false}
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

  // ===== RENDER PRINCIPAL =====

  return (
    <MobileScaffold>
      {toast && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 80,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 30,
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              borderRadius: 999,
              padding: "10px 14px",
              fontSize: 13,
              fontWeight: 600,
              background:
                toast.type === "success"
                  ? "rgba(34,197,94,0.95)"
                  : "rgba(248,113,113,0.95)",
              color: "white",
              boxShadow: "0 18px 40px rgba(0,0,0,0.65)",
            }}
          >
            {toast.message}
          </div>
        </div>
      )}

      <main style={S.pageShell}>
        <div style={S.stickyTop}>
          <EventsHero subtitle={headerSubtitle} />
        </div>

        {/* CARD PRINCIPAL */}
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

            <aside style={S.factBox} className="spEvt-factBox">
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
            </aside>
          </div>

          {/* Filtros y acciones */}
          <EventsFiltersBar
            view={filters.view}
            scope={filters.scope}
            query={filters.query}
            onChangeView={(view) =>
              setFilters((f) => ({
                ...f,
                view,
              }))
            }
            onChangeScope={(scope) =>
              setFilters((f) => ({
                ...f,
                scope,
              }))
            }
            onChangeQuery={(query) =>
              setFilters((f) => ({
                ...f,
                query,
              }))
            }
          />

          {/* Acciones masivas / digest demo */}
          {events.length > 0 && (
            <button
              type="button"
              onClick={sendTodayDigest}
              disabled={sendingDigest}
              style={{
                ...S.digestBtn,
                ...(sendingDigest ? S.digestBtnLoading : {}),
              }}
            >
              {sendingDigest
                ? "Enviando resumen de hoy…"
                : "Enviar resumen de hoy (demo)"}
            </button>
          )}

          {anySelected && (
            <div style={S.bulkBar}>
              <span style={S.bulkLabel}>
                {selectedIds.size} evento
                {selectedIds.size === 1 ? "" : "s"} seleccionado
                {selectedIds.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={handleDeleteSelected}
                disabled={deleting}
                style={S.bulkDelete}
              >
                {deleting ? "Eliminando…" : "Eliminar selección"}
              </button>
            </div>
          )}

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
            <EventsEmptyState
              onCreateFirstEvent={() =>
                router.push("/events/new/details?type=personal")
              }
            />
          ) : (
            <EventsTimelineList
              groupedByDate={groupedByDate as any}
              selectedIds={selectedIds}
              onToggleSelected={toggleSelection}
            />
          )}
        </section>

        {/* Botón para refrescar datos */}
        <section style={S.footerSection}>
          <button
            type="button"
            onClick={refreshData}
            disabled={loading}
            style={S.refreshBtn}
          >
            {loading ? "Actualizando lista…" : "Actualizar lista"}
          </button>
        </section>
      </main>
    </MobileScaffold>
  );
}

// ===== ESTILOS (solo diseño, sin lógica) =====

const S: Record<string, React.CSSProperties> = {
  pageShell: {
    maxWidth: 720,
    margin: "0 auto",
    padding: "10px 14px 80px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 10,
    paddingBottom: 8,
    marginBottom: 4,
    background:
      "linear-gradient(to bottom, rgba(8,15,28,1) 0%, rgba(8,15,28,0.92) 55%, rgba(8,15,28,0.0) 100%)",
    backdropFilter: "blur(14px)",
  },

  card: {
    borderRadius: 24,
    border: "1px solid rgba(31,41,55,0.95)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(circle at 100% 0%, rgba(56,189,248,0.18), transparent 55%), rgba(15,23,42,0.98)",
    padding: 16,
    boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
  },

  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "rgba(129,199,255,0.98)",
  },
  h1: {
    margin: 0,
    marginTop: 4,
    fontSize: 22,
    fontWeight: 950,
    color: "rgba(248,250,252,1)",
  },
  sub: {
    margin: 0,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(209,213,219,0.98)",
  },

  factBox: {
    minWidth: 160,
    maxWidth: 210,
    alignSelf: "stretch",
    borderRadius: 18,
    border: "1px solid rgba(30,64,175,0.9)",
    background:
      "radial-gradient(circle at 100% 0%, rgba(59,130,246,0.35), transparent 55%), rgba(15,23,42,0.96)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(191,219,254,0.96)",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  factRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "rgba(229,231,235,0.98)",
  },
  factDotPersonal: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "rgba(56,189,248,0.98)",
  },
  factDotGroup: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "rgba(239,68,68,0.98)",
  },
  factHint: {
    marginTop: 2,
    fontSize: 11,
    color: "rgba(148,163,184,0.96)",
  },

  digestBtn: {
    marginTop: 10,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(59,130,246,0.85)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(191,219,254,0.98)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  digestBtnLoading: {
    opacity: 0.7,
    cursor: "default",
  },

  bulkBar: {
    marginTop: 10,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(30,64,175,0.88)",
    padding: "8px 11px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  bulkLabel: {
    fontSize: 12,
    color: "rgba(219,234,254,0.98)",
  },
  bulkDelete: {
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.95)",
    background: "rgba(127,29,29,0.96)",
    padding: "6px 10px",
    fontSize: 12,
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },

  loadingList: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(30,64,175,0.95)",
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
    fontWeight: 800,
    color: "rgba(248,250,252,0.98)",
  },
  loadingSub: {
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },

  footerSection: {
    marginTop: 16,
    display: "flex",
    justifyContent: "center",
  },
  refreshBtn: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    padding: "8px 14px",
    fontSize: 13,
    color: "rgba(229,231,235,0.98)",
    cursor: "pointer",
  },
};