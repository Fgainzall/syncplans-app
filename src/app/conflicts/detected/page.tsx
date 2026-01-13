"use client";

import React, { useEffect, useMemo, useState } from "react";
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
} from "@/lib/conflicts";

import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import { Resolution, getMyConflictResolutionsMap } from "@/lib/conflictResolutionsDb";

/* =========================
   Helpers
   ========================= */

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function prettyTimeRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const hhmm = (x: Date) =>
    `${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`;

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (!sameDay)
    return `${s.toLocaleDateString()} ${hhmm(s)} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  return `${hhmm(s)} – ${hhmm(e)}`;
}

type AttachedConflict = {
  id: string;
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;
  existingEvent?: CalendarEvent;
  incomingEvent?: CalendarEvent;
};

export default function ConflictsDetectedPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const groupIdFromUrl = sp.get("groupId");
  const focusEventId = sp.get("eventId");

  const [booting, setBooting] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});

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
        const { events: ev } = await loadEventsFromDb({ groupId: groupIdFromUrl });
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
    const cx = computeVisibleConflicts(events);
    const attached = attachEvents(cx, events) as unknown as AttachedConflict[];

    if (!focusEventId) return attached;

    return attached.filter(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    );
  }, [events, focusEventId]);

  const summary = useMemo(() => {
    const total = conflicts.length;
    let decided = 0;
    for (const c of conflicts) if (resMap[String(c.id)]) decided++;
    return { total, decided, pending: Math.max(0, total - decided) };
  }, [conflicts, resMap]);

  const openCompare = (idx: number) => {
    if (conflicts.length === 0) return;
    const safe = Math.min(Math.max(idx, 0), conflicts.length - 1);

    const qp = new URLSearchParams();
    qp.set("i", String(safe));
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);

    router.push(`/conflicts/compare?${qp.toString()}`);
  };

  const resumeNext = () => {
    if (conflicts.length === 0) return;
    const idx = conflicts.findIndex((c) => !resMap[String(c.id)]);
    openCompare(idx >= 0 ? idx : 0);
  };

  const goActions = () => {
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
              <div style={styles.loadingTitle}>Analizando tu agenda…</div>
              <div style={styles.loadingSub}>Buscando choques de horario</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <LogoutButton />
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Conflictos</div>
            <h1 style={styles.h1}>Tranquilo, esto se soluciona en segundos</h1>
            <div style={styles.sub}>
              {summary.total === 0
                ? "Tu agenda está limpia y sincronizada."
                : `Detectamos ${summary.total} conflicto(s). Decide una vez y listo.`}
            </div>
          </div>

          <div style={styles.heroRight}>
            {summary.total > 0 ? (
              <button onClick={resumeNext} style={styles.primaryBtn}>
                Resolver ahora ✨
              </button>
            ) : (
              <button onClick={() => router.push("/calendar")} style={styles.ghostBtn}>
                Volver al calendario
              </button>
            )}
          </div>
        </section>

        {summary.total === 0 ? (
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>Todo en orden ✅</div>
            <div style={styles.emptySub}>
              Cuando dos eventos choquen, aparecerán aquí con opciones claras para resolverlos.
            </div>
          </section>
        ) : (
          <section style={styles.listCard}>
            <div style={styles.listTop}>
              <div style={styles.listTitle}>Conflictos detectados</div>
              <div style={styles.listHint}>Toca uno para compararlos y decidir.</div>
            </div>

            <div style={styles.list}>
              {conflicts.map((c, idx) => {
                const chosen = resMap[String(c.id)];
                const a = c.existingEvent;
                const b = c.incomingEvent;

                const aMeta = groupMeta(((a?.groupType ?? "personal") as GroupType));
                const bMeta = groupMeta(((b?.groupType ?? "personal") as GroupType));

                return (
                  <button key={c.id} onClick={() => openCompare(idx)} style={styles.rowBtn}>
                    <div style={styles.rowLeft}>
                      <div style={styles.rowTop}>
                        <span style={styles.badgeDanger}>
                          Choque · {ymd(new Date(c.overlapStart))}
                        </span>

                        {chosen ? (
                          <span style={styles.badgeChosen}>Decidido</span>
                        ) : (
                          <span style={styles.badgePending}>Pendiente</span>
                        )}
                      </div>

                      <div style={styles.rowTwo}>
                        <div style={styles.miniLine}>
                          <span style={{ ...styles.dot, background: aMeta.dot }} />
                          <span style={styles.miniTitle}>{a?.title || "Evento A"}</span>
                          <span style={styles.miniTime}>
                            {a ? prettyTimeRange(a.start, a.end) : ""}
                          </span>
                        </div>

                        <div style={styles.miniLine}>
                          <span style={{ ...styles.dot, background: bMeta.dot }} />
                          <span style={styles.miniTitle}>{b?.title || "Evento B"}</span>
                          <span style={styles.miniTime}>
                            {b ? prettyTimeRange(b.start, b.end) : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={styles.rowRight}>→</div>
                  </button>
                );
              })}
            </div>

            {summary.decided > 0 && (
              <div style={styles.footerCta}>
                <button onClick={goActions} style={styles.ghostBtnWide}>
                  Aplicar decisiones
                </button>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

/* ===== styles (idénticos a los tuyos) ===== */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
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
  ghostBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 220,
  },
  listCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  listTop: { padding: 14, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  listTitle: { fontSize: 16, fontWeight: 900 },
  listHint: { marginTop: 4, fontSize: 12, opacity: 0.75 },
  list: { display: "flex", flexDirection: "column" },
  rowBtn: {
    textAlign: "left",
    border: "none",
    cursor: "pointer",
    background: "transparent",
    color: "inherit",
    padding: 14,
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
  rowLeft: { flex: 1, display: "flex", flexDirection: "column", gap: 10 },
  rowTop: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  rowTwo: { display: "flex", flexDirection: "column", gap: 8 },
  badgeDanger: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.35)",
    background: "rgba(248,113,113,0.12)",
  },
  badgePending: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
  },
  badgeChosen: {
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.28)",
    background: "rgba(34,197,94,0.10)",
  },
  miniLine: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  dot: { width: 10, height: 10, borderRadius: 999 },
  miniTitle: { fontSize: 13, fontWeight: 900, opacity: 0.95 },
  miniTime: { fontSize: 12, opacity: 0.7 },
  rowRight: { opacity: 0.7, fontWeight: 900 },
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
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
  footerCta: {
    padding: 14,
    display: "flex",
    justifyContent: "flex-end",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
};
