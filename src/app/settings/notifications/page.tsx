// src/app/settings/notifications/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
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
type PushUiStatus = "checking" | "unsupported" | "default" | "denied" | "granted" | "subscribed" | "error";

type PushState = {
  status: PushUiStatus;
  label: string;
  detail: string;
};
type PushSubscribeResponse = {
  ok?: boolean;
  error?: string;
};
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

function buildPushState(status: PushUiStatus): PushState {
  switch (status) {
    case "subscribed":
      return {
        status,
        label: "Push activo ✅",
        detail: "Este navegador ya puede recibir alertas importantes de SyncPlans.",
      };
    case "granted":
      return {
        status,
        label: "Permiso concedido",
        detail: "Falta completar la suscripción push para este navegador.",
      };
    case "denied":
      return {
        status,
        label: "Bloqueado por navegador",
        detail: "Actívalo desde la configuración del navegador si quieres recibir alertas.",
      };
    case "unsupported":
      return {
        status,
        label: "No disponible",
        detail: "Este navegador o contexto no soporta Web Push.",
      };
    case "error":
      return {
        status,
        label: "Revisar configuración",
        detail: "No se pudo preparar la suscripción. Revisa la key pública VAPID y el service worker.",
      };
    case "checking":
      return {
        status,
        label: "Revisando…",
        detail: "Verificando permisos y suscripción actual.",
      };
    default:
      return {
        status,
        label: "Pendiente",
        detail: "Activa push para recibir avisos importantes, como el momento de salir hacia un evento.",
      };
  }
}

