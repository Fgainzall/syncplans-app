"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AppHero from "@/components/AppHero";
import MobileScaffold from "@/components/MobileScaffold";
import { trackEvent, trackEventOnce, trackScreenView } from "@/lib/analytics";

import {
  CalendarEvent,
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  attachEvents,
  filterIgnoredConflicts,
} from "@/lib/conflicts";
import { normalizeGroupType } from "@/lib/naming";
import {
  getConflictDecisionSnapshot,
  resolveConflictResolution,
} from "@/lib/decisionEngine";

import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  Resolution,
  getMyConflictResolutionsMap,
} from "@/lib/conflictResolutionsDb";
import {
  filterOutDeclinedEvents,
  getMyDeclinedEventIds,
} from "@/lib/eventResponsesDb";
import { getIgnoredConflictKeys } from "@/lib/conflictPrefs";
import { markConflictNotificationsAsRead } from "@/lib/notificationsDb";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { hasPremiumAccess } from "@/lib/premium";

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

  if (!sameDay) {
    return `${s.toLocaleDateString()} ${hhmm(
      s
    )} → ${e.toLocaleDateString()} ${hhmm(e)}`;
  }

  return `${hhmm(s)} – ${hhmm(e)}`;
}

function normalizeForConflicts(gt: string | null | undefined): GroupType {
  return normalizeGroupType(gt) as GroupType;
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
    }

    mq.addListener(apply);
    return () => {
      mq.removeListener(apply);
    };
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

