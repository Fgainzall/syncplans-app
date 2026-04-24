// src/app/settings/SettingsClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getUser } from "@/lib/auth";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { hasPremiumAccess } from "@/lib/premium";
import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";
import supabase from "@/lib/supabaseClient";
import { trackEvent, trackScreenView } from "@/lib/analytics";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

type UiToast = { title: string; subtitle?: string } | null;

type GoogleStatus = {
  ok: boolean;
  connected: boolean;
  connection_state?: "connected" | "needs_reauth" | "disconnected";
  account: null | {
    provider: string;
    email: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  error?: string;
};

type TodayEventPreview = {
  id: string;
  title: string;
  time: string;
  groupLabel: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function startOfDay(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function prettyDateLabelFromISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);

  const dias = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatEventTime(value: string | null | undefined): string {
  if (!value) return "Sin hora";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "Sin hora";
  return dt.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelForGroup(row: DbEventRow): string {
  return row.group_id ? "Grupo" : "Personal";
}

async function getAccessTokenOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function buildTodayPreview(rows: DbEventRow[]): TodayEventPreview[] {
  const iso = todayISO();
  const start = startOfDay(iso).getTime();
  const end = start + 24 * 60 * 60 * 1000;

  return rows
    .filter((row) => {
      const rawStart = (row as any).start ?? (row as any).start_at;
      if (!rawStart) return false;
      const ms = new Date(rawStart).getTime();
      return Number.isFinite(ms) && ms >= start && ms < end;
    })
    .sort((a, b) => {
      const aStart = new Date(((a as any).start ?? (a as any).start_at) || 0).getTime();
      const bStart = new Date(((b as any).start ?? (b as any).start_at) || 0).getTime();
      return aStart - bStart;
    })
    .slice(0, 3)
    .map((row) => {
      const rawStart = ((row as any).start ?? (row as any).start_at) as string | undefined;
      return {
        id: String(row.id),
        title: String((row as any).title || "Evento"),
        time: formatEventTime(rawStart),
        groupLabel: labelForGroup(row),
      };
    });
}

export default function SettingsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<UiToast>(null);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [todayPreview, setTodayPreview] = useState<TodayEventPreview[]>([]);

  const [digestSending, setDigestSending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const notifScore = useMemo(() => {
    if (!settings) return null;
    const toggles = [
      settings.eventReminders,
      settings.dailySummary,
      settings.conflictAlerts,
      settings.partnerUpdates,
      settings.familyUpdates,
      settings.weeklySummary,
    ];
    const on = toggles.filter(Boolean).length;
    return { on, total: toggles.length, quiet: settings.quietHoursEnabled };
  }, [settings]);

  const googleConnected = !!google?.connected;
  const googleEmail = google?.account?.email ?? null;
  const googleState =
    google?.connection_state ?? (googleConnected ? "connected" : "disconnected");

  const googlePillLabel =
    googleState === "connected"
      ? "Conectado ✅"
      : googleState === "needs_reauth"
        ? "Requiere reconexión"
        : "No conectado";

  const googleActionLabel =
    googleState === "needs_reauth"
      ? "Reconectar"
      : googleState === "connected"
        ? "Gestionar"
        : "Conectar";

  const canUseGooglePremium = hasPremiumAccess(profile);

  const refreshGoogleStatus = useCallback(async () => {
    try {
      setGoogleLoading(true);

      const token = await getAccessTokenOrNull();
      if (!token) {
        setGoogle({
          ok: false,
          connected: false,
          account: null,
          error: "Sesión no encontrada. Vuelve a iniciar sesión.",
        });
        return;
      }

      const res = await fetch("/api/google/status", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      const json = (await res.json().catch(() => ({}))) as GoogleStatus;

      if (!res.ok || !json.ok) {
        setGoogle({
          ok: false,
          connected: false,
          account: null,
          error: json?.error || "No se pudo consultar el estado de Google.",
        });
        return;
      }

      setGoogle(json);
    } catch (error) {
      console.error("[Settings] google status error", error);
      setGoogle({
        ok: false,
        connected: false,
        account: null,
        error: "Error consultando el estado de Google.",
      });
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const refreshGoogleStatusWithRetry = useCallback(async () => {
    for (let i = 0; i < 6; i += 1) {
      const token = await getAccessTokenOrNull();
      if (token) break;
      await sleep(300);
    }
    await refreshGoogleStatus();
  }, [refreshGoogleStatus]);

  const loadTodayPreview = useCallback(async () => {
    try {
      const [events] = await Promise.all([
        getMyEvents().catch(() => [] as DbEventRow[]),
        getActiveGroupIdFromDb().catch(() => null),
      ]);
      setTodayPreview(buildTodayPreview(events));
    } catch (error) {
      console.warn("[Settings] today preview skipped", error);
    }
  }, []);

  const handleGoogleConnect = useCallback(() => {
    void trackEvent({
      event: "google_connect_started",
      metadata: {
        screen: "settings",
        source: "settings_google_card",
        connection_state: googleState,
      },
    });
    window.location.href = "/api/google/connect";
  }, [googleState]);

  const handleGoogleSyncNow = useCallback(async () => {
    try {
      setGoogleSyncing(true);
      showToast("Sincronizando…", "Importando eventos desde Google Calendar.");

      const token = await getAccessTokenOrNull();
      const res = await fetch("/api/google/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json.ok) {
        showToast(
          "No se pudo importar desde Google",
          json?.error || "Intenta de nuevo. Si persiste, reconecta Google."
        );
        return;
      }

      const imported = Number(json?.imported ?? 0);
      window.dispatchEvent(new CustomEvent("sp:google-synced", { detail: { imported } }));
      showToast("Importación lista ✅", `Importados/actualizados: ${imported}`);
      await Promise.all([refreshGoogleStatusWithRetry(), loadTodayPreview()]);
    } catch (error) {
      console.error("[Settings] google sync exception", error);
      showToast("No se pudo importar desde Google", "Intenta de nuevo en unos segundos.");
    } finally {
      setGoogleSyncing(false);
    }
  }, [loadTodayPreview, refreshGoogleStatusWithRetry, showToast]);

  const handleSendTodayDigestFromSettings = useCallback(async () => {
    try {
      setDigestSending(true);

      const token = await getAccessTokenOrNull();
      if (!token) {
        showToast("No encontramos tu sesión", "Vuelve a iniciar sesión e inténtalo otra vez.");
        return;
      }

      const res = await fetch("/api/daily-digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ date: todayISO(), source: "settings_manual" }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json.ok) {
        if (json?.reason === "no_email") {
          showToast("No encontramos tu correo", "Revisa tu sesión o vuelve a entrar a la app.");
          return;
        }
        throw new Error(json?.message || json?.error || "Error enviando el correo");
      }

      if (json?.reason === "no_events") {
        showToast("Hoy no tienes eventos 🙌", "Cuando tengas algo agendado, te mando el resumen.");
        return;
      }

      showToast("Te envié un resumen de hoy ✉️", "Si no lo ves, revisa Promociones o Spam.");
    } catch (error) {
      console.error("[Settings] daily digest error", error);
      showToast("No se pudo enviar el resumen", "Inténtalo de nuevo en unos segundos.");
    } finally {
      setDigestSending(false);
    }
  }, [showToast]);

  useEffect(() => {
    void trackScreenView({ screen: "settings", metadata: { area: "settings" } });
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const user = getUser();
        if (!user) {
          router.push("/auth/login?next=/settings");
          return;
        }

        const [dbSettings, dbProfile] = await Promise.all([
          getSettingsFromDb().catch(() => null),
          getMyProfile().catch(() => null),
        ]);

        if (!alive) return;
        if (dbSettings) setSettings(dbSettings);
        setProfile(dbProfile);

        await Promise.all([refreshGoogleStatusWithRetry(), loadTodayPreview()]);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [loadTodayPreview, refreshGoogleStatusWithRetry, router]);

  useEffect(() => {
    const googleParam = searchParams.get("google");
    if (googleParam !== "connected") return;

    showToast("Google conectado ✅", "Actualizando tu estado…");
    void (async () => {
      await refreshGoogleStatusWithRetry();
      router.replace("/settings");
    })();
  }, [refreshGoogleStatusWithRetry, router, searchParams, showToast]);

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
          <PremiumHeader />

          <section style={styles.hero}>
            <div style={{ minWidth: 0, flex: "1 1 420px" }}>
              <div style={styles.kicker}>Ajustes</div>
              <h1 style={styles.h1}>Centro de control</h1>
              <div style={styles.sub}>
                Configura notificaciones, permisos por grupo e integraciones sin ruido extra.
              </div>

              <div style={styles.heroMeta}>
                {notifScore ? (
                  <>
                    <span style={styles.pillSoft}>{notifScore.on}/{notifScore.total} activas</span>
                    <span style={styles.pillSoft}>{notifScore.quiet ? "Silencioso ON" : "Silencioso OFF"}</span>
                  </>
                ) : (
                  <span style={styles.pillSoft}>Cargando preferencias…</span>
                )}
                <span style={styles.pillSoft}>{prettyDateLabelFromISO(todayISO())}</span>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitle}>Ajustes de tu experiencia</div>
            <div style={styles.smallNote}>Configura cómo se comporta SyncPlans para ti.</div>

            <div style={styles.list}>
              <Row
                dot="rgba(56,189,248,0.95)"
                title="Notificaciones"
                desc="Recordatorios, push, resúmenes y modo silencioso."
                cta="Abrir"
                onClick={() => router.push("/settings/notifications")}
              />
              <Row
                dot="rgba(251,191,36,0.95)"
                title="Permisos por grupo"
                desc="Personal, Pareja y Familia: cómo se comporta tu experiencia."
                cta="Configurar"
                onClick={() => router.push("/settings/groups")}
              />
              <Row
                dot="rgba(244,63,94,0.95)"
                title="Preferencias de conflictos"
                desc="Avisos, defaults y reglas de coordinación."
                cta="Ajustar"
                onClick={() => router.push("/settings/conflicts")}
              />
              <Row
                dot="rgba(34,197,94,0.95)"
                title="Resumen semanal"
                desc="Controla el resumen que te devuelve claridad antes de empezar la semana."
                cta="Ver"
                onClick={() => router.push("/settings/weekly")}
              />
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div>
                <div style={styles.sectionTitle}>Integraciones de calendario</div>
                <div style={styles.smallNote}>
                  Importa eventos <b>read-only</b> como externos. Entran al contexto de conflictos sin romper tu calendario.
                </div>
              </div>

              <button
                onClick={() => void refreshGoogleStatusWithRetry()}
                style={{
                  ...styles.secondaryBtn,
                  opacity: googleLoading || googleSyncing ? 0.7 : 1,
                  cursor: googleLoading || googleSyncing ? "progress" : "pointer",
                }}
                disabled={googleLoading || googleSyncing}
                title="Revisar estado de conexión"
              >
                {googleLoading ? "Actualizando…" : "Actualizar estado"}
              </button>
            </div>

            {!canUseGooglePremium ? (
              <PremiumSettingsGate
                title="Mirar tu agenda externa ayuda. Decidir con ese contexto, sin salir de SyncPlans, es donde Premium empieza a valer."
                copy="Premium trae tu contexto externo al mismo sistema donde decides, respondes y resuelves choques. No es ver otro calendario: es tener más claridad, menos fricción y más control."
                cta="Ver por qué importa"
                onClick={() => {
                  void trackEvent({
                    event: "premium_cta_clicked",
                    metadata: { screen: "settings", source: "premium_settings_card", target: "/planes" },
                  });
                  router.push("/planes");
                }}
              />
            ) : (
              <div style={styles.innerCard}>
                <div style={styles.innerTop}>
                  <div style={styles.innerLeft}>
                    <div style={styles.innerTitleRow}>
                      <div style={styles.appIcon}>G</div>
                      <div>
                        <div style={styles.innerTitle}>Google Calendar</div>
                        <div style={styles.innerSub}>
                          {googleConnected
                            ? `Cuenta: ${googleEmail || "—"} · Importación read-only`
                            : "Conecta tu Google para importar eventos como externos."}
                        </div>
                      </div>
                    </div>

                    {!googleConnected && google?.error ? <div style={styles.errorBox}>{google.error}</div> : null}
                  </div>

                  <div style={styles.actionsWrap}>
                    <span
                      style={{
                        ...styles.pill,
                        ...(googleState === "connected"
                          ? styles.pillOk
                          : googleState === "needs_reauth"
                            ? styles.pillWarn
                            : styles.pillMuted),
                      }}
                    >
                      {googlePillLabel}
                    </span>

                    <button onClick={handleGoogleConnect} style={styles.primaryBtn}>
                      {googleActionLabel}
                    </button>

                    <button
                      onClick={() => void handleGoogleSyncNow()}
                      style={{
                        ...styles.secondaryBtn,
                        opacity: !googleConnected || googleSyncing ? 0.55 : 1,
                        cursor: !googleConnected ? "not-allowed" : googleSyncing ? "progress" : "pointer",
                      }}
                      disabled={!googleConnected || googleSyncing}
                      title={!googleConnected ? "Conecta Google para importar." : "Importar eventos desde Google"}
                    >
                      {googleSyncing ? "Importando…" : "Importar ahora"}
                    </button>
                  </div>
                </div>

                <div style={styles.note}><b>Tip:</b> Sync trae 30 días atrás y 120 días adelante.</div>

                {googleConnected ? (
                  <div style={styles.googleValueStrip}>
                    Ya añadiste contexto externo. El salto premium es usar esa información para anticipar choques, decidir antes y mantener una sola verdad compartida.
                  </div>
                ) : null}
              </div>
            )}

            <div style={{ ...styles.innerCard, opacity: 0.9 }}>
              <div style={styles.innerTop}>
                <div style={styles.innerTitleRow}>
                  <div style={{ ...styles.appIcon, border: "1px solid rgba(148,163,184,0.35)", background: "rgba(148,163,184,0.10)" }}>O</div>
                  <div>
                    <div style={styles.innerTitle}>Outlook / Microsoft 365</div>
                    <div style={styles.innerSub}>Próximamente. Lo activamos después de cerrar Google.</div>
                  </div>
                </div>
                <span style={{ ...styles.pill, ...styles.pillSoftMuted }}>Próximamente</span>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <div style={styles.sectionTitleRow}>
              <div>
                <div style={styles.sectionTitle}>Enviarme el resumen de hoy</div>
                <div style={styles.smallNote}>Te mando a tu correo los eventos de hoy, personales y del grupo activo.</div>
              </div>

              <button
                onClick={() => void handleSendTodayDigestFromSettings()}
                style={{ ...styles.primaryBtn, opacity: digestSending ? 0.7 : 1, cursor: digestSending ? "progress" : "pointer" }}
                disabled={digestSending}
                title="Enviar resumen de hoy"
              >
                {digestSending ? "Enviando…" : "Probar resumen de hoy"}
              </button>
            </div>

            {todayPreview.length > 0 ? (
              <div style={styles.todayList}>
                {todayPreview.map((event) => (
                  <div key={event.id} style={styles.todayRow}>
                    <div style={styles.todayTime}>{event.time}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={styles.todayTitle}>{event.title}</div>
                      <div style={styles.todayMeta}>{event.groupLabel}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={styles.note}><b>Pro tip:</b> Este correo deja claro por qué SyncPlans vale: te devuelve claridad operativa aunque no abras la grilla del calendario.</div>
            )}
          </section>

          {booting ? (
            <div style={styles.loadingCard}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando ajustes…</div>
                <div style={styles.loadingSub}>Preferencias + conectores</div>
              </div>
            </div>
          ) : null}
        </div>
      </MobileScaffold>
    </main>
  );
}

function PremiumSettingsGate({
  title,
  copy,
  cta = "Ver valor Premium",
  onClick,
}: {
  title: string;
  copy: string;
  cta?: string;
  onClick: () => void;
}) {
  return (
    <div style={styles.gateCard}>
      <div style={styles.gateBadge}>Premium</div>
      <div style={styles.gateTitle}>{title}</div>
      <div style={styles.gateCopy}>{copy}</div>
      <button onClick={onClick} style={styles.primaryBtn}>{cta}</button>
    </div>
  );
}

function Row({
  dot,
  title,
  desc,
  cta,
  onClick,
}: {
  dot: string;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={styles.rowBtn}>
      <div style={styles.rowLeft}>
        <div style={styles.rowTitleLine}>
          <span style={{ ...styles.dot, background: dot }} />
          <div style={styles.rowTitle}>{title}</div>
        </div>
        <div style={styles.rowDesc}>{desc}</div>
      </div>
      <div style={styles.rowCta}>{cta}</div>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { display: "flex", flexDirection: "column", gap: 12 },
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
  hero: {
    padding: "16px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
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
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "grid",
    gap: 12,
  },
  sectionTitleRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  sectionTitle: { fontWeight: 950, fontSize: 18, lineHeight: 1.15, letterSpacing: "-0.02em" },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72, maxWidth: 760, lineHeight: 1.5 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  rowBtn: {
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  rowTitleLine: { display: "flex", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 999, boxShadow: "0 0 16px rgba(255,255,255,0.10)", flexShrink: 0 },
  rowTitle: { fontSize: 13, fontWeight: 950, letterSpacing: "-0.2px" },
  rowDesc: { fontSize: 12, opacity: 0.75 },
  rowCta: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
  },
  gateCard: {
    borderRadius: 18,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08))",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  gateBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.35)",
    background: "rgba(56,189,248,0.12)",
  },
  gateTitle: { fontSize: 15, fontWeight: 950 },
  gateCopy: { fontSize: 12, opacity: 0.8, lineHeight: 1.5 },
  innerCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 10,
  },
  innerTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  innerLeft: { minWidth: 0, flex: 1 },
  innerTitleRow: { display: "flex", gap: 12, alignItems: "center", minWidth: 0 },
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
    flexShrink: 0,
  },
  innerTitle: { fontSize: 14, fontWeight: 950 },
  innerSub: { marginTop: 4, fontSize: 12, fontWeight: 650, opacity: 0.75, maxWidth: 720 },
  actionsWrap: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  pill: {
    fontSize: 10,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    whiteSpace: "nowrap",
  },
  pillOk: { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" },
  pillWarn: { background: "rgba(245,158,11,0.16)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.38)" },
  pillMuted: { background: "rgba(255,255,255,0.06)" },
  pillSoftMuted: { background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.25)", opacity: 0.9 },
  primaryBtn: {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.18)",
    color: "rgba(255,255,255,0.98)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  },
  secondaryBtn: {
    minHeight: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
  },
  errorBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    border: "1px dashed rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.08)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: 650,
  },
  note: { fontSize: 12, opacity: 0.78, fontWeight: 650, lineHeight: 1.45 },
  googleValueStrip: {
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.08)",
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },
  todayList: { display: "grid", gap: 8 },
  todayRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
  },
  todayTime: { fontSize: 12, fontWeight: 950, opacity: 0.88, width: 54, flexShrink: 0 },
  todayTitle: { fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  todayMeta: { marginTop: 2, fontSize: 11, opacity: 0.65, fontWeight: 700 },
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