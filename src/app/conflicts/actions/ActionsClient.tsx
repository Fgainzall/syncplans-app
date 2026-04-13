"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import supabase from "@/lib/supabaseClient";

import {
  CalendarEvent,
  GroupType,
  computeVisibleConflicts,
  attachEvents,
  conflictInvolvesEvent,
  filterIgnoredConflicts,
  type ConflictItem,
} from "@/lib/conflicts";
import { normalizeGroupType } from "@/lib/naming";
import {
  buildConflictLogPayload,
  getConflictDecisionSnapshot,
  resolveConflictResolution,
} from "@/lib/decisionEngine";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  Resolution,
  getMyConflictResolutionsMap,
} from "@/lib/conflictResolutionsDb";
import { createConflictResolutionLog } from "@/lib/conflictResolutionsLogDb";
import {
  declineEventForCurrentUser,
  filterOutDeclinedEvents,
  getMyDeclinedEventIds,
} from "@/lib/eventResponsesDb";
import { getIgnoredConflictKeys, setConflictPreference } from "@/lib/conflictPrefs";
import {
  deleteEventsByIdsDetailed,
  getEventById,
} from "@/lib/eventsDb";
import {
  createConflictAutoAdjustedNotification,
  createConflictDecisionNotification,
  createNotifications,
} from "@/lib/notificationsDb";

function normalizeForConflicts(gt: string | null | undefined): GroupType {
  return normalizeGroupType(gt) as GroupType;
}


function humanizeConflictActionError(
  err: unknown,
  fallback = "Intenta nuevamente."
) {
  const message =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();

  if (!message) return fallback;

  const lowered = message.toLowerCase();

  if (lowered.includes("abort")) {
    return "La acción tardó demasiado o se interrumpió. Vuelve a intentarlo.";
  }

  if (
    lowered.includes("fetch") ||
    lowered.includes("network") ||
    lowered.includes("failed to fetch")
  ) {
    return "Parece un problema de red. Revisa tu conexión e inténtalo otra vez.";
  }

  return message;
}

function safeTitle(value?: string | null) {
  const v = String(value ?? "").trim();
  return v || "Evento sin título";
}

function eventFromConflictById(conflict: ConflictItem, eventId: string) {
  const safeId = String(eventId ?? "").trim();
  if (!safeId) return null;

  const existingId = String(conflict.existingEventId ?? "").trim();
  if (existingId && existingId === safeId) {
    return conflict.existing ?? conflict.existingEvent ?? null;
  }

  const incomingId = String(conflict.incomingEventId ?? "").trim();
  if (incomingId && incomingId === safeId) {
    return conflict.incoming ?? conflict.incomingEvent ?? null;
  }

  return null;
}


function resolveEventOwnerId(event: any): string | null {
  const candidate =
    event?.owner_id ??
    event?.ownerId ??
    event?.created_by ??
    event?.createdBy ??
    event?.user_id ??
    event?.userId ??
    null;

  const normalized = String(candidate ?? "").trim();
  return normalized || null;
}

function resolveConflictGroupId(
  conflict: ConflictItem,
  fallbackGroupId?: string | null
): string | null {
  const raw =
    conflict.existing?.groupId ??
    conflict.incoming?.groupId ??
    fallbackGroupId ??
    null;

  const normalized = String(raw ?? "").trim();
  return normalized || null;
}
function groupLabel(groupType?: string | null) {
  const v = String(groupType ?? "personal").toLowerCase();
  if (v === "pair" || v === "couple") return "Pareja";
  if (v === "family") return "Familia";
  if (v === "shared" || v === "other") return "Compartido";
  return "Personal";
}

