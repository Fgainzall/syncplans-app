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
  conflictKey,
  filterIgnoredConflicts,
  loadIgnoredConflictKeys,
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
    `${String(x.getHours()).padStart(2, "0")}:${String(
      x.getMinutes()
    ).padStart(2, "0")}`;

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (!sameDay)
    return `${s.toLocaleDateString()} ${hhmm(
      s
    )} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}

function safeNumber(x: string | null, fallback = 0) {
  const n = Number(x ?? "");
  return Number.isFinite(n) ? n : fallback;
}

function normalizeForConflicts(gt: GroupType | null | undefined): GroupType {
  if (!gt) return "personal" as GroupType;
  return (gt === ("pair" as any) ? ("couple" as any) : gt) as GroupType;
}

function resolutionForConflict(
  c: AttachedConflict,
  resMap: Record<string, Resolution>
): Resolution | undefined {
  const exact = resMap[String(c.id)];
  if (exact) return exact;

  const a = String(c.existingEventId ?? "");
  const b = String(c.incomingEventId ?? "");
  if (!a || !b) return undefined;

  const stableKey = conflictKey(a, b);
  if (resMap[stableKey]) return resMap[stableKey];

  const [x, y] = [a, b].sort();
  const legacyPrefix = `cx::${x}::${y}::`;

  for (const k of Object.keys(resMap)) {
    if (k.startsWith(legacyPrefix)) return resMap[k];
  }

  return undefined;
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

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

  const conflicts = useMemo<AttachedConflict[]>(() => {
    const normalized: CalendarEvent[] = (Array.isArray(events) ? events : []).map(
      (e) => ({
        ...e,
        groupType: normalizeForConflicts((e.groupType ?? "personal") as any),
      })
    );

    const cx = computeVisibleConflicts(normalized);
    const ignored = loadIgnoredConflictKeys();
    const visible = filterIgnoredConflicts(cx, ignored);

    return attachEvents(visible, events) as unknown as AttachedConflict[];
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

  const aMeta = groupMeta(
    normalizeForConflicts((a?.groupType ?? "personal") as GroupType)
  );
  const bMeta = groupMeta(
    normalizeForConflicts((b?.groupType ?? "personal") as GroupType)
  );

  const conflictId = c?.id ?? "";
  const chosen: Resolution | undefined =
    c && conflictId ? resolutionForConflict(c, resMap) : undefined;

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

  const setChoice = async (r: Resolution) => {
    if (!c || !conflictId) return;

    setResMap((prev) => ({ ...prev, [conflictId]: r }));

    try {
      await upsertConflictResolution(conflictId, r);

      setToast({ title: "Decisión guardada", sub: conflictResolutionHint(r) });
    } catch (e: any) {
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
            <button
              onClick={next}
              style={styles.iconBtn}
              aria-label="Siguiente"
            >
              ›
            </button>
          </div>
        </section>

        <section style={styles.compareGrid}>
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
              Conservar A
            </button>

            <button
              onClick={() => setChoice("replace_with_new")}
              style={{
                ...styles.actionBtn,
                ...(chosen === "replace_with_new" ? styles.actionOn : {}),
              }}
            >
              Conservar B
            </button>

            <button
              onClick={() => setChoice("none")}
              style={{
                ...styles.actionBtn,
                ...(chosen === "none" ? styles.actionOn : {}),
              }}
            >
              Mantener ambos
            </button>
          </div>

          <div style={styles.hintBox}>{conflictResolutionHint(chosen)}</div>
        </section>

        <section style={styles.footerBar}>
          <button onClick={goList} style={styles.secondaryBtn}>
            Volver a lista
          </button>

          <button onClick={goApply} style={styles.primaryBtnWide}>
            Ir a aplicar decisiones
          </button>
        </section>

        {toast && (
          <div style={styles.toastWrap}>
            <div style={styles.toast}>
              <div style={styles.toastTitle}>{toast.title}</div>
              {toast.sub ? <div style={styles.toastSub}>{toast.sub}</div> : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(1000px 620px at 15% -10%, rgba(70,92,210,0.18), transparent 50%), linear-gradient(180deg, #071026 0%, #050914 100%)",
    color: "#F7F9FF",
  },
  shell: {
    width: "min(1180px, calc(100% - 24px))",
    margin: "0 auto",
    padding: "24px 0 110px",
  },
  topRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 16,
    alignItems: "start",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  ghostBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#EAF0FF",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(14px)",
  },
  hero: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 18,
    alignItems: "stretch",
    border: "1px solid rgba(110,138,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(16,22,48,0.92), rgba(9,13,30,0.92))",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
  },
  heroLeft: {
    display: "grid",
    gap: 8,
  },
  heroRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#AEBEFF",
    fontWeight: 800,
  },
  h1: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  sub: {
    color: "rgba(235,241,255,0.76)",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 760,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 24,
    fontWeight: 900,
    cursor: "pointer",
  },
  compareGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  card: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
    padding: 18,
    display: "grid",
    gap: 12,
  },
  cardFocus: {
    border: "1px solid rgba(110,138,255,0.34)",
    boxShadow: "0 0 0 3px rgba(110,138,255,0.12)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  badgeA: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(67,88,219,0.18)",
    border: "1px solid rgba(114,140,255,0.24)",
    color: "#E6ECFF",
  },
  badgeB: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(116,80,227,0.18)",
    border: "1px solid rgba(164,132,255,0.24)",
    color: "#F0E8FF",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: 800,
    color: "#E9EEFF",
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  title: {
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  time: {
    fontSize: 14,
    color: "rgba(235,241,255,0.72)",
  },
  actionsCard: {
    marginTop: 18,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  actionsTop: {
    display: "grid",
    gap: 4,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  actionsSub: {
    fontSize: 13,
    color: "rgba(235,241,255,0.66)",
    lineHeight: 1.5,
  },
  actionBtns: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  actionBtn: {
    borderRadius: 18,
    padding: "14px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  actionOn: {
    background:
      "linear-gradient(135deg, rgba(91,120,255,0.96), rgba(119,95,255,0.96))",
    border: "1px solid rgba(103,133,255,0.28)",
    boxShadow: "0 18px 44px rgba(63,93,227,0.22)",
  },
  hintBox: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    fontSize: 14,
    color: "rgba(235,241,255,0.78)",
  },
  footerBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  secondaryBtn: {
    borderRadius: 16,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },
  primaryBtnWide: {
    borderRadius: 16,
    padding: "12px 18px",
    border: "1px solid rgba(103,133,255,0.28)",
    background:
      "linear-gradient(135deg, rgba(91,120,255,0.96), rgba(119,95,255,0.96))",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 18px 44px rgba(63,93,227,0.30)",
  },
  emptyCard: {
    marginTop: 20,
    borderRadius: 24,
    padding: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,35,0.82)",
    display: "grid",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 900,
  },
  emptySub: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.72)",
  },
  loadingCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,35,0.84)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background:
      "linear-gradient(135deg, rgba(115,145,255,1), rgba(144,119,255,1))",
    boxShadow: "0 0 0 8px rgba(115,145,255,0.10)",
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 900,
  },
  loadingSub: {
    fontSize: 13,
    color: "rgba(235,241,255,0.68)",
  },
  toastWrap: {
    position: "fixed",
    right: 18,
    bottom: 18,
    zIndex: 100,
  },
  toast: {
    minWidth: 260,
    maxWidth: 380,
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,26,0.95)",
    boxShadow: "0 20px 50px rgba(0,0,0,0.34)",
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
toastSub: {
  marginTop: 6,
  fontSize: 13,
  color: "rgba(235,241,255,0.74)",
  lineHeight: 1.5,
},
};