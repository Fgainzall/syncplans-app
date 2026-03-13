"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUnreadConflictNotificationsSummary } from "@/lib/notificationsDb";
import supabase from "@/lib/supabaseClient";
import AppHero from "@/components/AppHero";
import MobileScaffold from "@/components/MobileScaffold";

import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getMyEvents } from "@/lib/eventsDb";

type Props = {
  highlightId: string | null;
  appliedToast: string | null;
};

type UiToast = { title: string; subtitle?: string } | null;

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

/** ✅ Solo Summary: detecta móvil por ancho (modo app iPhone entra aquí) */
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

/** 🕒 inicio de hoy en hora local (sin UTC raro) */
function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 📊 Estado emocional de la semana (solo 7 días) */
function getWeekMoodLabel(count: number): string {
  if (count === 0) return "Semana libre";
  if (count <= 3) return "Semana ligera";
  if (count <= 6) return "Semana activa";
  return "Semana movida";
}

function getWeekSubtitle(count: number): string {
  if (count === 0) return "No hay eventos en los próximos 7 días.";
  if (count === 1) return "1 evento en los próximos 7 días.";
  return `${count} eventos en los próximos 7 días.`;
}

export default function SummaryClient({ highlightId, appliedToast }: Props) {
  const router = useRouter();
  const isMobile = useIsMobileWidth(520);

  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

const [events, setEvents] = useState<any[]>([]);
const [loading, setLoading] = useState(false);

const [conflictAlert, setConflictAlert] = useState<{
  count: number;
  latestEventId: string | null;
}>({
  count: 0,
  latestEventId: null,
});

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
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
    return `Personal + ${activeLabel}`;
  }, [activeGroupId, activeLabel]);

  /**
   * ✅ FIX REAL DEL PROBLEMA 2
   *
   * Antes:
   * - si había grupo activo, Summary mostraba SOLO ese grupo
   * - dejaba fuera los personales
   *
   * Ahora:
   * - sin grupo activo → solo personales
   * - con grupo activo → personales + grupo activo
   *
   * Así queda alineado con la lógica esperada del producto.
   */
  const visibleEvents = useMemo(() => {
    const gid = activeGroupId ? String(activeGroupId) : null;

    return (events ?? [])
      .filter((e) => {
        const eg = (e as any)?.group_id ?? null;

        // Evento personal
        if (!eg) return true;

        // Evento de grupo: solo entra si coincide con el grupo activo
        if (!gid) return false;

        return String(eg) === gid;
      })
      .map((e) => {
        const startIso = (e as any)?.start ?? (e as any)?.start_at ?? null;
        const endIso = (e as any)?.end ?? (e as any)?.end_at ?? null;
        const start = safeDate(startIso);
        const end = safeDate(endIso);

        return {
          ...e,
          _start: start,
          _end: end,
          _title:
            (e as any)?.title ??
            (e as any)?.name ??
            (e as any)?.summary ??
            "Evento",
        };
      })
      .filter((e) => e._start)
      .sort(
        (a, b) => (a._start as Date).getTime() - (b._start as Date).getTime()
      );
  }, [events, activeGroupId]);

  /**
   * 🔵 Clave: próximos 7 días
   * Ventana: [hoy 00:00 local, hoy + 7 días) → NO entra el día 8
   */
  const upcomingAll = useMemo(() => {
    const today = startOfTodayLocal();
    const windowEnd = addDays(today, 7);

    const startMs = today.getTime();
    const endMs = windowEnd.getTime();

    return visibleEvents.filter((e) => {
      const start = e._start as Date;
      const t = start.getTime();
      return t >= startMs && t < endMs;
    });
  }, [visibleEvents]);

  const upcomingStats = useMemo(() => {
    let personal = 0;
    let group = 0;
    let external = 0;

    for (const e of upcomingAll) {
      const isExternal = !!(e as any)?.is_external;
      const hasGroup = !!(e as any)?.group_id;

      if (isExternal) {
        external += 1;
      } else if (hasGroup) {
        group += 1;
      } else {
        personal += 1;
      }
    }

    return {
      total: upcomingAll.length,
      personal,
      group,
      external,
    };
  }, [upcomingAll]);

  // ✅ En móvil mostramos menos para evitar scroll infinito
  const UPCOMING_LIMIT = isMobile ? 3 : 8;

  const upcoming = useMemo(
    () => upcomingAll.slice(0, UPCOMING_LIMIT),
    [upcomingAll, UPCOMING_LIMIT]
  );

  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;
  const remainingUpcoming =
    upcoming.length > 1 ? upcoming.slice(1) : ([] as any[]);

  const showSeeMore = !booting && upcomingAll.length > UPCOMING_LIMIT;

  /**
   * 🧠 Estado emocional de la semana
   * Basado SOLO en eventos de los próximos 7 días.
   */
  const mood = useMemo(() => {
    if (booting) {
      return {
        title: "Cargando tu resumen…",
        subtitle: "Revisando eventos y grupos activos.",
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
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) {
      router.replace("/auth/login");
      return null;
    }
    return data.session.user;
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

      const [es, conflictInfo] = await Promise.all([
  getMyEvents(),
  getUnreadConflictNotificationsSummary().catch(() => ({
    count: 0,
    latestEventId: null,
  })),
]);

setEvents(Array.isArray(es) ? es : []);
setConflictAlert(conflictInfo);
    } catch (e: any) {
      showToast(
        "No se pudo cargar el resumen",
        e?.message || "Intenta nuevamente."
      );
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
        if (appliedToast) showToast("Listo ✅", appliedToast);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ escucha cambio de grupo activo sin recargar
  useEffect(() => {
    const handler = () => loadSummary();
    window.addEventListener("sp:active-group-changed", handler as any);
    return () =>
      window.removeEventListener("sp:active-group-changed", handler as any);
  }, [loadSummary]);

  const title = activeGroupId
    ? `Resumen · Personal + ${activeLabel}`
    : "Resumen · Personal";

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
  return (
    <main style={styles.page} className="spSum-page">
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
        <div style={styles.shell} className="spSum-shell">
          <section style={styles.hero} className="spSum-hero">
            <div style={styles.heroLeft}>
         <AppHero
  title={title}
  subtitle={
    !isMobile
      ? "Una sola verdad sobre tu tiempo compartido. Cambia el grupo activo en Calendario y aquí se actualiza solo."
      : "Tu tiempo en un solo lugar. Se actualiza solo."
  }
/>
            </div>

            <div style={styles.heroBtns} className="spSum-heroBtns">
              <button
                onClick={() => router.push("/calendar")}
                style={styles.primaryBtn}
                className="spSum-btn"
              >
                Abrir Calendario →
              </button>
              <button
                onClick={() => router.push("/conflicts/detected")}
                style={styles.ghostBtn}
                className="spSum-btn"
              >
                Ver conflictos →
              </button>
            </div>
          </section>

          <section style={styles.card} className="spSum-card">
  {conflictAlert.count > 0 ? (
    <button
      onClick={openConflictCenter}
      style={styles.conflictBanner}
      className="spSum-conflictBanner"
    >
      <div style={styles.conflictBannerLeft}>
        <div style={styles.conflictBannerEyebrow}>Atención</div>
        <div style={styles.conflictBannerTitle}>
          Tienes {conflictAlert.count} conflicto
          {conflictAlert.count === 1 ? "" : "s"} pendiente
          {conflictAlert.count === 1 ? "" : "s"}
        </div>
        <div style={styles.conflictBannerSub}>
          No esperes a entrar manualmente a Conflictos. Revísalos ahora.
        </div>
      </div>

      <div style={styles.conflictBannerCta}>Resolver ahora →</div>
    </button>
  ) : null}

  <div
    style={{
      ...styles.stateRow,
                boxShadow: `0 0 32px ${moodAccentGlow}`,
                borderColor: moodAccentBorder,
              }}
            >
              <div style={styles.stateLeft}>
                <div style={styles.stateLabelRow}>
                  <span style={styles.statePill}>
                    Contexto: <b>{contextLabel}</b>
                  </span>
                  {loading && !booting ? (
                    <span style={styles.stateLoadingBadge}>Actualizando…</span>
                  ) : null}
                </div>
                <div style={styles.stateMoodTitle}>{mood.title}</div>
                <div style={styles.stateMoodSub}>{mood.subtitle}</div>

                <div style={styles.stateStatsRow}>
                  <span style={styles.stateStat}>
                    {upcomingStats.total} próximo
                    {upcomingStats.total === 1 ? "" : "s"}
                  </span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>
                    {upcomingStats.personal} personales
                  </span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>
                    {upcomingStats.group} en grupos
                  </span>
                  {upcomingStats.external > 0 ? (
                    <>
                      <span style={styles.stateStatDot}>·</span>
                      <span style={styles.stateStat}>
                        {upcomingStats.external} externos
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={styles.stateKpi}>
                <div style={styles.stateKpiLabel}>Próximos 7 días</div>
                <div style={styles.stateKpiNumber}>{upcomingStats.total}</div>
                <div style={styles.stateKpiHint}>
                  Solo cuenta esta semana, no el mes entero.
                </div>
              </div>
            </div>

            {booting ? (
              <div style={styles.loadingCard}>
                <div style={styles.loadingDot} />
                <div>
                  <div style={styles.loadingTitle}>Cargando resumen…</div>
                  <div style={styles.loadingSub}>Eventos y contexto</div>
                </div>
              </div>
            ) : !nextEvent ? (
              <div style={styles.emptyBlock}>
                <div style={styles.emptyTitle}>No hay nada por delante</div>
                <div style={styles.emptySub}>
                  En este contexto no tienes eventos en los próximos 7 días. Crea
                  uno nuevo desde Calendario o desde Eventos.
                </div>
                <button
                  onClick={() =>
                    router.push("/events/new/details?type=personal")
                  }
                  style={styles.emptyBtn}
                >
                  Crear primer evento →
                </button>
              </div>
            ) : (
              <>
                <div style={styles.nextBlock}>
                  <div style={styles.nextLabel}>Siguiente evento</div>
                  <button
                    onClick={() => router.push("/calendar")}
                    style={styles.nextCard}
                    className="spSum-eventRow"
                  >
                    {(() => {
                      const start = nextEvent._start as Date;
                      const end = nextEvent._end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      return (
                        <>
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>
                              {nextEvent._title}
                            </div>
                          </div>
                          <div style={styles.eventMeta}>
                            {(nextEvent as any)?.is_external ? (
                              <span style={styles.pill}>Externo</span>
                            ) : null}
                            {(nextEvent as any)?.group_id ? (
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
                    {remainingUpcoming.map((e: any) => {
                      const start = e._start as Date;
                      const end = e._end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      const isHighlighted =
                        highlightId &&
                        String((e as any)?.id ?? "") === String(highlightId);

                      return (
                        <button
                          key={
                            (e as any)?.id ??
                            `${e._title}-${start.toISOString()}`
                          }
                          onClick={() => router.push("/calendar")}
                          style={{
                            ...styles.eventRow,
                            ...(isHighlighted ? styles.eventRowHighlight : {}),
                          }}
                          className="spSum-eventRow"
                        >
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>{e._title}</div>
                          </div>

                          <div style={styles.eventMeta}>
                            {(e as any)?.is_external ? (
                              <span style={styles.pill}>Externo</span>
                            ) : null}
                            {(e as any)?.group_id ? (
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
                    Ver todos en Calendario ({upcomingAll.length}) →
                  </button>
                )}
              </>
            )}
          </section>

          <section style={styles.card} className="spSum-card">
            <div style={styles.sectionTitle}>Acciones rápidas</div>
            <div style={styles.smallNote}>
              Lo que más vas a usar cuando entras solo a “ver cómo están las
              cosas”.
            </div>
            <div style={styles.quickGrid} className="spSum-quickGrid">
              <button
                onClick={() => router.push("/events/new/details?type=personal")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Crear evento</div>
                <div style={styles.quickSub}>
                  Personal o para tu grupo activo, en segundos.
                </div>
              </button>

              <button
                onClick={() => router.push("/groups")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Ir a grupos</div>
                <div style={styles.quickSub}>
                  Invita, configura y revisa quién ve qué.
                </div>
              </button>

              <button
                onClick={() => router.push("/conflicts/detected")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>Resolver conflictos</div>
                <div style={styles.quickSub}>
                  Detectar → comparar → decidir sin pelear.
                </div>
              </button>
            </div>
          </section>
        </div>
      </MobileScaffold>

      <style>{`
        @media (max-width: 520px) {
          .spSum-shell {
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-top: 14px !important;
            gap: 12px !important;
          }

          .spSum-hero {
            border-radius: 20px !important;
            padding: 14px !important;
            gap: 12px !important;
          }

          .spSum-heroBtns {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .spSum-btn {
            width: 100% !important;
            min-height: 46px !important;
            justify-content: center !important;
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
    </main>
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
    gap: 14,
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
  hero: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 18px",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025))",
    boxShadow: "0 22px 70px rgba(0,0,0,0.34)",
    backdropFilter: "blur(16px)",
    flexWrap: "wrap",
  },
  heroLeft: {
    flex: 1,
    minWidth: 260,
  },
  heroBtns: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryBtn: {
    padding: "11px 14px",
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  ghostBtn: {
    padding: "11px 14px",
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(14px)",
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
    marginTop: 12,
    fontSize: 26,
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
    minWidth: 150,
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
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-1px",
    lineHeight: 1,
  },
  stateKpiHint: {
    marginTop: 6,
    fontSize: 11,
    opacity: 0.58,
    lineHeight: 1.35,
  },
  loadingCard: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 18px rgba(56,189,248,0.5)",
  },
  loadingTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  loadingSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.68,
  },
  emptyBlock: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.025)",
    padding: 18,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.45,
    maxWidth: 700,
  },
  emptyBtn: {
    marginTop: 12,
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  nextBlock: {
    marginTop: 16,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.7,
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  nextCard: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(124,58,237,0.08))",
    padding: "16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    cursor: "pointer",
    color: "inherit",
    textAlign: "left",
  },
  eventsList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  eventRow: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "13px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    cursor: "pointer",
    color: "inherit",
    textAlign: "left",
    transition: "all 160ms ease",
  },
  eventRowHighlight: {
    border: "1px solid rgba(56,189,248,0.42)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.22) inset",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(255,255,255,0.04))",
  },
  eventLeft: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  eventWhen: {
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.72,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(56,189,248,0.20)",
    background: "rgba(56,189,248,0.10)",
  },
  pillSoft: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    opacity: 0.92,
  },
  seeMoreBtn: {
    marginTop: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "-0.2px",
  },
  smallNote: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.68,
    lineHeight: 1.4,
  },
  quickGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  quickCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.03))",
    padding: 16,
    minHeight: 106,
    cursor: "pointer",
    color: "inherit",
    textAlign: "left",
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: "-0.2px",
  },
   quickSub: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.45,
  },

  conflictBanner: {
    width: "100%",
    marginBottom: 14,
    borderRadius: 18,
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
};