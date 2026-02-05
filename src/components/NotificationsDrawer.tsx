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
  const [toast, setToast] = useState<{ title: string; subtitle?: string } | null>(
    null
  );

  const lastOpenFetchAt = useRef(0);
  const busyIds = useRef<Set<string>>(new Set());

  const unreadCount = useMemo(
    () =>
      items.filter((x) => !x.read_at || x.read_at === "").length,
    [items]
  );

  useEffect(() => {
    if (!onUnreadChange) return;
    onUnreadChange(unreadCount);
  }, [unreadCount, onUnreadChange]);

  useEffect(() => {
    if (!open) return;

    const now = Date.now();
    if (now - lastOpenFetchAt.current < 250) return; // guard anti doble open
    lastOpenFetchAt.current = now;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const n = await getMyNotifications(limit);
        if (!alive) return;
        setItems(n);
      } catch {
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
  }, [open, limit]);

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
    if (n.title) return n.title;
    if (n.type === "conflict_detected" || n.type === "conflict")
      return "Conflicto de horario";
    if (n.type === "event_created") return "Nuevo evento creado";
    if (n.type === "event_deleted") return "Evento eliminado";
    return "Notificación";
  }

  function subtitleFor(n: NotificationRow) {
    if (n.body) return n.body;
    if (n.type === "conflict_detected" || n.type === "conflict")
      return "Tu evento se cruza con otro. Revísalo antes de que se complique.";
    if (n.type === "event_created")
      return "Tu evento se guardó correctamente.";
    if (n.type === "event_deleted") return "Tu evento fue eliminado.";
    return "Toca para ver más.";
  }

  function typeLabel(n: NotificationRow): string {
    const t = String(n.type || "").toLowerCase();
    if (t === "conflict" || t === "conflict_detected") return "Conflicto";
    if (t === "event_created" || t === "event_deleted") return "Evento";
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

  async function onMarkAll() {
    const nowIso = new Date().toISOString();

    try {
      setLoading(true);

      // ✅ optimista: baja badge al instante
      setItems((prev) =>
        prev.map((x) => ({ ...x, read_at: x.read_at ?? nowIso }))
      );

      // persist
      await markAllRead();

      // refresh silencioso
      refreshFromDb(true);

      setToast({
        title: "Listo",
        subtitle: "Marcaste todas como leídas.",
      });
    } catch {
      setToast({
        title: "No pudimos marcar como leídas",
        subtitle: "Intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteAll() {
    try {
      setLoading(true);

      // ✅ optimista: limpiamos lista
      setItems([]);

      await deleteAllNotifications();

      setToast({
        title: "Notificaciones eliminadas",
        subtitle: "Borraste todo el historial de notificaciones.",
      });
    } catch {
      setToast({
        title: "No pudimos eliminar",
        subtitle: "Intenta nuevamente.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshFromDb(silent = false) {
    let alive = true;

    try {
      if (!silent) setLoading(true);
      const n = await getMyNotifications(limit);
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

  async function onOpenNotification(n: NotificationRow) {
    const href = notificationHref(n);

    const id = String(n.id);
    const nowIso = new Date().toISOString();

    try {
      busyIds.current.add(id);
      setItems((prev) =>
        prev.map((x) =>
          String(x.id) === id ? { ...x, read_at: x.read_at ?? nowIso } : x
        )
      );

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
                        opacity: unreadCount === 0 || loading ? 0.6 : 1,
                        cursor:
                          unreadCount === 0 || loading ? "default" : "pointer",
                      }}
                      onClick={() => {
                        if (unreadCount === 0 || loading) return;
                        onMarkAll();
                      }}
                      disabled={unreadCount === 0 || loading}
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
                      Eliminar todo
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
                    Cuando tengas conflictos, eventos o invitaciones, aparecerán
                    aquí.
                  </div>
                </div>
              ) : (
                <div style={list}>
                  {items.map((n) => {
                    const isUnread = !n.read_at || n.read_at === "";
                    const isBusy = busyIds.current.has(String(n.id));

                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => onOpenNotification(n)}
                        style={{
                          ...rowBtn,
                          borderColor: isUnread
                            ? "rgba(255,255,255,0.16)"
                            : "rgba(255,255,255,0.08)",
                          background: isUnread
                            ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))"
                            : "rgba(255,255,255,0.04)",
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
                              background: isUnread
                                ? "#FBBF24"
                                : "rgba(255,255,255,0.22)",
                              boxShadow: isUnread
                                ? "0 0 0 4px rgba(251,191,36,0.12)"
                                : "none",
                            }}
                          />

                          <div style={{ flex: 1, textAlign: "left" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  ...rowTitle,
                                  opacity: isUnread ? 1 : 0.9,
                                }}
                              >
                                {titleFor(n)}
                              </div>
                              <div style={rowTime}>{timeFor(n)}</div>
                            </div>

                            <div style={rowSub}>{subtitleFor(n)}</div>

                            <div style={rowMeta}>
                              <span style={metaPill}>{typeLabel(n)}</span>
                              <span style={metaPill}>Abrir</span>
                              {isUnread && (
                                <span
                                  style={{
                                    ...metaPill,
                                    borderColor: "rgba(251,191,36,0.35)",
                                  }}
                                >
                                  Nuevo
                                </span>
                              )}
                              <span
                                style={metaPillDanger}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteNotificationClick(n);
                                }}
                              >
                                Eliminar
                              </span>
                            </div>
                          </div>

                          <div style={{ marginTop: 2, opacity: 0.8 }}>›</div>
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
          {toast.subtitle && <div style={toastSub}>{toast.subtitle}</div>}
        </div>
      )}
    </>
  );
}

function SkeletonList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
