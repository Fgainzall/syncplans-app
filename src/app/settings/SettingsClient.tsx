// src/app/settings/SettingsClient.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import { getUser } from "@/lib/auth";
import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

/* Helpers de fecha para el resumen */
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

  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${
    meses[dt.getMonth()]
  } ${dt.getFullYear()}`;
}

function labelForGroup(row: DbEventRow): string {
  if (!row.group_id) return "Personal";
  return "Grupo";
}

type UiToast = { title: string; subtitle?: string } | null;

type GoogleStatus = {
  ok: boolean;
  connected: boolean;
  account: null | {
    provider: string;
    email: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  error?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getAccessTokenOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function SettingsHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [booting, setBooting] = useState(true);
  const [toast, setToast] = useState<UiToast>(null);

  const [s, setS] = useState<NotificationSettings | null>(null);

  // digest manual
  const [digestSending, setDigestSending] = useState(false);

  // google status
  const [googleLoading, setGoogleLoading] = useState(false);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const notifScore = useMemo(() => {
    if (!s) return null;
    const toggles = [
      s.eventReminders,
      s.dailySummary,
      s.conflictAlerts,
      s.partnerUpdates,
      s.familyUpdates,
      s.weeklySummary,
    ];
    const on = toggles.filter(Boolean).length;
    return { on, total: toggles.length, quiet: s.quietHoursEnabled };
  }, [s]);

  const googleConnected = !!google?.connected;
  const googleEmail = google?.account?.email ?? null;

  async function refreshGoogleStatus() {
    try {
      setGoogleLoading(true);

      const token = await getAccessTokenOrNull();
      if (!token) {
        setGoogle({
          ok: false,
          connected: false,
          account: null,
          error: "Sesión no encontrada (token faltante).",
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
          error:
            (json as any)?.error || "No se pudo consultar estado de Google.",
        });
        return;
      }

      setGoogle(json);
    } catch (e: any) {
      console.error("[SettingsHub] google status error", e);
      setGoogle({
        ok: false,
        connected: false,
        account: null,
        error: "Error consultando estado de Google.",
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  // ✅ importante: volver del redirect a veces no tiene token listo al primer render
  async function refreshGoogleStatusWithRetry() {
    // 6 intentos ~ 1.8s total
    for (let i = 0; i < 6; i++) {
      const token = await getAccessTokenOrNull();
      if (token) break;
      await sleep(300);
    }
    await refreshGoogleStatus();
  }

  function handleGoogleConnect() {
    window.location.href = "/api/google/connect";
  }

  // ✅ /api/google/sync necesita Authorization (mismo patrón que status)
  async function handleGoogleSyncNow() {
    try {
      setGoogleSyncing(true);
      showToast("Sincronizando…", "Importando desde Google Calendar");

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
      showToast("Importación lista ✅", `Importados/actualizados: ${imported}`);

      refreshGoogleStatusWithRetry().catch(() => {});
    } catch (e: any) {
      console.error("[SettingsHub] google sync exception", e);
      showToast(
        "No se pudo importar desde Google",
        "Intenta de nuevo en unos segundos."
      );
    } finally {
      setGoogleSyncing(false);
    }
  }

  async function handleSendTodayDigestFromSettings() {
    try {
      setDigestSending(true);

      const u = getUser();
      const email =
        (u as any)?.email ||
        (u as any)?.user_metadata?.email ||
        (u as any)?.user_metadata?.preferred_email;

      if (!email) {
        showToast("No encontramos tu correo", "Revisa tu sesión o tu perfil.");
        return;
      }

      // Fecha “hoy” (cliente)
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const todayISO = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(
        2,
        "0"
      )}`;

      const base = startOfDay(todayISO);
      const end = new Date(base);
      end.setDate(end.getDate() + 1);

      const [activeGroupId, rawEvents] = await Promise.all([
        getActiveGroupIdFromDb().catch(() => null),
        getMyEvents().catch(() => [] as DbEventRow[]),
      ]);

      const baseMs = base.getTime();
      const endMs = end.getTime();

      const filteredByDay = (rawEvents ?? []).filter((r: DbEventRow) => {
        const startMs = new Date(r.start).getTime();
        if (Number.isNaN(startMs)) return false;
        return startMs >= baseMs && startMs < endMs;
      });

      // Personales + grupo activo (si hay)
      const filtered = filteredByDay.filter((r) => {
        if (!activeGroupId) return !r.group_id;
        return !r.group_id || String(r.group_id) === String(activeGroupId);
      });

      if (!filtered.length) {
        showToast(
          "Hoy no tienes eventos 🙌",
          "Cuando tengas algo agendado, te mando el resumen."
        );
        return;
      }

      const eventsPayload = filtered.map((e) => ({
        title: e.title ?? "Evento",
        start: e.start,
        end: e.end,
        groupLabel: labelForGroup(e),
      }));

      const dateLabel = prettyDateLabelFromISO(todayISO);

      const res = await fetch("/api/daily-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          date: dateLabel,
          events: eventsPayload,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json.ok) {
        throw new Error(json?.message || "Error enviando el correo");
      }

      showToast(
        "Te envié un resumen de hoy ✉️",
        "Si no lo ves, revisa Promociones o Spam."
      );
    } catch (err: any) {
      console.error("[SettingsHub] daily digest error", err);
      showToast(
        "No se pudo enviar el resumen",
        "Inténtalo de nuevo en unos segundos."
      );
    } finally {
      setDigestSending(false);
    }
  }

  // Boot
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const u = getUser();
        if (!u) {
          router.push("/auth/login?next=/settings");
          return;
        }

        try {
          const db = await getSettingsFromDb();
          if (alive) setS(db);
        } catch {
          // ok
        }

        await refreshGoogleStatusWithRetry();
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ FIX: si vuelves del OAuth con ?google=connected, forzamos refresh + toast + limpiamos URL
  useEffect(() => {
    const g = searchParams.get("google");
    if (g !== "connected") return;

    // Toast inmediato (UX)
    showToast("Google conectado ✅", "Actualizando tu estado…");

    (async () => {
      await refreshGoogleStatusWithRetry();
      router.replace("/settings");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const title = "Settings";

  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
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
            <div style={styles.kicker}>Panel</div>
            <h1 style={styles.h1}>{title}</h1>
            <div style={styles.sub}>
              Notificaciones, permisos por grupo y conexiones de calendario.
            </div>

            {notifScore ? (
              <div style={styles.heroMeta}>
                <span style={styles.pillSoft}>
                  {notifScore.on}/{notifScore.total} activas
                </span>
                <span style={styles.pillSoft}>
                  {notifScore.quiet ? "Silencioso ON" : "Silencioso OFF"}
                </span>
              </div>
            ) : null}
          </div>

          <div style={styles.heroBtns}>
            <button
              onClick={() => router.push("/calendar")}
              style={styles.ghostBtn}
            >
              Volver al calendario →
            </button>
            <button onClick={() => router.push("/profile")} style={styles.ghostBtn}>
              Ir a perfil →
            </button>
          </div>
        </section>

        {/* CONFIG */}
        <section style={styles.card}>
          <div style={styles.sectionTitle}>Ajustes de tu experiencia</div>
          <div style={styles.smallNote}>
            Configura cómo se comporta SyncPlans para ti.
          </div>

          <div style={styles.list}>
            <Row
              dot="rgba(56,189,248,0.95)"
              title="Notificaciones"
              desc="Recordatorios, resúmenes y modo silencioso."
              cta="Abrir"
              onClick={() => router.push("/settings/notifications")}
            />
            <Row
              dot="rgba(251,191,36,0.95)"
              title="Permisos por grupo"
              desc="Personal / Pareja / Familia: cómo se comporta tu experiencia."
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
              desc="Mantén tu valor semanal ON/OFF."
              cta="Ver"
              onClick={() => router.push("/settings/weekly")}
            />
          </div>
        </section>

        {/* CONNECT */}
        <section style={styles.card}>
          <div style={styles.sectionTitleRow}>
            <div>
              <div style={styles.sectionTitle}>Integraciones de calendario</div>
              <div style={styles.smallNote}>
                Importa eventos <b>read-only</b> como “externos”. Entran a
                conflictos, no rompen tu calendario.
              </div>
            </div>

            <button
              onClick={refreshGoogleStatusWithRetry}
              style={{
                ...styles.secondaryBtn,
                opacity: googleLoading || googleSyncing ? 0.7 : 1,
                cursor:
                  googleLoading || googleSyncing ? "progress" : "pointer",
              }}
              disabled={googleLoading || googleSyncing}
              title="Revisar estado de conexión"
            >
              {googleLoading ? "Actualizando…" : "Actualizar estado"}
            </button>
          </div>

          {/* Google card */}
          <div style={styles.innerCard}>
            <div style={styles.innerTop}>
              <div style={styles.innerLeft}>
                <div style={styles.innerTitleRow}>
                  <div style={styles.appIcon}>G</div>
                  <div>
                    <div style={styles.innerTitle}>Google Calendar</div>
                    <div style={styles.innerSub}>
                      {googleConnected
                        ? `Cuenta: ${googleEmail || "—"} · Read-only import`
                        : "Conecta tu Google para importar eventos como externos."}
                    </div>
                  </div>
                </div>

                {!googleConnected && google?.error ? (
                  <div style={styles.errorBox}>{google.error}</div>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    ...styles.pill,
                    ...(googleConnected ? styles.pillOk : styles.pillMuted),
                  }}
                >
                  {googleConnected ? "Conectado ✅" : "No conectado"}
                </span>

                <button onClick={handleGoogleConnect} style={styles.primaryBtn}>
                  {googleConnected ? "Reconectar" : "Conectar"}
                </button>

                <button
                  onClick={handleGoogleSyncNow}
                  style={{
                    ...styles.secondaryBtn,
                    opacity: !googleConnected ? 0.45 : 1,
                    cursor: !googleConnected
                      ? "not-allowed"
                      : googleSyncing
                      ? "progress"
                      : "pointer",
                  }}
                  disabled={!googleConnected || googleSyncing}
                  title={
                    !googleConnected
                      ? "Conecta Google para importar."
                      : "Importar eventos desde Google"
                  }
                >
                  {googleSyncing ? "Importando…" : "Importar ahora"}
                </button>
              </div>
            </div>

            <div style={styles.note}>
              <b>Tip:</b> Sync trae 30 días atrás y 120 días adelante.
            </div>
          </div>

          {/* Microsoft card (placeholder) */}
          <div style={{ ...styles.innerCard, opacity: 0.9 }}>
            <div style={styles.innerTop}>
              <div style={styles.innerTitleRow}>
                <div
                  style={{
                    ...styles.appIcon,
                    border: "1px solid rgba(148,163,184,0.35)",
                    background: "rgba(148,163,184,0.10)",
                  }}
                >
                  O
                </div>
                <div>
                  <div style={styles.innerTitle}>Outlook / Microsoft 365</div>
                  <div style={styles.innerSub}>
                    Próximamente. Lo activamos después de cerrar Google.
                  </div>
                </div>
              </div>

              <span style={{ ...styles.pill, ...styles.pillSoftMuted }}>
                Próximamente
              </span>
            </div>
          </div>
        </section>

        {/* EMAIL */}
        <section style={styles.card}>
          <div style={styles.sectionTitleRow}>
            <div>
              <div style={styles.sectionTitle}>Enviarme el resumen de hoy</div>
              <div style={styles.smallNote}>
                Te mando a tu correo los eventos de hoy (personales + del grupo
                activo).
              </div>
            </div>

            <button
              onClick={handleSendTodayDigestFromSettings}
              style={{
                ...styles.primaryBtn,
                opacity: digestSending ? 0.7 : 1,
                cursor: digestSending ? "progress" : "pointer",
              }}
              disabled={digestSending}
              title="Enviar resumen de hoy"
            >
              {digestSending ? "Enviando…" : "Probar resumen de hoy"}
            </button>
          </div>

          <div style={styles.note}>
            <b>Pro tip:</b> Esto te deja ver el valor “real” del producto sin
            depender del calendario.
          </div>
        </section>

        {booting ? (
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando settings…</div>
              <div style={styles.loadingSub}>Preferencias + conectores</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
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
  shell: {
    maxWidth: 980,
    margin: "0 auto",
    padding: "22px 18px 48px",
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
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
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
  h1: { margin: "10px 0 0", fontSize: 26, letterSpacing: "-0.6px" },
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
  sectionTitleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72, maxWidth: 760 },

  list: { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 },

  rowBtn: {
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLeft: { minWidth: 0, display: "flex", flexDirection: "column", gap: 4 },
  rowTitleLine: { display: "flex", alignItems: "center", gap: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    boxShadow: "0 0 16px rgba(255,255,255,0.10)",
  },
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

  innerCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  },
  innerTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  innerLeft: { minWidth: 0, flex: 1 },
  innerTitleRow: { display: "flex", gap: 12, alignItems: "center" },
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
  innerTitle: { fontSize: 14, fontWeight: 950 },
  innerSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 650,
    opacity: 0.75,
    maxWidth: 720,
  },

  pill: {
    fontSize: 10,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    whiteSpace: "nowrap",
  },
  pillOk: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.25)",
  },
  pillMuted: { background: "rgba(255,255,255,0.06)" },
  pillSoftMuted: {
    background: "rgba(148,163,184,0.08)",
    border: "1px solid rgba(148,163,184,0.25)",
    opacity: 0.9,
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

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
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

  note: {
    marginTop: 10,
    fontSize: 12,
    opacity: 0.78,
    fontWeight: 650,
    lineHeight: 1.4,
  },

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
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};