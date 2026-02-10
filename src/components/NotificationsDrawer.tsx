// src/components/NotificationsDrawer.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

export type NavigationMode = "push" | "replace";

export default function NotificationsDrawer({
  open,
  onClose,
  navigationMode = "replace", // app-like
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
  const [toast, setToast] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  // guard para no hacer doble fetch cuando open parpadea
  const lastOpenFetchAt = useRef(0);
  const busyIds = useRef<Set<string>>(new Set());

  // ⚠️ Ahora getMyNotifications SOLO trae no leídas.
  // Además, añadimos las invitaciones pendientes como "group_invite".
  const unreadCount = useMemo(() => items.length, [items]);

  // Actualizar badge en el header premium
  useEffect(() => {
    if (!onUnreadChange) return;
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  // Helper: convertir invitación → notificación sintética
  function inviteToNotificationRow(inv: GroupInvitation): NotificationRow {
    const gt = (inv.group_type || "").toLowerCase();
    const mapping: Record<string, string> = {
      personal: "Personal",
      solo: "Personal",
      pair: "Pareja",
      couple: "Pareja",
      family: "Familia",
    };
    const groupLabel = mapping[gt] ?? "Grupo";

    return {
      id: `invite:${inv.id}`, // 👈 id sintético
      user_id: "synthetic", // no se usa en el front
      type: "group_invite",
      title: inv.group_name
        ? `Invitación a ${inv.group_name}`
        : `Invitación a un ${groupLabel.toLowerCase()}`,
      body: `Te invitaron a un grupo (${groupLabel}).`,
      entity_id: inv.id, // aquí guardamos el id real de la invitación
      payload: {
        group_name: inv.group_name,
        group_type: inv.group_type,
      },
      created_at: inv.created_at ?? new Date().toISOString(),
      read_at: null,
    };
  }

  async function fetchNotificationsAndInvites(): Promise<NotificationRow[]> {
    const [notifs, invites] = await Promise.all([
      getMyNotifications(limit),
      getMyInvitations(),
    ]);

    const syntheticInvites = (invites ?? []).map(inviteToNotificationRow);

    // Invitaciones primero, luego resto de notificaciones
    return [...syntheticInvites, ...(notifs ?? [])];
  }

  // Cargar notificaciones cuando se abre el drawer
  useEffect(() => {
    if (!open) return;

    const now = Date.now();
    if (now - lastOpenFetchAt.current < 250) return; // anti doble-open
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, limit]);

  // Autocerrar toast suave
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function navTo(href: string) {
    if (navigationMode === "replace") router.replace(href);
    else router.push(href);
  }

  function titleFor(n: NotificationRow) {
    const t = String(n.type || "").toLowerCase();

    // 💬 Notificaciones de mensajes de grupo (V2)
    if (t === "group_message") {
      const payload = (n.payload || {}) as any;
      const groupName =
        payload.group_name ||
        n.title?.replace(/^Nuevo mensaje en\s+/i, "") ||
        "tu grupo";
      const authorName: string | undefined = payload.author_name;

      if (authorName) {
        return `${authorName} escribió en ${groupName}`;
      }

      if (n.title) return n.title;
      return `Nuevo mensaje en ${groupName}`;
    }

    // 📩 Invitaciones de grupo
    if (t === "group_invite") {
      if (n.title) return n.title;
      const payload = (n.payload || {}) as any;
      const groupName: string | undefined = payload.group_name;
      if (groupName) return `Invitación a ${groupName}`;
      return "Nueva invitación a un grupo";
    }

    // Resto de tipos (legacy)
    if (n.title) return n.title;
    if (t === "conflict_detected" || t === "conflict")
      return "Conflicto de horario";
    if (t === "event_created") return "Nuevo evento creado";
    if (t === "event_deleted") return "Evento eliminado";
    return "Notificación";
  }

  function subtitleFor(n: NotificationRow) {
    const t = String(n.type || "").toLowerCase();

    // 💬 Mensaje de grupo: usamos snippet si viene en payload
    if (t === "group_message") {
      const payload = (n.payload || {}) as any;
      return (
        payload.message_snippet ||
        n.body ||
        "Toca para ver el mensaje en el grupo."
      );
    }

    // 📩 Invitación de grupo
    if (t === "group_invite") {
      if (n.body) return n.body;
      const payload = (n.payload || {}) as any;
      const groupName: string | undefined = payload.group_name;
      if (groupName)
        return `Te invitaron al grupo "${groupName}". Toca para ver detalles.`;
      return "Toca para ver y aceptar o rechazar la invitación.";
    }

    if (n.body) return n.body;
    if (t === "conflict_detected" || t === "conflict")
      return "Tu evento se cruza con otro. Revísalo antes de que se complique.";
    if (t === "event_created")
      return "Tu evento se guardó correctamente.";
    if (t === "event_deleted") return "Tu evento fue eliminado.";
    return "Toca para ver más.";
  }

  function typeLabel(n: NotificationRow): string {
    const t = String(n.type || "").toLowerCase();
    if (t === "conflict" || t === "conflict_detected") return "Conflicto";
    if (t === "event_created" || t === "event_deleted") return "Evento";
    if (t === "group_message") return "Mensaje de grupo";
    if (t === "group_invite") return "Invitación";
    return "Notificación";
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
    let alive = true;
    try {
      if (!silent) setLoading(true);
      const n = await fetchNotificationsAndInvites();
      if (!alive) return;
      setItems(n);
    } catch {
      if (!silent) {
        setToast({
          title: "No pudimos actualizar",
          subtitle: "Verifica tu conexión.",
        });
      }
    } finally {
      if (alive && !silent) setLoading(false);
    }
  }

  // ✅ "Marcar todo leído" solo limpia notificaciones reales,
  //    pero mantiene las invitaciones pendientes.
  async function onMarkAll() {
    if (items.length === 0) return;

    try {
      setLoading(true);

      // optimista: dejamos solo las invitaciones (group_invite)
      setItems((prev) =>
        prev.filter(
          (n) => String(n.type || "").toLowerCase() === "group_invite"
        )
      );

      await markAllRead();

      setToast({
        title: "Listo",
        subtitle: "Marcaste todas como leídas.",
      });
    } catch {
      setToast({
        title: "No pudimos marcar como leídas",
        subtitle: "Intenta nuevamente.",
      });
      // reintentar carga para no quedar desfasados
      void refreshFromDb(true);
    } finally {
      setLoading(false);
    }
  }

  // Igual que marcar todo leído, pero semánticamente “borrar todo”
  async function onDeleteAll() {
    if (items.length === 0) return;

    try {
      setLoading(true);

      // optimista: dejamos solo las invitaciones
      setItems((prev) =>
        prev.filter(
          (n) => String(n.type || "").toLowerCase() === "group_invite"
        )
      );

      await deleteAllNotifications();

      setToast({
        title: "Notificaciones eliminadas",
        subtitle: "Limpiaste tu bandeja de notificaciones.",
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

    // 📩 Invitación de grupo: no marcamos como leída,
    // solo redirigimos al flujo de invitaciones.
    if (type === "group_invite") {
      const href = notificationHref(n);
      navTo(href);
      onClose();
      return;
    }

    const href = notificationHref(n);
    const id = String(n.id);

    try {
      busyIds.current.add(id);

      // Cuando abres una notificación, la quitamos del listado inmediatamente.
      setItems((prev) => prev.filter((x) => String(x.id) !== id));

      // La marcamos como leída en la BD
      await markNotificationRead(id);

      navTo(href);
      onClose();
    } catch {
      setToast({
        title: "No pudimos abrir esa notificación",
        subtitle: "Intenta de nuevo.",
      });
    } finally {
      busyIds.current.delete(id);
    }
  }

  async function onDeleteNotificationClick(n: NotificationRow) {
    const type = String(n.type || "").toLowerCase();

    // Para invitaciones no tenemos “Quitar” aquí; se maneja en /invitations
    if (type === "group_invite") return;

    const id = String(n.id);

    try {
      busyIds.current.add(id);
      // optimista: sacamos esa notificación de la lista
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
            style={drawer}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            <div style={header}>
              <div>
                <div style={title}>Notificaciones</div>
                <div style={sub}>
                  {unreadCount > 0
                    ? `${unreadCount} sin leer`
                    : "Estás al día ✨"}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: "rgba(148,163,184,0.85)",
                  }}
                >
                  Solo mostramos notificaciones pendientes. Lo que
                  marques como leído desaparecerá de aquí, pero se
                  mantiene en el historial interno.
                </div>
              </div>

              <div style={headerActions}>
                <button
                  type="button"
                  style={{
                    ...iconBtn,
                    opacity: loading ? 0.6 : 1,
                    cursor: loading ? "progress" : "pointer",
                  }}
                  onClick={() => refreshFromDb()}
                  disabled={loading}
                  title="Actualizar"
                >
                  ⟳
                </button>

                {items.length > 0 && (
                  <>
                    <button
                      type="button"
                      style={{
                        ...ghostBtn,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? "progress" : "pointer",
                      }}
                      onClick={onMarkAll}
                      disabled={loading}
                    >
                      Marcar todo leído
                    </button>

                    <button
                      type="button"
                      style={{
                        ...ghostDangerBtn,
                        opacity: loading ? 0.6 : 1,
                        cursor: loading ? "progress" : "pointer",
                      }}
                      onClick={onDeleteAll}
                      disabled={loading}
                    >
                      Limpiar bandeja
                    </button>
                  </>
                )}

                <button type="button" style={iconBtn} onClick={onClose}>
                  ✕
                </button>
              </div>
            </div>

            <div style={body}>
              {loading && items.length === 0 ? (
                <SkeletonList />
              ) : showEmptyState ? (
                <div style={emptyBox}>
                  <div style={emptyTitle}>Nada nuevo por aquí</div>
                  <div style={emptySub}>
                    Cuando tengas conflictos, eventos, mensajes o
                    invitaciones a grupos, aparecerán en esta bandeja.
                  </div>
                </div>
              ) : (
                <div style={list}>
                  {items.map((n) => {
                    const isBusy = busyIds.current.has(String(n.id));
                    const payload = (n.payload || {}) as any;
                    const type = String(n.type || "").toLowerCase();

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenNotification(n)}
                        style={{
                          ...rowBtn,
                          borderColor: "rgba(255,255,255,0.16)",
                          background:
                            "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))",
                          opacity: isBusy ? 0.7 : 1,
                          cursor: isBusy ? "progress" : "pointer",
                        }}
                        disabled={isBusy}
                      >
                        <div
                          style={{
                            display: "flex",
                            gap: 12,
                            alignItems: "flex-start",
                          }}
                        >
                          <div
                            style={{
                              ...dot,
                              background: "#FBBF24",
                              boxShadow:
                                "0 0 0 4px rgba(251,191,36,0.12)",
                            }}
                          />

                          <div
                            style={{
                              flex: 1,
                              textAlign: "left",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <div style={rowTitle}>
                                {titleFor(n)}
                              </div>
                              <div style={rowTime}>
                                {timeFor(n)}
                              </div>
                            </div>

                            <div style={rowSub}>
                              {subtitleFor(n)}
                            </div>

                            <div style={rowMeta}>
                              <span style={metaPill}>
                                {typeLabel(n)}
                              </span>
                              {(type === "group_message" ||
                                type === "group_invite") &&
                                payload.group_name && (
                                  <span style={metaPill}>
                                    Grupo: {payload.group_name}
                                  </span>
                                )}
                              <span style={metaPill}>Abrir</span>
                              {type !== "group_invite" && (
                                <span
                                  style={metaPillDanger}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteNotificationClick(n);
                                  }}
                                >
                                  Quitar
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{ marginTop: 2, opacity: 0.8 }}
                          >
                            ›
                          </div>
                        </div>
                      </button>
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
          {toast.subtitle && (
            <div style={toastSub}>{toast.subtitle}</div>
          )}
        </div>
      )}
    </>
  );
}

function SkeletonList() {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 10 }}
    >
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

// ───────────────── estilos ─────────────────

const backdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.30)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  zIndex: 40,
  display: "flex",
  justifyContent: "flex-end",
};

const drawer: React.CSSProperties = {
  width: 360,
  maxWidth: "100%",
  height: "100%",
  background: "radial-gradient(circle at top, #0f172a 0, #020617 60%)",
  borderLeft: "1px solid rgba(148,163,184,0.45)",
  padding: 16,
  display: "flex",
  flexDirection: "column",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const title: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "rgba(248,250,252,0.98)",
};

const sub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "rgba(148,163,184,0.95)",
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const body: React.CSSProperties = {
  marginTop: 14,
  flex: 1,
  overflowY: "auto",
  paddingRight: 4,
};

const list: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const rowBtn: React.CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  padding: 10,
  background: "rgba(255,255,255,0.04)",
  color: "inherit",
  textAlign: "left",
};

const dot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  marginTop: 6,
  flex: "0 0 auto",
};

const rowTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
};

const rowTime: React.CSSProperties = {
  fontSize: 11,
  color: "rgba(255,255,255,0.55)",
  whiteSpace: "nowrap",
  marginTop: 1,
};

const rowSub: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "rgba(255,255,255,0.70)",
  lineHeight: 1.35,
};

const rowMeta: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const metaPill: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.78)",
  cursor: "default",
};

