
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
import { trackEventOnce, trackScreenView } from "@/lib/analytics";

import {
  getMyEvents,
  deleteEventsByIdsDetailed,
  type DbEventRow,
} from "@/lib/eventsDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getMyDeclinedEventIds } from "@/lib/eventResponsesDb";
import { filterVisibleEvents } from "@/lib/tempeventVisibility";
import { getMyProfile } from "@/lib/profilesDb";
import { hasPremiumAccess } from "@/lib/premium";

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

const MOBILE_BREAKPOINT = 768;
const MOBILE_INITIAL_VISIBLE = 8;
const MOBILE_LOAD_MORE_STEP = 8;

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
  const [isMobile, setIsMobile] = useState(false);
  const [mobileVisibleCount, setMobileVisibleCount] = useState(MOBILE_INITIAL_VISIBLE);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const focusedEventId = searchParams.get("focusEventId");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    void trackScreenView({
      screen: "events",
      metadata: {
        source: focusedEventId ? "focused_event" : "events_tab",
        focusedEventId: focusedEventId ?? null,
      },
    });
  }, [focusedEventId]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          router.replace("/auth/login");
          return;
        }

        const [eventsRes, groupsRes, declinedRes, profileRes] = await Promise.all([
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
          getMyProfile().catch((err) => {
            console.error("Error getMyProfile en /events:", err);
            return null;
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
        setHasPremium(hasPremiumAccess(profileRes));
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

  const timelineEvents = useMemo(() => {
    if (!isMobile) return filteredEvents;
    return filteredEvents.slice(0, mobileVisibleCount);
  }, [filteredEvents, isMobile, mobileVisibleCount]);

  const hasMoreTimelineEvents =
    isMobile && filteredEvents.length > timelineEvents.length;

  const statusSnapshot = useMemo(() => {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const visibleEvents = filterVisibleEvents(events, {
      declinedIds: declinedEventIds,
      hiddenIds: hiddenEventIds,
    });

    const nextCount = visibleEvents.filter((e) => new Date(e.start) >= now).length;
    const responseCount = visibleEvents.filter(
      (e) => !!e.group_id && new Date(e.start) >= now
    ).length;
    const resolvedCount = visibleEvents.filter((e) => new Date(e.end) < now).length;
    const soonCount = visibleEvents.filter((e) => {
      const start = new Date(e.start);
      return start >= now && start <= nextWeek;
    }).length;

    return { nextCount, responseCount, resolvedCount, soonCount };
  }, [events, declinedEventIds, hiddenEventIds]);

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

  const premiumContext = useMemo(() => {
    const sharedDensity = valueVisibility.groupCount;
    const next24h = valueVisibility.next24h;
    const hasSharedCoordination = totalGroups > 0 || sharedDensity > 0;

    if (hasPremium) return null;
    if (!valueVisibility.hasValue && totalGroups === 0) return null;

    const shouldShow =
      next24h > 0 ||
      statusSnapshot.soonCount >= 3 ||
      sharedDensity >= 2 ||
      totalGroups >= 1;

    if (!shouldShow) return null;

    if (next24h > 0) {
      return {
        variant: "urgency" as const,
        eyebrow: "Premium cuando más importa",
        title: "Cuando tu semana se aprieta, Premium te ayuda a ver antes dónde conviene entrar.",
        body:
          "Más claridad compartida, menos idas y vueltas y mejor contexto para decidir qué mover antes de que el ruido vuelva a aparecer.",
        cta: "Ver ventajas Premium",
      };
    }

    if (hasSharedCoordination) {
      return {
        variant: "shared" as const,
        eyebrow: "Más valor compartido",
        title: "Cuando más gente y más planes viven aquí, Premium empieza a sentirse lógico.",
        body:
          "Te ayuda a coordinar con más claridad, anticipar mejor y convertir actividad compartida en menos fricción real.",
        cta: "Explorar Premium",
      };
    }

    return {
      variant: "momentum" as const,
      eyebrow: "Más claridad operativa",
      title: "Ya estás usando SyncPlans de verdad. Premium lo vuelve todavía más claro.",
      body:
        "No cambia tu flujo free: lo mejora con más contexto, mejor lectura del tiempo compartido y decisiones más rápidas.",
      cta: "Conocer Premium",
    };
  }, [hasPremium, statusSnapshot.soonCount, totalGroups, valueVisibility]);

  useEffect(() => {
    if (!premiumContext) return;

    void trackEventOnce({
      event: "premium_viewed",
      scope: "local",
      onceKey: `events:premium_viewed:${premiumContext.variant}:${focusedEventId ?? "all"}`,
      metadata: {
        source: "events",
        variant: premiumContext.variant,
        focusedEventId: focusedEventId ?? null,
        totalGroups,
        sharedGroupCount: valueVisibility.groupCount,
        next24hCount: valueVisibility.next24h,
        upcomingCount: statusSnapshot.soonCount,
      },
    });
  }, [
    premiumContext,
    focusedEventId,
    totalGroups,
    valueVisibility.groupCount,
    valueVisibility.next24h,
    statusSnapshot.soonCount,
  ]);

  const headerSubtitle = useMemo(() => {
    const visibleEvents = filterVisibleEvents(events, {
      declinedIds: declinedEventIds,
      hiddenIds: hiddenEventIds,
    });

    if (visibleEvents.length === 0) {
      return "Mira qué parte de tu coordinación ya tiene forma, qué necesita respuesta y qué conviene mover antes de que vuelva a perderse.";
    }

    const personal = visibleEvents.filter((e) => !e.group_id).length;
    const groupEvents = visibleEvents.filter((e) => !!e.group_id).length;

    return `Tu lista combina ${personal} evento${
      personal === 1 ? "" : "s"
    } personales y ${groupEvents} en grupos. Desde aquí se ve qué ya está claro, qué todavía necesita respuesta y qué merece seguimiento.`;
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

  useEffect(() => {
    setMobileVisibleCount(MOBILE_INITIAL_VISIBLE);
  }, [filters.view, filters.scope, filters.query]);

  const anySelected = selectedIds.size > 0;
  const compactHeaderSubtitle = isMobile
    ? events.length === 0
      ? "Ve rápido qué sigue y dónde conviene entrar."
      : `${filteredEvents.length} evento${filteredEvents.length === 1 ? "" : "s"} visibles para decidir más rápido.`
    : headerSubtitle;

  const showTopNarrative = !isMobile && urgentEvents.length === 0;
  const showDigestButton = !isMobile && events.length > 0 && !anySelected;
  const showValueRail =
    !isMobile &&
    valueVisibility.hasValue &&
    urgentEvents.length === 0 &&
    !premiumContext;
  const showPremiumRail =
    !isMobile &&
    !!premiumContext &&
    urgentEvents.length === 0;

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={S.pageBg}>
        <Section>
          <PremiumHeader
            hideUpgradeCta
            title="Eventos"
            subtitle="Mira qué ya está claro dentro del sistema y qué todavía necesita respuesta para no quedarse afuera."
          />
          <Card style={S.cardShell}>
            <div style={S.loadingRow}>
              <div style={S.loadingDot} />
              <div>
                <div style={S.loadingTitle}>Cargando tus eventos…</div>
                <div style={S.loadingSub}>Preparando tu lista para hoy</div>
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
        <div style={S.toastViewport}>
          <div
            style={{
              ...S.toastPill,
              background:
                toast.type === "success"
                  ? "rgba(34,197,94,0.95)"
                  : "rgba(248,113,113,0.95)",
            }}
          >
            {toast.message}
          </div>
        </div>
      )}

      <Section>
        <PremiumHeader hideUpgradeCta title="Eventos" subtitle={compactHeaderSubtitle} />

        <Card style={S.cardShell} className="spEvt-card">
          <div style={S.titleRow}>
            <div style={S.heroCopy}>
              <div style={S.kicker}>Lo que ya está dentro del sistema</div>
              <h1 style={S.h1}>Eventos con estado real</h1>
              {showTopNarrative ? (
                <p style={S.sub}>
                  Aquí ves qué está próximo, qué depende de otra persona y dónde conviene entrar
                  primero para mover coordinación real.
                </p>
              ) : null}
            </div>

            <aside style={S.factBox} className="spEvt-factBox">
              <div style={S.factLabel}>Resumen rápido</div>
              <div style={S.factGrid}>
                <div style={S.factItem}>
                  <span style={S.factDotPersonal} />
                  <span>{valueVisibility.personalCount} personales</span>
                </div>
                <div style={S.factItem}>
                  <span style={S.factDotGroup} />
                  <span>{valueVisibility.groupCount} en grupos</span>
                </div>
              </div>
              {!isMobile && totalGroups > 0 ? (
                <div style={S.factHint}>
                  {totalGroups} grupo{totalGroups === 1 ? "" : "s"} conectado{totalGroups === 1 ? "" : "s"}.
                </div>
              ) : null}
            </aside>
          </div>

          {!loading && urgentEvents.length > 0 ? (
            <div style={S.focusRail}>
              <div style={S.focusHeader}>
                <div>
                  <div style={S.focusEyebrow}>Foco operativo</div>
                  <div style={S.focusTitle}>Lo que pide movimiento ahora</div>
                </div>
                <div style={S.focusCount}>
                  {urgentEvents.length} evento{urgentEvents.length === 1 ? "" : "s"}
                </div>
              </div>

              <div style={S.focusList}>
                {urgentEvents.slice(0, isMobile ? 2 : 3).map((e) => (
                  <button
                    key={String(e.id)}
                    type="button"
                    style={S.focusItem}
                    onClick={() =>
                      router.push(`/events?focusEventId=${encodeURIComponent(String(e.id))}`)
                    }
                  >
                    <div style={S.focusItemMain}>
                      <div style={S.focusName}>{e.title || "Sin título"}</div>
                      <div style={S.focusMeta}>
                        {shortDateLabel(e.start)} · {shortTimeLabel(e.start)}
                        {e.group?.name ? ` · ${e.group.name}` : " · Personal"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showValueRail ? (
            <div style={S.secondaryRail}>
              <div>
                <div style={S.secondaryEyebrow}>Lectura rápida</div>
                <div style={S.secondaryTitle}>Tu lista ya tiene contexto útil.</div>
                <div style={S.secondarySub}>
                  {valueVisibility.personalCount} personales · {valueVisibility.groupCount} compartidos · {statusSnapshot.soonCount} por revisar pronto.
                </div>
              </div>
            </div>
          ) : null}

          {showPremiumRail && premiumContext ? (
            <div style={S.premiumRail}>
              <div style={S.premiumCopy}>
                <div style={S.premiumEyebrow}>{premiumContext.eyebrow}</div>
                <div style={S.premiumTitle}>{premiumContext.title}</div>
                <div style={S.premiumSub}>{premiumContext.body}</div>
              </div>
              <button
                type="button"
                style={S.premiumBtn}
                onClick={() => router.push("/planes")}
              >
                {premiumContext.cta}
              </button>
            </div>
          ) : null}

          <div style={S.statusGrid}>
            <button
              type="button"
              style={{ ...S.statusCard, ...(filters.view === "upcoming" ? S.statusCardActive : {}) }}
              onClick={() => setFilters((f) => ({ ...f, view: "upcoming" }))}
            >
              <div style={S.statusLabel}>Próximos</div>
              <div style={S.statusValue}>{statusSnapshot.nextCount}</div>
              {!isMobile ? <div style={S.statusHint}>Lo que sigue dentro del sistema</div> : null}
            </button>

            <button
              type="button"
              style={{ ...S.statusCard, ...(filters.scope === "groups" ? S.statusCardActive : {}) }}
              onClick={() => setFilters((f) => ({ ...f, scope: f.scope === "groups" ? "all" : "groups" }))}
            >
              <div style={S.statusLabel}>Compartidos</div>
              <div style={S.statusValue}>{statusSnapshot.responseCount}</div>
              {!isMobile ? <div style={S.statusHint}>Planes donde coordinar con alguien más importa</div> : null}
            </button>

            <button
              type="button"
              style={{ ...S.statusCard, ...(filters.view === "history" ? S.statusCardActive : {}) }}
              onClick={() => setFilters((f) => ({ ...f, view: "history" }))}
            >
              <div style={S.statusLabel}>Resueltos</div>
              <div style={S.statusValue}>{statusSnapshot.resolvedCount}</div>
              {!isMobile ? <div style={S.statusHint}>Eventos que ya pasaron y dejaron salida clara</div> : null}
            </button>

            <button
              type="button"
              style={S.statusCard}
              onClick={() => setFilters((f) => ({ ...f, view: "upcoming" }))}
            >
              <div style={S.statusLabel}>7 días</div>
              <div style={S.statusValue}>{statusSnapshot.soonCount}</div>
              {!isMobile ? <div style={S.statusHint}>Lo que conviene revisar pronto</div> : null}
            </button>
          </div>

          <EventsFiltersBar
            view={filters.view}
            scope={filters.scope}
            query={filters.query}
            onChangeView={(view) => setFilters((f) => ({ ...f, view }))}
            onChangeScope={(scope) => setFilters((f) => ({ ...f, scope }))}
            onChangeQuery={(query) => setFilters((f) => ({ ...f, query }))}
          />

          {showDigestButton ? (
            <div style={S.auxRow}>
              <button
                type="button"
                onClick={sendTodayDigest}
                disabled={sendingDigest}
                style={{ ...S.digestBtn, ...(sendingDigest ? S.digestBtnLoading : {}) }}
              >
                {sendingDigest ? "Preparando resumen de hoy…" : "Enviar resumen operativo de hoy (demo)"}
              </button>
            </div>
          ) : null}

          {anySelected ? (
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
          ) : null}

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
            <>
              <EventsTimeline
                events={timelineEvents}
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

              {hasMoreTimelineEvents ? (
                <div style={S.mobileLoadMoreWrap}>
                  <button
                    type="button"
                    onClick={() =>
                      setMobileVisibleCount((current) => current + MOBILE_LOAD_MORE_STEP)
                    }
                    style={S.mobileLoadMoreBtn}
                  >
                    Ver {Math.min(MOBILE_LOAD_MORE_STEP, filteredEvents.length - timelineEvents.length)} más
                  </button>
                  <div style={S.mobileLoadMoreHint}>
                    Mostrando {timelineEvents.length} de {filteredEvents.length} eventos
                  </div>
                </div>
              ) : null}
            </>
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

      <style jsx>{`
        @media (max-width: 767px) {
          .spEvt-card {
            padding: 14px !important;
          }

          .spEvt-factBox {
            min-width: 100% !important;
            max-width: none !important;
            padding: 12px !important;
          }
        }
      `}</style>
    </MobileScaffold>
  );
}

const S: Record<string, React.CSSProperties> = {
  pageBg: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 620px at 20% -10%, rgba(56,189,248,0.14), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(124,58,237,0.12), transparent 58%), #050816",
  },
  cardShell: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,15,30,0.76)",
    backdropFilter: "blur(16px)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
    padding: 18,
  },
  toastViewport: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 80,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: 30,
  },
  toastPill: {
    pointerEvents: "auto",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    color: "white",
    boxShadow: "0 18px 40px rgba(0,0,0,0.65)",
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  heroCopy: {
    minWidth: 0,
    flex: "1 1 520px",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
  },
  h1: {
    margin: "8px 0 0",
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.03,
    letterSpacing: "-0.04em",
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  sub: {
    margin: "10px 0 0",
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.76)",
    fontWeight: 600,
  },
  factBox: {
    minWidth: 240,
    maxWidth: 280,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  factLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.66)",
  },
  factGrid: {
    display: "grid",
    gap: 8,
  },
  factItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
    color: "rgba(255,255,255,0.92)",
  },
  factDotPersonal: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(251,191,36,0.95)",
    boxShadow: "0 0 0 5px rgba(251,191,36,0.12)",
  },
  factDotGroup: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 0 5px rgba(56,189,248,0.12)",
  },
  factHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 600,
  },
  focusRail: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px solid rgba(251,191,36,0.22)",
    background:
      "linear-gradient(135deg, rgba(120,53,15,0.42), rgba(30,41,59,0.62))",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  focusHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  focusEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(253,224,71,0.92)",
  },
  focusTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: 900,
    color: "rgba(255,255,255,0.97)",
  },
  focusCount: {
    borderRadius: 999,
    padding: "8px 10px",
    background: "rgba(251,191,36,0.16)",
    border: "1px solid rgba(251,191,36,0.20)",
    color: "rgba(254,243,199,0.98)",
    fontSize: 12,
    fontWeight: 900,
  },
  focusList: {
    display: "grid",
    gap: 8,
  },
  focusItem: {
    display: "flex",
    width: "100%",
    textAlign: "left",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 13px",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
  },
  focusItemMain: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  focusName: {
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
  },
  focusMeta: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.72)",
    fontWeight: 700,
  },
  secondaryRail: {
    marginTop: 14,
    borderRadius: 18,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(8,47,73,0.34)",
    padding: "14px 15px",
  },
  secondaryEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
  },
  secondaryTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: 900,
    color: "rgba(255,255,255,0.97)",
  },
  secondarySub: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.74)",
    fontWeight: 600,
  },
  premiumRail: {
    marginTop: 14,
    borderRadius: 18,
    border: "1px solid rgba(196,181,253,0.24)",
    background:
      "linear-gradient(135deg, rgba(76,29,149,0.72), rgba(15,23,42,0.88))",
    padding: "14px 15px",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },
  premiumCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  premiumEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(233,213,255,0.92)",
  },
  premiumTitle: {
    fontSize: 16,
    lineHeight: 1.3,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
  },
  premiumSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(243,232,255,0.84)",
    fontWeight: 600,
  },
  premiumBtn: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(216,180,254,0.34)",
    background: "rgba(168,85,247,0.24)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  statusGrid: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  statusCard: {
    display: "grid",
    gap: 6,
    textAlign: "left",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "14px 14px",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    minHeight: 92,
  },
  statusCardActive: {
    border: "1px solid rgba(56,189,248,0.32)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.18) inset",
    background: "rgba(56,189,248,0.08)",
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.74)",
  },
  statusValue: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  statusHint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.64)",
    fontWeight: 600,
  },
  auxRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "flex-start",
  },
  digestBtn: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  },
  digestBtnLoading: {
    opacity: 0.7,
    cursor: "wait",
  },
  bulkBar: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.16)",
    background: "rgba(127,29,29,0.24)",
    padding: "12px 14px",
  },
  bulkLabel: {
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(254,226,226,0.95)",
  },
  bulkDelete: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(252,165,165,0.22)",
    background: "rgba(248,113,113,0.18)",
    color: "rgba(255,255,255,0.98)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  },
  loadingList: {
    marginTop: 14,
  },
  loadingRow: {
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
    color: "rgba(255,255,255,0.96)",
  },
  loadingSub: {
    fontSize: 12,
    color: "rgba(226,232,240,0.66)",
    marginTop: 2,
    fontWeight: 600,
  },
  mobileLoadMoreWrap: {
    marginTop: 14,
    display: "grid",
    justifyItems: "center",
    gap: 8,
  },
  mobileLoadMoreBtn: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  mobileLoadMoreHint: {
    fontSize: 12,
    color: "rgba(226,232,240,0.64)",
    fontWeight: 600,
  },
  footerSection: {
    display: "flex",
    justifyContent: "center",
    marginTop: 14,
    paddingBottom: 8,
  },
  refreshBtn: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
};