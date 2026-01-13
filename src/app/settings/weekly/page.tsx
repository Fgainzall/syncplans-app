// src/app/settings/weekly/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import {
  getSettingsFromDb,
  saveSettingsToDb,
  type NotificationSettings,
} from "@/lib/settings";

export default function WeeklySettingsPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<NotificationSettings | null>(null);
  const [savedPulse, setSavedPulse] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const u = getUser();
      if (!u) {
        router.push("/auth/login?next=/settings/weekly");
        return;
      }

      try {
        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
      } catch {
        // igual mostramos (pero si no hay s, mostramos fallback)
      } finally {
        if (alive) setReady(true);
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
      setTimeout(() => setSavedPulse(false), 700);
    } finally {
      setSaving(false);
    }
  }

  const status = useMemo(() => {
    if (!s) return null;
    return s.weeklySummary ? "ON" : "OFF";
  }, [s]);

  if (!ready) return null;

  if (!s) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            No pude cargar tus ajustes todavía. Revisa que tu SQL esté listo y que tu sesión esté activa.
          </div>

          <button
            onClick={() => router.push("/settings")}
            className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Volver a settings
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              SyncPlans · Ajustes
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Resumen semanal</h1>

            <p className="mt-2 text-sm text-white/60">
              Tu “valor diario” consolidado: lo importante de tu semana, sin ruido.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/settings")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Volver a settings
            </button>

            <div
              className={[
                "rounded-full border px-3 py-2 text-xs font-semibold transition",
                savedPulse
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100/80"
                  : "border-white/10 bg-white/5 text-white/60",
              ].join(" ")}
            >
              {saving ? "Guardando…" : savedPulse ? "Guardado ✓" : "Auto-guardado"}
            </div>
          </div>
        </div>

        {/* Card */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="mb-4">
            <div className="text-sm font-semibold">Estado</div>
            <div className="mt-1 text-xs text-white/60">
              Resumen semanal: <span className="font-semibold text-white/80">{status}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30">
            <ToggleRow
              title="Activar resumen semanal"
              subtitle="Un resumen compacto de tu semana (eventos, organización y conflictos)."
              value={s.weeklySummary}
              onChange={(v) => commit({ ...s, weeklySummary: v })}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
            Nota: por ahora esto controla el switch. Luego lo conectamos al “scheduler” real (envío semanal).
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------------- UI ---------------- */

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
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{subtitle}</div>
      </div>

      <button
        onClick={() => onChange(!value)}
        className={[
          "relative h-8 w-14 rounded-full border transition",
          value ? "border-emerald-400/30 bg-emerald-500/20" : "border-white/10 bg-white/5",
        ].join(" ")}
        aria-label={title}
      >
        <span
          className={[
            "absolute top-1 h-6 w-6 rounded-full border bg-[#050816] transition",
            value ? "left-7 border-emerald-400/30" : "left-1 border-white/10",
          ].join(" ")}
        />
      </button>
    </div>
  );
}
