// src/app/summary/SummaryClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

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
  if (t === "other") return "Compartido";
  return "Grupo";
}

/** ✅ SOLO para Summary: detecta móvil por ancho (modo app iPhone entra aquí) */
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

export default function SummaryClient({ highlightId, appliedToast }: Props) {
  const router = useRouter();
  const isMobile = useIsMobileWidth(520);

  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<UiToast>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  const visibleEvents = useMemo(() => {
    const gid = activeGroupId;

    return (events ?? [])
      .filter((e) => {
        const eg = (e as any)?.group_id ?? null;
        if (gid) return String(eg ?? "") === String(gid);
        return !eg;
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

  const upcomingAll = useMemo(() => {
    const now = Date.now();
    return visibleEvents.filter((e) => (e._start as Date).getTime() >= now);
  }, [visibleEvents]);

  // ✅ CLAVE: en móvil mostramos menos para evitar scroll infinito
  const UPCOMING_LIMIT = isMobile ? 4 : 8;

  const upcoming = useMemo(() => {
    return upcomingAll.slice(0, UPCOMING_LIMIT);
  }, [upcomingAll, UPCOMING_LIMIT]);

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

      const es = await getMyEvents();
      setEvents(Array.isArray(es) ? es : []);
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
        if (appliedToast) {
          showToast("Listo ✅", appliedToast);
        }
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
    const handler = () => {
      loadSummary();
    };
    window.addEventListener("sp:active-group-changed", handler as any);
    return () =>
      window.removeEventListener("sp:active-group-changed", handler as any);
  }, [loadSummary]);

  const title = activeGroupId ? `Resumen · ${activeLabel}` : "Resumen · Personal";

  const showSeeMore = !booting && upcomingAll.length > UPCOMING_LIMIT;

  return (
    <main style={styles.page} className="spSum-page">
      {/* Toast */}
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

      <div style={styles.shell} className="spSum-shell">
        <div style={styles.topRow} className="spSum-topRow">
          <PremiumHeader />
          <div style={styles.topActions} className="spSum-topActions">
            <LogoutButton />
          </div>
        </div>

        {/* Hero compacto */}
        <section style={styles.hero} className="spSum-hero">
          <div>
            <div style={styles.kicker}>Tu resumen</div>
            <h1 style={styles.h1} className="spSum-h1">
              {title}
            </h1>
            {!isMobile && (
              <div style={styles.sub}>
                Vista rápida de lo importante. Si cambiaste el grupo activo en
                Calendario, aquí se actualiza solo (sin recargar).
              </div>
            )}
            {isMobile && (
              <div style={styles.subMobile}>
                Lo importante, rápido. Actualiza solo.
              </div>
            )}
          </div>

          <div style={styles.heroBtns} className="spSum-heroBtns">
            <button
              onClick={() => router.push("/calendar")}
              style={styles.primaryBtn}
              className="spSum-btn"
            >
              Calendario →
            </button>
            <button
              onClick={() => router.push("/conflicts/detected")}
              style={styles.ghostBtn}
              className="spSum-btn"
            >
              Conflictos →
            </button>
          </div>
        </section>

        {/* Próximos eventos */}
        <section style={styles.card} className="spSum-card">
          <div style={styles.sectionTitle}>Próximos eventos</div>
          <div style={styles.smallNote}>
            Mostrando: <b>{activeLabel}</b> ·{" "}
            {loading ? "Actualizando…" : `${upcoming.length} visibles`}
          </div>

          {booting ? (
            <div style={styles.loadingCard}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando resumen…</div>
                <div style={styles.loadingSub}>Eventos y contexto</div>
              </div>
            </div>
          ) : upcoming.length === 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              No hay eventos próximos para este contexto. Ve a Calendario para
              crear uno.
            </div>
          ) : (
            <>
              <div style={styles.eventsList} className="spSum-eventsList">
                {upcoming.map((e: any) => {
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
                      key={(e as any)?.id ?? `${e._title}-${start.toISOString()}`}
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

              {/* ✅ En móvil: botón “ver más” para evitar scroll eterno */}
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

        {/* Acciones rápidas */}
        <section style={styles.card} className="spSum-card">
          <div style={styles.sectionTitle}>Acciones rápidas</div>
          <div style={styles.quickGrid} className="spSum-quickGrid">
            <button
              onClick={() => router.push("/events/new/details")}
              style={styles.quickCard}
              className="spSum-quickCard"
            >
              <div style={styles.quickTitle}>Crear evento</div>
              <div style={styles.quickSub}>Personal o para tu grupo activo</div>
            </button>

            <button
              onClick={() => router.push("/groups")}
              style={styles.quickCard}
              className="spSum-quickCard"
            >
              <div style={styles.quickTitle}>Ir a grupos</div>
              <div style={styles.quickSub}>Invita, configura, revisa miembros</div>
            </button>

            <button
              onClick={() => router.push("/conflicts/detected")}
              style={styles.quickCard}
              className="spSum-quickCard"
            >
              <div style={styles.quickTitle}>Resolver choques</div>
              <div style={styles.quickSub}>Detectar → comparar → decidir</div>
            </button>
          </div>
        </section>
      </div>

      {/* ✅ SOLO Summary: responsive premium (NO toca otras páginas) */}
      <style>{`
        @media (max-width: 520px) {
          .spSum-shell { padding: 14px 12px 24px !important; }
          .spSum-topRow { gap: 10px !important; margin-bottom: 10px !important; }
          .spSum-topActions { width: 100% !important; justify-content: flex-end !important; }
          
          .spSum-hero { padding: 12px 12px !important; border-radius: 16px !important; }
          .spSum-h1 { font-size: 20px !important; letter-spacing: -0.4px !important; margin-top: 8px !important; }
          .spSum-heroBtns { width: 100% !important; }
          .spSum-btn { padding: 10px 12px !important; border-radius: 12px !important; flex: 1 1 auto !important; }

          .spSum-card { padding: 12px !important; border-radius: 16px !important; margin-top: 10px !important; }

          .spSum-eventRow { padding: 10px 10px !important; border-radius: 12px !important; }
          .spSum-eventsList { gap: 8px !important; }

          /* Acciones rápidas: 1 columna en iPhone para que no “crezca raro” */
          .spSum-quickGrid { grid-template-columns: 1fr !important; gap: 10px !important; }
          .spSum-quickCard { padding: 12px !important; border-radius: 14px !important; }

          .spSum-seeMore { width: 100% !important; }
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
    maxWidth: 980,
    margin: "0 auto",
    padding: "22px 18px 48px",
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
    maxWidth: 420,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  kicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
  },
  h1: { margin: "10px 0 0", fontSize: 26, letterSpacing: "-0.6px" },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },
  subMobile: { marginTop: 8, fontSize: 12, opacity: 0.75, maxWidth: 420 },

  heroBtns: { display: "flex", gap: 10, flexWrap: "wrap" },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72 },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  loadingCard: {
    marginTop: 12,
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

  eventsList: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  eventRow: {
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  eventRowHighlight: {
    border: "1px solid rgba(255,255,255,0.85)",
    boxShadow: "0 0 18px rgba(56,189,248,0.28)",
    background: "rgba(255,255,255,0.06)",
  },
  eventLeft: { display: "flex", flexDirection: "column", gap: 3 },
  eventWhen: { fontSize: 11, opacity: 0.75, fontWeight: 800 },
  eventTitle: { fontSize: 13, fontWeight: 950, letterSpacing: "-0.2px" },
  eventMeta: { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" },
  pill: {
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.55)",
    background: "rgba(56,189,248,0.12)",
    whiteSpace: "nowrap",
  },
  pillSoft: {
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(148,163,184,0.08)",
    opacity: 0.9,
    whiteSpace: "nowrap",
  },

  seeMoreBtn: {
    marginTop: 10,
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },

  quickGrid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  quickCard: {
    cursor: "pointer",
    textAlign: "left",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.02)",
    padding: 12,
  },
  quickTitle: { fontWeight: 950, fontSize: 13 },
  quickSub: { marginTop: 6, fontSize: 12, opacity: 0.75 },
};