function formatRange(startIso?: string | null, endIso?: string | null) {
  const start = startIso ? new Date(startIso) : null;
  const end = endIso ? new Date(endIso) : null;

  if (!start || Number.isNaN(start.getTime())) return "Sin fecha";

  try {
    if (end && !Number.isNaN(end.getTime())) {
      const sameDay = start.toDateString() === end.toDateString();

      if (sameDay) {
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

    return start.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sin fecha";
  }
}

type ApplySummary = {
  resolvedCount: number;
  deletedCount: number;
  blockedCount: number;
  ignoredCount: number;
  softRejectedCount: number;
  notifiedCount: number;
  fallbackKeepBothCount: number;
};

export default function ActionsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupIdFromUrl = searchParams.get("groupId");
  const focusEventId = searchParams.get("eventId");
  const focusConflictId = searchParams.get("conflict");
  const focusIndex = searchParams.get("i");

  const [booting, setBooting] = useState(true);
  const [applying, setApplying] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());
  const [ignoredConflictKeys, setIgnoredConflictKeys] = useState<Set<string>>(
    new Set()
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ApplySummary | null>(null);
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < 920;
  });
  const applyInFlightRef = useRef(false);

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

      setCurrentUserId(user.id);

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

  const visibleEventsForConflicts = useMemo(() => {
    return filterOutDeclinedEvents(
      Array.isArray(events) ? events : [],
      declinedIds
    );
  }, [events, declinedIds]);

  const allVisibleConflicts = useMemo<ConflictItem[]>(() => {
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

  const scopedConflicts = useMemo(() => {
    if (!focusEventId) return allVisibleConflicts;
    return allVisibleConflicts.filter((c) =>
      conflictInvolvesEvent(c, focusEventId)
    );
  }, [allVisibleConflicts, focusEventId]);

  const resolvedConflicts = useMemo(() => {
    return scopedConflicts.filter((c) => {
      const snapshot = getConflictDecisionSnapshot({
        conflict: {
          id: c.id,
          existing: c.existingEventId,
          incoming: c.incomingEventId,
        },
        resolvedConflictMap: resMap,
      });

      return snapshot.isResolved;
    });
  }, [scopedConflicts, resMap]);

  const keepBothConflicts = useMemo(() => {
    return resolvedConflicts.filter((c) => {
      const resolution = resolveConflictResolution(
        {
          id: c.id,
          existing: c.existingEventId,
          incoming: c.incomingEventId,
        },
        resMap
      );

      return resolution === "none";
    });
  }, [resolvedConflicts, resMap]);

  const actionableConflicts = useMemo(() => {
    return resolvedConflicts.filter((c) => {
      const resolution = resolveConflictResolution(
        {
          id: c.id,
          existing: c.existingEventId,
          incoming: c.incomingEventId,
        },
        resMap
      );

      return (
        resolution === "keep_existing" || resolution === "replace_with_new"
      );
    });
  }, [resolvedConflicts, resMap]);

  const pendingCount = Math.max(
    scopedConflicts.length - resolvedConflicts.length,
    0
  );

  const goBack = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    if (focusEventId) qp.set("eventId", focusEventId);
    if (focusConflictId) qp.set("conflict", focusConflictId);
    if (focusIndex) qp.set("i", focusIndex);
    router.push(`/conflicts/compare?${qp.toString()}`, { scroll: false });
  };

  const goToSummary = (result?: ApplySummary) => {
    const qp = new URLSearchParams();
    qp.set("from", "conflicts");

    if (result) {
      qp.set("resolved", String(result.resolvedCount));
      qp.set("deleted", String(result.deletedCount));
      qp.set("blocked", String(result.blockedCount));
      qp.set("ignored", String(result.ignoredCount));
      qp.set("softRejected", String(result.softRejectedCount));
      qp.set("notified", String(result.notifiedCount));
      qp.set("fallbackKeepBoth", String(result.fallbackKeepBothCount));
    }

    router.push(`/summary?${qp.toString()}`, { scroll: false });
  };

  const applyAll = async () => {
    if (applyInFlightRef.current || applying || !currentUserId) return;

    applyInFlightRef.current = true;

    try {
      setApplying(true);

      const idsRequestedForRemoval = new Set<string>();
      const ignoredConflictIds = new Set<string>();
      const removalPlanByEventId = new Map<
        string,
        { conflictId: string; resolution: Resolution }
      >();

      for (const c of actionableConflicts) {
        const resolution = resolveConflictResolution(
          {
            id: c.id,
            existing: c.existingEventId,
            incoming: c.incomingEventId,
          },
          resMap
        );
        const existingId = String(c.existingEventId ?? "").trim();
        const incomingId = String(c.incomingEventId ?? "").trim();

        if (!existingId || !incomingId || !resolution) continue;

        if (resolution === "keep_existing") {
          idsRequestedForRemoval.add(incomingId);
          ignoredConflictIds.add(String(c.id));
          removalPlanByEventId.set(incomingId, {
            conflictId: String(c.id),
            resolution,
          });
        }

        if (resolution === "replace_with_new") {
          idsRequestedForRemoval.add(existingId);
          ignoredConflictIds.add(String(c.id));
          removalPlanByEventId.set(existingId, {
            conflictId: String(c.id),
            resolution,
          });
        }
      }

      for (const c of keepBothConflicts) {
        ignoredConflictIds.add(String(c.id));
      }

      let deletedCount = 0;
      let blockedCount = 0;
      let fallbackKeepBothCount = 0;
      const blockedIds = new Set<string>();
      const fallbackConflictIds = new Set<string>();

      if (idsRequestedForRemoval.size > 0) {
        const deletionResult = await deleteEventsByIdsDetailed(
          Array.from(idsRequestedForRemoval)
        );

        deletedCount = Number(deletionResult?.deletedCount ?? 0);
        blockedCount = Array.isArray(deletionResult?.blockedIds)
          ? deletionResult.blockedIds.length
          : 0;

        for (const rawId of deletionResult?.blockedIds ?? []) {
          const blockedId = String(rawId ?? "").trim();
          if (!blockedId) continue;

          blockedIds.add(blockedId);

          const plan = removalPlanByEventId.get(blockedId);
          if (plan?.conflictId) {
            fallbackConflictIds.add(plan.conflictId);
          }
        }
      }

      if (blockedIds.size > 0) {
        const declineWrites: Promise<unknown>[] = [];

        for (const blockedId of blockedIds) {
          const blockedFromEvents = events.find(
            (event) => String(event?.id ?? "").trim() === blockedId
          );
         const blockedGroupId =
  String(blockedFromEvents?.groupId ?? "").trim() || null;

          declineWrites.push(
            declineEventForCurrentUser(
              blockedId,
              blockedGroupId,
              "Fallback keep both after blocked delete"
            )
          );
        }

        await Promise.allSettled(declineWrites);
        fallbackKeepBothCount = fallbackConflictIds.size;
      }

      let notifiedCount = 0;

      for (const blockedId of blockedIds) {
        try {
          const dbEvent = await getEventById(blockedId);
          const targetUserId = resolveEventOwnerId(dbEvent);

          if (!targetUserId || targetUserId === currentUserId) continue;

          await createNotifications([
            {
              user_id: targetUserId,
              type: "event_rejected",
              title: "Uno de tus eventos no pudo reemplazarse",
              body:
                "Otro miembro resolvió el conflicto, pero tu evento no pudo eliminarse. Se mantendrán ambos para evitar inconsistencias.",
              entity_id: blockedId,
              payload: {
                event_id: blockedId,
                actor_user_id: currentUserId,
                resolution: "fallback_keep_both",
              },
            },
          ]);

          notifiedCount += 1;
        } catch {
          // no rompemos el flujo por una notificación
        }
      }

      if (ignoredConflictIds.size > 0) {
        const ignoredWrites: Promise<unknown>[] = [];

        for (const conflict of [...actionableConflicts, ...keepBothConflicts]) {
          const existingId = String(conflict.existingEventId ?? "").trim();
          const incomingId = String(conflict.incomingEventId ?? "").trim();
          if (!existingId || !incomingId) continue;

          ignoredWrites.push(
            setConflictPreference(existingId, incomingId, "ignored")
          );
        }

        await Promise.allSettled(ignoredWrites);
      }

      const logWrites: Promise<unknown>[] = [];
      const decisionNotifications: Array<{
        user_id: string;
        actor_user_id: string;
        conflict_id: string;
        decision_type: string;
        final_action: string;
        affected_event_id: string;
        affected_event_title: string | null;
        kept_event_id: string | null;
        kept_event_title: string | null;
        group_id: string | null;
        source: string;
      }> = [];

      for (const c of actionableConflicts) {
        const resolution = resolveConflictResolution(
          {
            id: c.id,
            existing: c.existingEventId,
            incoming: c.incomingEventId,
          },
          resMap
        );
        const existingId = String(c.existingEventId ?? "").trim();
        const incomingId = String(c.incomingEventId ?? "").trim();

        if (!resolution || !existingId || !incomingId) continue;

        const targetEventId =
          resolution === "keep_existing" ? incomingId : existingId;

        const wasBlocked = blockedIds.has(targetEventId);
        const finalAction = wasBlocked
          ? "fallback_keep_both"
          : buildConflictLogPayload(resolution).finalAction;
        const groupIdForConflict = resolveConflictGroupId(c, groupIdFromUrl);

        logWrites.push(
          createConflictResolutionLog({
            conflictId: String(c.id),
            groupId: groupIdForConflict,
            decidedBy: currentUserId,
            decisionType: buildConflictLogPayload(resolution).decisionType,
            finalAction,
            reason: wasBlocked
              ? "No se pudo eliminar el evento objetivo por permisos. SyncPlans aplicó fallback automático y mantuvo ambos."
              : null,
            metadata: {
              existing_event_id: existingId,
              incoming_event_id: incomingId,
              target_event_id: targetEventId,
              fallback_applied: wasBlocked,
              blocked_event_id: wasBlocked ? targetEventId : null,
              source: "conflicts_actions",
            },
          })
        );

        try {
          const targetFromConflict = eventFromConflictById(c, targetEventId);
          const targetDbEvent = targetFromConflict ?? (await getEventById(targetEventId));
          const targetUserId = resolveEventOwnerId(targetDbEvent);

          if (targetUserId && targetUserId !== currentUserId) {
            const keptEventId = resolution === "keep_existing" ? existingId : incomingId;
            const keptFromConflict = eventFromConflictById(c, keptEventId);

            decisionNotifications.push({
              user_id: targetUserId,
              actor_user_id: currentUserId,
              conflict_id: String(c.id),
              decision_type: buildConflictLogPayload(resolution).decisionType,
              final_action: finalAction,
              affected_event_id: targetEventId,
              affected_event_title: safeTitle(
                (targetDbEvent as any)?.title ?? (targetFromConflict as any)?.title ?? null
              ),
              kept_event_id: keptEventId || null,
              kept_event_title: safeTitle((keptFromConflict as any)?.title ?? null),
              group_id: groupIdForConflict,
              source: "conflicts_actions",
            });
          }
        } catch {
          // no rompemos el flujo por una notificación
        }
      }

      for (const c of keepBothConflicts) {
        const existingId = String(c.existingEventId ?? "").trim();
        const incomingId = String(c.incomingEventId ?? "").trim();

        if (!existingId || !incomingId) continue;

        logWrites.push(
          createConflictResolutionLog({
            conflictId: String(c.id),
            groupId: resolveConflictGroupId(c, groupIdFromUrl),
            decidedBy: currentUserId,
            decisionType: "keep_both",
            finalAction: "keep_both",
            reason: null,
            metadata: {
              existing_event_id: existingId,
              incoming_event_id: incomingId,
              fallback_applied: false,
              source: "conflicts_actions",
            },
          })
        );
      }

      if (logWrites.length > 0) {
        await Promise.allSettled(logWrites);
      }

      if (decisionNotifications.length > 0) {
        try {
          for (const row of decisionNotifications) {
            const decisionLabel =
              row.final_action === "fallback_keep_both"
                ? `Se intentó resolver el conflicto con “${row.affected_event_title ?? "evento"}”, pero no se pudo eliminar. SyncPlans mantuvo ambos eventos automáticamente.`
                : row.final_action === "replace_with_new"
                  ? `Se reemplazó “${row.affected_event_title ?? "evento"}” por “${row.kept_event_title ?? "el nuevo evento"}”.`
                  : row.final_action === "keep_existing"
                    ? `Se conservó “${row.kept_event_title ?? "el evento existente"}”.`
                    : `Se tomó una decisión sobre un conflicto que involucraba “${row.affected_event_title ?? "un evento"}”.`;

            if (row.final_action === "fallback_keep_both") {
              await createConflictAutoAdjustedNotification({
                userId: row.user_id,
                decisionLabel,
                entityId: row.affected_event_id ?? null,
                payload: {
                  actor_user_id: row.actor_user_id,
                  conflict_id: row.conflict_id,
                  decision_type: row.decision_type,
                  final_action: row.final_action,
                  affected_event_id: row.affected_event_id,
                  affected_event_title: row.affected_event_title,
                  kept_event_id: row.kept_event_id,
                  kept_event_title: row.kept_event_title,
                  group_id: row.group_id,
                  source: row.source,
                },
              });
            } else {
              await createConflictDecisionNotification({
                userId: row.user_id,
                decisionLabel,
                entityId: row.affected_event_id ?? null,
                payload: {
                  actor_user_id: row.actor_user_id,
                  conflict_id: row.conflict_id,
                  decision_type: row.decision_type,
                  final_action: row.final_action,
                  affected_event_id: row.affected_event_id,
                  affected_event_title: row.affected_event_title,
                  kept_event_id: row.kept_event_id,
                  kept_event_title: row.kept_event_title,
                  group_id: row.group_id,
                  source: row.source,
                },
              });
            }

            notifiedCount += 1;
          }
        } catch (_error) {
          // No bloqueamos la resolución principal si falla una notificación.
        }
      }

      const result: ApplySummary = {
        resolvedCount: resolvedConflicts.length,
        deletedCount,
        blockedCount,
        ignoredCount: ignoredConflictIds.size,
        softRejectedCount: blockedIds.size,
        notifiedCount,
        fallbackKeepBothCount,
      };
await trackEvent({
  event: "conflict_resolved",
  userId: currentUserId,
  metadata: {
    resolvedCount: result.resolvedCount,
    deletedCount: result.deletedCount,
    blockedCount: result.blockedCount,
    ignoredCount: result.ignoredCount,
    softRejectedCount: result.softRejectedCount,
    notifiedCount: result.notifiedCount,
    fallbackKeepBothCount: result.fallbackKeepBothCount,
  },
});
      setSummary(result);

      if (fallbackKeepBothCount > 0) {
        setToast({
          title: "Aplicado con ajuste automático",
          sub:
            fallbackKeepBothCount === 1
              ? "Uno de los cambios no pudo completarse. Mantuvimos ambos para no romper nada."
              : `${fallbackKeepBothCount} cambios no pudieron completarse. Mantuvimos ambos para no romper nada.`,
        });
      } else {
        setToast({
          title: "Cambios aplicados",
          sub: "Perfecto. El cambio ya quedó aplicado y ahora te devuelvo al resumen.",
        });
      }

      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));

      setTimeout(() => {
        goToSummary(result);
      }, 700);
    } catch (e: any) {
      setToast({
        title: "No se pudo aplicar",
        sub:
          typeof e?.message === "string" && e.message.trim()
            ? e.message
            : "Intenta nuevamente.",
      });
    } finally {
      applyInFlightRef.current = false;
      setApplying(false);
    }
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.loadingCard}>Preparando cierre…</div>
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
          <div style={styles.kicker}>Cierre</div>
          <h1 style={styles.h1}>
            {focusEventId
              ? "Cierra este conflicto"
              : "Aplica lo que ya decidiste"}
          </h1>
          <div style={styles.sub}>
            {focusEventId
              ? "Aquí cerramos el conflicto que vienes revisando. SyncPlans aplicará solo las decisiones ligadas a este evento y luego te devolverá al resumen."
              : "Aquí cerramos el flujo. SyncPlans aplicará lo que ya decidiste y luego te devolverá al resumen."}
          </div>

          <div
            style={{
              ...styles.heroStats,
              gridTemplateColumns: isMobile
                ? "minmax(0, 1fr)"
                : "repeat(3, minmax(0, 1fr))",
            }}
          >
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Conflictos visibles</div>
              <div style={styles.statValue}>{scopedConflicts.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Con decisión guardada</div>
              <div style={styles.statValue}>{resolvedConflicts.length}</div>
            </div>

            <div style={styles.statCard}>
              <div style={styles.statLabel}>Pendientes</div>
              <div style={styles.statValue}>{pendingCount}</div>
            </div>
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionTitle}>Esto es lo que va a pasar</div>
              <div style={styles.sectionSub}>
                {focusEventId
                  ? "Solo se aplicarán las decisiones guardadas para este evento."
                  : "Solo se aplicarán conflictos que ya tengan una salida elegida."}
              </div>
            </div>
          </div>

          {!resolvedConflicts.length ? (
            <div style={styles.emptyBox}>
              Todavía no hay decisiones listas para aplicar.
            </div>
          ) : (
            <div style={styles.stack}>
              {resolvedConflicts.map((c) => {
                const resolution = resolveConflictResolution(
          {
            id: c.id,
            existing: c.existingEventId,
            incoming: c.incomingEventId,
          },
          resMap
        );
                const keptTitle =
                  resolution === "keep_existing"
                    ? safeTitle(c.existingEvent?.title)
                    : resolution === "replace_with_new"
                    ? safeTitle(c.incomingEvent?.title)
                    : null;

                const affectedTitle =
                  resolution === "keep_existing"
                    ? safeTitle(c.incomingEvent?.title)
                    : resolution === "replace_with_new"
                    ? safeTitle(c.existingEvent?.title)
                    : null;

                return (
                  <article key={String(c.id)} style={styles.conflictCard}>
                    <div
                      style={{
                        ...styles.conflictTop,
                        ...(isMobile ? styles.conflictTopMobile : null),
                      }}
                    >
                      <div style={styles.conflictBadge}>
                        {resolution === "keep_existing"
                          ? "Se mantiene el Evento A"
                          : resolution === "replace_with_new"
                            ? "Se mantiene el Evento B"
                            : "Se conservan ambos"}
                      </div>

                      <div style={styles.conflictMeta}>
                        {groupLabel(
                          c.existingEvent?.groupType ?? c.incomingEvent?.groupType
                        )}
                      </div>
                    </div>

                    <div style={styles.conflictGrid}>
                      <div style={styles.eventMini}>
                        <div style={styles.eventMiniLabel}>Evento A</div>
                        <div style={styles.eventMiniTitle}>
                          {safeTitle(c.existingEvent?.title)}
                        </div>
                        <div style={styles.eventMiniSub}>
                          {formatRange(c.existingEvent?.start, c.existingEvent?.end)}
                        </div>
                      </div>

                      <div style={styles.eventMini}>
                        <div style={styles.eventMiniLabel}>Evento B</div>
                        <div style={styles.eventMiniTitle}>
                          {safeTitle(c.incomingEvent?.title)}
                        </div>
                        <div style={styles.eventMiniSub}>
                          {formatRange(c.incomingEvent?.start, c.incomingEvent?.end)}
                        </div>
                      </div>
                    </div>

                    <div style={styles.decisionBox}>
                      {resolution === "none" ? (
                        <span>
                          Ambos eventos seguirán visibles y este cruce dejará de molestarte aquí para que puedas revisarlo más adelante con calma.
                        </span>
                      ) : (
                        <span>
                          Se conservará <strong>{keptTitle}</strong> y se intentará retirar <strong>{affectedTitle}</strong>. Si ese evento no te pertenece o no puede tocarse, SyncPlans mantendrá ambos para evitar inconsistencias, lo ocultará para ti y avisará al creador.
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {summary ? (
          <section style={styles.sectionCard}>
            <div style={styles.sectionTitle}>Resultado</div>
            <div style={styles.summaryGrid}>
              <div style={styles.summaryPill}>
                Con decisión: {summary.resolvedCount}
              </div>
              <div style={styles.summaryPill}>
                Retirados: {summary.deletedCount}
              </div>
              <div style={styles.summaryPill}>
                No se pudieron tocar: {summary.blockedCount}
              </div>
              <div style={styles.summaryPill}>
                Silenciados: {summary.ignoredCount}
              </div>
              <div style={styles.summaryPill}>
                Ocultos para ti: {summary.softRejectedCount}
              </div>
              <div style={styles.summaryPill}>
                Avisos enviados: {summary.notifiedCount}
              </div>
              <div style={styles.summaryPill}>
                Mantuvimos ambos: {summary.fallbackKeepBothCount}
              </div>
            </div>
          </section>
        ) : null}

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
            onClick={() => {
              void applyAll();
            }}
            disabled={applying || !resolvedConflicts.length}
            style={{
              ...styles.primaryBtn,
              ...(applying || !resolvedConflicts.length
                ? styles.primaryBtnDisabled
                : null),
            }}
          >
            {applying ? "Aplicando..." : "Aplicar y volver al resumen"}
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
    maxWidth: 860,
  },
  heroStats: {
    marginTop: 8,
    display: "grid",
    gap: 12,
  },
  statCard: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(235,241,255,0.58)",
  },
  statValue: {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  sectionCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,35,0.88)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(235,241,255,0.66)",
    lineHeight: 1.5,
  },
  emptyBox: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(235,241,255,0.74)",
    fontSize: 14,
  },
  stack: {
    display: "grid",
    gap: 14,
  },
  conflictCard: {
    borderRadius: 20,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    gap: 14,
  },
  conflictTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  conflictTopMobile: {
    alignItems: "flex-start",
  },
  conflictBadge: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(103,133,255,0.30)",
    background:
      "linear-gradient(135deg, rgba(91,120,255,0.20), rgba(119,95,255,0.20))",
    color: "#EDF2FF",
  },
  conflictMeta: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(235,241,255,0.66)",
  },
  conflictGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  eventMini: {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
  },
  eventMiniLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: "rgba(235,241,255,0.56)",
  },
  eventMiniTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
  },
  eventMiniSub: {
    fontSize: 13,
    color: "rgba(235,241,255,0.72)",
    lineHeight: 1.5,
  },
  decisionBox: {
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(235,241,255,0.82)",
    fontSize: 13,
    lineHeight: 1.6,
  },
  summaryGrid: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryPill: {
    borderRadius: 999,
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#EEF3FF",
    fontSize: 13,
    fontWeight: 800,
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
  primaryBtnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
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