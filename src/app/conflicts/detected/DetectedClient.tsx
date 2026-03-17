"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AppHero from "@/components/AppHero";

import {
  CalendarEvent,
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  attachEvents,
  conflictKey,
  filterIgnoredConflicts,
  filterSoftRejectedEvents,
  loadIgnoredConflictKeys,
  loadSoftRejectedEventIds,
  SOFT_REJECTED_EVENTS_KEY,
} from "@/lib/conflicts";

import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  Resolution,
  getMyConflictResolutionsMap,
} from "@/lib/conflictResolutionsDb";
import { markConflictNotificationsAsRead } from "@/lib/notificationsDb";

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

/**
 * Compat:
 * el motor viejo tolera "couple"; el producto ya usa "pair".
 */
function normalizeForConflicts(gt: GroupType | null | undefined): GroupType {
  if (!gt) return "personal" as GroupType;
  return (gt === ("pair" as any) ? ("couple" as any) : gt) as GroupType;
}

/** móvil por ancho */
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

type AttachedConflict = {
  id: string;
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;
  existingEvent?: CalendarEvent;
  incomingEvent?: CalendarEvent;
};

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

export default function DetectedClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const isMobile = useIsMobileWidth(520);

  const groupIdFromUrl = sp.get("groupId");
  const focusEventId = sp.get("eventId");

  const [booting, setBooting] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() =>
    loadSoftRejectedEventIds()
  );

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
          groupId: groupIdFromUrl ?? undefined,
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

      if (alive) {
        setHiddenEventIds(loadSoftRejectedEventIds());
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, groupIdFromUrl]);

  useEffect(() => {
    const refreshHidden = () => {
      setHiddenEventIds(loadSoftRejectedEventIds());
    };

    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === SOFT_REJECTED_EVENTS_KEY) {
        refreshHidden();
      }
    };

    const onFocus = () => refreshHidden();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshHidden();
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(
      "sp:soft-rejected-events-changed",
      refreshHidden as EventListener
    );

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(
        "sp:soft-rejected-events-changed",
        refreshHidden as EventListener
      );
    };
  }, []);

  const visibleEvents = useMemo<CalendarEvent[]>(() => {
    return filterSoftRejectedEvents(
      Array.isArray(events) ? events : [],
      hiddenEventIds
    );
  }, [events, hiddenEventIds]);

  const allVisibleConflicts = useMemo<AttachedConflict[]>(() => {
    const normalized: CalendarEvent[] = visibleEvents.map((e) => ({
      ...e,
      groupType: normalizeForConflicts((e.groupType ?? "personal") as any),
    }));

    const cx = computeVisibleConflicts(normalized);
    const ignored = loadIgnoredConflictKeys();
    const visible = filterIgnoredConflicts(cx, ignored);

    return attachEvents(
      visible,
      visibleEvents
    ) as unknown as AttachedConflict[];
  }, [visibleEvents]);

  /**
   * Mantenemos solo conflictos pendientes reales,
   * igual que el banner nuevo de Summary.
   */
  const pendingConflicts = useMemo<AttachedConflict[]>(() => {
    const pending = allVisibleConflicts.filter(
      (c) => !resolutionForConflict(c, resMap)
    );

    if (!focusEventId) return pending;

    return pending.filter(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    );
  }, [allVisibleConflicts, resMap, focusEventId]);

  const summary = useMemo(() => {
    const totalVisible = allVisibleConflicts.length;
    let decided = 0;

    for (const c of allVisibleConflicts) {
      if (resolutionForConflict(c, resMap)) decided++;
    }

    const pending = pendingConflicts.length;

    return {
      totalVisible,
      decided,
      pending,
    };
  }, [allVisibleConflicts, pendingConflicts, resMap]);

  /**
   * Si entramos desde una notificación con eventId
   * y ya no hay conflicto pendiente real para ese evento,
   * limpiamos esa notificación fantasma.
   */
  useEffect(() => {
    if (!focusEventId) return;
    if (booting) return;

    const hasPendingForFocus = pendingConflicts.some(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    );

    if (hasPendingForFocus) return;

    void markConflictNotificationsAsRead({
      eventIds: [String(focusEventId)],
    }).catch(() => {
      // no rompemos la UI si falla esta limpieza
    });
  }, [focusEventId, pendingConflicts, booting]);

  const LIST_LIMIT = isMobile ? 5 : 50;
  const visibleConflicts = useMemo(
    () => pendingConflicts.slice(0, LIST_LIMIT),
    [pendingConflicts, LIST_LIMIT]
  );
  const showSeeMore = !booting && pendingConflicts.length > LIST_LIMIT;

  const openCompare = (idx: number) => {
    if (pendingConflicts.length === 0) return;
    const safe = Math.min(Math.max(idx, 0), pendingConflicts.length - 1);

    const qp = new URLSearchParams();
    qp.set("i", String(safe));
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);

    router.push(`/conflicts/compare?${qp.toString()}`);
  };

  const resumeNext = () => {
    if (pendingConflicts.length === 0) return;
    openCompare(0);
  };

  const goActions = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/actions?${qp.toString()}`);
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell} className="spDet-shell">
          <AppHero
            mobileNav="bottom"
            title="Conflictos"
            subtitle="Analizando tu agenda para encontrar choques de horario."
          />

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
      <div style={styles.shell} className="spDet-shell">
        <div style={styles.topRow} className="spDet-topRow">
          <AppHero
            mobileNav="bottom"
            title="Conflictos"
            subtitle={
              summary.pending === 0
                ? "Tu agenda está sincronizada."
                : "Detecta y resuelve choques de horario en segundos."
            }
          />
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Conflictos</div>
            <h1 style={styles.h1}>
              {summary.pending === 0
                ? "Todo claro por aquí"
                : "Tranquilo, esto se soluciona en segundos"}
            </h1>
            <div style={styles.sub}>
              {summary.pending === 0
                ? "No encontramos choques pendientes visibles para este contexto."
                : `Detectamos ${summary.pending} conflicto(s) pendiente(s). Decide una vez y listo.`}
            </div>
          </div>

          <div style={styles.heroRight}>
            {summary.pending > 0 ? (
              <button onClick={resumeNext} style={styles.primaryBtn}>
                Resolver ahora ✨
              </button>
            ) : (
              <button
                onClick={() => router.push("/calendar")}
                style={styles.secondaryBtn}
              >
                Ir al calendario
              </button>
            )}
          </div>
        </section>

        <section style={styles.listCard}>
          <div style={styles.listTop}>
            <div>
              <div style={styles.listTitle}>Conflictos detectados</div>
              <div style={styles.listSub}>
                Toca uno para compararlos y decidir.
              </div>
            </div>

            {summary.pending > 0 && (
              <button onClick={goActions} style={styles.secondaryBtn}>
                Aplicar decisiones
              </button>
            )}
          </div>

          {visibleConflicts.length === 0 ? (
            <div style={styles.emptyWrap}>
              <div style={styles.emptyTitle}>No hay conflictos visibles</div>
              <div style={styles.emptySub}>
                Ya no quedan choques pendientes para este contexto.
              </div>
            </div>
          ) : (
            <div style={styles.items}>
              {visibleConflicts.map((c, idx) => {
                const a = c.existingEvent;
                const b = c.incomingEvent;

                const aMeta = groupMeta(
                  normalizeForConflicts((a?.groupType ?? "personal") as any)
                );
                const bMeta = groupMeta(
                  normalizeForConflicts((b?.groupType ?? "personal") as any)
                );

                return (
                  <button
                    key={c.id}
                    onClick={() => openCompare(idx)}
                    style={styles.item}
                  >
                    <div style={styles.itemHead}>
                      <div style={styles.badges}>
                        <span style={styles.badgeDanger}>
                          Choque · {ymd(new Date(c.overlapStart))}
                        </span>

                        <span style={styles.badgePending}>Pendiente</span>
                      </div>

                      <span style={styles.arrow}>→</span>
                    </div>

                    <div style={styles.row}>
                      <span style={{ ...styles.dot, background: aMeta.dot }} />
                      <span style={styles.title}>
                        {a?.title || "Evento A"}
                      </span>
                      <span style={styles.time}>
                        {a ? prettyTimeRange(a.start, a.end) : ""}
                      </span>
                    </div>

                    <div style={styles.row}>
                      <span style={{ ...styles.dot, background: bMeta.dot }} />
                      <span style={styles.title}>
                        {b?.title || "Evento B"}
                      </span>
                      <span style={styles.time}>
                        {b ? prettyTimeRange(b.start, b.end) : ""}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {showSeeMore && (
            <div style={styles.moreWrap}>
              <div style={styles.moreText}>
                Hay más conflictos, pero en móvil limitamos la lista para evitar
                scroll infinito.
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(1000px 600px at 15% -10%, rgba(70,92,210,0.18), transparent 50%), linear-gradient(180deg, #071026 0%, #050914 100%)",
    color: "#F7F9FF",
  },
  shell: {
    width: "min(1180px, calc(100% - 24px))",
    margin: "0 auto",
    padding: "18px 0 120px",
  },
  topRow: {
    display: "grid",
    gap: 16,
  },
  hero: {
    marginTop: 16,
    borderRadius: 26,
    border: "1px solid rgba(113,141,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(15,22,46,0.92), rgba(9,13,29,0.92))",
    boxShadow: "0 26px 70px rgba(0,0,0,0.28)",
    padding: 22,
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 18,
    alignItems: "center",
  },
  heroLeft: {
    display: "grid",
    gap: 8,
  },
  heroRight: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: "#AFC1FF",
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
    fontSize: 15,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.74)",
  },
  primaryBtn: {
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
  listCard: {
    marginTop: 18,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
    overflow: "hidden",
  },
  listTop: {
    padding: "18px 18px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  listSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(235,241,255,0.66)",
    lineHeight: 1.5,
  },
  items: {
    display: "grid",
  },
  item: {
    border: 0,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#F7F9FF",
    padding: "16px 18px",
    textAlign: "left",
    display: "grid",
    gap: 12,
    cursor: "pointer",
  },
  itemHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  badges: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badgeDanger: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(94,37,42,0.82)",
    border: "1px solid rgba(255,128,140,0.18)",
    color: "#FFE2E7",
  },
  badgePending: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 900,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#E8EEFF",
  },
  arrow: {
    fontSize: 18,
    color: "rgba(235,241,255,0.54)",
    fontWeight: 900,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "12px minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  title: {
    fontSize: 14,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  time: {
    fontSize: 12,
    color: "rgba(235,241,255,0.66)",
  },
  emptyWrap: {
    padding: 24,
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
  moreWrap: {
    padding: "12px 18px 18px",
  },
  moreText: {
    fontSize: 12,
    color: "rgba(235,241,255,0.60)",
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
};