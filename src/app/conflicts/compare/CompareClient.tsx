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
  conflictInvolvesEvent,
  filterIgnoredConflicts,
} from "@/lib/conflicts";
import { normalizeGroupType } from "@/lib/naming";
import { getConflictDecisionSnapshot } from "@/lib/decisionEngine";
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
import { getIgnoredConflictKeys } from "@/lib/conflictPrefs";

function normalizeForConflicts(gt: string | null | undefined): GroupType {
  return normalizeGroupType(gt) as GroupType;
}

function safeTitle(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "Evento sin título";
}
type CalendarEventWithLocation = CalendarEvent & {
  location?: string | null;
};

function getEventLocation(event?: CalendarEventWithLocation | null) {
  return String(event?.location ?? "").trim();
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

function resolutionLabel(value: Resolution | null) {
  if (value === "keep_existing") return "Se mantiene el plan actual";
  if (value === "replace_with_new") return "Se mantiene el plan nuevo";
  if (value === "none") return "Se mantienen ambos por ahora";
  return "Todavía no has elegido qué hacer";
}

function parseIndex(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return Math.floor(n);
}

export default function CompareClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupIdFromUrl = searchParams.get("groupId");
  const focusConflictId = searchParams.get("conflict");
  const incomingIdFromUrl = searchParams.get("incoming");
  const existingIdFromUrl = searchParams.get("existing");
  const focusEventId = searchParams.get("eventId");
  const indexFromUrl = parseIndex(searchParams.get("i"));

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [ignoredConflictKeys, setIgnoredConflictKeys] = useState<Set<string>>(
    new Set()
  );
  const [selectedResolution, setSelectedResolution] = useState<Resolution | null>(
    null
  );
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < 920;
  });

  const loadScreenData = useCallback(async () => {
    const [eventsForConflicts, dbMap, declinedSet, ignoredSet] = await Promise.all([
      loadEventsFromDb({ groupId: groupIdFromUrl }),
      getMyConflictResolutionsMap(),
      getMyDeclinedEventIds(),
      getIgnoredConflictKeys(),
    ]);

    setEvents(
      Array.isArray(eventsForConflicts?.events) ? eventsForConflicts.events : []
    );
    setResMap(dbMap ?? {});
    setDeclinedIds(declinedSet instanceof Set ? declinedSet : new Set());
    setIgnoredConflictKeys(ignoredSet instanceof Set ? ignoredSet : new Set());
  }, [groupIdFromUrl]);

  useEffect(() => {
    const syncViewport = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth < 920);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

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
    const visible = filterIgnoredConflicts(computed, ignoredConflictKeys);

    return attachEvents(visible, visibleEventsForConflicts);
  }, [visibleEventsForConflicts, ignoredConflictKeys]);

  const focusConflicts = useMemo(() => {
    if (!focusEventId) return [];
    return conflicts.filter((c) => conflictInvolvesEvent(c, focusEventId));
  }, [conflicts, focusEventId]);

  const activeConflict = useMemo<ConflictItem | null>(() => {
    if (!conflicts.length) return null;

    if (focusConflictId) {
      const byId = conflicts.find(
        (c) => String(c.id) === String(focusConflictId)
      );
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

    if (indexFromUrl != null && conflicts[indexFromUrl]) {
      return conflicts[indexFromUrl];
    }

    if (focusEventId) {
      const byEvent = conflicts.find((c) =>
        conflictInvolvesEvent(c, focusEventId)
      );
      if (byEvent) return byEvent;
    }

    return conflicts[0] ?? null;
  }, [
    conflicts,
    focusConflictId,
    existingIdFromUrl,
    incomingIdFromUrl,
    indexFromUrl,
    focusEventId,
  ]);

  useEffect(() => {
    if (!activeConflict) {
      setSelectedResolution(null);
      return;
    }

    const snapshot = getConflictDecisionSnapshot({
      conflict: {
        id: activeConflict.id,
        existing: activeConflict.existingEventId,
        incoming: activeConflict.incomingEventId,
      },
      resolvedConflictMap: resMap,
    });

    setSelectedResolution(snapshot.resolution ?? null);
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
        sub: "Listo, ya quedó claro para todos. Ahora solo falta aplicarlo.",
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

  const activeConflictIndex = useMemo(() => {
    if (!activeConflict) return null;
    const idx = conflicts.findIndex(
      (c) => String(c.id) === String(activeConflict.id)
    );
    return idx >= 0 ? idx : null;
  }, [conflicts, activeConflict]);

  const goToActions = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);
    if (activeConflict?.id != null) qp.set("conflict", String(activeConflict.id));
    if (activeConflictIndex != null) qp.set("i", String(activeConflictIndex));
    router.push(`/conflicts/actions?${qp.toString()}`, { scroll: false });
  };

  const goBack = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);
    router.push(`/conflicts/detected?${qp.toString()}`, { scroll: false });
  };

  const existing = activeConflict?.existingEvent;
  const incoming = activeConflict?.incomingEvent;

  const existingSelected = selectedResolution === "keep_existing";
  const incomingSelected = selectedResolution === "replace_with_new";
  const bothSelected = selectedResolution === "none";

  const decisionReady = selectedResolution !== null;

  const focusSummaryText = useMemo(() => {
    if (focusEventId && focusConflicts.length > 1) {
      return `Este evento tiene ${focusConflicts.length} conflictos visibles. Aquí estás resolviendo uno de ellos.`;
    }

    if (focusEventId && focusConflicts.length === 1) {
      return "Estás resolviendo el conflicto principal del evento que disparó la alerta.";
    }

    return "Compara ambos eventos, guarda una decisión y luego pasa al cierre final.";
  }, [focusEventId, focusConflicts.length]);

  const decisionImpact = useMemo(() => {
    if (selectedResolution === "keep_existing") {
      return {
        title: "Mantendrás el plan actual",
        sub: "Esto prioriza lo que ya estaba en agenda y deja el cierre final listo para aplicarlo sin volver a comparar todo.",
        next: "Siguiente paso: entrar al cierre y confirmar la acción final.",
      };
    }

    if (selectedResolution === "replace_with_new") {
      return {
        title: "Mantendrás el plan nuevo",
        sub: "Esto da prioridad al nuevo evento y evita que el conflicto siga abierto como una duda compartida.",
        next: "Siguiente paso: entrar al cierre y aplicar el cambio de forma clara.",
      };
    }

    if (selectedResolution === "none") {
      return {
        title: "Ambos planes seguirán visibles por ahora",
        sub: "Esto conserva las dos opciones, pero el cruce seguirá marcado para revisarlo después con más contexto.",
        next: "Siguiente paso: pasar al cierre sabiendo que no se descartará nada todavía.",
      };
    }

    return {
      title: "Todavía no elegiste una salida",
      sub: "Elegir aquí evita volver a pensar lo mismo después. Una decisión simple ahora le devuelve claridad al grupo.",
      next: "Siguiente paso: selecciona una opción para seguir al cierre con más contexto.",
    };
  }, [selectedResolution]);

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.loadingCard}>Preparando comparación…</div>
        </div>
      </main>
    );
  }

  if (!activeConflict || !existing || !incoming) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>Este conflicto ya no está pendiente</div>
            <div style={styles.emptySub}>
              Puede que ya lo hayas resuelto, que se haya ocultado o que ese evento ya no siga visible en este contexto.
            </div>
            <div style={styles.footerBar}>
              <button onClick={goBack} style={styles.secondaryBtn}>
                Volver
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div
          style={{
            ...styles.topRow,
            ...(isMobile ? styles.topRowMobile : null),
          }}
        >
          <PremiumHeader />
          <div
            style={{
              ...styles.topActions,
              ...(isMobile ? styles.topActionsMobile : null),
            }}
          >
            <button onClick={goBack} style={styles.ghostBtn}>
              ← Volver
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.kicker}>Comparar</div>
          <h1 style={styles.h1}>Decide sin darle más vueltas</h1>
          <div style={styles.sub}>
            {focusEventId
              ? "Te traje directo al cruce relevante. Compara ambos planes y sal de aquí con una decisión clara."
              : "Compara los dos planes una vez. Guarda tu decisión ahora y luego SyncPlans la aplicará sin hacerte repetir el mismo análisis."}
          </div>

          <div
            style={{
              ...styles.heroInfoRow,
              ...(isMobile ? styles.heroInfoRowMobile : null),
            }}
          >
            <div style={styles.heroInfoCard}>
              <div style={styles.heroInfoLabel}>Cruce detectado</div>
              <div style={styles.heroInfoValue}>
                {formatRange(existing?.start, incoming?.end || existing?.end)}
              </div>
            </div>

            <div style={styles.heroInfoCard}>
              <div style={styles.heroInfoLabel}>Estado actual</div>
              <div style={styles.heroInfoValue}>
                {resolutionLabel(selectedResolution)}
              </div>
            </div>
          </div>
        </section>

        <section style={styles.decisionGuide}>
          <div style={styles.decisionGuideEyebrow}>Qué decides aquí</div>
          <div style={styles.decisionGuideTitle}>Elige qué plan debe seguir.</div>
          <div style={styles.decisionGuideSub}>
            Este es el momento importante: cuando decides aquí, el conflicto deja de ser una duda repetida y pasa a tener una salida concreta dentro de SyncPlans.
          </div>
          <div style={styles.decisionGuideFocus}>{focusSummaryText}</div>
        </section>

        <section
          style={{
            ...styles.compareGrid,
            gridTemplateColumns: isMobile
              ? "minmax(0, 1fr)"
              : "repeat(2, minmax(0, 1fr))",
          }}
        >
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

             {getEventLocation(existing) ? (
  <div style={styles.metaRow}>
    <span style={styles.metaLabel}>Lugar</span>
    <span>{getEventLocation(existing)}</span>
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
              {saving && existingSelected ? "Guardando…" : "Quedarme con este"}
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

             {getEventLocation(incoming) ? (
  <div style={styles.metaRow}>
    <span style={styles.metaLabel}>Lugar</span>
    <span>{getEventLocation(incoming)}</span>
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
              {saving && incomingSelected ? "Guardando…" : "Quedarme con este"}
            </button>
          </article>
        </section>

        <section style={styles.impactCard}>
          <div style={styles.impactEyebrow}>Lo que cambia si decides ahora</div>
          <div style={styles.impactTitle}>{decisionImpact.title}</div>
          <div style={styles.impactSub}>{decisionImpact.sub}</div>
          <div style={styles.impactNext}>{decisionImpact.next}</div>
        </section>

        <section style={styles.middleCard}>
          <div
            style={{
              ...styles.middleTop,
              ...(isMobile ? styles.middleTopMobile : null),
            }}
          >
            <div>
              <div style={styles.middleTitle}>Otra opción</div>
              <div style={styles.middleSub}>
                Si todavía no quieres descartar ninguno, puedes mantener ambos por ahora. SyncPlans dejará claro que este cruce sigue pendiente para revisarlo después.
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

        <section
          style={{
            ...styles.footerBar,
            ...(isMobile ? styles.footerBarMobile : null),
          }}
        >
          <button onClick={goBack} style={styles.secondaryBtn}>
            Volver
          </button>

          <button
            onClick={goToActions}
            style={{
              ...styles.primaryBtn,
              ...(decisionReady ? null : styles.primaryBtnMuted),
            }}
          >
            {decisionReady ? "Confirmar y seguir al cierre" : "Ir al cierre"}
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
  topRowMobile: {
    gridTemplateColumns: "1fr",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  topActionsMobile: {
    justifyContent: "flex-start",
    flexWrap: "wrap",
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
    gap: 10,
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
  heroInfoRow: {
    marginTop: 8,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  heroInfoRowMobile: {
    gridTemplateColumns: "minmax(0, 1fr)",
  },
  heroInfoCard: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  },
  heroInfoLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(235,241,255,0.58)",
  },
  heroInfoValue: {
    fontSize: 14,
    lineHeight: 1.5,
    color: "#F3F6FF",
    fontWeight: 700,
  },
  compareGrid: {
    marginTop: 18,
    display: "grid",
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
    color: "#DCE5FF",
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  metaBlock: {
    display: "grid",
    gap: 10,
  },
  metaRow: {
    display: "grid",
    gap: 4,
    fontSize: 14,
    color: "rgba(235,241,255,0.84)",
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(235,241,255,0.56)",
  },
  notesBox: {
    borderRadius: 16,
    padding: 12,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "rgba(235,241,255,0.82)",
    fontSize: 13,
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  choiceBtn: {
    borderRadius: 16,
    padding: "12px 16px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
  },
  choiceBtnSelected: {
    border: "1px solid rgba(103,133,255,0.30)",
    background:
      "linear-gradient(135deg, rgba(91,120,255,0.20), rgba(119,95,255,0.20))",
    boxShadow: "0 16px 34px rgba(63,93,227,0.18)",
  },
  middleCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
  },
  middleTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    flexWrap: "wrap",
  },
  middleTopMobile: {
    alignItems: "stretch",
  },
  middleTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  middleSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(235,241,255,0.66)",
    lineHeight: 1.5,
    maxWidth: 720,
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
    border: "1px solid rgba(255,214,102,0.30)",
    background: "rgba(255,214,102,0.10)",
    color: "#FFF0C7",
  },
  decisionGuide: {
    marginTop: 16,
    marginBottom: 4,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 6,
  },
  decisionGuideEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#9FB3FF",
    fontWeight: 800,
  },
  decisionGuideTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: "#F8FBFF",
  },
  decisionGuideSub: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(230,236,255,0.80)",
    maxWidth: 780,
  },
  decisionGuideFocus: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.55,
    color: "#DCE5FF",
    fontWeight: 700,
  },
  impactCard: {
    marginTop: 16,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(103,133,255,0.18)",
    background:
      "linear-gradient(180deg, rgba(18,24,52,0.92), rgba(10,14,30,0.92))",
    display: "grid",
    gap: 8,
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  },
  impactEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#AEBEFF",
    fontWeight: 800,
  },
  impactTitle: {
    fontSize: 20,
    fontWeight: 900,
    color: "#F8FBFF",
    letterSpacing: "-0.02em",
  },
  impactSub: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.80)",
    maxWidth: 760,
  },
  impactNext: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "#DCE5FF",
    fontWeight: 700,
  },
  footerBar: {
    marginTop: 20,
    display: "flex",
    justifyContent: "flex-end",
    gap: 12,
    flexWrap: "wrap",
  },
  footerBarMobile: {
    justifyContent: "stretch",
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
  primaryBtnMuted: {
    opacity: 0.92,
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
    color: "#F6F8FC",
    fontSize: 16,
    fontWeight: 900,
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