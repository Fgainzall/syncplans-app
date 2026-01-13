"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getMyNotifications,
  markAllRead,
  markNotificationRead,
  NotificationRow,
  notificationHref,
} from "@/lib/notificationsDb";

export type NavigationMode = "push" | "replace";

export default function NotificationsDrawer({
  open,
  onClose,
  navigationMode = "replace", // B por defecto (app-like)
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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  // Evita re-fetch doble si abres/cierra rápido
  const lastOpenFetchAt = useRef<number>(0);

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items]);

  // ✅ baja badge “al toque”
  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  async function refreshFromDb(silent = true) {
    try {
      const n = await getMyNotifications(limit);
      setItems(n);
    } catch {
      if (!silent) {
        setToast({
          title: "No pudimos actualizar",
          subtitle: "Tus cambios se guardaron, pero no pudimos recargar la lista.",
        });
      }
    }
  }

  useEffect(() => {
    if (!open) return;

    const now = Date.now();
    if (now - lastOpenFetchAt.current < 250) return; // guard anti “doble open”
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
    if (n.type === "conflict_detected") return "Conflicto detectado";
    if (n.type === "event_created") return "Evento creado";
    if (n.type === "event_deleted") return "Evento eliminado";
    return "Notificación";
  }

  function subtitleFor(n: NotificationRow) {
    if (n.body) return n.body;
    if (n.type === "conflict_detected") return "Encontramos un choque de horario. Resuélvelo en 1 toque.";
    if (n.type === "event_created") return "Tu evento se guardó correctamente.";
    if (n.type === "event_deleted") return "Tu evento fue eliminado.";
    return "Toca para ver más.";
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
      setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? nowIso })));

      // persist
      await markAllRead();

      // ✅ refresh “no-blocking” (silencioso)
      refreshFromDb(true);

      setToast({ title: "Listo", subtitle: "Marcamos todo como leído." });
    } catch {
      // si falló el persist, intentamos volver a estado real
      await refreshFromDb(false);
      setToast({ title: "Ups", subtitle: "No se pudo marcar todo como leído." });
    } finally {
      setLoading(false);
    }
  }

  async function openNotification(n: NotificationRow) {
    const href = notificationHref(n);
    const nowIso = new Date().toISOString();

    try {
      setBusyId(n.id);

      // ✅ optimista (baja badge)
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: x.read_at ?? nowIso } : x)));

      // persist si era unread
      if (!n.read_at) {
        await markNotificationRead(n.id);
      }
    } catch {
      // si falla, igual navegamos
    } finally {
      setBusyId(null);
      onClose();
      navTo(href);

      // ✅ refresh silencioso para que lista quede exacta al volver
      refreshFromDb(true);
    }
  }

  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div style={panel} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={header}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={headerTitle}>Notificaciones</div>
              {unreadCount > 0 && <div style={badge}>{unreadCount}</div>}
            </div>
            <div style={headerSub}>Tu bandeja de alertas y conflictos</div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={onMarkAll}
              disabled={loading || items.length === 0 || unreadCount === 0}
              style={{
                ...ghostBtn,
                opacity: loading || items.length === 0 || unreadCount === 0 ? 0.6 : 1,
                cursor: loading || items.length === 0 || unreadCount === 0 ? "not-allowed" : "pointer",
              }}
              title="Marcar todo como leído"
            >
              {loading ? "..." : "Marcar todo"}
            </button>

            <button onClick={onClose} style={iconBtn} aria-label="Cerrar">
              ✕
            </button>
          </div>
        </div>

        {/* List */}
        <div style={body}>
          {loading && items.length === 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : items.length === 0 ? (
            <div style={emptyWrap}>
              <div style={emptyTitle}>Todo tranquilo ✨</div>
              <div style={emptySub}>Cuando tengas recordatorios o conflictos, aparecerán aquí.</div>
              <button
                style={primaryBtn}
                onClick={() => {
                  onClose();
                  navTo("/calendar");
                }}
              >
                Ir a mi calendario
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((n) => {
                const isUnread = !n.read_at;
                const isBusy = busyId === n.id;

                return (
                  <button
                    key={n.id}
                    onClick={() => openNotification(n)}
                    style={{
                      ...rowBtn,
                      borderColor: isUnread ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                      background: isUnread
                        ? "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))"
                        : "rgba(255,255,255,0.04)",
                      opacity: isBusy ? 0.7 : 1,
                      cursor: isBusy ? "progress" : "pointer",
                    }}
                    disabled={isBusy}
                  >
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div
                        style={{
                          ...dot,
                          background: isUnread ? "#FBBF24" : "rgba(255,255,255,0.22)",
                          boxShadow: isUnread ? "0 0 0 4px rgba(251,191,36,0.12)" : "none",
                        }}
                      />

                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ ...rowTitle, opacity: isUnread ? 1 : 0.9 }}>{titleFor(n)}</div>
                          <div style={rowTime}>{timeFor(n)}</div>
                        </div>

                        <div style={rowSub}>{subtitleFor(n)}</div>

                        <div style={rowMeta}>
                          <span style={metaPill}>Abrir</span>
                          {isUnread && (
                            <span style={{ ...metaPill, borderColor: "rgba(251,191,36,0.35)" }}>Nuevo</span>
                          )}
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

        {/* Toast */}
        {toast && (
          <div style={toastWrap}>
            <div style={toastTitle}>{toast.title}</div>
            {toast.subtitle && <div style={toastSub}>{toast.subtitle}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={skRow}>
      <div style={skDot} />
      <div style={{ flex: 1 }}>
        <div style={skLine1} />
        <div style={skLine2} />
      </div>
    </div>
  );
}

/* ------------------------------ Styles ------------------------------ */

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  backdropFilter: "blur(6px)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 80,
};

const panel: React.CSSProperties = {
  width: 420,
  maxWidth: "92vw",
  height: "100vh",
  background: "linear-gradient(180deg, rgba(10,12,18,0.96), rgba(10,12,18,0.92))",
  borderLeft: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "-20px 0 60px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};

const header: React.CSSProperties = {
  padding: "18px 18px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.10)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const headerTitle: React.CSSProperties = {
  color: "rgba(255,255,255,0.95)",
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: 0.2,
};

const headerSub: React.CSSProperties = {
  color: "rgba(255,255,255,0.60)",
  fontSize: 12,
};

const badge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(12,14,18,0.95)",
  background: "#FBBF24",
};

const body: React.CSSProperties = {
  padding: 16,
  overflow: "auto",
  flex: 1,
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

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.04)",
  color: "rgba(255,255,255,0.86)",
  fontSize: 14,
  cursor: "pointer",
};

const rowBtn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 14,
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.10)",
  color: "rgba(255,255,255,0.92)",
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
};

const emptyWrap: React.CSSProperties = {
  border: "1px dashed rgba(255,255,255,0.18)",
  borderRadius: 18,
  padding: 18,
  background: "rgba(255,255,255,0.03)",
  display: "grid",
  gap: 10,
};

const emptyTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "rgba(255,255,255,0.92)",
};

const emptySub: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.65)",
  lineHeight: 1.35,
};

const primaryBtn: React.CSSProperties = {
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
  color: "rgba(255,255,255,0.92)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const toastWrap: React.CSSProperties = {
  position: "absolute",
  bottom: 18,
  left: 18,
  right: 18,
  padding: 14,
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
  color: "rgba(255,255,255,0.70)",
};

const skRow: React.CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
};

const skDot: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  marginTop: 6,
  background: "rgba(255,255,255,0.22)",
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
