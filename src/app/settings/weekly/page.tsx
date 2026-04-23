// src/app/settings/weekly/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getUser } from "@/lib/auth";
import {
  getSettingsFromDb,
  saveSettingsToDb,
  type NotificationSettings,
} from "@/lib/settings";

type UiToast = { title: string; subtitle?: string } | null;

export default function WeeklySettingsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const user = getUser();
        if (!user) {
          router.push("/auth/login?next=/settings/weekly");
          return;
        }

        const db = await getSettingsFromDb();
        if (!alive) return;
        setSettings(db);
      } catch (e) {
        console.error("[WeeklySettings] load error", e);
        showToast(
          "No se pudieron cargar tus ajustes",
          "Refresca la página o intenta de nuevo."
        );
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function commit(next: NotificationSettings) {
    setSettings(next);
    setSaving(true);

    try {
      await saveSettingsToDb(next);
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 900);
      showToast(
        "Preferencia guardada ✅",
        next.weeklySummary
          ? "Tu resumen semanal quedó activo."
          : "Tu resumen semanal quedó pausado."
      );
    } catch (e) {
      console.error("[WeeklySettings] save error", e);
      showToast("No se pudo guardar", "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const weeklyEnabled = !!settings?.weeklySummary;

  const status = useMemo(() => {
    if (!settings) return "—";
    return weeklyEnabled ? "Activo" : "Pausado";
  }, [settings, weeklyEnabled]);

  const valueBullets = useMemo(() => {
    if (weeklyEnabled) {
      return [
        "Una lectura compacta de la semana sin abrir varias pantallas para reconstruir el contexto.",
        "Más claridad compartida para empezar la semana sabiendo qué viene y dónde puede haber fricción.",
        "Menos trabajo manual cuando SyncPlans ya se volvió parte del hábito real.",
      ];
    }

    return [
      "Puedes dejarlo apagado mientras validas el uso base del producto.",
      "Actívalo cuando quieras más contexto semanal con menos esfuerzo manual.",
      "No cambia tus eventos; solo mejora la lectura recurrente de lo que ya existe.",
    ];
  }, [weeklyEnabled]);

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.topRow}>
            <PremiumHeader />
            <div style={styles.topActions}>
              <LogoutButton />
            </div>
          </div>

          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Resumen semanal</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Settings</div>
            <h1 style={styles.h1}>Resumen semanal</h1>
            <div style={styles.sub}>
              Una capa de contexto recurrente para que SyncPlans te ayude a anticiparte,
              no solo a registrar eventos.
            </div>

            <div style={styles.heroMeta}>
              <span style={styles.pillSoft}>Estado: {status}</span>
              <span
                style={{
                  ...styles.pillSoft,
                  ...(savedPulse ? styles.pillOkSoft : null),
                }}
              >
                {saving ? "Guardando…" : savedPulse ? "Guardado ✓" : "Auto-guardado"}
              </span>
            </div>
          </div>

          <div style={styles.heroBtns}>
            <button
              onClick={() => router.push("/settings")}
              style={styles.ghostBtn}
            >
              Volver a settings →
            </button>
            <button
              onClick={() => router.push("/summary")}
              style={styles.ghostBtn}
            >
              Ir al resumen →
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Qué hace esta capa</div>
          <div style={styles.smallNote}>
            No es un correo por mandar correos. Es una forma de darte más contexto
            semanal sin obligarte a reconstruir todo manualmente.
          </div>

          <div style={styles.valueGrid}>
            {valueBullets.map((item) => (
              <div key={item} style={styles.valueCard}>
                <span style={styles.valueDot} />
                <span style={styles.valueText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Control</div>
          <div style={styles.smallNote}>
            Activa o pausa el resumen semanal. El objetivo aquí es más claridad
            recurrente, no más ruido.
          </div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Activar resumen semanal"
              subtitle={
                weeklyEnabled
                  ? "Está activo. SyncPlans ya puede resumirte la semana con una lectura más limpia."
                  : "Actívalo cuando quieras una vista compacta de la semana sin perseguir varias pantallas."
              }
              value={!!settings?.weeklySummary}
              onChange={(v) => {
                if (!settings) return;
                commit({ ...settings, weeklySummary: v });
              }}
              disabled={!settings || saving}
            />
          </div>

          <div style={styles.note}>
            <b>Importante:</b> este switch controla la preferencia. El envío real depende
            del flujo de automatización / cron que conectemos después.
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Cuándo tiene sentido activarlo</div>
          <div style={styles.smallNote}>
            Esta capa empieza a cobrar sentido cuando SyncPlans ya te ahorra fricción de verdad.
          </div>

          <div style={styles.innerCard}>
            <div style={styles.reasonItem}>
              <div style={styles.reasonTitle}>Sí conviene si…</div>
              <div style={styles.reasonCopy}>
                ya usas SyncPlans con otra persona y quieres entrar a la semana con
                mejor contexto y menos trabajo manual.
              </div>
            </div>

            <Divider />

            <div style={styles.reasonItem}>
              <div style={styles.reasonTitle}>Puedes dejarlo apagado si…</div>
              <div style={styles.reasonCopy}>
                todavía estás validando el caso base y prefieres mantener el producto
                lo más simple posible por ahora.
              </div>
            </div>
          </div>
        </section>
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

function Divider() {
  return <div style={styles.divider} />;
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "22px 18px 48px",
    display: "grid",
    gap: 14,
  },
  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
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
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  hero: {
    padding: "18px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(124,58,237,0.06) 55%, rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  heroLeft: {
    minWidth: 0,
    flex: "1 1 420px",
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
    width: "fit-content",
  },
  h1: {
    margin: "10px 0 0",
    fontSize: 28,
    lineHeight: 1.04,
    letterSpacing: "-0.7px",
    fontWeight: 950,
  },
  sub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.55,
    opacity: 0.78,
    maxWidth: 720,
  },
  heroBtns: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  heroMeta: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
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
  pillOkSoft: {
    border: "1px solid rgba(34,197,94,0.25)",
    background: "rgba(34,197,94,0.10)",
  },
  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  sectionTitle: {
    fontWeight: 950,
    fontSize: 18,
    lineHeight: 1.15,
    letterSpacing: "-0.02em",
  },
  smallNote: {
    fontSize: 12,
    opacity: 0.76,
    maxWidth: 760,
    lineHeight: 1.5,
  },
  valueGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
  },
  valueCard: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 12px",
  },
  valueDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    marginTop: 7,
    flexShrink: 0,
  },
  valueText: {
    fontSize: 12,
    lineHeight: 1.5,
    opacity: 0.88,
  },
  innerCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  toggleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 10px",
  },
  toggleTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  toggleSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.72,
    lineHeight: 1.4,
    maxWidth: 640,
  },
  toggleBtn: {
    position: "relative",
    width: 56,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    flexShrink: 0,
  },
  toggleOn: {
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.14)",
  },
  toggleOff: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
  },
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
  knobOn: {
    left: 28,
    border: "1px solid rgba(34,197,94,0.35)",
  },
  knobOff: {
    left: 4,
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.08)",
  },
  note: {
    fontSize: 12,
    opacity: 0.78,
    fontWeight: 650,
    lineHeight: 1.45,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
  },
  reasonItem: {
    display: "grid",
    gap: 4,
  },
  reasonTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  reasonCopy: {
    fontSize: 12,
    opacity: 0.74,
    lineHeight: 1.45,
  },
  loadingCard: {
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
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: {
    fontWeight: 900,
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.75,
    marginTop: 2,
  },
};