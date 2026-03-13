// src/app/conflicts/actions/ActionsClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  CalendarEvent,
  computeVisibleConflicts,
  attachEvents,
  type ConflictItem,
  conflictKey,
  ignoreConflictIds,
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
  type CreateNotificationInput,
} from "@/lib/notificationsDb";

import {
  type Resolution,
  getMyConflictResolutionsMap,
  clearMyConflictResolutions,
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

  const conflicts = useMemo<ConflictItem[]>(() => {
    const cx = computeVisibleConflicts(events);
    return attachEvents(cx, events);
  }, [events]);

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
        title: "Nada que aplicar",
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
            "No se eliminaron todos los eventos seleccionados. No aplicamos el cambio para evitar inconsistencias."
          );
        }
      }

      /**
       * Eventos ajenos rechazados:
       * todavía no existe persistencia real por-usuario, así que por ahora:
       * - NO intentamos borrarlos globalmente
       * - SÍ notificamos al creador
       * - SÍ cerramos localmente el conflicto para no dejar al usuario atrapado
       */
      if (blockedConflictIds.length > 0) {
        try {
          ignoreConflictIds(blockedConflictIds);
        } catch {
          // no rompemos el flujo si falla localStorage
        }
      }

      try {
        await clearMyConflictResolutions();
      } catch {
        // no bloquea la UX si falla limpiar
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

      router.replace(`/summary?${qp.toString()}`);
    } catch (e: any) {
      setBusy(false);
      setToast({
        title: "No se pudo aplicar",
        sub:
          e?.message ??
          "Inténtalo nuevamente en unos segundos. Si falló el aviso o el borrado real, no aplicamos el cambio para no dejar el flujo incompleto.",
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
              <div style={styles.loadingTitle}>Preparando cambios…</div>
              <div style={styles.loadingSub}>Un último chequeo</div>
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
            <div style={styles.kicker}>Último paso</div>
            <h1 style={styles.h1}>Aplicar decisiones</h1>
            <div style={styles.sub}>
              Esto actualizará tu calendario y resolverá los conflictos
              seleccionados.
            </div>

            {conflicts.length > 0 && plan.decided === 0 && (
              <div style={styles.helperText}>
                No hay decisiones guardadas aún. Vuelve a “Comparar” y elige qué
                evento mantener.
              </div>
            )}

                       {blockedDeleteIds.length > 0 && (
              <div style={styles.warningPill}>
                Uno o más eventos elegidos para salir no son tuyos. SyncPlans no
                los borrará para todos, pero sí enviará el aviso al creador y
                cerrará esta decisión localmente.
              </div>
            )}

            {rejectedTargets.length > 0 && (
              <div style={styles.noticePill}>
                Además, SyncPlans intentará avisar automáticamente a la otra
                persona cuando su evento no sea elegido.
              </div>
            )}
          </div>

          <div style={styles.heroRight}>
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Conflictos</div>
                <div style={styles.statValue}>{plan.total}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Decididos</div>
                <div style={styles.statValue}>{plan.decided}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Pendientes</div>
                <div style={styles.statValue}>{plan.pending}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Por eliminar</div>
                <div style={styles.statValue}>{plan.deleteIds.length}</div>
              </div>
            </div>

            <button
              onClick={apply}
              disabled={disabledApply}
              style={{
                ...styles.primaryBtn,
                opacity: disabledApply ? 0.55 : 1,
                cursor: disabledApply ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Aplicando…" : "Aplicar cambios ✅"}
            </button>
          </div>
        </section>

        {rejectedTargets.length > 0 && (
          <section style={styles.panelCard}>
            <div style={styles.panelHeader}>
              <div>
                <div style={styles.panelKicker}>Comunicación automática</div>
                <div style={styles.panelTitle}>
                  Eventos rechazados de otras personas
                </div>
              </div>
              <div style={styles.panelMeta}>
                {rejectedTargets.length} aviso
                {rejectedTargets.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={styles.panelSub}>
              Antes de aplicar, puedes dejar un comentario opcional para
              explicar por qué ese evento no fue aceptado.
            </div>

            <div style={styles.cardsGrid}>
              {rejectedTargets.map((target) => (
                <div key={target.id} style={styles.rejectCard}>
                  <div style={styles.rejectTop}>
                    <div>
                      <div style={styles.rejectTitle}>{target.title}</div>
                      <div style={styles.rejectTime}>
                        {formatRange(target.startsAt, target.endsAt)}
                      </div>
                    </div>
                    <div style={styles.rejectBadge}>Se notificará</div>
                  </div>

                  <label style={styles.label}>
                    Comentario opcional para el creador
                  </label>
                  <textarea
                    value={commentsByEventId[target.id] ?? ""}
                    onChange={(e) => updateComment(target.id, e.target.value)}
                    placeholder="Ej.: Ya teníamos este otro plan confirmado / se cruza con algo familiar / lo vemos para otro momento."
                    style={styles.textarea}
                    maxLength={220}
                  />
                  <div style={styles.charHint}>
                    {(commentsByEventId[target.id] ?? "").length}/220
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {conflicts.length === 0 && (
          <section style={styles.emptyCard}>
            <div style={styles.emptyTitle}>No hay conflictos abiertos</div>
            <div style={styles.emptySub}>
              Tu calendario ya está limpio. Puedes volver al calendario o crear
              nuevos eventos.
            </div>
            <button
              onClick={() => router.push("/calendar")}
              style={styles.primaryBtnWide}
            >
              Ir al calendario
            </button>
          </section>
        )}

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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 14,
    flexWrap: "wrap",
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    flex: 1,
    minWidth: 280,
  },
  heroRight: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "flex-end",
    minWidth: 260,
    flex: "0 0 auto",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    width: "fit-content",
  },
  h1: {
    margin: 0,
    fontSize: 26,
    letterSpacing: "-0.6px",
  },
  sub: {
    fontSize: 13,
    opacity: 0.78,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.82,
    lineHeight: 1.35,
  },
  warningPill: {
    marginTop: 8,
    width: "fit-content",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.10)",
    color: "rgba(255,255,255,0.92)",
  },
  noticePill: {
    marginTop: 8,
    width: "fit-content",
    padding: "8px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.08)",
    color: "rgba(255,255,255,0.9)",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtnWide: {
    marginTop: 12,
    padding: "12px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(80px, 1fr))",
    gap: 8,
    marginBottom: 10,
    width: "100%",
  },
  statCard: {
    padding: 8,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(5,8,22,0.85)",
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.75,
  },
  statValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: 900,
  },
  panelCard: {
    marginTop: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
    padding: 16,
  },
  panelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  panelKicker: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.72,
  },
  panelTitle: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.2px",
  },
  panelMeta: {
    fontSize: 12,
    fontWeight: 800,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
  },
  panelSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    opacity: 0.82,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
    marginTop: 14,
  },
  rejectCard: {
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(5,8,22,0.74)",
  },
  rejectTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  rejectTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  rejectTime: {
    marginTop: 5,
    fontSize: 12,
    opacity: 0.72,
  },
  rejectBadge: {
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 8px",
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.10)",
    color: "rgba(255,255,255,0.94)",
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.88,
  },
  textarea: {
    width: "100%",
    minHeight: 104,
    resize: "vertical",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: 13,
    lineHeight: 1.45,
    outline: "none",
    boxSizing: "border-box",
  },
  charHint: {
    marginTop: 8,
    fontSize: 11,
    opacity: 0.62,
    textAlign: "right",
  },
  emptyCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.02)",
    padding: 18,
  },
  emptyTitle: {
    fontWeight: 900,
    fontSize: 16,
  },
  emptySub: {
    marginTop: 6,
    opacity: 0.78,
    fontSize: 13,
  },
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
  loadingTitle: {
    fontWeight: 900,
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.75,
  },
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
    zIndex: 100,
  },
  toastT: {
    fontSize: 13,
    fontWeight: 900,
  },
  toastS: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
  },
};