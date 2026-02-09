// src/app/settings/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getUser } from "@/lib/auth";
import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";

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

export default function SettingsHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [s, setS] = useState<NotificationSettings | null>(null);

  // 🔔 Estado V2 – resumen diario desde settings
  const [digestSending, setDigestSending] = useState(false);
  const [digestToast, setDigestToast] = useState<{
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
        // ok: igual mostramos hub
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

  // Auto-esconder toast del resumen
  useEffect(() => {
    if (!digestToast) return;
    const t = setTimeout(() => setDigestToast(null), 3600);
    return () => clearTimeout(t);
  }, [digestToast]);

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

      // Fecha “hoy” en Lima (lo resolvemos en cliente)
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const todayISO = `${y}-${String(m).padStart(2, "0")}-${String(
        d
      ).padStart(2, "0")}`;

      const base = startOfDay(todayISO);
      const end = new Date(base);
      end.setDate(end.getDate() + 1);

      const [activeGroupId, rawEvents] = await Promise.all([
        getActiveGroupIdFromDb().catch(() => null),
        getMyEvents().catch(() => [] as DbEventRow[]),
      ]);

      const baseMs = base.getTime();
      const endMs = end.getTime();

      // Filtrar por día
      const filteredByDay = (rawEvents ?? []).filter((r: DbEventRow) => {
        const startMs = new Date(r.start).getTime();
        if (Number.isNaN(startMs)) return false;
        return startMs >= baseMs && startMs < endMs;
      });

      // Misma lógica que DayTimeline: personales + grupo activo (si hay)
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

      if (!res.ok || !json.ok) {
        throw new Error(json?.message || "Error enviando el correo");
      }

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

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            SyncPlans · Panel de usuario
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Settings
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Tu app se vuelve personal aquí: notificaciones, permisos por grupo y
            conflictos.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/calendar")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Volver al calendario
            </button>
            <button
              onClick={() => router.push("/profile")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Ir a perfil
            </button>
          </div>
        </div>

        {/* Tiles principales */}
        <div className="grid gap-4">
          <Tile
            title="Notificaciones"
            desc={
              notifScore
                ? `${notifScore.on}/${notifScore.total} activadas · ${
                    notifScore.quiet ? "Silencioso ON" : "Silencioso OFF"
                  }`
                : "Controla recordatorios, resúmenes y modo silencioso."
            }
            cta="Abrir"
            onClick={() => router.push("/settings/notifications")}
            dotClass="bg-cyan-400"
          />

          <Tile
            title="Permisos por grupo"
            desc="Personal / Pareja / Familia: cómo quieres que se comporte tu experiencia."
            cta="Configurar"
            onClick={() => router.push("/settings/groups")}
            dotClass="bg-amber-300"
          />

          <Tile
            title="Preferencias de conflictos"
            desc="Tu estilo: avisar antes de guardar, default de resolución y más."
            cta="Ajustar"
            onClick={() => router.push("/settings/conflicts")}
            dotClass="bg-rose-400"
          />

          <Tile
            title="Resumen semanal"
            desc="Sección rápida para tu ‘valor diario’: mantenerlo ON/OFF."
            cta="Ver"
            onClick={() => router.push("/settings/notifications")}
            dotClass="bg-emerald-400"
          />
        </div>

        {/* Bloque: disparar resumen de hoy manualmente */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/80">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="h-2 w-2 rounded-full bg-cyan-400" />
                Enviarme el resumen de hoy
              </div>
              <p className="mt-1 text-[11px] text-white/60">
                Usa el mismo motor que el resumen diario automático: te mando a tu correo los eventos de hoy
                (personales + del grupo activo) para que veas cómo se ve.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSendTodayDigestFromSettings}
              disabled={digestSending}
              className={[
                "mt-1 inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold transition sm:mt-0",
                digestSending
                  ? "border-white/20 bg-white/10 text-white/60 cursor-default"
                  : "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
              ].join(" ")}
            >
              {digestSending ? "Enviando resumen…" : "Probar resumen de hoy"}
            </button>
          </div>

          {digestToast && (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[11px]">
              <div className="font-semibold text-white">
                {digestToast.title}
              </div>
              {digestToast.subtitle && (
                <div className="mt-1 text-[10px] text-white/70">
                  {digestToast.subtitle}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
          Pro tip: este hub hace que SyncPlans se sienta “producto real” (y te ordena el roadmap).
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
      className="group text-left rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:bg-white/10"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={["h-2.5 w-2.5 rounded-full", dotClass].join(" ")}
            />
            <div className="text-sm font-semibold">{title}</div>
          </div>
          <div className="mt-2 text-xs text-white/60">{desc}</div>
        </div>

        <div className="shrink-0 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white/70 group-hover:bg-black/40">
          {cta}
        </div>
      </div>
    </button>
  );
}
