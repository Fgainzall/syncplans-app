// src/app/events/EventsPageClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import EventsFiltersBar from "@/components/events/EventsFiltersBar";
import EventsEmptyState from "@/components/events/EventsEmptyState";
import EventsTimeline from "@/components/EventsTimeline";

import {
  getMyEvents,
  deleteEventsByIdsDetailed,
  type DbEventRow,
} from "@/lib/eventsDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getMyDeclinedEventIds } from "@/lib/eventResponsesDb";
import { filterVisibleEvents } from "@/lib/tempeventVisibility";

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

function localDateKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isWithinNext24Hours(value: string | Date) {
  const now = new Date();
  const d = value instanceof Date ? value : new Date(value);
  const diff = d.getTime() - now.getTime();
  return diff >= 0 && diff <= 24 * 60 * 60 * 1000;
}

function shortDateLabel(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const now = new Date();

  const todayKey = localDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const dateKey = localDateKey(d);

  if (dateKey === todayKey) return "Hoy";
  if (dateKey === localDateKey(tomorrow)) return "Mañana";

  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}`;
}

function shortTimeLabel(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<EventWithGroup[]>([]);
  const [hiddenEventIds] = useState<Set<string>>(() => new Set());
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
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

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        const [eventsRes, groupsRes, declinedRes] = await Promise.all([
          getMyEvents().catch((err) => {
            console.error("Error getMyEvents en /events:", err);
            return [] as DbEventRow[];
          }),
          getMyGroups().catch((err) => {
            console.error("Error getMyGroups en /events:", err);
            return [] as GroupRow[];
          }),
          getMyDeclinedEventIds().catch((err) => {
            console.error("Error getMyDeclinedEventIds en /events:", err);
            return new Set<string>();
          }),
        ]);

        if (!alive) return;

        const groupsById = new Map(groupsRes.map((g) => [String(g.id), g]));

        const withGroup: EventWithGroup[] = eventsRes.map((e) => ({
          ...e,
          group: e.group_id ? groupsById.get(String(e.group_id)) ?? null : null,
        }));

        setEvents(withGroup);
        setGroups(groupsRes);
        setDeclinedEventIds(declinedRes);
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

  const totalGroups = groups.length;
  const focusedEventId = searchParams.get("focusEventId");

  const filteredEvents = useMemo(() => {
    let list = filterVisibleEvents(events, {
      declinedIds: declinedEventIds,
      hiddenIds: hiddenEventIds,
    });

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
        const title = String(e.title ?? "").toLowerCase();
        const notes = String(e.notes ?? "").toLowerCase();
        const groupName = String(e.group?.name ?? "").toLowerCase();

        return title.includes(q) || notes.includes(q) || groupName.includes(q);
      });
    }

    return list;
  }, [events, declinedEventIds, hiddenEventIds, filters]);

  const urgentEvents = useMemo(() => {
    if (filters.view === "history") return [];
    return filteredEvents.filter((e) => isWithinNext24Hours(e.start));
  }, [filteredEvents, filters.view]);

  const valueVisibility = useMemo(() => {
    const visibleEvents = filterVisibleEvents(events, {
      declinedIds: declinedEventIds,
      hiddenIds: hiddenEventIds,
    });

    const personalCount = visibleEvents.filter((e) => !e.group_id).length;
    const groupCount = visibleEvents.filter((e) => !!e.group_id).length;
    const next24h = visibleEvents.filter((e) => isWithinNext24Hours(e.start)).length;

    return {
      personalCount,
      groupCount,
      next24h,
      hasValue: visibleEvents.length > 0,
    };
  }, [events, declinedEventIds, hiddenEventIds]);

  const headerSubtitle = useMemo(() => {
    const visibleEvents = filterVisibleEvents(events, {
      declinedIds: declinedEventIds,
      hiddenIds: hiddenEventIds,
    });

    if (visibleEvents.length === 0) {
      return "Revisa tus planes personales y compartidos sin perder contexto.";
    }

    const personal = visibleEvents.filter((e) => !e.group_id).length;
    const groupEvents = visibleEvents.filter((e) => !!e.group_id).length;

    return `Tu lista combina ${personal} plan${
      personal === 1 ? "" : "es"
    } personales y ${groupEvents} compartido${groupEvents === 1 ? "" : "s"}. Filtra, revisa y decide sin perder contexto.`;
  }, [events, declinedEventIds, hiddenEventIds]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function refreshData() {
    try {
      setLoading(true);

      const [eventsRes, groupsRes, declinedRes] = await Promise.all([
        getMyEvents().catch((err) => {
          console.error("Error refrescando getMyEvents:", err);
          return [] as DbEventRow[];
        }),
        getMyGroups().catch((err) => {
          console.error("Error refrescando getMyGroups:", err);
          return [] as GroupRow[];
        }),
        getMyDeclinedEventIds().catch((err) => {
          console.error("Error refrescando getMyDeclinedEventIds:", err);
          return new Set<string>();
        }),
      ]);

      const groupsById = new Map(groupsRes.map((g) => [String(g.id), g]));

      const withGroup: EventWithGroup[] = eventsRes.map((e) => ({
        ...e,
        group: e.group_id ? groupsById.get(String(e.group_id)) ?? null : null,
      }));

      setEvents(withGroup);
      setGroups(groupsRes);
      setDeclinedEventIds(declinedRes);
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
        } de tu lista? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      setDeleting(true);

      const idsArray = Array.from(selectedIds);
      const result = await deleteEventsByIdsDetailed(idsArray);

      if (result.deletedCount > 0) {
        const removedIds = new Set(result.ownIds.map(String));

        setEvents((prev) =>
          prev.filter((event) => !removedIds.has(String(event.id)))
        );
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of removedIds) next.delete(id);
          return next;
        });
      }

      if (result.deletedCount > 0 && result.blockedIds.length > 0) {
        setToast({
          type: "success",
          message:
            `Se eliminaron ${result.deletedCount} evento${
              result.deletedCount === 1 ? "" : "s"
            }, pero ${result.blockedIds.length} no se pudo${
              result.blockedIds.length === 1 ? "" : "ieron"
            } borrar porque no te pertenece${
              result.blockedIds.length === 1 ? "" : "n"
            } o no está permitido.`,
        });
        return;
      }

      if (result.deletedCount > 0) {
        setToast({
          type: "success",
          message: `Se eliminaron ${result.deletedCount} evento${
            result.deletedCount === 1 ? "" : "s"
          } correctamente.`,
        });
        return;
      }

      throw new Error(
        "No se pudo eliminar la selección con tu sesión actual. Puede incluir eventos de otra persona o bloqueados por permisos."
      );
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

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={S.pageBg}>
        <Section>
          <PremiumHeader
            title="Eventos"
            subtitle="Revisa tus planes personales y compartidos sin perder contexto."
          />
          <Card style={S.cardShell}>
            <div style={S.loadingRow}>
              <div style={S.loadingDot} />
              <div>
                <div style={S.loadingTitle}>Cargando tus eventos…</div>
                <div style={S.loadingSub}>Preparando tu vista de coordinación</div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={1120} style={S.pageBg}>
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

      <Section>
        <PremiumHeader title="Eventos" subtitle={headerSubtitle} />

        <Card style={S.cardShell} className="spEvt-card">
          <div style={S.titleRow}>
            <div>
              <div style={S.kicker}>Tus planes, con contexto</div>
              <h1 style={S.h1}>Planes visibles</h1>
              <p style={S.sub}>
                Mira tus próximos planes personales y compartidos en un solo
                lugar. Desde aquí puedes editar, filtrar y limpiar sin perder
                claridad.
              </p>
            </div>

            <aside style={S.factBox} className="spEvt-factBox">
              <div style={S.factLabel}>Lectura rápida</div>
              <div style={S.factRow}>
                <span style={S.factDotPersonal} />
                <span>{valueVisibility.personalCount} personales</span>
              </div>
              <div style={S.factRow}>
                <span style={S.factDotGroup} />
                <span>{valueVisibility.groupCount} en grupos</span>
              </div>

              {totalGroups > 0 && (
                <div style={S.factHint}>
                  Tienes {totalGroups} grupo{totalGroups === 1 ? "" : "s"} alimentando esta coordinación.
                </div>
              )}
            </aside>
          </div>

          {valueVisibility.hasValue && (
            <div style={S.valueRail}>
              <div style={S.valueRailCopy}>
                <div style={S.valueRailEyebrow}>Claridad visible</div>
                <div style={S.valueRailTitle}>
                  Aquí ya se nota lo que SyncPlans está ordenando.
                </div>
                <div style={S.valueRailSub}>
                  {valueVisibility.personalCount} personal · {valueVisibility.groupCount} compartido
                  {valueVisibility.next24h > 0
                    ? ` · ${valueVisibility.next24h} requiere atención en las próximas 24 horas`
                    : " · sin urgencias inmediatas ahora mismo"}
                </div>
              </div>

              <div style={S.valueRailActions}>
                <button
                  type="button"
                  onClick={() =>
                    router.push(valueVisibility.next24h > 0 ? "/calendar" : "/summary")
                  }
                  style={S.valueRailBtn}
                >
                  {valueVisibility.next24h > 0 ? "Ver tiempo cercano" : "Volver al resumen"}
                </button>
              </div>
            </div>
          )}

          <EventsFiltersBar
            view={filters.view}
            scope={filters.scope}
            query={filters.query}
            onChangeView={(view) => setFilters((f) => ({ ...f, view }))}
            onChangeScope={(scope) => setFilters((f) => ({ ...f, scope }))}
            onChangeQuery={(query) => setFilters((f) => ({ ...f, query }))}
          />

          {events.length > 0 && (
            <button
              type="button"
              onClick={sendTodayDigest}
              disabled={sendingDigest}
              style={{ ...S.digestBtn, ...(sendingDigest ? S.digestBtnLoading : {}) }}
            >
              {sendingDigest ? "Enviando resumen de hoy…" : "Enviar resumen de hoy (demo)"}
            </button>
          )}

          {anySelected && (
            <div style={S.bulkBar}>
              <span style={S.bulkLabel}>
                {selectedIds.size} evento{selectedIds.size === 1 ? "" : "s"} seleccionado{selectedIds.size === 1 ? "" : "s"}
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

          {!loading && urgentEvents.length > 0 && (
            <div style={S.urgentBlock}>
              <div style={S.urgentHeader}>
                <div>
                  <div style={S.urgentKicker}>Foco operativo</div>
                  <div style={S.urgentTitle}>Requiere atención</div>
                </div>

                <div style={S.urgentCount}>
                  {urgentEvents.length} evento{urgentEvents.length === 1 ? "" : "s"}
                </div>
              </div>

              <div style={S.urgentList}>
                {urgentEvents.slice(0, 3).map((e) => (
                  <div key={String(e.id)} style={S.urgentItem}>
                    <div style={S.urgentItemMain}>
                      <div style={S.urgentNameRow}>
                        <span style={S.urgentName}>{e.title || "Sin título"}</span>
                        <span style={S.urgentWhen}>
                          {shortDateLabel(e.start)} · {shortTimeLabel(e.start)}
                        </span>
                      </div>

                      <div style={S.urgentMeta}>
                        {e.group?.name ? `En ${e.group.name}` : "Personal"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {urgentEvents.length > 3 && (
                <div style={S.urgentFooter}>+{urgentEvents.length - 3} más para revisar pronto</div>
              )}
            </div>
          )}

          {loading ? (
            <div style={S.loadingList}>
              <div style={S.loadingRow}>
                <div style={S.loadingDot} />
                <div>
                  <div style={S.loadingTitle}>Cargando eventos…</div>
                  <div style={S.loadingSub}>Un momento, por favor.</div>
                </div>
              </div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <EventsEmptyState
              onCreateFirstEvent={() => router.push("/events/new/details?type=personal")}
            />
          ) : (
            <EventsTimeline
              events={filteredEvents}
              selectedIds={selectedIds}
              focusedEventId={focusedEventId}
              onToggleSelected={toggleSelection}
              onEventsRemoved={(removedIds) => {
                const removed = new Set(removedIds.map(String));
                setEvents((prev) =>
                  prev.filter((event) => !removed.has(String(event.id)))
                );
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  for (const id of removed) next.delete(id);
                  return next;
                });
              }}
            />
          )}
        </Card>

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
      </Section>
    </MobileScaffold>
  );
}

const S: Record<string, React.CSSProperties> = {
  pageBg: {
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  cardShell: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
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
  valueRail: {
    marginBottom: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(52,211,153,0.22)",
    background:
      "linear-gradient(135deg, rgba(20,83,45,0.72), rgba(15,23,42,0.84))",
  },
  valueRailCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  valueRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(134,239,172,0.9)",
  },
  valueRailTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.98)",
  },
  valueRailSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(220,252,231,0.82)",
  },
  valueRailActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  valueRailBtn: {
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,0.24)",
    background: "rgba(34,197,94,0.18)",
    padding: "10px 14px",
    fontSize: 13,
    color: "rgba(255,255,255,0.96)",
    fontWeight: 900,
    cursor: "pointer",
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
  urgentBlock: {
    marginTop: 14,
    marginBottom: 2,
    borderRadius: 18,
    border: "1px solid rgba(248,113,113,0.30)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(239,68,68,0.22), transparent 58%), rgba(15,23,42,0.97)",
    padding: 12,
    boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
  },
  urgentHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  urgentKicker: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "rgba(254,202,202,0.9)",
  },
  urgentTitle: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 900,
    color: "rgba(255,245,245,1)",
  },
  urgentCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(254,226,226,0.92)",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(127,29,29,0.28)",
    padding: "6px 10px",
  },
  urgentList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  urgentItem: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    padding: "10px 11px",
  },
  urgentItemMain: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  urgentNameRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  urgentName: {
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.98)",
  },
  urgentWhen: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(252,165,165,0.95)",
  },
  urgentMeta: {
    fontSize: 11,
    color: "rgba(203,213,225,0.86)",
  },
  urgentFooter: {
    marginTop: 10,
    fontSize: 11,
    color: "rgba(254,226,226,0.82)",
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
    width: "100%",
    maxWidth: 900,
    margin: "16px auto 0",
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