export default function NotificationsSettingsPage() {
  const router = useRouter();

  const [appSettings, setAppSettings] = useState<AppNotificationSettings | null>(null);
  const [userNotif, setUserNotif] = useState<UserNotificationSettings | null>(null);

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [pushStatus, setPushStatus] = useState<PushUiStatus>("checking");
  const [pushWorking, setPushWorking] = useState(false);

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const refreshPushStatus = useCallback(async () => {
    if (!isPushSupported()) {
      setPushStatus("unsupported");
      return;
    }

    try {
      const permission = Notification.permission;
      if (permission === "denied") {
        setPushStatus("denied");
        return;
      }

      const existing = await getExistingPushSubscription();
      if (existing) {
        setPushStatus("subscribed");
        return;
      }

      setPushStatus(permission === "granted" ? "granted" : "default");
    } catch (error) {
      console.error("[NotificationsSettings] push status error", error);
      setPushStatus("error");
    }
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const [s, u] = await Promise.all([getSettingsFromDb(), getMyNotificationSettings()]);

        if (!alive) return;
        setAppSettings(s);
        setUserNotif(u);
      } catch (error) {
        console.error("[NotificationsSettings] load error", error);
        showToast("No se pudieron cargar tus ajustes", "Refresca la página o intenta de nuevo en unos segundos.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    void refreshPushStatus();

    return () => {
      alive = false;
    };
  }, [refreshPushStatus, showToast]);

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

  const pushState = useMemo(() => buildPushState(pushStatus), [pushStatus]);

  function updateApp<K extends keyof AppNotificationSettings>(key: K, value: AppNotificationSettings[K]) {
    setAppSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateUser<K extends keyof UserNotificationSettings>(key: K, value: UserNotificationSettings[K]) {
    setUserNotif((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleEnablePush() {
    try {
      setPushWorking(true);
      setToast(null);

      if (!isPushSupported()) {
        setPushStatus("unsupported");
        showToast("Push no está disponible", "Prueba en Chrome, Edge o un navegador compatible.");
        return;
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
      if (!vapidPublicKey) {
        setPushStatus("error");
        showToast("Falta configurar Web Push", "Agrega NEXT_PUBLIC_VAPID_PUBLIC_KEY y vuelve a desplegar.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus(permission === "denied" ? "denied" : "default");
        showToast("Permiso no activado", "No te molestaré con push hasta que lo actives desde el navegador.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
  urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

   const json = (await res.json().catch(() => ({}))) as PushSubscribeResponse;
if (!res.ok || !json.ok) {
  throw new Error(json.error || "No se pudo guardar la suscripción push.");
}

      setPushStatus("subscribed");
      showToast("Push activado ✅", "Ya puedes recibir alertas importantes de SyncPlans en este navegador.");
    } catch (error) {
      console.error("[NotificationsSettings] enable push error", error);
      setPushStatus("error");
      showToast("No se pudo activar push", error instanceof Error ? error.message : "Inténtalo de nuevo en unos segundos.");
    } finally {
      setPushWorking(false);
    }
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

      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 900);
      showToast("Ajustes guardados ✅", "Tus notificaciones se actualizaron correctamente.");
    } catch (error) {
      console.error("[NotificationsSettings] save error", error);
      showToast("No se pudieron guardar los cambios", "Inténtalo de nuevo en unos segundos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={styles.page}>
      {toast ? (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <MobileScaffold
        maxWidth={980}
        paddingDesktop="22px 18px 48px"
        paddingMobile="18px 14px 64px"
        mobileBottomSafe={96}
      >
        <div style={styles.shell}>
          <div style={styles.topRow}>
            <PremiumHeader />
            <div style={styles.topActions}>
              <LogoutButton />
            </div>
          </div>

          <section style={styles.hero}>
            <div style={{ minWidth: 0, flex: "1 1 420px" }}>
              <div style={styles.kicker}>Settings</div>
              <h1 style={styles.h1}>Notificaciones</h1>
              <div style={styles.sub}>
                Resúmenes, recordatorios, push y alertas que te ayudan a llegar antes a lo importante.
              </div>

              <div style={styles.heroMeta}>
                {statusLabel ? <span style={styles.pillSoft}>{statusLabel}</span> : null}
                <span style={{ ...styles.pillSoft, ...(savedPulse ? styles.pillOkSoft : null) }}>
                  {saving ? "Guardando…" : savedPulse ? "Guardado ✓" : "Listo para guardar"}
                </span>
                <span style={{ ...styles.pillSoft, ...(pushStatus === "subscribed" ? styles.pillOkSoft : null) }}>
                  {pushState.label}
                </span>
              </div>
            </div>

            <div style={styles.heroBtns}>
              <button onClick={() => router.push("/settings")} style={styles.ghostBtn}>Volver a settings →</button>
              <button onClick={() => router.push("/summary")} style={styles.ghostBtn}>Ir al resumen →</button>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Push del navegador</div>
            <div style={styles.smallNote}>
              Esta es la base para avisos reales como “ya es momento de salir” según tráfico, distancia y hora del evento.
            </div>

            <div style={styles.innerCard}>
              <div style={styles.pushRow}>
                <div style={{ minWidth: 0 }}>
                  <div style={styles.toggleTitle}>{pushState.label}</div>
                  <div style={styles.toggleSub}>{pushState.detail}</div>
                </div>
                <button
                  onClick={() => void handleEnablePush()}
                  disabled={pushWorking || pushStatus === "unsupported" || pushStatus === "denied"}
                  style={{
                    ...styles.primaryBtn,
                    opacity: pushWorking || pushStatus === "unsupported" || pushStatus === "denied" ? 0.65 : 1,
                    cursor: pushWorking ? "progress" : pushStatus === "unsupported" || pushStatus === "denied" ? "not-allowed" : "pointer",
                  }}
                >
                  {pushWorking ? "Activando…" : pushStatus === "subscribed" ? "Revalidar push" : "Activar push"}
                </button>
              </div>

              <div style={styles.note}>
                <b>Importante:</b> el permiso depende del navegador y del dispositivo. En iPhone, la app debe estar instalada como PWA para recibir push web.
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Qué debería hacer esta capa</div>
            <div style={styles.smallNote}>
              Una buena notificación no compite por atención. Te hace entrar a tiempo a lo que importa y evita perseguir contexto manualmente.
            </div>

            <div style={styles.valueGrid}>
              <ValueCard copy="Los resúmenes te ayudan a empezar el día o la semana con una lectura más limpia." />
              <ValueCard copy="Los recordatorios sirven cuando reducen olvido y fricción, no cuando solo generan ruido." />
              <ValueCard copy="Las alertas de conflicto te llevan a decidir antes del problema, no después." />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Resúmenes y recordatorios</div>
            <div style={styles.smallNote}>Esta parte define qué contexto quieres recibir de forma recurrente.</div>

            <div style={styles.innerCard}>
              <ToggleRow
                title="Resumen diario por email"
                subtitle="Cada mañana: eventos de hoy, personales y compartidos, para empezar con claridad."
                value={!!appSettings?.dailySummary}
                onChange={(v) => updateApp("dailySummary", v)}
              />
              <Divider />
              <ToggleRow
                title="Resumen semanal"
                subtitle="Una vista general compacta de tu semana para entender lo que viene sin abrir varias pantallas."
                value={!!appSettings?.weeklySummary}
                onChange={(v) => updateApp("weeklySummary", v)}
              />
              <Divider />
              <ToggleRow
                title="Recordatorios de eventos"
                subtitle="Avisos para eventos cercanos, cuando sí te ayudan a llegar antes y mejor."
                value={!!appSettings?.eventReminders}
                onChange={(v) => updateApp("eventReminders", v)}
              />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Conflictos</div>
            <div style={styles.smallNote}>Aquí decides si SyncPlans debe avisarte cuando detecte choques relevantes.</div>

            <div style={styles.innerCard}>
              <ToggleRow
                title="Alertas de conflictos"
                subtitle="Te avisa cuando un evento nuevo choque con algo existente y convenga revisar la decisión."
                value={!!appSettings?.conflictAlerts}
                onChange={(v) => updateApp("conflictAlerts", v)}
              />
              <div style={styles.note}>
                <b>Tip:</b> esto funciona mejor cuando ya estás usando el flujo de conflictos como parte real de tu coordinación.
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Notificaciones por tipo</div>
            <div style={styles.smallNote}>Elige de qué contextos quieres recibir avisos dentro de la app.</div>

            <div style={styles.innerCard}>
              <ToggleRow
                title="Personal"
                subtitle="Actividad y cambios en tu espacio individual."
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
                subtitle="Actividad y movimiento en grupos familiares."
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
                  Solo usamos estos ajustes para avisarte sobre tu coordinación. No se comparten con nadie.
                </div>
              </div>

              <button
                onClick={() => void handleSave()}
                style={{ ...styles.primaryBtn, opacity: saving || booting ? 0.7 : 1, cursor: saving || booting ? "progress" : "pointer" }}
                disabled={saving || booting}
              >
                {saving ? "Guardando…" : "Guardar preferencias"}
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
      </MobileScaffold>
    </main>
  );
}

function ValueCard({ copy }: { copy: string }) {
  return (
    <div style={styles.valueCard}>
      <span style={styles.valueDot} />
      <span style={styles.valueText}>{copy}</span>
    </div>
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
        style={{ ...styles.toggleBtn, ...(value ? styles.toggleOn : styles.toggleOff) }}
        aria-label={title}
        aria-pressed={value}
      >
        <span style={{ ...styles.toggleKnob, ...(value ? styles.knobOn : styles.knobOff) }} />
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
  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 80, pointerEvents: "none" },
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
  shell: { display: "grid", gap: 14 },
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
  hero: {
    padding: "18px 16px",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(124,58,237,0.06) 55%, rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
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
    width: "fit-content",
  },
  h1: { margin: "10px 0 0", fontSize: 28, lineHeight: 1.04, letterSpacing: "-0.7px", fontWeight: 950 },
  sub: { marginTop: 8, fontSize: 13, lineHeight: 1.55, opacity: 0.78, maxWidth: 720 },
  heroBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroMeta: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },
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
    minHeight: 44,
    padding: "0 14px",
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
  sectionTitle: { fontWeight: 950, fontSize: 18, lineHeight: 1.15, letterSpacing: "-0.02em" },
  smallNote: { fontSize: 12, opacity: 0.76, maxWidth: 760, lineHeight: 1.5 },
  valueGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 },
  valueCard: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 12px",
  },
  valueDot: { width: 8, height: 8, borderRadius: 999, background: "rgba(56,189,248,0.95)", marginTop: 7, flexShrink: 0 },
  valueText: { fontSize: 12, lineHeight: 1.5, opacity: 0.88 },
  innerCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
    display: "grid",
    gap: 10,
  },
  pushRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" },
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
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 10px" },
  toggleTitle: { fontSize: 13, fontWeight: 900 },
  toggleSub: { marginTop: 4, fontSize: 12, opacity: 0.72, lineHeight: 1.4, maxWidth: 640 },
  toggleBtn: {
    position: "relative",
    width: 56,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    flexShrink: 0,
    cursor: "pointer",
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
  footerRow: { display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-end", flexWrap: "wrap" },
  footerLeft: { minWidth: 0, flex: "1 1 320px", display: "grid", gap: 4 },
  footerTitle: { fontSize: 13, fontWeight: 900 },
  footerText: { fontSize: 12, opacity: 0.74, lineHeight: 1.45 },
  primaryBtn: {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.18)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontWeight: 900,
  },
  divider: { height: 1, background: "rgba(255,255,255,0.08)" },
  loadingCard: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: { width: 12, height: 12, borderRadius: 999, background: "rgba(56,189,248,0.95)", boxShadow: "0 0 24px rgba(56,189,248,0.55)" },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};