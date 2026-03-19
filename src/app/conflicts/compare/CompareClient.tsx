"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  CalendarEvent,
  GroupType,
  computeVisibleConflicts,
  attachEvents,
  type ConflictItem,
  conflictKey,
  filterIgnoredConflicts,
  loadIgnoredConflictKeys,
} from "@/lib/conflicts";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  type Resolution,
  getMyConflictResolutionsMap,
  upsertConflictResolution,
} from "@/lib/conflictResolutionsDb";
import {
  filterOutDeclinedEvents,
  getMyDeclinedEventIds,
} from "@/lib/eventResponsesDb";

function normalizeForConflicts(gt: GroupType | null | undefined): GroupType {
  return (gt ?? "personal") as GroupType;
}

function resolutionForConflict(
  c: ConflictItem,
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

function safeTitle(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "Evento sin título";
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Sin fecha";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sin fecha";

  try {
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatRange(startIso?: string | null, endIso?: string | null) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;

  if (!start || Number.isNaN(start.getTime())) return "";

  const sameDay =
    !!end &&
    !Number.isNaN(end.getTime()) &&
    start.toDateString() === end.toDateString();

  try {
    if (end && !Number.isNaN(end.getTime()) && sameDay) {
      return `${start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })} · ${start.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })} – ${end.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    if (end && !Number.isNaN(end.getTime())) {
      return `${start.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })} → ${end.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return formatDateTime(startIso);
  } catch {
    return startIso ?? "";
  }
}

function groupTone(groupType?: string | null): React.CSSProperties {
  const v = String(groupType ?? "personal").toLowerCase();

  if (v === "pair" || v === "couple") {
    return {
      border: "1px solid rgba(255,111,156,0.24)",
      background: "rgba(78,25,45,0.70)",
      color: "#FFD8E6",
    };
  }

  if (v === "family") {
    return {
      border: "1px solid rgba(255,196,92,0.24)",
      background: "rgba(78,56,18,0.72)",
      color: "#FFEEC7",
    };
  }

  if (v === "shared" || v === "other") {
    return {
      border: "1px solid rgba(102,255,179,0.24)",
      background: "rgba(20,60,42,0.72)",
      color: "#D7FFE9",
    };
  }

  return {
    border: "1px solid rgba(122,140,255,0.22)",
    background: "rgba(33,42,86,0.70)",
    color: "#DCE5FF",
  };
}

function groupLabel(groupType?: string | null) {
  const v = String(groupType ?? "personal").toLowerCase();
  if (v === "pair" || v === "couple") return "Pareja";
  if (v === "family") return "Familia";
  if (v === "shared" || v === "other") return "Compartido";
  return "Personal";
}

export default function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupIdFromUrl = searchParams.get("groupId");
  const focusId = searchParams.get("conflict");
  const incomingIdFromUrl = searchParams.get("incoming");
  const existingIdFromUrl = searchParams.get("existing");

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [selectedResolution, setSelectedResolution] = useState<Resolution | null>(
    null
  );
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );

  const loadScreenData = useCallback(async () => {
    const [eventsForConflicts, dbMap, declinedSet] = await Promise.all([
      loadEventsFromDb({ groupId: groupIdFromUrl }),
      getMyConflictResolutionsMap(),
      getMyDeclinedEventIds(),
    ]);

    setEvents(
      Array.isArray(eventsForConflicts?.events) ? eventsForConflicts.events : []
    );
    setResMap(dbMap ?? {});
    setDeclinedIds(declinedSet instanceof Set ? declinedSet : new Set());
  }, [groupIdFromUrl]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!alive) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      try {
        await loadScreenData();
      } catch {
        if (!alive) return;
        setEvents([]);
        setResMap({});
        setDeclinedIds(new Set());
      }

      if (!alive) return;
      setBooting(false);
    })();

    return () => {
      alive = false;
    };
  }, [router, loadScreenData]);

  useEffect(() => {
    const refreshFromDb = () => {
      void loadScreenData();
    };

    const onFocus = () => refreshFromDb();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshFromDb();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadScreenData]);

  const visibleEventsForConflicts = useMemo(() => {
    return filterOutDeclinedEvents(
      Array.isArray(events) ? events : [],
      declinedIds
    );
  }, [events, declinedIds]);

  const conflicts = useMemo<ConflictItem[]>(() => {
    const normalized: CalendarEvent[] = (
      Array.isArray(visibleEventsForConflicts) ? visibleEventsForConflicts : []
    ).map((e) => ({
      ...e,
      groupType: normalizeForConflicts(e.groupType),
    }));

    const computed = computeVisibleConflicts(normalized);
    const ignored = loadIgnoredConflictKeys();
    const visible = filterIgnoredConflicts(computed, ignored);

    return attachEvents(visible, visibleEventsForConflicts);
  }, [visibleEventsForConflicts]);

  const activeConflict = useMemo<ConflictItem | null>(() => {
    if (!conflicts.length) return null;

    if (focusId) {
      const byId = conflicts.find((c) => String(c.id) === String(focusId));
      if (byId) return byId;
    }

    if (existingIdFromUrl && incomingIdFromUrl) {
      const byPair = conflicts.find((c) => {
        const a = String(c.existingEventId ?? "");
        const b = String(c.incomingEventId ?? "");
        return (
          a === String(existingIdFromUrl) && b === String(incomingIdFromUrl)
        );
      });
      if (byPair) return byPair;
    }

    return conflicts[0] ?? null;
  }, [conflicts, focusId, existingIdFromUrl, incomingIdFromUrl]);

  useEffect(() => {
    if (!activeConflict) {
      setSelectedResolution(null);
      return;
    }

    const current = resolutionForConflict(activeConflict, resMap);
    setSelectedResolution(current ?? null);
  }, [activeConflict, resMap]);

  const saveDecision = async (resolution: Resolution) => {
    if (!activeConflict || saving) return;

    try {
      setSaving(true);

      await upsertConflictResolution({
        conflictId: String(activeConflict.id),
        existingEventId: String(activeConflict.existingEventId ?? ""),
        incomingEventId: String(activeConflict.incomingEventId ?? ""),
        resolution,
      });

      const nextMap = await getMyConflictResolutionsMap();
      setResMap(nextMap ?? {});
      setSelectedResolution(resolution);

      setToast({
        title: "Decisión guardada",
        sub: "La resolución ya quedó persistida.",
      });
    } catch (e: any) {
      setToast({
        title: "No se pudo guardar",
        sub:
          typeof e?.message === "string" && e.message.trim()
            ? e.message
            : "Intenta nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  };

  const goToActions = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/actions?${qp.toString()}`);
  };

  const goBack = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/detected?${qp.toString()}`);
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando comparación…</div>
              <div style={styles.loadingSub}>Un segundo</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!activeConflict) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.topRow}>
            <PremiumHeader />
            <div style={styles.topActions}>
              <button onClick={goBack} style={styles.ghostBtn}>
                ← Volver
              </button>
              <LogoutButton />
            </div>
          </div>

          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No encontramos un conflicto activo</div>
            <div style={styles.emptySub}>
              Puede que ya esté resuelto o que uno de los eventos haya quedado
              declined y por eso ya no deba compararse.
            </div>
            <div style={styles.footerBar}>
              <button onClick={goBack} style={styles.primaryBtn}>
                Volver a conflictos
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const existing = activeConflict.existingEvent;
  const incoming = activeConflict.incomingEvent;

  const existingSelected = selectedResolution === "keep_existing";
  const incomingSelected = selectedResolution === "replace_with_new";
  const bothSelected = selectedResolution === "none";

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <button onClick={goBack} style={styles.ghostBtn}>
              ← Volver
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.kicker}>Comparar</div>
          <h1 style={styles.h1}>Elige qué hacer con este choque</h1>
          <div style={styles.sub}>
            Esta pantalla ya compara solo eventos visibles reales. Si alguno fue
            marcado como declined en BD, ya no debería aparecer aquí.
          </div>
        </section>

        <section style={styles.compareGrid}>
          <article
            style={{
              ...styles.eventCard,
              ...(existingSelected ? styles.eventCardSelected : {}),
            }}
          >
            <div style={styles.cardTop}>
              <span
                style={{
                  ...styles.typePill,
                  ...groupTone(existing?.groupType),
                }}
              >
                {groupLabel(existing?.groupType)}
              </span>

              <span style={styles.sidePill}>Evento A</span>
            </div>

            <h2 style={styles.cardTitle}>{safeTitle(existing?.title)}</h2>

            <div style={styles.metaBlock}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Cuándo</span>
                <span>{formatRange(existing?.start, existing?.end)}</span>
              </div>

              {existing?.location ? (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Lugar</span>
                  <span>{existing.location}</span>
                </div>
              ) : null}

              {existing?.notes ? (
                <div style={styles.notesBox}>{existing.notes}</div>
              ) : null}
            </div>

            <button
              disabled={saving}
              onClick={() => void saveDecision("keep_existing")}
              style={{
                ...styles.choiceBtn,
                ...(existingSelected ? styles.choiceBtnSelected : {}),
              }}
            >
              {saving && existingSelected ? "Guardando…" : "Conservar este"}
            </button>
          </article>

          <article
            style={{
              ...styles.eventCard,
              ...(incomingSelected ? styles.eventCardSelected : {}),
            }}
          >
            <div style={styles.cardTop}>
              <span
                style={{
                  ...styles.typePill,
                  ...groupTone(incoming?.groupType),
                }}
              >
                {groupLabel(incoming?.groupType)}
              </span>

              <span style={styles.sidePill}>Evento B</span>
            </div>

            <h2 style={styles.cardTitle}>{safeTitle(incoming?.title)}</h2>

            <div style={styles.metaBlock}>
              <div style={styles.metaRow}>
                <span style={styles.metaLabel}>Cuándo</span>
                <span>{formatRange(incoming?.start, incoming?.end)}</span>
              </div>

              {incoming?.location ? (
                <div style={styles.metaRow}>
                  <span style={styles.metaLabel}>Lugar</span>
                  <span>{incoming.location}</span>
                </div>
              ) : null}

              {incoming?.notes ? (
                <div style={styles.notesBox}>{incoming.notes}</div>
              ) : null}
            </div>

            <button
              disabled={saving}
              onClick={() => void saveDecision("replace_with_new")}
              style={{
                ...styles.choiceBtn,
                ...(incomingSelected ? styles.choiceBtnSelected : {}),
              }}
            >
              {saving && incomingSelected ? "Guardando…" : "Conservar este"}
            </button>
          </article>
        </section>

        <section style={styles.middleCard}>
          <div style={styles.middleTop}>
            <div>
              <div style={styles.middleTitle}>Otra opción</div>
              <div style={styles.middleSub}>
                También puedes mantener ambos y decidir después.
              </div>
            </div>

            <button
              disabled={saving}
              onClick={() => void saveDecision("none")}
              style={{
                ...styles.secondaryChoiceBtn,
                ...(bothSelected ? styles.secondaryChoiceBtnSelected : {}),
              }}
            >
              {saving && bothSelected ? "Guardando…" : "Mantener ambos"}
            </button>
          </div>
        </section>

        <section style={styles.footerBar}>
          <button onClick={goBack} style={styles.secondaryBtn}>
            Volver
          </button>

          <button onClick={goToActions} style={styles.primaryBtn}>
            Seguir a cierre
          </button>
        </section>

        {toast ? (
          <div style={styles.toastWrap}>
            <div style={styles.toast}>
              <div style={styles.toastTitle}>{toast.title}</div>
              {toast.sub ? <div style={styles.toastSub}>{toast.sub}</div> : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(1200px 700px at 10% -10%, rgba(58,80,180,0.22), transparent 50%), linear-gradient(180deg, #071026 0%, #050914 100%)",
    color: "#F6F8FC",
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
    border: "1px solid rgba(110,138,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(16,22,48,0.92), rgba(9,13,30,0.92))",
    borderRadius: 28,
    padding: 22,
    boxShadow: "0 30px 90px rgba(0,0,0,0.34)",
    display: "grid",
    gap: 8,
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
    maxWidth: 840,
  },
  compareGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },
  eventCard: {
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,35,0.88)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
    display: "grid",
    gap: 14,
  },
  eventCardSelected: {
    border: "1px solid rgba(110,138,255,0.36)",
    boxShadow: "0 24px 80px rgba(76,98,219,0.22)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  typePill: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
  },
  sidePill: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#E8EEFF",
  },
  cardTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  metaBlock: {
    display: "grid",
    gap: 12,
  },
  metaRow: {
    display: "grid",
    gap: 4,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(235,241,255,0.84)",
  },
  metaLabel: {
    fontSize: 12,
    color: "rgba(235,241,255,0.58)",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  notesBox: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 12,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.82)",
    whiteSpace: "pre-wrap",
  },
  choiceBtn: {
    marginTop: 8,
    borderRadius: 16,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  choiceBtnSelected: {
    border: "1px solid rgba(103,133,255,0.30)",
    background:
      "linear-gradient(135deg, rgba(91,120,255,0.96), rgba(119,95,255,0.96))",
    boxShadow: "0 18px 44px rgba(63,93,227,0.30)",
  },
  middleCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
  },
  middleTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  middleTitle: {
    fontSize: 18,
    fontWeight: 900,
  },
  middleSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(235,241,255,0.68)",
    lineHeight: 1.5,
  },
  secondaryChoiceBtn: {
    borderRadius: 16,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryChoiceBtnSelected: {
    border: "1px solid rgba(255,214,102,0.28)",
    background: "rgba(90,69,21,0.82)",
    color: "#FFF0C7",
  },
  footerBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
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