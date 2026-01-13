"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getSettingsFromDb, type NotificationSettings } from "@/lib/settings";

export default function SettingsHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [s, setS] = useState<NotificationSettings | null>(null);

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
    const toggles = [s.eventReminders, s.conflictAlerts, s.partnerUpdates, s.familyUpdates, s.weeklySummary];
    const on = toggles.filter(Boolean).length;
    return { on, total: toggles.length, quiet: s.quietHoursEnabled };
  }, [s]);

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            SyncPlans · Panel de usuario
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-2 text-sm text-white/60">
            Tu app se vuelve personal aquí: notificaciones, permisos por grupo y conflictos.
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

        {/* Tiles */}
        <div className="grid gap-4">
          <Tile
            title="Notificaciones"
            desc={
              notifScore
                ? `${notifScore.on}/${notifScore.total} activadas · ${notifScore.quiet ? "Silencioso ON" : "Silencioso OFF"}`
                : "Controla recordatorios, alertas y modo silencioso."
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
            <span className={["h-2.5 w-2.5 rounded-full", dotClass].join(" ")} />
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
