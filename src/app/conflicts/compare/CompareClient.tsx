// src/app/conflicts/compare/CompareClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  CalendarEvent,
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  attachEvents,
  conflictResolutionLabel,
  conflictResolutionHint,
} from "@/lib/conflicts";

import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  Resolution,
  getMyConflictResolutionsMap,
  upsertConflictResolution,
} from "@/lib/conflictResolutionsDb";

/* =========================
   Helpers
   ========================= */

type AttachedConflict = {
  id: string;
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;
  existingEvent?: CalendarEvent;
  incomingEvent?: CalendarEvent;
};

function prettyTimeRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hhmm = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(
      2,
      "0"
    )}`;

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (!sameDay)
    return `${s.toLocaleDateString()} ${hhmm(s)} → ${e.toLocaleDateString()} ${hhmm(
      e
    )}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}

function safeNumber(x: string | null, fallback = 0) {
  const n = Number(x ?? "");
  return Number.isFinite(n) ? n : fallback;
}

export default function CompareClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const groupIdFromUrl = sp.get("groupId");
  const iFromUrl = safeNumber(sp.get("i"), 0);
  const eventIdFromUrl = sp.get("eventId");

  const [booting, setBooting] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );

  const cardARef = useRef<HTMLDivElement | null>(null);
  const cardBRef = useRef<HTMLDivElement | null>(null);

  /* =========================
     Toast auto-hide
     ========================= */

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  /* =========================
     Boot
     ========================= */

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
        const { events: ev } = await loadEventsFromDb({
          groupId: groupIdFromUrl,
        });
        if (!alive) return;
        setEvents(Array.isArray(ev) ? ev : []);
      } catch {
        if (!alive) return;
        setEvents([]);
      }

      try {
        const dbMap = await getMyConflictResolutionsMap();
        if (!alive) return;
        setResMap(dbMap ?? {});
      } catch {
        if (!alive) return;
        setResMap({});
      }

      setBooting(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, groupIdFromUrl]);

  /* =========================
     Conflicts
     ========================= */

  const conflicts = useMemo<AttachedConflict[]>(() => {
    const cx = computeVisibleConflicts(events);
    return attachEvents(cx, events) as unknown as AttachedConflict[];
  }, [events]);

  useEffect(() => {
    if (conflicts.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (eventIdFromUrl) {
      const idx = conflicts.findIndex((c) => {
        const a = c.existingEvent;
        const b = c.incomingEvent;
        return a?.id === eventIdFromUrl || b?.id === eventIdFromUrl;
      });
      if (idx >= 0) {
        setActiveIndex(idx);
        return;
      }
    }

    const clamped = Math.min(Math.max(iFromUrl, 0), conflicts.length - 1);
    setActiveIndex(clamped);
  }, [conflicts, eventIdFromUrl, iFromUrl]);

  const safeIndex = useMemo(() => {
    if (conflicts.length === 0) return 0;
    return Math.min(Math.max(activeIndex, 0), conflicts.length - 1);
  }, [activeIndex, conflicts.length]);

  const c = conflicts[safeIndex];
  const a = c?.existingEvent;
  const b = c?.incomingEvent;

  const aMeta = groupMeta((a?.groupType ?? "personal") as GroupType);
  const bMeta = groupMeta((b?.groupType ?? "personal") as GroupType);

  const conflictId = c?.id ?? "";
  const chosen: Resolution | undefined = conflictId ? resMap[conflictId] : undefined;

  /* =========================
     Focus (evento origen)
     ========================= */

  const targetSide = useMemo<"A" | "B" | null>(() => {
    if (!eventIdFromUrl) return null;
    if (a?.id && a.id === eventIdFromUrl) return "A";
    if (b?.id && b.id === eventIdFromUrl) return "B";
    return null;
  }, [eventIdFromUrl, a?.id, b?.id]);

  useEffect(() => {
    if (!targetSide) return;
    const el = targetSide === "A" ? cardARef.current : cardBRef.current;
    if (!el) return;

    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => window.clearTimeout(t);
  }, [targetSide, safeIndex]);

  /* =========================
     Actions
     ========================= */
const setChoice = async (r: Resolution) => {
  if (!c || !conflictId) return;

  // optimistic update
  setResMap((prev) => ({ ...prev, [conflictId]: r }));

  try {
    await upsertConflictResolution(conflictId, r);

    // Opcional: refetch para confirmar (muy útil en debug)
    // const fresh = await getMyConflictResolutionsMap();
    // setResMap(fresh ?? {});

    setToast({ title: "Decisión guardada", sub: conflictResolutionHint(r) });
  } catch (e: any) {
    // rollback: deja pendiente si no se guardó
    setResMap((prev) => {
      const next = { ...prev };
      delete next[conflictId];
      return next;
    });

    setToast({
      title: "No se pudo guardar",
      sub:
        typeof e?.message === "string"
          ? e.message
          : "Revisa RLS/constraints y vuelve a intentar.",
    });
  }
};

  const go = (idx: number) => {
    const qp = new URLSearchParams();
    qp.set("i", String(idx));
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (eventIdFromUrl) qp.set("eventId", eventIdFromUrl);
    router.replace(`/conflicts/compare?${qp.toString()}`);
  };

  const prev = () => go(Math.max(0, safeIndex - 1));
  const next = () => go(Math.min(conflicts.length - 1, safeIndex + 1));

  const goList = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (eventIdFromUrl) qp.set("eventId", eventIdFromUrl);
    router.push(`/conflicts/detected?${qp.toString()}`);
  };

  const goApply = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/actions?${qp.toString()}`);
  };

  /* =========================
     Loading / empty
     ========================= */

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando comparación…</div>
              <div style={styles.loadingSub}>Un segundo</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!c) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No hay conflictos</div>
            <div style={styles.emptySub}>
              Vuelve al calendario y crea/edita eventos para generar choques.
            </div>
            <button
              onClick={() => router.push("/calendar")}
              style={styles.primaryBtnWide}
            >
              Ir al calendario
            </button>
          </section>
        </div>
      </main>
    );
  }

  /* =========================
     UI
     ========================= */

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <button onClick={goList} style={styles.ghostBtn}>
              ← Lista
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Comparar</div>
            <h1 style={styles.h1}>
              Conflicto {safeIndex + 1} de {conflicts.length}
            </h1>
            <div style={styles.sub}>
              Elige una opción. Luego podrás aplicar todos los cambios juntos.
            </div>
          </div>

          <div style={styles.heroRight}>
            <button onClick={prev} style={styles.iconBtn} aria-label="Anterior">
              ‹
            </button>
            <button onClick={next} style={styles.iconBtn} aria-label="Siguiente">
              ›
            </button>
          </div>
        </section>

        <section style={styles.compareGrid}>
          {/* EVENTO A */}
          <div
            ref={cardARef}
            style={{
              ...styles.card,
              ...(targetSide === "A" ? styles.cardFocus : {}),
            }}
          >
            <div style={styles.cardTop}>
              <span style={styles.badgeA}>Evento A</span>
              <span style={styles.pill}>
                <span style={{ ...styles.pillDot, background: aMeta.dot }} />
                {aMeta.label}
              </span>
            </div>

            <div style={styles.title}>{a?.title || "Evento A"}</div>
            <div style={styles.time}>
              {a ? prettyTimeRange(a.start, a.end) : ""}
            </div>
          </div>

          {/* EVENTO B */}
          <div
            ref={cardBRef}
            style={{
              ...styles.card,
              ...(targetSide === "B" ? styles.cardFocus : {}),
            }}
          >
            <div style={styles.cardTop}>
              <span style={styles.badgeB}>Evento B</span>
              <span style={styles.pill}>
                <span style={{ ...styles.pillDot, background: bMeta.dot }} />
                {bMeta.label}
              </span>
            </div>

            <div style={styles.title}>{b?.title || "Evento B"}</div>
            <div style={styles.time}>
              {b ? prettyTimeRange(b.start, b.end) : ""}
            </div>
          </div>
        </section>

        <section style={styles.actionsCard}>
          <div style={styles.actionsTop}>
            <div style={styles.actionsTitle}>Tu decisión</div>
            <div style={styles.actionsSub}>
              Estado actual: <b>{conflictResolutionLabel(chosen)}</b>
            </div>
          </div>

          <div style={styles.actionBtns}>
            <button
              onClick={() => setChoice("keep_existing")}
              style={{
                ...styles.actionBtn,
                ...(chosen === "keep_existing" ? styles.actionOn : {}),
              }}
            >
              ✅ Conservar A
              <div style={styles.actionHint}>Eliminar evento B</div>
            </button>

            <button
              onClick={() => setChoice("replace_with_new")}
              style={{
                ...styles.actionBtn,
                ...(chosen === "replace_with_new" ? styles.actionOn : {}),
              }}
            >
              ⭐ Conservar B
              <div style={styles.actionHint}>Eliminar evento A</div>
            </button>

            <button
              onClick={() => setChoice("none")}
              style={{
                ...styles.actionBtn,
                ...(chosen === "none" ? styles.actionOn : {}),
              }}
            >
              💤 Mantener ambos
              <div style={styles.actionHint}>Ignorar este conflicto</div>
            </button>
          </div>

          <div style={styles.bottomRow}>
            <button onClick={goList} style={styles.ghostBtnWide}>
              Volver a la lista
            </button>
            <button onClick={goApply} style={styles.primaryBtnWide}>
              Aplicar cambios
            </button>
          </div>
        </section>

        {toast && (
          <div style={styles.toast}>
            <div style={styles.toastT}>{toast.title}</div>
            {toast.sub && <div style={styles.toastS}>{toast.sub}</div>}
          </div>
        )}
      </div>
    </main>
  );
}

/* =========================
   Styles
   ========================= */

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: { display: "flex", gap: 10, alignItems: "center" },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  heroLeft: { display: "flex", flexDirection: "column", gap: 6 },
  heroRight: { display: "flex", gap: 10, alignItems: "center" },
  kicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    fontWeight: 900,
  },
  h1: { margin: 0, fontSize: 26, letterSpacing: "-0.6px" },
  sub: { fontSize: 13, opacity: 0.75 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 20,
    fontWeight: 900,
  },
  compareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  card: {
    position: "relative",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  cardFocus: {
    border: "1px solid rgba(255,255,255,0.16)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    boxShadow:
      "0 16px 48px rgba(0,0,0,0.35), 0 0 0 3px rgba(56,189,248,0.10)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  badgeA: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.3)",
    background: "rgba(250,204,21,0.1)",
  },
  badgeB: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.3)",
    background: "rgba(96,165,250,0.1)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 12,
    fontWeight: 900,
  },
  pillDot: { width: 8, height: 8, borderRadius: 999 },
  title: { marginTop: 10, fontSize: 16, fontWeight: 900 },
  time: { marginTop: 6, fontSize: 13, opacity: 0.75 },
  actionsCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  actionsTop: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 10,
  },
  actionsTitle: { fontSize: 16, fontWeight: 900 },
  actionsSub: { fontSize: 12, opacity: 0.75 },
  actionBtns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  actionBtn: {
    textAlign: "left",
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  actionHint: { marginTop: 6, fontSize: 12, opacity: 0.72, fontWeight: 700 },
  actionOn: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
  },
  bottomRow: {
    marginTop: 12,
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },
  primaryBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },
  emptyCard: {
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.02)",
    padding: 18,
  },
  emptyTitle: { fontWeight: 900, fontSize: 16 },
  emptySub: { marginTop: 6, opacity: 0.75, fontSize: 13 },
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
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75 },
  toast: {
    position: "fixed",
    left: 18,
    right: 18,
    bottom: 18,
    maxWidth: 560,
    margin: "0 auto",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(16,18,26,0.92)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
  },
  toastT: { fontSize: 13, fontWeight: 900 },
  toastS: { marginTop: 4, fontSize: 12, opacity: 0.75 },
};