const metaPillDanger: React.CSSProperties = {
  ...metaPill,
  borderColor: "rgba(248,113,113,0.6)",
  background: "rgba(248,113,113,0.10)",
  color: "rgba(254,242,242,0.96)",
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.86)",
  fontSize: 12,
  fontWeight: 600,
};

const ghostDangerBtn: React.CSSProperties = {
  ...ghostBtn,
  borderColor: "rgba(248,113,113,0.7)",
  background: "rgba(127,29,29,0.70)",
  color: "rgba(254,242,242,0.98)",
};

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(15,23,42,0.85)",
  color: "rgba(248,250,252,0.96)",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emptyBox: React.CSSProperties = {
  padding: 16,
  borderRadius: 16,
  border: "1px dashed rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.75)",
};

const emptyTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "rgba(248,250,252,0.95)",
};

const emptySub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "rgba(148,163,184,0.95)",
};

const skRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(15,23,42,0.85)",
};

const skDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "rgba(148,163,184,0.8)",
};

const skLine1: React.CSSProperties = {
  height: 10,
  width: "55%",
  borderRadius: 999,
  background: "rgba(255,255,255,0.18)",
};

const skLine2: React.CSSProperties = {
  height: 10,
  width: "85%",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  marginTop: 10,
};

const toastBox: React.CSSProperties = {
  position: "fixed",
  bottom: 18,
  right: 18,
  zIndex: 50,
  padding: "10px 12px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(16,18,26,0.92)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
};

const toastTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
};

const toastSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "rgba(209,213,219,0.95)",
};
