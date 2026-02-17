// src/app/summary/SummaryClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

// OJO: no sabemos tu API exacta de eventsDb en este chat.
// Intentamos usar getMyEvents si existe (es lo más estándar en tu repo).
// Si tu eventsDb no exporta getMyEvents, en el siguiente mensaje me pegas eventsDb.ts y lo alineo 1:1.
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

export default function SummaryClient({ highlightId, appliedToast }: Props) {
  const router = useRouter();

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
    // Heurística flexible (porque tu schema exacto no está en este chat):
    // - Si hay activeGroupId: mostramos eventos con group_id === activeGroupId
    // - Si no: mostramos eventos sin group_id (personales)
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
      .filter((e) => e._start) // solo los que tienen start parseable
      .sort((a, b) => (a._start as Date).getTime() - (b._start as Date).getTime());
  }, [events, activeGroupId]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return visibleEvents.filter((e) => (e._start as Date).getTime() >= now).slice(0, 8);
  }, [visibleEvents]);

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

      // 1) Cargar grupos (para label + sanity del active group)
      const gs = await getMyGroups();
      setGroups(gs);

      // 2) Leer active group id (DB/local fallback vive en activeGroup.ts)
      const activeId = await getActiveGroupIdFromDb().catch(() => null);

      const validActive =
        activeId && gs.some((g) => String(g.id) === String(activeId))
          ? String(activeId)
          : null;

      setActiveGroupId(validActive);

      // 3) Cargar eventos (tu eventsDb decide qué significa “mis eventos”)
      // Si tu getMyEvents ya mezcla personales + grupos, perfecto.
      // Si no, luego lo alineamos en eventsDb.ts (TANDA 3/3).
      const es = await getMyEvents();
      setEvents(Array.isArray(es) ? es : []);
    } catch (e: any) {
      showToast("No se pudo cargar el resumen", e?.message || "Intenta nuevamente.");
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

  // ✅ FIX CLAVE: si cambia el grupo activo en otra pantalla, Summary se entera y refresca
  useEffect(() => {
    const handler = () => {
      loadSummary();
    };
    window.addEventListener("sp:active-group-changed", handler as any);
    return () => window.removeEventListener("sp:active-group-changed", handler as any);
  }, [loadSummary]);

  const title = activeGroupId ? `Resumen · ${activeLabel}` : "Resumen · Personal";

  return (
    <main style={styles.page}>
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
          <PremiumHeader />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <div style={styles.kicker}>Tu resumen</div>
            <h1 style={styles.h1}>{title}</h1>
            <div style={styles.sub}>
              Vista rápida de lo importante. Si cambiaste el grupo activo en Calendario,
              aquí se actualiza solo (sin recargar).
            </div>
          </div>

          <div style={styles.heroBtns}>
            <button onClick={() => router.push("/calendar")} style={styles.primaryBtn}>
              Ir al calendario →
            </button>
            <button onClick={() => router.push("/conflicts/detected")} style={styles.ghostBtn}>
              Ver conflictos →
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Próximos eventos</div>
          <div style={styles.smallNote}>
            Mostrando: <b>{activeLabel}</b> · {loading ? "Actualizando…" : `${upcoming.length} visibles`}
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
              No hay eventos próximos para este contexto. Ve a Calendario para crear uno.
            </div>
          ) : (
            <div style={styles.eventsList}>
              {upcoming.map((e: any) => {
                const start = e._start as Date;
                const end = e._end as Date | null;
                const when = end ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}` : `${fmtDay(start)} · ${fmtTime(start)}`;
                const isHighlighted =
                  highlightId && String((e as any)?.id ?? "") === String(highlightId);

                return (
                  <button
                    key={(e as any)?.id ?? `${e._title}-${start.toISOString()}`}
                    onClick={() => router.push("/calendar")}
                    style={{
                      ...styles.eventRow,
                      ...(isHighlighted ? styles.eventRowHighlight : {}),
                    }}
                  >
                    <div style={styles.eventLeft}>
                      <div style={styles.eventWhen}>{when}</div>
                      <div style={styles.eventTitle}>{e._title}</div>
                    </div>
                    <div style={styles.eventMeta}>
                      {(e as any)?.is_external ? (
                        <span style={styles.pill}>Externo</span>
                      ) : null}
                      {(e as any)?.group_id ? <span style={styles.pillSoft}>Grupo</span> : <span style={styles.pillSoft}>Personal</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Acciones rápidas</div>
          <div style={styles.quickGrid}>
            <button onClick={() => router.push("/events/new/details")} style={styles.quickCard}>
              <div style={styles.quickTitle}>Crear evento</div>
              <div style={styles.quickSub}>Personal o para tu grupo activo</div>
            </button>

            <button onClick={() => router.push("/groups")} style={styles.quickCard}>
              <div style={styles.quickTitle}>Ir a grupos</div>
              <div style={styles.quickSub}>Invita, configura, revisa miembros</div>
            </button>

            <button onClick={() => router.push("/conflicts/detected")} style={styles.quickCard}>
              <div style={styles.quickTitle}>Resolver choques</div>
              <div style={styles.quickSub}>Detectar → comparar → decidir</div>
            </button>
          </div>
        </section>
      </div>
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
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
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
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
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