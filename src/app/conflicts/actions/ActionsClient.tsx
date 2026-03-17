"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
  filterSoftRejectedEvents,
  loadIgnoredConflictKeys,
  loadSoftRejectedEventIds,
  SOFT_REJECTED_EVENTS_KEY,
  ignoreConflictIds,
  hideEventIdsForCurrentUser,
} from "@/lib/conflicts";
import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import {
  deleteEventsByIdsDetailed,
  getMyEvents,
  type DbEventRow,
} from "@/lib/eventsDb";
import { getMyProfile } from "@/lib/profilesDb";
import {
  createNotifications,
  markConflictNotificationsAsRead,
  type CreateNotificationInput,
} from "@/lib/notificationsDb";

import {
  type Resolution,
  getMyConflictResolutionsMap,
} from "@/lib/conflictResolutionsDb";

type RejectedTarget = {
  id: string;
  title: string;
  creatorId: string;
  groupId: string | null;
  startsAt: string;
  endsAt: string;
};

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

function actorDisplayNameFromProfile(
  profile: Awaited<ReturnType<typeof getMyProfile>>
) {
  if (!profile) return "Alguien";

  const display = String((profile as any).display_name ?? "").trim();
  if (display) return display;

  const full = `${(profile as any).first_name ?? ""} ${(profile as any).last_name ?? ""}`.trim();
  if (full) return full;

  const first = String((profile as any).first_name ?? "").trim();
  if (first) return first;

  return "Alguien";
}

