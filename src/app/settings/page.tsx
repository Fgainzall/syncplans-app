// src/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

function labelForGroup(row: DbEventRow): string {
  if (!row.group_id) return "Personal";
  return "Grupo";
}

/* ─────────────────────────────────────────────
   Integraciones: helpers
───────────────────────────────────────────── */

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

async function getAccessTokenOrNull(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function SettingsHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [s, setS] = useState<NotificationSettings | null>(null);

  // Resumen diario manual
  const [digestSending, setDigestSending] = useState(false);
  const [digestToast, setDigestToast] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  // Integraciones
  const [googleLoading, setGoogleLoading] = useState(false);
  const [google, setGoogle] = useState<GoogleStatus | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [connectToast, setConnectToast] = useState<{
    title: string;
    subtitle?: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const u = getUser();
      if (!u) {
        router.push("/auth/login?next=/settings");
        return;
      }

      try {
        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
      } catch {
        // ok
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

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

  // Auto-hide toasts
  useEffect(() => {
    if (!digestToast) return;
    const t = setTimeout(() => setDigestToast(null), 3600);
    return () => clearTimeout(t);
  }, [digestToast]);

  useEffect(() => {
    if (!connectToast) return;
    const t = setTimeout(() => setConnectToast(null), 4200);
    return () => clearTimeout(t);
  }, [connectToast]);

  /* ─────────────────────────────────────────────
     Google status
  ───────────────────────────────────────────── */

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
          error: (json as any)?.error || "No se pudo consultar estado de Google.",
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

  useEffect(() => {
    refreshGoogleStatus().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGoogleConnect() {
    window.location.href = "/api/google/connect";
  }

  async function handleGoogleSyncNow() {
    try {
      setGoogleSyncing(true);

      const res = await fetch("/api/google/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json.ok) {
        console.error("[SettingsHub] google sync error", json);
        setConnectToast({
          title: "No se pudo importar desde Google",
          subtitle:
            json?.error ||
            "Intenta de nuevo. Si persiste, desconecta y vuelve a conectar.",
        });
        return;
      }

      setConnectToast({
        title: "Importación lista ✅",
        subtitle: `Trajimos ${json?.imported ?? 0} evento(s). Ya entran a conflictos.`,
      });

      refreshGoogleStatus().catch(() => {});
    } catch (e: any) {
      console.error("[SettingsHub] google sync exception", e);
      setConnectToast({
        title: "No se pudo importar desde Google",
        subtitle: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setGoogleSyncing(false);
    }
  }

  /* ─────────────────────────────────────────────
     Resumen diario manual
  ───────────────────────────────────────────── */

  async function handleSendTodayDigestFromSettings() {
    try {
      setDigestSending(true);

      const u = getUser();
      const email =
        (u as any)?.email ||
        (u as any)?.user_metadata?.email ||
        (u as any)?.user_metadata?.preferred_email;

      if (!email) {
        setDigestToast({
          title: "No encontramos tu correo",
          subtitle: "Revisa tu sesión o tu perfil.",
        });
        return;
      }

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const todayISO = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

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

      const filtered = filteredByDay.filter((r) => {
        if (!activeGroupId) return !r.group_id;
        return !r.group_id || String(r.group_id) === String(activeGroupId);
      });

      if (!filtered.length) {
        setDigestToast({
          title: "Hoy no tienes eventos 🙌",
          subtitle: "Cuando tengas algo agendado, te mando el resumen.",
        });
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
      if (!res.ok || !json.ok) throw new Error(json?.message || "Error enviando el correo");

      setDigestToast({
        title: "Te envié un resumen de hoy a tu correo ✉️",
        subtitle: "Si no lo ves, revisa Promociones o Spam.",
      });
    } catch (err: any) {
      console.error("[SettingsHub] daily digest error", err);
      setDigestToast({
        title: "No se pudo enviar el resumen",
        subtitle: "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setDigestSending(false);
    }
  }

  if (!ready) return null;

  const googleConnected = !!google?.connected;
  const googleEmail = google?.account?.email ?? null;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      {/* ✅ Contenedor único centrado (como Summary) */}
      <div className="mx-auto w-full max-w-[860px] px-4 py-6">
        <PremiumHeader
          title="Settings"
          subtitle="Notificaciones, permisos por grupo y conexiones de calendario."
          rightSlot={<LogoutButton />}
        />

        <div className="mt-6 space-y-6">
          {/* CONFIG */}
          <section className="rounded-3xl border border-white/10 bg-black/35 p-5">
            <div className="mb-4">
              <div className="text-[11px] font-extrabold tracking-wide text-white/55">
                CONFIGURACIÓN
              </div>
              <div className="mt-1 text-lg font-semibold text-white">
                Ajustes de tu experiencia
              </div>
              <div className="mt-1 text-xs text-white/60">
                {notifScore
                  ? `${notifScore.on}/${notifScore.total} notificaciones activas · ${
                      notifScore.quiet ? "Silencioso ON" : "Silencioso OFF"
                    }`
                  : "Controla notificaciones, permisos por grupo y conflictos."}
              </div>
            </div>

            <div className="grid gap-3">
              <Tile
                title="Notificaciones"
                desc="Recordatorios, resúmenes y modo silencioso."
                cta="Abrir"
                onClick={() => router.push("/settings/notifications")}
                dotClass="bg-cyan-400"
              />

              <Tile
                title="Permisos por grupo"
                desc="Personal / Pareja / Familia: cómo se comporta SyncPlans."
                cta="Configurar"
                onClick={() => router.push("/settings/groups")}
                dotClass="bg-amber-300"
              />

              <Tile
                title="Preferencias de conflictos"
                desc="Avisos, defaults y reglas de coordinación."
                cta="Ajustar"
                onClick={() => router.push("/settings/conflicts")}
                dotClass="bg-rose-400"
              />

              <Tile
                title="Resumen semanal"
                desc="Mantén tu valor semanal ON/OFF."
                cta="Ver"
                onClick={() => router.push("/settings/notifications")}
                dotClass="bg-emerald-400"
              />
            </div>
          </section>

          {/* CONECTAR */}
          <section className="rounded-3xl border border-white/10 bg-black/35 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-extrabold tracking-wide text-white/55">
                  CONECTAR
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  Integraciones de calendario
                </div>
                <div className="mt-1 text-xs text-white/60">
                  Importa eventos <b>read-only</b> desde Google/Outlook como “externos”.
                  Entran a conflictos, pero no rompen tu calendario.
                </div>
              </div>

              <button
                type="button"
                onClick={refreshGoogleStatus}
                disabled={googleLoading}
                className={[
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                  googleLoading
                    ? "border-white/20 bg-white/10 text-white/60 cursor-default"
                    : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10",
                ].join(" ")}
              >
                {googleLoading ? "Actualizando…" : "Actualizar estado"}
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {/* Google */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Google Calendar</span>
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          googleConnected
                            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
                            : "border-white/15 bg-white/5 text-white/70",
                        ].join(" ")}
                      >
                        {googleConnected ? "Conectado" : "No conectado"}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-white/60">
                      {googleConnected ? (
                        <>
                          Cuenta: <span className="text-white/85">{googleEmail || "—"}</span>
                          <span className="text-white/40"> · Read-only import</span>
                        </>
                      ) : (
                        "Conecta tu Google para importar tus eventos como externos."
                      )}
                    </div>

                    {!googleConnected && google?.error && (
                      <div className="mt-2 text-[11px] text-rose-200/90">{google.error}</div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleGoogleConnect}
                      className="rounded-2xl border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25"
                    >
                      {googleConnected ? "Reconectar" : "Conectar"}
                    </button>

                    <button
                      type="button"
                      onClick={handleGoogleSyncNow}
                      disabled={!googleConnected || googleSyncing}
                      className={[
                        "rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                        !googleConnected
                          ? "border-white/10 bg-white/5 text-white/40 cursor-default"
                          : googleSyncing
                            ? "border-white/20 bg-white/10 text-white/60 cursor-default"
                            : "border-emerald-400/45 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20",
                      ].join(" ")}
                      title={!googleConnected ? "Conecta Google para importar." : "Importa eventos ahora."}
                    >
                      {googleSyncing ? "Importando…" : "Importar ahora"}
                    </button>
                  </div>
                </div>

                <div className="mt-3 text-[11px] text-white/45">
                  Tip: si no ves eventos, revisa el rango: Sync trae 30 días atrás y 120 días adelante.
                </div>
              </div>

              {/* Microsoft placeholder */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">Outlook / Microsoft 365</span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-white/60">
                        Próximamente
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-white/60">
                      Misma lógica: importar como “externos” + conflictos. Lo activamos después de cerrar Google.
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/40 cursor-default"
                  >
                    Conectar
                  </button>
                </div>
              </div>
            </div>

            {connectToast && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-[11px]">
                <div className="font-semibold text-white">{connectToast.title}</div>
                {connectToast.subtitle && <div className="mt-1 text-white/70">{connectToast.subtitle}</div>}
              </div>
            )}
          </section>

          {/* RESUMEN HOY */}
          <section className="rounded-3xl border border-white/10 bg-black/35 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[11px] font-extrabold tracking-wide text-white/55">
                  CORREO
                </div>
                <div className="mt-1 text-lg font-semibold text-white">Enviarme el resumen de hoy</div>
                <div className="mt-1 text-xs text-white/60">
                  Te mando a tu correo los eventos de hoy (personales + del grupo activo).
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendTodayDigestFromSettings}
                disabled={digestSending}
                className={[
                  "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold transition",
                  digestSending
                    ? "border-white/20 bg-white/10 text-white/60 cursor-default"
                    : "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
                ].join(" ")}
              >
                {digestSending ? "Enviando…" : "Probar resumen de hoy"}
              </button>
            </div>

            {digestToast && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-[11px]">
                <div className="font-semibold text-white">{digestToast.title}</div>
                {digestToast.subtitle && <div className="mt-1 text-white/70">{digestToast.subtitle}</div>}
              </div>
            )}
          </section>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/55">
            Pro tip: este hub hace que SyncPlans se sienta “producto real” y te ordena el roadmap.
          </div>
        </div>
      </div>
    </main>
  );
}

function Tile({
  title,
  desc,
  cta,
  onClick,
  dotClass,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
  dotClass: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={["h-2.5 w-2.5 rounded-full", dotClass].join(" ")} />
            <div className="text-sm font-semibold text-white">{title}</div>
          </div>
          <div className="mt-1 text-xs text-white/60">{desc}</div>
        </div>

        <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/75 group-hover:bg-black/40">
          {cta}
        </div>
      </div>
    </button>
  );
}