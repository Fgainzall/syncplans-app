// src/app/settings/weekly/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getUser } from "@/lib/auth";
import { getSettingsFromDb, saveSettingsToDb, type NotificationSettings } from "@/lib/settings";

type UiToast = { title: string; subtitle?: string } | null;

export default function WeeklySettingsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [s, setS] = useState<NotificationSettings | null>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const u = getUser();
        if (!u) {
          router.push("/auth/login?next=/settings/weekly");
          return;
        }

        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
      } catch (e) {
        console.error("[WeeklySettings] load error", e);
        showToast("No se pudieron cargar tus ajustes", "Refresca la página o intenta de nuevo.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function commit(next: NotificationSettings) {
    setS(next);
    setSaving(true);
    try {
      await saveSettingsToDb(next);
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 700);
    } catch (e) {
      console.error("[WeeklySettings] save error", e);
      showToast("No se pudo guardar", "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const status = useMemo(() => {
    if (!s) return "—";
    return s.weeklySummary ? "ON" : "OFF";
  }, [s]);

  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <div style={styles.kicker}>Settings</div>
            <h1 style={styles.h1}>Resumen semanal</h1>
            <div style={styles.sub}>Tu semana en limpio: valor consolidado, sin ruido.</div>

            <div style={styles.heroMeta}>
              <span style={styles.pillSoft}>Estado: {status}</span>
              <span style={{ ...styles.pillSoft, ...(savedPulse ? styles.pillOkSoft : null) }}>
                {saving ? "Guardando…" : savedPulse ? "Guardado ✓" : "Auto-guardado"}
              </span>
            </div>
          </div>

          <div style={styles.heroBtns}>
            <button onClick={() => router.push("/settings")} style={styles.ghostBtn}>
              Volver a settings →
            </button>
            <button onClick={() => router.push("/calendar")} style={styles.ghostBtn}>
              Ir al calendario →
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Control</div>
          <div style={styles.smallNote}>
            Activa/desactiva el resumen semanal. Luego lo conectamos al scheduler real de envío.
          </div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Activar resumen semanal"
              subtitle="Un resumen compacto de tu semana (eventos, organización y conflictos)."
              value={!!s?.weeklySummary}
              onChange={(v) => {
                if (!s) return;
                commit({ ...s, weeklySummary: v });
              }}
              disabled={!s || saving}
            />
          </div>

          <div style={styles.note}>
            <b>Nota:</b> Este switch controla el setting. El envío semanal depende del cron / endpoint semanal.
          </div>
        </section>

        {booting ? (
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Resumen semanal</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <div style={styles.toggleRow}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.toggleTitle}>{title}</div>
        <div style={styles.toggleSub}>{subtitle}</div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        disabled={disabled}
        style={{
          ...styles.toggleBtn,
          ...(value ? styles.toggleOn : styles.toggleOff),
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        aria-label={title}
      >
        <span
          style={{
            ...styles.toggleKnob,
            ...(value ? styles.knobOn : styles.knobOff),
          }}
        />
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 980, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 420,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  kicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
  },
  h1: { margin: "10px 0 0", fontSize: 26, letterSpacing: "-0.6px", fontWeight: 900 as any },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },
  heroBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroMeta: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72, maxWidth: 760 },

  innerCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
  },

  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 10px" },
  toggleTitle: { fontSize: 13, fontWeight: 900 as any },
  toggleSub: { marginTop: 4, fontSize: 12, opacity: 0.72, lineHeight: 1.3 },

  toggleBtn: {
    position: "relative",
    width: 56,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  toggleOn: { border: "1px solid rgba(34,197,94,0.30)", background: "rgba(34,197,94,0.14)" },
  toggleOff: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" },
  toggleKnob: {
    position: "absolute",
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#050816",
    border: "1px solid rgba(255,255,255,0.10)",
    transition: "all 180ms ease",
  },
  knobOn: { left: 28, border: "1px solid rgba(34,197,94,0.35)" },
  knobOff: { left: 4 },

  pillSoft: {
    fontSize: 10,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(148,163,184,0.08)",
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  pillOkSoft: { border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.10)" },

  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900 as any,
  },

  note: { marginTop: 10, fontSize: 12, opacity: 0.78, fontWeight: 650 as any, lineHeight: 1.4 },

  loadingCard: {
    marginTop: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: { width: 12, height: 12, borderRadius: 999, background: "rgba(56,189,248,0.95)", boxShadow: "0 0 24px rgba(56,189,248,0.55)" },
  loadingTitle: { fontWeight: 900 as any },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};