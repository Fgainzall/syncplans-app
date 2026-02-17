// src/app/settings/notifications/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  getSettingsFromDb,
  saveSettingsToDb,
  type NotificationSettings as AppNotificationSettings,
} from "@/lib/settings";

import {
  getMyNotificationSettings,
  updateMyNotificationSettings,
  type NotificationSettings as UserNotificationSettings,
} from "@/lib/userNotificationSettings";

type UiToast = { title: string; subtitle?: string } | null;

export default function NotificationsSettingsPage() {
  const router = useRouter();

  const [appSettings, setAppSettings] = useState<AppNotificationSettings | null>(null);
  const [userNotif, setUserNotif] = useState<UserNotificationSettings | null>(null);

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const [s, u] = await Promise.all([getSettingsFromDb(), getMyNotificationSettings()]);
        if (!alive) return;
        setAppSettings(s);
        setUserNotif(u);
      } catch (err) {
        console.error("[NotificationsSettings] load error", err);
        showToast("No se pudieron cargar tus ajustes", "Refresca la página o intenta de nuevo en unos segundos.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (!appSettings || !userNotif) return null;
    const onCount =
      Number(appSettings.dailySummary) +
      Number(appSettings.weeklySummary) +
      Number(appSettings.eventReminders) +
      Number(appSettings.conflictAlerts) +
      Number(userNotif.notify_personal) +
      Number(userNotif.notify_pair) +
      Number(userNotif.notify_family) +
      Number(userNotif.notify_conflicts);
    return `${onCount} activas`;
  }, [appSettings, userNotif]);

  function updateApp<K extends keyof AppNotificationSettings>(key: K, value: AppNotificationSettings[K]) {
    setAppSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateUser<K extends keyof UserNotificationSettings>(key: K, value: UserNotificationSettings[K]) {
    setUserNotif((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!appSettings || !userNotif) return;

    try {
      setSaving(true);
      setToast(null);

      await Promise.all([
        saveSettingsToDb(appSettings),
        updateMyNotificationSettings({
          notify_conflicts: userNotif.notify_conflicts,
          notify_personal: userNotif.notify_personal,
          notify_pair: userNotif.notify_pair,
          notify_family: userNotif.notify_family,
        }),
      ]);

      showToast("Ajustes guardados ✅", "Tus notificaciones se actualizaron correctamente.");
    } catch (err) {
      console.error("[NotificationsSettings] save error", err);
      showToast("No se pudieron guardar los cambios", "Inténtalo de nuevo en unos segundos.");
    } finally {
      setSaving(false);
    }
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
          <div>
            <div style={styles.kicker}>Settings</div>
            <h1 style={styles.h1}>Notificaciones</h1>
            <div style={styles.sub}>Resúmenes, recordatorios y qué avisos quieres recibir.</div>

            {statusLabel ? (
              <div style={styles.heroMeta}>
                <span style={styles.pillSoft}>{statusLabel}</span>
              </div>
            ) : null}
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
          <div style={styles.sectionTitle}>Resúmenes por email</div>
          <div style={styles.smallNote}>Controla el valor diario/semanal y recordatorios automáticos.</div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Resumen diario por email"
              subtitle="Cada mañana: eventos de hoy (personales + compartidos) para empezar con claridad."
              value={!!appSettings?.dailySummary}
              onChange={(v) => updateApp("dailySummary", v)}
            />
            <Divider />
            <ToggleRow
              title="Resumen semanal"
              subtitle="Un correo con una vista general compacta de tu semana."
              value={!!appSettings?.weeklySummary}
              onChange={(v) => updateApp("weeklySummary", v)}
            />
            <Divider />
            <ToggleRow
              title="Recordatorios de eventos"
              subtitle="Avisos para eventos cercanos en el tiempo."
              value={!!appSettings?.eventReminders}
              onChange={(v) => updateApp("eventReminders", v)}
            />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Conflictos</div>
          <div style={styles.smallNote}>Te avisamos cuando un evento nuevo choque con algo existente.</div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Alertas de conflictos"
              subtitle="Mostrar aviso cuando SyncPlans detecte choques importantes."
              value={!!appSettings?.conflictAlerts}
              onChange={(v) => updateApp("conflictAlerts", v)}
            />
            <div style={styles.note}>
              <b>Tip:</b> Esto se complementa con “Preferencias de conflictos” (defaults y reglas).
            </div>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Notificaciones por tipo</div>
          <div style={styles.smallNote}>Elige de qué espacios quieres recibir avisos dentro de la app.</div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Personal"
              subtitle="Actividad y cambios en tu espacio personal."
              value={!!userNotif?.notify_personal}
              onChange={(v) => updateUser("notify_personal", v)}
            />
            <Divider />
            <ToggleRow
              title="Pareja"
              subtitle="Eventos, cambios y actividad en grupos de pareja."
              value={!!userNotif?.notify_pair}
              onChange={(v) => updateUser("notify_pair", v)}
            />
            <Divider />
            <ToggleRow
              title="Familia"
              subtitle="Actividad en grupos familiares."
              value={!!userNotif?.notify_family}
              onChange={(v) => updateUser("notify_family", v)}
            />
            <Divider />
            <ToggleRow
              title="Conflictos"
              subtitle="Avisos específicos cuando se detecten choques importantes."
              value={!!userNotif?.notify_conflicts}
              onChange={(v) => updateUser("notify_conflicts", v)}
            />
          </div>

          <div style={styles.footerRow}>
            <div style={styles.footerLeft}>
              <div style={styles.footerTitle}>Privacidad</div>
              <div style={styles.footerText}>
                Solo usamos estos ajustes para avisarte sobre tu calendario. No compartimos esta información con nadie.
              </div>
            </div>

            <button
              onClick={handleSave}
              style={{
                ...styles.primaryBtn,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "progress" : "pointer",
              }}
              disabled={saving || booting}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>

        {booting ? (
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Notificaciones</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Divider() {
  return <div style={styles.divider} />;
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
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
        style={{
          ...styles.toggleBtn,
          ...(value ? styles.toggleOn : styles.toggleOff),
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
    cursor: "pointer",
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

  divider: { height: 1, background: "rgba(255,255,255,0.08)" },

  footerRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  footerLeft: { maxWidth: 680 },
  footerTitle: { fontWeight: 900 as any, fontSize: 12 },
  footerText: { marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.35 },

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900 as any,
  },
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