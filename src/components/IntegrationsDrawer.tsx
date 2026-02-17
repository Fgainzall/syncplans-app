// src/components/IntegrationsDrawer.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import supabase from "@/lib/supabaseClient";

type GoogleStatus = {
  ok: boolean;
  connected: boolean;
  account?: {
    provider?: string | null;
    email?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
  error?: string;
};

export default function IntegrationsDrawer({
  open,
  onClose,
  onSynced,
}: {
  open: boolean;
  onClose: () => void;
  onSynced?: (imported: number) => void; // para refrescar Calendar/Summary
}) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  const close = useCallback(() => {
    if (loading || syncing) return;
    onClose();
  }, [loading, syncing, onClose]);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/google/status", {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const json = (await res.json().catch(() => null)) as GoogleStatus | null;
      if (!res.ok || !json?.ok) {
        setStatus({
          ok: false,
          connected: false,
          error: json?.error || "No se pudo leer el estado.",
        });
        return;
      }

      setStatus(json);
    } catch (e: any) {
      setStatus({
        ok: false,
        connected: false,
        error: e?.message || "Error leyendo estado.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchStatus();
  }, [open, fetchStatus]);

  const onSyncNow = useCallback(async () => {
    if (syncing) return;

    try {
      setSyncing(true);
      setToast({ title: "Sincronizando…", subtitle: "Importando desde Google Calendar" });

      const res = await fetch("/api/google/sync", { method: "POST" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setToast({
          title: "No se pudo sincronizar",
          subtitle: json?.error ?? "Revisa tu conexión o vuelve a conectar Google.",
        });
        window.setTimeout(() => setToast(null), 3200);
        return;
      }

      const imported = Number(json?.imported ?? 0);

      setToast({
        title: "Sincronizado ✅",
        subtitle: `Importados/actualizados: ${imported}`,
      });

      // refrescar estado del drawer (por si updated_at cambia)
      fetchStatus();

      // avisar a quien lo abrió para que refresque Calendar/Summary sin reload
      onSynced?.(imported);

      window.setTimeout(() => setToast(null), 2600);
    } catch (e: any) {
      setToast({
        title: "Error sincronizando",
        subtitle: e?.message ?? "Intenta de nuevo.",
      });
      window.setTimeout(() => setToast(null), 3200);
    } finally {
      setSyncing(false);
    }
  }, [fetchStatus, onSynced, syncing]);

  const connected = !!status?.connected;
  const email = status?.account?.email ?? null;

  const googlePill = useMemo(() => {
    if (loading) return { label: "Revisando…", tone: "muted" as const };
    if (connected) return { label: "Conectado ✅", tone: "ok" as const };
    if (status && !status.ok) return { label: "Error", tone: "bad" as const };
    return { label: "No conectado", tone: "muted" as const };
  }, [connected, loading, status]);

  if (!open) return null;

  return (
    <div style={S.overlay} onMouseDown={close} role="dialog" aria-modal="true">
      <div style={S.panel} onMouseDown={(e) => e.stopPropagation()}>
        {toast && (
          <div style={S.toastWrap}>
            <div style={S.toastCard}>
              <div style={S.toastTitle}>{toast.title}</div>
              {toast.subtitle ? <div style={S.toastSub}>{toast.subtitle}</div> : null}
            </div>
          </div>
        )}

        <div style={S.topRow}>
          <div>
            <div style={S.kicker}>Integraciones</div>
            <div style={S.title}>Conectar</div>
            <div style={S.sub}>Importa tus eventos externos y mantenlos en SyncPlans.</div>
          </div>

          <button onClick={close} style={S.closeBtn} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div style={S.card}>
          <div style={S.cardTop}>
            <div style={S.cardLeft}>
              <div style={S.cardTitleRow}>
                <div style={S.appIcon}>G</div>
                <div>
                  <div style={S.cardTitle}>Google Calendar</div>
                  <div style={S.cardSub}>
                    {email ? `Cuenta: ${email}` : "Importa eventos a tu calendario SyncPlans"}
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                ...S.pill,
                ...(googlePill.tone === "ok"
                  ? S.pillOk
                  : googlePill.tone === "bad"
                    ? S.pillBad
                    : S.pillMuted),
              }}
            >
              {googlePill.label}
            </div>
          </div>

          {status?.error ? (
            <div style={S.errorBox}>
              {status.error}
            </div>
          ) : null}

          <div style={S.actions}>
            <button
              type="button"
              onClick={fetchStatus}
              style={S.secondaryBtn}
              disabled={loading || syncing}
            >
              {loading ? "Revisando…" : "Revisar estado"}
            </button>

            <button
              type="button"
              onClick={onSyncNow}
              style={{
                ...S.primaryBtn,
                opacity: syncing ? 0.78 : 1,
                cursor: syncing ? "progress" : "pointer",
              }}
              disabled={syncing}
              title="Importar eventos desde Google Calendar"
            >
              {syncing ? "Sincronizando…" : "Sincronizar ahora"}
            </button>
          </div>

          <div style={S.note}>
            <b>Tip:</b> “Sincronizar ahora” importa desde Google → SyncPlans.
            <span style={{ opacity: 0.75 }}> En tu calendario, “Actualizar” solo recarga desde la DB.</span>
          </div>
        </div>

        <div style={S.footerHint}>
          Outlook (próximamente)
        </div>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    display: "flex",
    justifyContent: "flex-end",
  },
  panel: {
    width: "min(520px, 92vw)",
    height: "100%",
    padding: 18,
    borderLeft: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 420px at 20% 0%, rgba(37,99,235,0.18), transparent 55%), radial-gradient(900px 520px at 90% 10%, rgba(124,58,237,0.16), transparent 55%), rgba(2,6,23,0.92)",
    boxShadow: "-30px 0 90px rgba(0,0,0,0.55)",
    position: "relative",
  },

  toastWrap: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    zIndex: 2,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13, color: "rgba(255,255,255,0.95)" },
  toastSub: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.70)", fontWeight: 650 },

  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 6,
  },
  kicker: { fontSize: 12, fontWeight: 900, color: "#dbeafe", opacity: 0.9 },
  title: { fontSize: 24, fontWeight: 950, color: "#fff", marginTop: 6 },
  sub: { marginTop: 6, fontSize: 13, color: "#a8b3cf", fontWeight: 650 },

  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },

  card: {
    marginTop: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardLeft: { minWidth: 0, flex: 1 },
  cardTitleRow: { display: "flex", gap: 12, alignItems: "center" },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.12)",
    color: "#E0F2FE",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
  },
  cardTitle: { fontSize: 14, fontWeight: 950, color: "#fff" },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 650,
    color: "rgba(255,255,255,0.70)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  pill: {
    height: 30,
    padding: "0 10px",
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  pillOk: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "rgba(255,255,255,0.92)" },
  pillBad: { background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.25)", color: "rgba(255,255,255,0.92)" },
  pillMuted: { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.86)" },

  errorBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: 650,
  },

  actions: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  secondaryBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,0.35)",
    background: "linear-gradient(180deg, rgba(37,99,235,0.95), rgba(37,99,235,0.55))",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 950,
  },

  note: {
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: 650,
    lineHeight: 1.4,
  },

  footerHint: {
    marginTop: 14,
    fontSize: 12,
    opacity: 0.55,
    fontWeight: 750,
  },
};