function normalizeForConflicts(gt: GroupType | null | undefined): GroupType {
  if (!gt) return "personal" as GroupType;
  return (gt === ("pair" as any) ? ("couple" as any) : gt) as GroupType;
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

    return start.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ActionsClient({
  groupIdFromUrl,
}: {
  groupIdFromUrl: string | null;
}) {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [dbEvents, setDbEvents] = useState<DbEventRow[]>([]);
  const [resMap, setResMap] = useState<Record<string, Resolution>>({});
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [actorName, setActorName] = useState("Alguien");
  const [hiddenEventIds, setHiddenEventIds] = useState<Set<string>>(() =>
    loadSoftRejectedEventIds()
  );
  const [commentsByEventId, setCommentsByEventId] = useState<
    Record<string, string>
  >({});
  const [toast, setToast] = useState<null | { title: string; sub?: string }>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      const uid = data.session?.user?.id ?? null;
      if (error || !uid) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      setCurrentUid(uid);

      try {
        const [eventsForConflicts, dbMap, rawDbEvents, profile] =
          await Promise.all([
            loadEventsFromDb({ groupId: groupIdFromUrl }),
            getMyConflictResolutionsMap(),
            getMyEvents(),
            getMyProfile(),
          ]);

        if (!alive) return;

        setEvents(
          Array.isArray(eventsForConflicts?.events)
            ? eventsForConflicts.events
            : []
        );
        setResMap(dbMap ?? {});
        setDbEvents(Array.isArray(rawDbEvents) ? rawDbEvents : []);
        setActorName(actorDisplayNameFromProfile(profile));
        setHiddenEventIds(loadSoftRejectedEventIds());
      } catch {
        if (!alive) return;
        setEvents([]);
        setResMap({});
        setDbEvents([]);
      }

      setBooting(false);
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

  const visibleEventsForConflicts = useMemo(() => {
    return filterSoftRejectedEvents(
      Array.isArray(events) ? events : [],
      hiddenEventIds
    );
  }, [events, hiddenEventIds]);

  const conflicts = useMemo<ConflictItem[]>(() => {
    const normalized: CalendarEvent[] = (
      Array.isArray(visibleEventsForConflicts) ? visibleEventsForConflicts : []
    ).map((e) => ({
      ...e,
      groupType: normalizeForConflicts((e.groupType ?? "personal") as any),
    }));

    const cx = computeVisibleConflicts(normalized);
    const ignored = loadIgnoredConflictKeys();
    const visible = filterIgnoredConflicts(cx, ignored);

    return attachEvents(visible, visibleEventsForConflicts);
  }, [visibleEventsForConflicts]);

  const plan = useMemo(() => {
    let decided = 0;
    let pending = 0;
    let skipped = 0;
    const deleteIds = new Set<string>();

    for (const c of conflicts) {
      const r = resolutionForConflict(c, resMap);
      if (!r) {
        pending++;
        continue;
      }

      decided++;

      if (r === "none") {
        skipped++;
        continue;
      }

      if (r === "keep_existing" && c.incomingEventId) {
        deleteIds.add(String(c.incomingEventId));
      }

      if (r === "replace_with_new" && c.existingEventId) {
        deleteIds.add(String(c.existingEventId));
      }
    }

    return {
      total: conflicts.length,
      decided,
      pending,
      skipped,
      deleteIds: Array.from(deleteIds),
    };
  }, [conflicts, resMap]);

  const dbEventsById = useMemo(() => {
    return new Map(dbEvents.map((ev) => [String(ev.id), ev]));
  }, [dbEvents]);

  const ownDeleteIds = useMemo(() => {
    const out: string[] = [];

    for (const eventId of plan.deleteIds) {
      const row = dbEventsById.get(String(eventId));
      if (!row) continue;

      const ownerId = String(row.user_id ?? "").trim();
      if (currentUid && ownerId === currentUid) {
        out.push(String(row.id));
      }
    }

    return out;
  }, [plan.deleteIds, dbEventsById, currentUid]);

  const rejectedTargets = useMemo<RejectedTarget[]>(() => {
    const out: RejectedTarget[] = [];
    const seen = new Set<string>();

    for (const eventId of plan.deleteIds) {
      const row = dbEventsById.get(String(eventId));
      if (!row) continue;

      const creatorId = String(row.user_id ?? "").trim();
      if (!creatorId) continue;
      if (currentUid && creatorId === currentUid) continue;
      if (seen.has(String(row.id))) continue;

      seen.add(String(row.id));

      out.push({
        id: String(row.id),
        title: safeTitle(row.title),
        creatorId,
        groupId: row.group_id ?? null,
        startsAt: row.start,
        endsAt: row.end,
      });
    }

    return out;
  }, [plan.deleteIds, dbEventsById, currentUid]);

  const blockedDeleteIds = useMemo(() => {
    const own = new Set(ownDeleteIds);
    return plan.deleteIds.filter((id) => !own.has(String(id)));
  }, [plan.deleteIds, ownDeleteIds]);

  const blockedConflictIds = useMemo(() => {
    const blocked = new Set(blockedDeleteIds.map(String));
    if (!blocked.size) return [] as string[];

    const ids = new Set<string>();

    for (const c of conflicts) {
      const r = resolutionForConflict(c, resMap);
      if (!r || r === "none") continue;

      const targetDeleteId =
        r === "keep_existing"
          ? String(c.incomingEventId ?? "")
          : String(c.existingEventId ?? "");

      if (targetDeleteId && blocked.has(targetDeleteId)) {
        ids.add(String(c.id));
      }
    }

    return Array.from(ids);
  }, [blockedDeleteIds, conflicts, resMap]);

  const ignoredConflictIds = useMemo(() => {
    const ids = new Set<string>();

    for (const c of conflicts) {
      const r = resolutionForConflict(c, resMap);
      if (r === "none") {
        ids.add(String(c.id));
      }
    }

    return Array.from(ids);
  }, [conflicts, resMap]);

  const resolvedConflictEventIds = useMemo(() => {
    const ids = new Set<string>();

    for (const c of conflicts) {
      const r = resolutionForConflict(c, resMap);
      if (!r) continue;

      if (c.existingEventId) ids.add(String(c.existingEventId));
      if (c.incomingEventId) ids.add(String(c.incomingEventId));
    }

    return Array.from(ids);
  }, [conflicts, resMap]);

  const notificationRows = useMemo<CreateNotificationInput[]>(() => {
    return rejectedTargets
      .map((target) => {
        const comment = String(commentsByEventId[target.id] ?? "").trim();
        const bodyBase = `Tu evento “${target.title}” no fue elegido al resolver un conflicto.`;
        const body = comment ? `${bodyBase} Motivo: ${comment}` : bodyBase;

        const creatorId = String(target.creatorId ?? "").trim();
        if (!creatorId) return null;

        return {
          user_id: creatorId,
          type: "event_rejected",
          title: `${actorName} no aceptó tu evento`,
          body,
          entity_id: target.id,
          payload: {
            event_id: target.id,
            event_title: target.title,
            actor_name: actorName,
            actor_user_id: currentUid,
            comment: comment || null,
            group_id: target.groupId,
            start: target.startsAt,
            end: target.endsAt,
          },
        } satisfies CreateNotificationInput;
      })
      .filter(Boolean) as CreateNotificationInput[];
  }, [rejectedTargets, commentsByEventId, actorName, currentUid]);

  const disabledApply = plan.decided === 0 || busy;
  const hasRejectedTargets = rejectedTargets.length > 0;

  const updateComment = (eventId: string, value: string) => {
    setCommentsByEventId((prev) => ({
      ...prev,
      [eventId]: value,
    }));
  };

  const apply = async () => {
    if (busy) return;

    if (plan.decided === 0) {
      setToast({
        title: "Nada que finalizar",
        sub: "Primero elige qué hacer con al menos un conflicto.",
      });
      return;
    }

    try {
      setBusy(true);

      let notifiedCount = 0;

      if (notificationRows.length > 0) {
        try {
          notifiedCount = await createNotifications(notificationRows);
        } catch (e: any) {
          throw new Error(
            e?.message ||
              "No se pudo crear la notificación para el otro usuario."
          );
        }

        if (notifiedCount !== notificationRows.length) {
          throw new Error(
            "No se registraron todas las notificaciones esperadas del evento rechazado."
          );
        }
      }

      let deletedCount = 0;

      if (ownDeleteIds.length > 0) {
        const deleteResult = await deleteEventsByIdsDetailed(ownDeleteIds);
        deletedCount = deleteResult.deletedCount;

        if (deleteResult.blockedIds.length > 0) {
          throw new Error(
            "Algunos eventos no podían eliminarse con tu sesión actual."
          );
        }

        if (deletedCount !== ownDeleteIds.length) {
          throw new Error(
            "No se eliminaron todos los eventos seleccionados. No cerramos el flujo para evitar inconsistencias."
          );
        }
      }

      if (blockedDeleteIds.length > 0) {
        try {
          hideEventIdsForCurrentUser(blockedDeleteIds);
        } catch {
          // no rompemos el flujo si falla localStorage
        }
      }

      if (blockedConflictIds.length > 0) {
        try {
          ignoreConflictIds(blockedConflictIds);
        } catch {
          // no rompemos el flujo si falla localStorage
        }
      }

      if (ignoredConflictIds.length > 0) {
        try {
          ignoreConflictIds(ignoredConflictIds);
        } catch {
          // no rompemos el flujo si falla localStorage
        }
      }

      if (resolvedConflictEventIds.length > 0) {
        try {
          await markConflictNotificationsAsRead({
            eventIds: resolvedConflictEventIds,
          });
        } catch {
          // si falla la limpieza de notificaciones, no rompemos el cierre
        }
      }

      const qp = new URLSearchParams();
      qp.set("from", "conflicts");
      qp.set("resolved", String(plan.decided));

      if (deletedCount > 0) {
        qp.set("deleted", String(deletedCount));
      }

      if (notifiedCount > 0) {
        qp.set("notified", String(notifiedCount));
      }

      if (blockedDeleteIds.length > 0) {
        qp.set("softRejected", String(blockedDeleteIds.length));
      }

      if (ignoredConflictIds.length > 0) {
        qp.set("ignored", String(ignoredConflictIds.length));
      }

      router.replace(`/summary?${qp.toString()}`);
    } catch (e: any) {
      setBusy(false);
      setToast({
        title: "No se pudo finalizar",
        sub:
          e?.message ??
          "Inténtalo nuevamente en unos segundos. Si falló el aviso o el borrado real, no cerramos el flujo para no dejarlo incompleto.",
      });
    }
  };

  const back = () => {
    const qp = new URLSearchParams();
    if (groupIdFromUrl) qp.set("groupId", groupIdFromUrl);
    router.push(`/conflicts/detected?${qp.toString()}`);
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando cierre…</div>
              <div style={styles.loadingSub}>Un segundo</div>
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
          <div style={styles.topActions}>
            <button onClick={back} style={styles.ghostBtn}>
              ← Volver
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Cierre</div>
            <h1 style={styles.h1}>
              {hasRejectedTargets
                ? "Enviar comentarios y cerrar"
                : "Finalizar resolución"}
            </h1>
            <div style={styles.sub}>
              {hasRejectedTargets
                ? "Antes de cerrar, puedes avisar al creador de cada evento que no fue elegido."
                : "Revisamos todo y dejamos lista tu decisión sobre los conflictos."}
            </div>
          </div>

          <div style={styles.heroRight}>
            <div style={styles.statPill}>
              <div style={styles.statLabel}>Resueltos</div>
              <div style={styles.statValue}>{plan.decided}</div>
            </div>
            <div style={styles.statPillMuted}>
              <div style={styles.statLabel}>Pendientes</div>
              <div style={styles.statValue}>{plan.pending}</div>
            </div>
          </div>
        </section>

        <section style={styles.summaryCard}>
          <div style={styles.summaryGrid}>
            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Conflictos analizados</div>
              <div style={styles.summaryValue}>{plan.total}</div>
            </div>

            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Decisiones guardadas</div>
              <div style={styles.summaryValue}>{plan.decided}</div>
            </div>

            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Eliminaciones reales</div>
              <div style={styles.summaryValue}>{ownDeleteIds.length}</div>
            </div>

            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Se mantienen ambos</div>
              <div style={styles.summaryValue}>{plan.skipped}</div>
            </div>

            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Soft reject / ocultados</div>
              <div style={styles.summaryValue}>{blockedDeleteIds.length}</div>
            </div>

            <div style={styles.summaryItem}>
              <div style={styles.summaryLabel}>Comentarios por enviar</div>
              <div style={styles.summaryValue}>{rejectedTargets.length}</div>
            </div>
          </div>
        </section>

        {conflicts.length > 0 ? (
          <section style={styles.conflictsCard}>
            <div style={styles.blockTop}>
              <div style={styles.blockTitle}>Decisiones detectadas</div>
              <div style={styles.blockSub}>
                Esto es lo que se aplicará al finalizar.
              </div>
            </div>

            <div style={styles.conflictList}>
              {conflicts.map((c) => {
                const r = resolutionForConflict(c, resMap);
                const existing = c.existingEvent;
                const incoming = c.incomingEvent;

                let statusLabel = "Pendiente";
                let statusTone = styles.pillGray;

                if (r === "keep_existing") {
                  statusLabel = "Conservar A";
                  statusTone = styles.pillGreen;
                } else if (r === "replace_with_new") {
                  statusLabel = "Conservar B";
                  statusTone = styles.pillGreen;
                } else if (r === "none") {
                  statusLabel = "Mantener ambos";
                  statusTone = styles.pillAmber;
                }

                return (
                  <div key={c.id} style={styles.conflictRow}>
                    <div style={styles.conflictHead}>
                      <div style={styles.conflictTitle}>
                        {safeTitle(existing?.title)} ↔ {safeTitle(incoming?.title)}
                      </div>
                      <span style={{ ...styles.pillStatus, ...statusTone }}>
                        {statusLabel}
                      </span>
                    </div>

                    <div style={styles.conflictMeta}>
                      <div style={styles.metaLine}>
                        <span style={styles.metaLabel}>A</span>
                        <span>{formatRange(existing?.start, existing?.end)}</span>
                      </div>
                      <div style={styles.metaLine}>
                        <span style={styles.metaLabel}>B</span>
                        <span>{formatRange(incoming?.start, incoming?.end)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No hay conflictos visibles</div>
            <div style={styles.emptySub}>
              No encontramos choques pendientes para este contexto.
            </div>
          </section>
        )}

        {rejectedTargets.length > 0 && (
          <section style={styles.commentsCard}>
            <div style={styles.blockTop}>
              <div style={styles.blockTitle}>Comentario opcional</div>
              <div style={styles.blockSub}>
                Esto se enviará al creador del evento que no fue elegido.
              </div>
            </div>

            <div style={styles.commentList}>
              {rejectedTargets.map((target) => {
                const current = String(commentsByEventId[target.id] ?? "");
                return (
                  <div key={target.id} style={styles.commentRow}>
                    <div style={styles.commentHead}>
                      <div style={styles.commentTitle}>{target.title}</div>
                      <div style={styles.commentTime}>
                        {formatRange(target.startsAt, target.endsAt)}
                      </div>
                    </div>

                    <textarea
                      value={current}
                      onChange={(e) => updateComment(target.id, e.target.value)}
                      placeholder="Ej.: Me chocaba con otro plan confirmado / ya tenía algo cerrado / no llego a esa hora."
                      style={styles.textarea}
                      rows={3}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section style={styles.footerBar}>
          <button onClick={back} style={styles.secondaryBtn} disabled={busy}>
            Volver
          </button>

          <button
            onClick={apply}
            style={{
              ...styles.primaryBtn,
              ...(disabledApply ? styles.primaryBtnDisabled : {}),
            }}
            disabled={disabledApply}
          >
            {busy
              ? "Aplicando…"
              : hasRejectedTargets
                ? "Enviar comentarios"
                : "Finalizar resolución"}
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
    gap: 12,
    alignItems: "stretch",
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
  statPill: {
    minWidth: 118,
    borderRadius: 22,
    padding: "14px 16px",
    border: "1px solid rgba(102,255,179,0.28)",
    background: "rgba(22,38,28,0.76)",
    display: "grid",
    gap: 6,
    alignContent: "center",
  },
  statPillMuted: {
    minWidth: 118,
    borderRadius: 22,
    padding: "14px 16px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    display: "grid",
    gap: 6,
    alignContent: "center",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(235,241,255,0.68)",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: 800,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 900,
    lineHeight: 1,
  },
  summaryCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(11,16,35,0.84)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },
  summaryItem: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 14,
    display: "grid",
    gap: 6,
  },
  summaryLabel: {
    fontSize: 12,
    color: "rgba(235,241,255,0.66)",
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 900,
  },
  conflictsCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
  },
  commentsCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(10,14,30,0.90)",
  },
  blockTop: {
    display: "grid",
    gap: 4,
    marginBottom: 14,
  },
  blockTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  blockSub: {
    fontSize: 13,
    color: "rgba(235,241,255,0.66)",
    lineHeight: 1.5,
  },
  conflictList: {
    display: "grid",
    gap: 12,
  },
  conflictRow: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  conflictHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  conflictTitle: {
    fontSize: 15,
    fontWeight: 800,
  },
  conflictMeta: {
    display: "grid",
    gap: 8,
  },
  metaLine: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "rgba(235,241,255,0.82)",
    fontSize: 13,
  },
  metaLabel: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
  },
  pillStatus: {
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 900,
  },
  pillGray: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#E8EEFF",
  },
  pillGreen: {
    background: "rgba(19,61,35,0.78)",
    border: "1px solid rgba(102,255,179,0.22)",
    color: "#D6FFE8",
  },
  pillAmber: {
    background: "rgba(74,55,18,0.80)",
    border: "1px solid rgba(255,214,102,0.24)",
    color: "#FFF0C7",
  },
  commentList: {
    display: "grid",
    gap: 14,
  },
  commentRow: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  commentHead: {
    display: "grid",
    gap: 4,
  },
  commentTitle: {
    fontSize: 15,
    fontWeight: 800,
  },
  commentTime: {
    fontSize: 12,
    color: "rgba(235,241,255,0.62)",
  },
  textarea: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(4,8,20,0.80)",
    color: "#F6F8FC",
    padding: "12px 14px",
    outline: "none",
    fontSize: 14,
    lineHeight: 1.55,
    resize: "vertical",
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
  primaryBtnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
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