export default function DetectedClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const isMobile = useIsMobileWidth(520);

  const groupIdFromUrl = sp.get("groupId");
  const focusEventId = sp.get("eventId");

  const [booting, setBooting] = useState(true);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [declinedEventIds, setDeclinedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [ignoredConflictKeys, setIgnoredConflictKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    void trackScreenView({
      screen: "conflicts_detected",
      metadata: {
        source: focusEventId ? "notification_or_focus" : "conflicts_tab",
        groupId: groupIdFromUrl ?? null,
        focusEventId: focusEventId ?? null,
      },
    });
  }, [focusEventId, groupIdFromUrl]);

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
        const [{ events: ev }, dbMap, declined, ignored, fetchedProfile] = await Promise.all([
          loadEventsFromDb({
            groupId: groupIdFromUrl ?? undefined,
          }),
          getMyConflictResolutionsMap().catch(() => ({})),
          getMyDeclinedEventIds().catch(() => new Set<string>()),
          getIgnoredConflictKeys().catch(() => new Set<string>()),
          getMyProfile().catch(() => null),
        ]);

        if (!alive) return;

        setEvents(Array.isArray(ev) ? ev : []);
        setResMap(dbMap ?? {});
        setDeclinedEventIds(declined ?? new Set());
        setIgnoredConflictKeys(ignored ?? new Set());
        setProfile(fetchedProfile ?? null);
      } catch {
        if (!alive) return;
        setEvents([]);
        setResMap({});
        setDeclinedEventIds(new Set());
        setIgnoredConflictKeys(new Set());
        setProfile(null);
      } finally {
        if (alive) {
          setBooting(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, groupIdFromUrl]);

  useEffect(() => {
    let alive = true;

    const refreshFromDb = async () => {
      try {
        const [nextResMap, nextDeclined, nextIgnored] = await Promise.all([
          getMyConflictResolutionsMap().catch(() => ({})),
          getMyDeclinedEventIds().catch(() => new Set<string>()),
          getIgnoredConflictKeys().catch(() => new Set<string>()),
        ]);

        if (!alive) return;

        setResMap(nextResMap ?? {});
        setDeclinedEventIds(nextDeclined ?? new Set());
        setIgnoredConflictKeys(nextIgnored ?? new Set());
      } catch {
        // no rompemos UI por refresh fallido
      }
    };

    const onFocus = () => {
      void refreshFromDb();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshFromDb();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const visibleEvents = useMemo<CalendarEvent[]>(() => {
    return filterOutDeclinedEvents(
      Array.isArray(events) ? events : [],
      declinedEventIds
    );
  }, [events, declinedEventIds]);

  const allVisibleConflicts = useMemo<AttachedConflict[]>(() => {
    const normalized: CalendarEvent[] = visibleEvents.map((e) => ({
      ...e,
      groupType: normalizeForConflicts(e.groupType),
    }));

    const cx = computeVisibleConflicts(normalized);
    const visible = filterIgnoredConflicts(cx, ignoredConflictKeys);

    return attachEvents(
      visible,
      visibleEvents
    ) as unknown as AttachedConflict[];
  }, [visibleEvents, ignoredConflictKeys]);

  /**
   * Mantenemos solo conflictos pendientes reales:
   * - el evento declined ya salió del universo por visibleEvents
   * - aquí además ocultamos conflictos ya resueltos en conflict_resolutions
   */
  const pendingConflicts = useMemo<AttachedConflict[]>(() => {
    const pending = allVisibleConflicts.filter((c) => {
      const snapshot = getConflictDecisionSnapshot({
        conflict: {
          id: c.id,
          existing: c.existingEventId,
          incoming: c.incomingEventId,
        },
        resolvedConflictMap: resMap,
      });

      return snapshot.isPending;
    });

    if (!focusEventId) return pending;

    return pending.filter(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    );
  }, [allVisibleConflicts, resMap, focusEventId]);
  const focusedEvent = useMemo(() => {
    if (!focusEventId) return null;

    return (
      visibleEvents.find((e) => String(e.id) === String(focusEventId)) ?? null
    );
  }, [visibleEvents, focusEventId]);

const isFocusedView = Boolean(focusEventId);
const hasPremium = hasPremiumAccess(profile);

  const focusRelatedVisibleConflicts = useMemo(() => {
    if (!focusEventId) return [];

    return allVisibleConflicts.filter(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    );
  }, [allVisibleConflicts, focusEventId]);

  const focusSummary = useMemo(() => {
    if (!focusEventId) {
      return { relatedCount: 0, pendingCount: 0, visibleCount: 0 };
    }

    const pendingCount = pendingConflicts.filter(
      (c) =>
        String(c.existingEventId) === String(focusEventId) ||
        String(c.incomingEventId) === String(focusEventId)
    ).length;

    const visibleCount = focusRelatedVisibleConflicts.length;

    return {
      relatedCount: pendingCount > 0 ? pendingCount : visibleCount,
      pendingCount,
      visibleCount,
    };
  }, [pendingConflicts, focusRelatedVisibleConflicts, focusEventId]);
const summary = useMemo(() => {
  const totalVisible = allVisibleConflicts.length;
  let decided = 0;

  for (const c of allVisibleConflicts) {
    const resolution = resolveConflictResolution(
      {
        id: c.id,
        existing: c.existingEventId,
        incoming: c.incomingEventId,
      },
      resMap
    );

    if (resolution) decided++;
  }

  const pending = pendingConflicts.length;

  return {
    totalVisible,
    decided,
    pending,
  };
}, [allVisibleConflicts, pendingConflicts, resMap]);

const shouldShowUpgradeNudge = !hasPremium && summary.pending > 0;

const premiumNudge = useMemo(() => {
  if (!shouldShowUpgradeNudge) return null;

  if (isFocusedView) {
    return {
      title:
        "Cuando un cruce ya te trajo hasta aquí, Premium ayuda a que el próximo no vuelva a empezar en mensajes sueltos.",
      copy:
        "Premium suma más contexto compartido para anticipar choques antes, decidir más rápido y dejar menos espacio para interpretaciones distintas cuando coordinan entre personas.",
      primaryLabel: "Ver ventajas Premium",
      secondaryLabel: "Seguir resolviendo",
    };
  }

  return {
    title:
      "Resolver conflictos está bien. Anticiparlos con más claridad compartida es todavía mejor.",
    copy:
      "Si ya estás coordinando de verdad dentro de SyncPlans, Premium te ayuda a detectar mejor los cruces, decidir con menos ida y vuelta y sostener una sola versión clara del tiempo compartido.",
    primaryLabel: "Desbloquear Premium",
    secondaryLabel: "Seguir resolviendo",
  };
}, [shouldShowUpgradeNudge, isFocusedView]);

const returnPressure = useMemo(() => {
  if (summary.pending > 0) {
    return {
      title: `Hay ${summary.pending} conflicto${summary.pending === 1 ? "" : "s"} esperando una decisión tuya.`,
      copy: "Si lo resuelves ahora, evitas que el cruce siga viviendo en mensajes sueltos o en interpretaciones distintas.",
      primaryLabel: "Resolver ahora",
      primaryAction: "resolve" as const,
    };
  }

  if (summary.decided > 0) {
    return {
      title: `Ya tienes ${summary.decided} decisión${summary.decided === 1 ? "" : "es"} lista${summary.decided === 1 ? "" : "s"} para aplicar.`,
      copy: "Un último paso y queda claro para todos dentro de SyncPlans.",
      primaryLabel: "Aplicar decisiones",
      primaryAction: "apply" as const,
    };
  }

  return null;
}, [summary.pending, summary.decided]);

  useEffect(() => {
    if (booting) return;
    if (pendingConflicts.length === 0) return;

    const firstConflict = pendingConflicts[0];

    const metadata = {
      screen: "conflicts_detected",
      source: focusEventId ? "notification_or_focus" : "conflicts_tab",
      groupId: groupIdFromUrl ?? null,
      focusEventId: focusEventId ?? null,
      pendingCount: pendingConflicts.length,
      visibleCount: allVisibleConflicts.length,
      decidedCount: summary.decided,
      firstConflictId: firstConflict?.id ?? null,
      firstExistingEventId: firstConflict?.existingEventId ?? null,
      firstIncomingEventId: firstConflict?.incomingEventId ?? null,
      hasPremium,
      isFocusedView,
    };

    void trackEvent({
      event: "conflict_seen",
      metadata,
    });

    void trackEventOnce({
      event: "first_conflict_seen",
      scope: "local",
      onceKey: "funnel:first_conflict_seen",
      metadata,
    });
  }, [
    booting,
    pendingConflicts,
    allVisibleConflicts.length,
    summary.decided,
    groupIdFromUrl,
    focusEventId,
    hasPremium,
    isFocusedView,
  ]);

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

  useEffect(() => {
    if (booting) return;
    if (!shouldShowUpgradeNudge || !premiumNudge) return;

    const metadata = {
      screen: "conflicts_detected",
      placement: isFocusedView ? "focused_conflict" : "detected_list",
      source: focusEventId ? "notification_or_focus" : "conflicts_tab",
      pendingCount: summary.pending,
      decidedCount: summary.decided,
      visibleCount: summary.totalVisible,
      groupId: groupIdFromUrl ?? null,
      focusEventId: focusEventId ?? null,
      hasPremium,
      isFocusedView,
    };

    void trackEventOnce({
      event: "premium_viewed",
      scope: "session",
      onceKey: `premium_viewed:conflicts_detected:${isFocusedView ? "focused" : "list"}`,
      metadata,
    });
  }, [
    booting,
    shouldShowUpgradeNudge,
    premiumNudge,
    isFocusedView,
    focusEventId,
    summary.pending,
    summary.decided,
    summary.totalVisible,
    groupIdFromUrl,
    hasPremium,
  ]);

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

    const selectedConflict = pendingConflicts[safe];

    void trackEvent({
      event: "conflict_compare_opened",
      metadata: {
        screen: "conflicts_detected",
        source: focusEventId ? "notification_or_focus" : "conflicts_tab",
        index: safe,
        pendingCount: pendingConflicts.length,
        conflictId: selectedConflict?.id ?? null,
        existingEventId: selectedConflict?.existingEventId ?? null,
        incomingEventId: selectedConflict?.incomingEventId ?? null,
        groupId: groupIdFromUrl ?? null,
        focusEventId: focusEventId ?? null,
      },
    });

    router.push(`/conflicts/compare?${qp.toString()}`);
  };

  const resumeNext = () => {
    if (pendingConflicts.length === 0) return;
    openCompare(0);
  };

  const openFocusedCompare = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);

    const selectedConflict = pendingConflicts[0] ?? null;

    void trackEvent({
      event: "conflict_compare_opened",
      metadata: {
        screen: "conflicts_detected",
        source: focusEventId ? "notification_or_focus" : "conflicts_tab",
        index: 0,
        pendingCount: pendingConflicts.length,
        conflictId: selectedConflict?.id ?? null,
        existingEventId: selectedConflict?.existingEventId ?? null,
        incomingEventId: selectedConflict?.incomingEventId ?? null,
        groupId: groupIdFromUrl ?? null,
        focusEventId: focusEventId ?? null,
      },
    });

    router.push(`/conflicts/compare?${qp.toString()}`);
  };

  const goActions = () => {
    if (summary.decided === 0 && summary.pending > 0) {
      resumeNext();
      return;
    }

    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);

    router.push(`/conflicts/actions?${qp.toString()}`);
  };

  const openPremiumPlans = () => {
    void trackEvent({
      event: "premium_cta_clicked",
      metadata: {
        screen: "conflicts_detected",
        placement: isFocusedView ? "focused_conflict" : "detected_list",
        source: focusEventId ? "notification_or_focus" : "conflicts_tab",
        pendingCount: summary.pending,
        decidedCount: summary.decided,
        visibleCount: summary.totalVisible,
        groupId: groupIdFromUrl ?? null,
        focusEventId: focusEventId ?? null,
        hasPremium,
        isFocusedView,
      },
    });

    router.push("/planes");
  };

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={styles.page}>
        <div style={styles.shell} className="spDet-shell">
          <AppHero
            mobileNav="bottom"
            title="Conflictos"
            subtitle="Analizando tu agenda para encontrar choques y ayudarte a cerrar lo que todavía no quedó alineado entre personas."
          />

          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Analizando tu agenda…</div>
              <div style={styles.loadingSub}>Buscando choques de horario</div>
            </div>
          </div>
        </div>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={1120} style={styles.page}>
      <div style={styles.shell} className="spDet-shell">
        <div style={styles.topRow} className="spDet-topRow">
                 <AppHero
            mobileNav="bottom"
            title="Conflictos"
            subtitle={
              summary.pending === 0
                ? "Tu agenda está sincronizada."
                : isFocusedView
                ? "Te trajimos directo al cruce que más conviene cerrar ahora."
                : "Aquí conviertes un cruce confuso en una sola decisión clara para todos."
            }
          />
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Conflictos</div>
            <h1 style={styles.h1}>
              {summary.pending === 0
                ? "Todo claro por aquí"
                : "Esto se resuelve en un minuto"}
            </h1>
            <div style={styles.sub}>
              {summary.pending === 0
                ? "No encontramos choques pendientes visibles para este contexto."
                : `Detectamos ${summary.pending} conflicto${summary.pending === 1 ? "" : "s"} pendiente${summary.pending === 1 ? "" : "s"}. Decide una vez aquí y evita seguir aclarando lo mismo por fuera del sistema.`}
            </div>
          </div>

          <div style={styles.heroRight}>
            {summary.pending > 0 ? (
              <button onClick={resumeNext} style={styles.primaryBtn}>
                Resolver ahora ✨
              </button>
            ) : isFocusedView ? (
              <button onClick={openFocusedCompare} style={styles.primaryBtn}>
                Revisar este conflicto
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
        {isFocusedView && focusedEvent ? (
          <section style={styles.focusCard}>
            <div style={styles.focusEyebrow}>Conflicto priorizado</div>
            <div style={styles.focusTitle}>
              {focusedEvent.title || "Evento seleccionado"}
            </div>
            <div style={styles.focusSub}>
              {focusSummary.relatedCount > 0
                ? `Este evento tiene ${focusSummary.relatedCount} conflicto${
                    focusSummary.relatedCount === 1 ? "" : "s"
                  } ${focusSummary.pendingCount > 0 ? "pendiente" : "relacionado"}${
                    focusSummary.relatedCount === 1 ? "" : "s"
                  } y por eso lo trajimos arriba: aquí conviene decidir antes de que el ruido vuelva al chat.`
                : "Llegaste desde una alerta específica. Si ya no aparece conflicto pendiente, puede que ya haya sido resuelto o ignorado."}
            </div>

            <div style={styles.focusActions}>
              <button onClick={openFocusedCompare} style={styles.primaryBtn}>
                Resolver conflicto
              </button>

              <button onClick={() => router.push("/calendar")} style={styles.secondaryBtn}>
                Volver al calendario
              </button>
            </div>
          </section>
        ) : null}

        {returnPressure ? (
          <section style={styles.returnCard}>
            <div style={styles.returnCopy}>
              <div style={styles.returnEyebrow}>Pendiente vivo</div>
              <div style={styles.returnTitle}>{returnPressure.title}</div>
              <div style={styles.returnSub}>{returnPressure.copy}</div>
            </div>

            <div style={styles.returnActions}>
              <button
                onClick={returnPressure.primaryAction === "apply" ? goActions : resumeNext}
                style={styles.primaryBtn}
              >
                {returnPressure.primaryLabel}
              </button>
              <button
                onClick={() => router.push("/calendar")}
                style={styles.secondaryBtn}
              >
                Ver calendario
              </button>
            </div>
          </section>
        ) : null}

        {shouldShowUpgradeNudge && premiumNudge ? (
          <section style={styles.upgradeNudgeCard}>
            <div style={styles.upgradeNudgeTop}>
              <div style={styles.upgradeNudgeBadge}>Premium</div>
              <div style={styles.upgradeNudgeEyebrow}>Mejor coordinación compartida</div>
            </div>

            <div style={styles.upgradeNudgeTitle}>{premiumNudge.title}</div>

            <div style={styles.upgradeNudgeCopy}>{premiumNudge.copy}</div>

            <div style={styles.upgradeNudgeBullets}>
              <span style={styles.upgradeNudgeBullet}>Menos idas y vueltas</span>
              <span style={styles.upgradeNudgeBullet}>Más claridad compartida</span>
              <span style={styles.upgradeNudgeBullet}>Decisiones más rápidas</span>
            </div>

            <div style={styles.upgradeNudgeActions}>
              <button onClick={openPremiumPlans} style={styles.primaryBtn}>
                {premiumNudge.primaryLabel}
              </button>
              <button onClick={resumeNext} style={styles.secondaryBtn}>
                {premiumNudge.secondaryLabel}
              </button>
            </div>
          </section>
        ) : null}

        <section style={styles.listCard}>
          <div style={styles.listTop}>
            <div>
              <div style={styles.listTitle}>Conflictos detectados</div>
              <div style={styles.listSub}>
                Toca uno, compáralos lado a lado y deja una decisión clara.
              </div>
            </div>

            {(summary.pending > 0 || summary.decided > 0 || isFocusedView) && (
              <button
                onClick={
                  summary.pending > 0 || summary.decided > 0
                    ? goActions
                    : openFocusedCompare
                }
                style={styles.secondaryBtn}
              >
                {summary.decided > 0
                  ? "Aplicar decisiones"
                  : "Empezar a resolver"}
              </button>
            )}
          </div>

          {visibleConflicts.length === 0 ? (
            <div style={styles.emptyWrap}>
              <div style={styles.emptyTitle}>No hay conflictos visibles</div>
              <div style={styles.emptySub}>
                {summary.decided > 0
                  ? "Ya no quedan choques pendientes visibles. Si corresponde, aplica las decisiones que dejaste listas."
                  : "Ya no quedan choques pendientes para este contexto."}
              </div>
              {summary.decided > 0 ? (
                <div style={styles.emptyActions}>
                  <button onClick={goActions} style={styles.primaryBtn}>
                    Aplicar decisiones
                  </button>
                  <button onClick={() => router.push("/calendar")} style={styles.secondaryBtn}>
                    Volver al calendario
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div style={styles.items}>
              {visibleConflicts.map((c, idx) => {
                const a = c.existingEvent;
                const b = c.incomingEvent;

                const aMeta = groupMeta(normalizeForConflicts(a?.groupType));
                const bMeta = groupMeta(normalizeForConflicts(b?.groupType));

                return (
                  <button
                    key={c.id}
                    onClick={() => openCompare(idx)}
                    style={styles.item}
                  >
                    <div style={styles.itemHead}>
                      <div style={styles.badges}>
                        <span style={styles.badgeDanger}>
                          Choque real · {ymd(new Date(c.overlapStart))}
                        </span>

                        <span style={styles.badgePending}>Pendiente</span>
                      </div>

                      <span style={styles.arrow}>→</span>
                    </div>

                    <div style={styles.row}>
                      <span style={{ ...styles.dot, background: aMeta.dot }} />
                      <span style={styles.title}>{a?.title || "Evento A"}</span>
                      <span style={styles.time}>
                        {a ? prettyTimeRange(a.start, a.end) : ""}
                      </span>
                    </div>

                    <div style={styles.row}>
                      <span style={{ ...styles.dot, background: bMeta.dot }} />
                      <span style={styles.title}>{b?.title || "Evento B"}</span>
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
    </MobileScaffold>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    background:
      "radial-gradient(1000px 600px at 15% -10%, rgba(70,92,210,0.18), transparent 50%), linear-gradient(180deg, #071026 0%, #050914 100%)",
    color: "#F7F9FF",
  },
  shell: {
    width: "100%",
    display: "grid",
    gap: 0,
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
  returnCard: {
    marginTop: 16,
    borderRadius: 24,
    border: "1px solid rgba(96,165,250,0.18)",
    background:
      "linear-gradient(135deg, rgba(14,37,68,0.82), rgba(15,23,42,0.88))",
    boxShadow: "0 22px 56px rgba(0,0,0,0.20)",
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "center",
  },
  returnCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  returnEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    fontWeight: 900,
    color: "rgba(147,197,253,0.95)",
  },
  returnTitle: {
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  returnSub: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.78)",
    maxWidth: 820,
  },
  returnActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  upgradeNudgeCard: {
    marginTop: 16,
    borderRadius: 24,
    border: "1px solid rgba(56,189,248,0.20)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(168,85,247,0.08))",
    boxShadow: "0 24px 60px rgba(0,0,0,0.20)",
    padding: 18,
    display: "grid",
    gap: 10,
  },
  upgradeNudgeTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  upgradeNudgeBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(56,189,248,0.30)",
    background: "rgba(56,189,248,0.12)",
    color: "#F3F7FF",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  upgradeNudgeEyebrow: {
    fontSize: 11,
    lineHeight: 1.2,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    fontWeight: 900,
    color: "rgba(191,219,254,0.86)",
  },
  upgradeNudgeTitle: {
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  upgradeNudgeCopy: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(235,241,255,0.78)",
    maxWidth: 820,
  },
  upgradeNudgeBullets: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  upgradeNudgeBullet: {
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(243,247,255,0.88)",
  },
  upgradeNudgeActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 4,
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
  emptyActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 8,
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
    focusCard: {
    marginTop: 14,
    borderRadius: 22,
    border: "1px solid rgba(244,114,182,0.18)",
    background:
      "linear-gradient(180deg, rgba(83,18,45,0.32), rgba(32,12,27,0.22))",
    boxShadow: "0 18px 48px rgba(0,0,0,0.20)",
    padding: 18,
    display: "grid",
    gap: 8,
  },
  focusEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase" as const,
    fontWeight: 800,
    color: "rgba(255,194,221,0.88)",
  },
  focusTitle: {
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 800,
    color: "#FFF4FA",
  },
  focusSub: {
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(255,232,242,0.76)",
  },
  focusActions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 6,
  },
};