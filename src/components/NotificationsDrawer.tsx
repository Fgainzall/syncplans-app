// src/components/NotificationsDrawer.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyNotifications,
  markAllRead,
  markNotificationRead,
  deleteNotification,
  deleteAllNotifications,
  type NotificationRow,
  notificationHref,
} from "@/lib/notificationsDb";
import {
  getMyInvitations,
  type GroupInvitation,
} from "@/lib/invitationsDb";
import { formatSmartTime } from "@/lib/timeFormat";

export type NavigationMode = "push" | "replace";

export default function NotificationsDrawer({
  open,
  onClose,
  navigationMode = "replace",
  onUnreadChange,
  limit = 30,
}: {
  open: boolean;
  onClose: () => void;
  navigationMode?: NavigationMode;
  onUnreadChange?: (unread: number) => void;
  limit?: number;
}) {
  const router = useRouter();

  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  const lastOpenFetchAt = useRef(0);
  const busyIds = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(() => items.length, [items]);
  const unreadLabel = unreadCount === 1 ? "1 pendiente" : `${unreadCount} pendientes`;

  useEffect(() => {
    if (!onUnreadChange) return;
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  useEffect(() => {
    const apply = () => {
      if (typeof window === "undefined") return;
      setIsMobile(window.innerWidth <= 768);
    };

    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  function inviteToNotificationRow(inv: GroupInvitation): NotificationRow {
    const gt = String(inv.group_type || "").toLowerCase();
    const mapping: Record<string, string> = {
      personal: "Personal",
      solo: "Personal",
      pair: "Pareja",
      couple: "Pareja",
      family: "Familia",
      shared: "Compartido",
      other: "Compartido",
    };
    const groupLabel = mapping[gt] ?? "Grupo";

    return {
      id: `invite:${inv.id}`,
      user_id: "synthetic",
      type: "group_invite",
      title: inv.group_name
        ? `Invitación a ${inv.group_name}`
        : `Invitación a un grupo ${groupLabel.toLowerCase()}`,
      body: `Te invitaron a un grupo (${groupLabel}).`,
      entity_id: inv.id,
      payload: {
        group_name: inv.group_name,
        group_type: inv.group_type,
      },
      created_at: inv.created_at ?? new Date().toISOString(),
      read_at: null,
    };
  }

 const fetchNotificationsAndInvites = useCallback(async (): Promise<
  NotificationRow[]
> => {
  const [notifs, invites] = await Promise.all([
    getMyNotifications(limit),
    getMyInvitations(),
  ]);

  const syntheticInvites = (invites ?? []).map(inviteToNotificationRow);
  return sortNotificationsForDrawer([...syntheticInvites, ...(notifs ?? [])]);
}, [limit]);

  useEffect(() => {
    if (!open) return;

    const now = Date.now();
    if (now - lastOpenFetchAt.current < 250) return;
    lastOpenFetchAt.current = now;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const n = await fetchNotificationsAndInvites();
        if (!alive) return;
        setItems(n);
      } catch {
        if (!alive) return;
        setToast({
          title: "No pudimos cargar notificaciones",
          subtitle: "Intenta de nuevo en unos segundos.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    }, [open, limit, fetchNotificationsAndInvites]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function navTo(href: string) {
    if (navigationMode === "replace") router.replace(href);
    else router.push(href);
  }

  function hrefFor(n: NotificationRow): string {
    const type = String(n.type || "").toLowerCase();

    if (type === "leave_alert") {
      const payload = (n.payload || {}) as any;
      const eventId = String(
        payload.event_id || payload.eventId || n.entity_id || ""
      ).trim();

      if (eventId) {
        return `/events/new/details?eventId=${encodeURIComponent(eventId)}&from=leave_alert`;
      }

      return "/calendar";
    }

    return notificationHref(n);
  }

  function actionLabelFor(n: NotificationRow): string {
    const type = String(n.type || "").toLowerCase();
    if (type === "group_invite") return "Ver invitación";
    if (type === "leave_alert") return "Abrir ruta";
    return "Abrir";
  }

  function travelModeLabel(value: unknown): string | null {
    const mode = String(value ?? "").toLowerCase();
    if (mode === "driving") return "Auto";
    if (mode === "walking") return "A pie";
    if (mode === "bicycling") return "Bici";
    if (mode === "transit") return "Transporte";
    return null;
  }

  function travelModeMessage(value: unknown): string {
    const mode = String(value ?? "").toLowerCase();
    if (mode === "walking") return "Es buen momento para empezar a caminar.";
    if (mode === "bicycling") return "Sal ahora para llegar con margen en bici.";
    if (mode === "transit") return "Te conviene salir ahora por tiempos de traslado.";
    return "El tráfico actual sugiere salir ahora.";
  }

  function originSourceLabel(value: unknown): string | null {
    const source = String(value ?? "").toLowerCase();
    if (source === "last_known") return "Ubicación guardada";
    if (source === "fallback_lima") return "Referencia Lima";
    if (source === "gps") return "Ubicación actual";
    if (source === "url") return "Punto enviado";
    return null;
  }

  function etaLabel(value: unknown): string | null {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const minutes = Math.max(1, Math.round(seconds / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }

  function shortTimeLabel(value: unknown, fallback: string): string {
    return formatSmartTime(
      typeof value === "string" || typeof value === "number" || value instanceof Date
        ? value
        : null,
      fallback,
    );
  }

  function titleFor(n: NotificationRow) {
    const t = String(n.type || "").toLowerCase();

    if (t === "group_message") {
      const payload = (n.payload || {}) as any;
      const groupName =
        payload.group_name ||
        n.title?.replace(/^Nuevo mensaje en\s+/i, "") ||
        "tu grupo";
      const authorName: string | undefined = payload.author_name;

      if (authorName) return `${authorName} escribió en ${groupName}`;
      if (n.title) return n.title;
      return `Nuevo mensaje en ${groupName}`;
    }

    if (t === "group_invite") {
      if (n.title) return n.title;
      const payload = (n.payload || {}) as any;
      const groupName: string | undefined = payload.group_name;
      if (groupName) return `Invitación a ${groupName}`;
      return "Nueva invitación a un grupo";
    }

    if (t === "leave_alert") {
      const payload = (n.payload || {}) as any;
      const eventTitle = String(payload.event_title ?? "").trim();
      const cleanTitle = String(n.title ?? "").trim();

      if (cleanTitle) return cleanTitle;
      if (eventTitle) return `Ya es momento de salir: ${eventTitle}`;
      return "Ya es momento de salir";
    }

    if (t === "event_rejected") {
      const payload = (n.payload || {}) as any;
      const actorName = String(payload.actor_name ?? "").trim() || "Alguien";
      const eventTitle = String(payload.event_title ?? "").trim();

      if (eventTitle) return `${actorName} no aceptó “${eventTitle}”`;
      if (n.title) return n.title;
      return `${actorName} no aceptó tu evento`;
    }

    if (t === "conflict_decision") {
      const payload = (n.payload || {}) as any;
      const keptTitle = String(payload.kept_event_title ?? "").trim();
      if (keptTitle) return `Decisión aplicada: “${keptTitle}”`;
      if (n.title) return n.title;
      return "Se aplicó una decisión de conflicto";
    }

    if (t === "conflict_auto_adjusted") {
      const payload = (n.payload || {}) as any;
      const affectedTitle = String(payload.affected_event_title ?? "").trim();
      if (affectedTitle) return `Ajuste automático en “${affectedTitle}”`;
      if (n.title) return n.title;
      return "SyncPlans aplicó un ajuste automático";
    }

    if (n.title) return n.title;
    if (t === "conflict_detected" || t === "conflict") return "Conflicto de horario";
    if (t === "event_created") return "Nuevo evento creado";
    if (t === "event_deleted") return "Evento eliminado";
    return "Notificación";
  }

  function subtitleFor(n: NotificationRow) {
    const t = String(n.type || "").toLowerCase();

    if (t === "group_message") {
      const payload = (n.payload || {}) as any;
      return (
        payload.message_snippet ||
        n.body ||
        "Toca para ver el mensaje en el grupo."
      );
    }

    if (t === "group_invite") {
      if (n.body) return n.body;
      const payload = (n.payload || {}) as any;
      const groupName: string | undefined = payload.group_name;
      if (groupName) {
        return `Te invitaron al grupo "${groupName}".`;
      }
      return "Toca para ver la invitación.";
    }

    if (t === "leave_alert") {
      const payload = (n.payload || {}) as any;
      const leaveText = shortTimeLabel(payload.leave_time, "ahora");
      const startText = shortTimeLabel(payload.event_start, "pronto");
      const destination = String(
        payload.destination_label || payload.destination_address || "el destino"
      ).trim();
      const eta = etaLabel(payload.eta_seconds);
      const modeMessage = travelModeMessage(payload.travel_mode);

      const etaText = eta ? ` Tardarás aprox. ${eta}.` : "";
      return `${modeMessage} Salida sugerida: ${leaveText} hacia ${destination}. Tu evento empieza a las ${startText}.${etaText}`;
    }


    if (t === "event_rejected") {
      const payload = (n.payload || {}) as any;
      const comment = String(payload.comment ?? "").trim();
      const eventTitle = String(payload.event_title ?? "").trim();
      const actorName = String(payload.actor_name ?? "").trim() || "Alguien";

      if (comment) return `${actorName} dejó este motivo: "${comment}"`;
      if (eventTitle) {
        return `Tu evento “${eventTitle}” no fue elegido al resolver un conflicto.`;
      }
      if (n.body) return n.body;
      return "Tu evento no fue elegido al resolver un conflicto.";
    }

    if (t === "conflict_decision") {
      const payload = (n.payload || {}) as any;
      const affectedTitle = String(payload.affected_event_title ?? "").trim();
      const keptTitle = String(payload.kept_event_title ?? "").trim();

      if (keptTitle && affectedTitle) {
        return `Se decidió conservar “${keptTitle}” frente a “${affectedTitle}”.`;
      }
      if (n.body) return n.body;
      return "Ya quedó aplicada una decisión de conflicto.";
    }

    if (t === "conflict_auto_adjusted") {
      const payload = (n.payload || {}) as any;
      const affectedTitle = String(payload.affected_event_title ?? "").trim();

      if (affectedTitle) {
        return `No se pudo reemplazar “${affectedTitle}”, así que SyncPlans mantuvo una salida segura.`;
      }
      if (n.body) return n.body;
      return "SyncPlans hizo un ajuste automático para evitar inconsistencias.";
    }

    if (n.body) return n.body;
    return "Toca para ver más.";
  }

  function typeLabel(n: NotificationRow): string {
    const t = String(n.type || "").toLowerCase();
    if (t === "conflict" || t === "conflict_detected") return "Conflicto";
    if (t === "conflict_decision") return "Decisión aplicada";
    if (t === "conflict_auto_adjusted") return "Ajuste automático";
    if (t === "event_created" || t === "event_deleted") return "Evento";
    if (t === "leave_alert") return "Salida inteligente";
    if (t === "event_rejected") return "Decisión";
    if (t === "group_message") return "Mensaje";
    if (t === "group_invite") return "Invitación";
    return "Notificación";
  }

  function accentFor(n: NotificationRow) {
    const t = String(n.type || "").toLowerCase();

    if (t === "conflict" || t === "conflict_detected") {
      return {
        dot: "#FB7185",
        border: "rgba(251,113,133,0.24)",
        bg: "linear-gradient(180deg, rgba(127,29,29,0.24), rgba(255,255,255,0.04))",
      };
    }

    if (t === "conflict_decision") {
      return {
        dot: "#4ADE80",
        border: "rgba(74,222,128,0.24)",
        bg: "linear-gradient(180deg, rgba(20,83,45,0.24), rgba(255,255,255,0.04))",
      };
    }

    if (t === "conflict_auto_adjusted") {
      return {
        dot: "#818CF8",
        border: "rgba(129,140,248,0.24)",
        bg: "linear-gradient(180deg, rgba(49,46,129,0.24), rgba(255,255,255,0.04))",
      };
    }

    if (t === "leave_alert") {
      return {
        dot: "#22D3EE",
        border: "rgba(34,211,238,0.42)",
        bg: "linear-gradient(180deg, rgba(8,145,178,0.30), rgba(15,23,42,0.78))",
      };
    }

    if (t === "event_rejected") {
      return {
        dot: "#F97316",
        border: "rgba(249,115,22,0.24)",
        bg: "linear-gradient(180deg, rgba(124,45,18,0.24), rgba(255,255,255,0.04))",
      };
    }

    if (t === "group_invite") {
      return {
        dot: "#38BDF8",
        border: "rgba(56,189,248,0.24)",
        bg: "linear-gradient(180deg, rgba(8,47,73,0.26), rgba(255,255,255,0.04))",
      };
    }

    if (t === "group_message") {
      return {
        dot: "#A78BFA",
        border: "rgba(167,139,250,0.24)",
        bg: "linear-gradient(180deg, rgba(76,29,149,0.24), rgba(255,255,255,0.04))",
      };
    }

    return {
      dot: "#FBBF24",
      border: "rgba(255,255,255,0.14)",
      bg: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))",
    };
  }

  function timeFor(n: NotificationRow) {
    const d = new Date(n.created_at);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function refreshFromDb(silent = false) {
    try {
      if (!silent) setLoading(true);
      const n = await fetchNotificationsAndInvites();
      setItems(n);
    } catch {
      if (!silent) {
        setToast({
          title: "No pudimos actualizar",
          subtitle: "Verifica tu conexión.",
        });
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function onMarkAll() {
    if (items.length === 0) return;

    try {
      setLoading(true);
      setItems((prev) =>
        prev.filter((n) => String(n.type || "").toLowerCase() === "group_invite")
      );
      await markAllRead();
      setToast({ title: "Listo", subtitle: "Marcaste todas como leídas." });
    } catch {
      setToast({
        title: "No pudimos marcar como leídas",
        subtitle: "Intenta nuevamente.",
      });
      void refreshFromDb(true);
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteAll() {
    if (items.length === 0) return;

    try {
      setLoading(true);
      setItems((prev) =>
        prev.filter((n) => String(n.type || "").toLowerCase() === "group_invite")
      );
      await deleteAllNotifications();
      setToast({
        title: "Notificaciones eliminadas",
        subtitle: "Limpiaste tu bandeja.",
      });
    } catch {
      setToast({
        title: "No pudimos eliminar",
        subtitle: "Intenta nuevamente.",
      });
      void refreshFromDb(true);
    } finally {
      setLoading(false);
    }
  }

  async function onOpenNotification(n: NotificationRow) {
    const type = String(n.type || "").toLowerCase();

    if (type === "group_invite") {
      navTo(hrefFor(n));
      onClose();
      return;
    }

    const href = hrefFor(n);
    const id = String(n.id);

    try {
      busyIds.current.add(id);
      setItems((prev) => prev.filter((x) => String(x.id) !== id));
      await markNotificationRead(id);
      navTo(href);
      onClose();
    } catch {
      setToast({
        title: "No pudimos abrir esa notificación",
        subtitle: "Intenta de nuevo.",
      });
      void refreshFromDb(true);
    } finally {
      busyIds.current.delete(id);
    }
  }

  async function onMarkOneRead(n: NotificationRow) {
    const type = String(n.type || "").toLowerCase();
    if (type === "group_invite") return;

    const id = String(n.id);

    try {
      busyIds.current.add(id);
      setItems((prev) => prev.filter((x) => String(x.id) !== id));
      await markNotificationRead(id);
    } catch {
      setToast({
        title: "No pudimos marcarla como leída",
        subtitle: "Intenta nuevamente.",
      });
      void refreshFromDb(true);
    } finally {
      busyIds.current.delete(id);
    }
  }

  async function onDeleteNotificationClick(n: NotificationRow) {
    const type = String(n.type || "").toLowerCase();
    if (type === "group_invite") return;

    const id = String(n.id);

    try {
      busyIds.current.add(id);
      setItems((prev) => prev.filter((x) => String(x.id) !== id));
      await deleteNotification(id);
    } catch {
      setToast({
        title: "No pudimos eliminar",
        subtitle: "Intenta nuevamente.",
      });
      void refreshFromDb(true);
    } finally {
      busyIds.current.delete(id);
    }
  }

  const showEmptyState = !loading && items.length === 0;

  return (
    <>
      {open && (
        <div style={backdrop} onClick={onClose}>
          <div
            style={{
              ...drawer,
              ...(isMobile ? drawerMobile : drawerDesktop),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
  style={{
    ...header,
    ...(isMobile
      ? {
          flexDirection: "column",
          alignItems: "stretch",
          gap: 12,
        }
      : null),
  }}
>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={title}>Notificaciones</div>
                <div style={sub}>
                  {unreadCount > 0 ? unreadLabel : "Estás al día ✨"}
                </div>
                <div style={subtleCopy}>
                  Solo mostramos notificaciones pendientes. Lo que marques como leído
                  saldrá de aquí.
                </div>
              </div>

              <div
  style={{
    ...headerTopActions,
    ...(isMobile
      ? {
          width: "100%",
          justifyContent: "flex-end",
        }
      : null),
  }}
>
                <button
                  type="button"
                  style={smallSoftBtn}
                  onClick={() => refreshFromDb()}
                  disabled={loading}
                >
                  Actualizar
                </button>
                <button type="button" style={iconBtn} onClick={onClose}>
                  ✕
                </button>
              </div>
            </div>

            {items.length > 0 && (
              <div
                style={{
                  ...bulkActionsRow,
                  ...(isMobile ? bulkActionsRowMobile : null),
                }}
              >
                <button
                  type="button"
                  style={secondaryHeaderBtn}
                  onClick={onMarkAll}
                  disabled={loading}
                >
                  Marcar todo leído
                </button>
                <button
                  type="button"
                  style={dangerHeaderBtn}
                  onClick={onDeleteAll}
                  disabled={loading}
                >
                  Limpiar bandeja
                </button>
              </div>
            )}

            <div style={body}>
              {loading && items.length === 0 ? (
                <SkeletonList />
              ) : showEmptyState ? (
                <div style={emptyBox}>
                  <div style={emptyTitle}>Sin notificaciones por ahora</div>
                  <div style={emptySub}>
                    Cuando tengas conflictos, eventos, mensajes o invitaciones a
                    grupos, aparecerán aquí.
                  </div>
                </div>
              ) : (
                <div style={list}>
                  {items.map((n) => {
                    const isBusy = busyIds.current.has(String(n.id));
                    const type = String(n.type || "").toLowerCase();
                    const isInvite = type === "group_invite";
                    const payload = (n.payload || {}) as any;
                    const accent = accentFor(n);

                    return (
                      <div
                        key={n.id}
                        style={{
                          ...rowCard,
                          borderColor: accent.border,
                          background: accent.bg,
                          opacity: isBusy ? 0.7 : 1,
                        }}
                      >
                        <div style={rowTop}>
                          <div style={rowTopLeft}>
                            <div
                              style={{
                                ...dot,
                                background: accent.dot,
                              }}
                            />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={rowTitleLine}>
                                <div style={rowTitle}>{titleFor(n)}</div>
                                <div style={rowTime}>{timeFor(n)}</div>
                              </div>

                              <div style={rowSub}>{subtitleFor(n)}</div>

                              <div style={rowMeta}>
                                <span style={metaPill}>{typeLabel(n)}</span>
                                {(type === "group_message" || type === "group_invite") &&
                                  payload.group_name && (
                                    <span style={metaPill}>{payload.group_name}</span>
                                  )}
                                {type === "event_rejected" && payload.event_title && (
                                  <span style={metaPill}>{payload.event_title}</span>
                                )}
                                {type === "conflict_decision" && payload.kept_event_title && (
                                  <span style={metaPill}>{payload.kept_event_title}</span>
                                )}
                                {type === "conflict_auto_adjusted" && payload.affected_event_title && (
                                  <span style={metaPill}>{payload.affected_event_title}</span>
                                )}
                                {type === "leave_alert" && travelModeLabel(payload.travel_mode) && (
                                  <span style={metaPill}>{travelModeLabel(payload.travel_mode)}</span>
                                )}
                                {type === "leave_alert" && etaLabel(payload.eta_seconds) && (
                                  <span style={metaPill}>ETA {etaLabel(payload.eta_seconds)}</span>
                                )}
                                {type === "leave_alert" && payload.leave_time && (
                                  <span style={metaPill}>Salir {shortTimeLabel(payload.leave_time, "ahora")}</span>
                                )}
                                {type === "leave_alert" && originSourceLabel(payload.origin_source) && (
                                  <span style={metaPill}>{originSourceLabel(payload.origin_source)}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            ...rowActions,
                            ...(isMobile ? rowActionsMobile : null),
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void onOpenNotification(n)}
                            disabled={isBusy}
                            style={{
                              ...(type === "leave_alert"
                                ? leaveAlertPrimaryBtn
                                : primaryRowBtn),
                              ...(isMobile ? mobileActionBtn : null),
                            }}
                          >
                            {actionLabelFor(n)}
                          </button>

                          {!isInvite && (
                            <button
                              type="button"
                              onClick={() => void onMarkOneRead(n)}
                              disabled={isBusy}
                              style={{
                                ...secondaryRowBtn,
                                ...(isMobile ? mobileActionBtn : null),
                              }}
                            >
                              Marcar leída
                            </button>
                          )}

                          {!isInvite && (
                            <button
                              type="button"
                              onClick={() => void onDeleteNotificationClick(n)}
                              disabled={isBusy}
                              style={{
                                ...dangerRowBtn,
                                ...(isMobile ? mobileActionBtn : null),
                              }}
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={toastBox}>
          <div style={toastTitle}>{toast.title}</div>
          {toast.subtitle && <div style={toastSub}>{toast.subtitle}</div>}
        </div>
      )}
    </>
  );
}

function sortNotificationsForDrawer(items: NotificationRow[]) {
  return [...items].sort((a, b) => {
    const aType = String(a.type || "").toLowerCase();
    const bType = String(b.type || "").toLowerCase();

    const priority = (type: string) => {
      if (type === "leave_alert") return 0;
      if (type === "group_invite") return 1;
      if (type === "conflict" || type === "conflict_detected") return 2;
      return 3;
    };

    const byPriority = priority(aType) - priority(bType);
    if (byPriority !== 0) return byPriority;

    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    return (Number.isFinite(bTime) ? bTime : 0) -
      (Number.isFinite(aTime) ? aTime : 0);
  });
}

function SkeletonList() {

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} style={skRow}>
          <div style={skDot} />
          <div style={{ flex: 1 }}>
            <div style={skLine1} />
            <div style={skLine2} />
          </div>
        </div>
      ))}
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(2,6,23,0.42)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  zIndex: 40,
  display: "flex",
  justifyContent: "flex-end",
};

const drawer: React.CSSProperties = {
  background:
    "radial-gradient(circle at top, rgba(15,23,42,0.98) 0, rgba(2,6,23,0.99) 62%)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "-18px 0 56px rgba(0,0,0,0.38)",
  borderLeft: "1px solid rgba(148,163,184,0.18)",
};

const drawerDesktop: React.CSSProperties = {
  width: "min(460px, 92vw)",
  height: "100%",
  padding: 20,
};

const drawerMobile: React.CSSProperties = {
  width: "100%",
  height: "100%",
  paddingTop: "max(16px, env(safe-area-inset-top))",
  paddingRight: 14,
  paddingBottom: "max(16px, env(safe-area-inset-bottom))",
  paddingLeft: 14,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const headerTopActions: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexShrink: 0,
  marginLeft: "auto",
};

const title: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 950,
  color: "rgba(248,250,252,0.98)",
  letterSpacing: "-0.03em",
  lineHeight: 1,
  wordBreak: "break-word",
};

const sub: React.CSSProperties = {
  marginTop: 7,
  fontSize: 13,
  color: "rgba(148,163,184,0.94)",
  fontWeight: 800,
};

const subtleCopy: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.45,
  color: "rgba(148,163,184,0.78)",
  maxWidth: 340,
};

const bulkActionsRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const bulkActionsRowMobile: React.CSSProperties = {
  flexDirection: "column",
};

const body: React.CSSProperties = {
  marginTop: 16,
  flex: 1,
  overflowY: "auto",
  paddingRight: 2,
  paddingBottom: 12,
};

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const rowCard: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  padding: 13,
  boxShadow: "0 10px 28px rgba(0,0,0,0.14)",
};

const rowTop: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
};

const rowTopLeft: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  width: "100%",
};

const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  marginTop: 6,
  flex: "0 0 auto",
  boxShadow: "0 0 0 5px rgba(255,255,255,0.03)",
};

const rowTitleLine: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const rowTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(248,250,252,0.98)",
  lineHeight: 1.28,
  letterSpacing: "-0.01em",
};

const rowTime: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(255,255,255,0.52)",
  whiteSpace: "nowrap",
  marginTop: 2,
  fontWeight: 800,
};

const rowSub: React.CSSProperties = {
  marginTop: 7,
  fontSize: 12,
  color: "rgba(255,255,255,0.74)",
  lineHeight: 1.5,
};

const rowMeta: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 7,
  flexWrap: "wrap",
};

const rowActions: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const rowActionsMobile: React.CSSProperties = {
  flexDirection: "column",
};

const metaPill: React.CSSProperties = {
  fontSize: 10,
  padding: "5px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.045)",
  color: "rgba(255,255,255,0.78)",
  fontWeight: 800,
};

const smallSoftBtn: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 13px",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 13,
  fontWeight: 800,
};

const secondaryHeaderBtn: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 13px",
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.94)",
  fontSize: 13,
  fontWeight: 800,
};

const dangerHeaderBtn: React.CSSProperties = {
  minHeight: 42,
  padding: "10px 13px",
  borderRadius: 13,
  border: "1px solid rgba(248,113,113,0.56)",
  background: "rgba(127,29,29,0.72)",
  color: "rgba(254,242,242,0.98)",
  fontSize: 13,
  fontWeight: 800,
};

const primaryRowBtn: React.CSSProperties = {
  minHeight: 40,
  padding: "9px 13px",
  borderRadius: 12,
  border: "1px solid rgba(56,189,248,0.35)",
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(59,130,246,0.18))",
  color: "rgba(255,255,255,0.98)",
  fontSize: 13,
  fontWeight: 800,
};

const leaveAlertPrimaryBtn: React.CSSProperties = {
  minHeight: 40,
  padding: "9px 13px",
  borderRadius: 12,
  border: "1px solid rgba(34,211,238,0.52)",
  background:
    "linear-gradient(135deg, rgba(34,211,238,0.28), rgba(59,130,246,0.24))",
  color: "rgba(255,255,255,0.98)",
  fontSize: 13,
  fontWeight: 900,
};

const secondaryRowBtn: React.CSSProperties = {

  minHeight: 40,
  padding: "9px 13px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 13,
  fontWeight: 800,
};

const dangerRowBtn: React.CSSProperties = {
  minHeight: 40,
  padding: "9px 13px",
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.56)",
  background: "rgba(127,29,29,0.72)",
  color: "rgba(254,242,242,0.98)",
  fontSize: 13,
  fontWeight: 800,
};

const mobileActionBtn: React.CSSProperties = {
  width: "100%",
  justifyContent: "center",
};

const iconBtn: React.CSSProperties = {
  width: 42,
  height: 42,
  borderRadius: 13,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "rgba(248,250,252,0.96)",
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyBox: React.CSSProperties = {
  padding: 18,
  borderRadius: 18,
  border: "1px dashed rgba(148,163,184,0.48)",
  background: "rgba(15,23,42,0.75)",
};

const emptyTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "rgba(248,250,252,0.95)",
};

const emptySub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.5,
  color: "rgba(148,163,184,0.95)",
};

const skRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(15,23,42,0.85)",
};

const skDot: React.CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: 999,
  background: "rgba(148,163,184,0.8)",
};

const skLine1: React.CSSProperties = {
  height: 12,
  width: "46%",
  borderRadius: 999,
  background: "rgba(148,163,184,0.22)",
};

const skLine2: React.CSSProperties = {
  height: 10,
  width: "72%",
  borderRadius: 999,
  background: "rgba(148,163,184,0.14)",
  marginTop: 8,
};

const toastBox: React.CSSProperties = {
  position: "fixed",
  right: 20,
  bottom: 20,
  zIndex: 60,
  minWidth: 240,
  maxWidth: 340,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(2,6,23,0.95)",
  padding: "12px 14px",
  boxShadow: "0 18px 50px rgba(0,0,0,0.4)",
};

const toastTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(248,250,252,0.98)",
};

const toastSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "rgba(148,163,184,0.92)",
};