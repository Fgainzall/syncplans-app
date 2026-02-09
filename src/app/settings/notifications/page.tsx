// src/app/settings/notifications/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import {
  getSettingsFromDb,
  saveSettingsToDb,
  resetSettingsToDb,
  type NotificationSettings,
} from "@/lib/settings";

export default function NotificationsSettingsPage() {
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
        router.push("/auth/login?next=/settings/notifications");
        return;
      }

      try {
        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
        setReady(true);
      } catch {
        if (!alive) return;
        setReady(true);
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

  const score = useMemo(() => {
    if (!s) return { on: 0, total: 6 };
    const toggles = [
      s.eventReminders,
      s.dailySummary,
      s.weeklySummary,
      s.conflictAlerts,
      s.partnerUpdates,
      s.familyUpdates,
    ];
    const on = toggles.filter(Boolean).length;
    return { on, total: toggles.length };
  }, [s]);

  if (!ready) return null;

  if (!s) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            No pude cargar tus ajustes todavía. Revisa que hayas corrido el SQL y que tu sesión esté activa.
          </div>

          <button
            onClick={() => router.push("/calendar")}
            className="mt-4 rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
          >
            Volver al calendario
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
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              SyncPlans · Ajustes
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight">Notificaciones</h1>

            <p className="mt-2 text-sm text-white/60">
              Controla recordatorios, resúmenes por correo y modo silencioso.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/profile")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Volver a perfil
            </button>

            <button
              onClick={async () => {
                setSaving(true);
                try {
                  const d = await resetSettingsToDb();
                  setS(d);
                  setSavedPulse(true);
                  setTimeout(() => setSavedPulse(false), 700);
                } finally {
                  setSaving(false);
                }
              }}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Restaurar defaults
            </button>
          </div>
        </div>

        {/* Status banner */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Estado</div>
              <div className="mt-1 text-xs text-white/60">
                {score.on}/{score.total} activadas ·{" "}
                {s.quietHoursEnabled ? "Modo silencioso activo" : "Modo silencioso apagado"}
                {saving ? " · Guardando…" : ""}
              </div>
            </div>

            <div
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold transition",
                savedPulse
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100/80"
                  : "border-white/10 bg-white/5 text-white/60",
              ].join(" ")}
            >
              {savedPulse ? "Guardado ✓" : "Auto-guardado"}
            </div>
          </div>
        </div>

        {/* Cards */}
        <div className="grid gap-4">
          <Card
            title="Recordatorios y resúmenes"
            desc="Tu foto diaria y semanal: antes de que algo se te pase."
          >
            <ToggleRow
              title="Recordatorio de eventos"
              subtitle="Te avisamos antes de que empiece un evento."
              value={s.eventReminders}
              onChange={(v) => commit({ ...s, eventReminders: v })}
            />
            <Divider />
            <ToggleRow
              title="Resumen diario por correo"
              subtitle="Cada mañana: un correo con los eventos que tienes para ese día."
              value={s.dailySummary}
              onChange={(v) => commit({ ...s, dailySummary: v })}
            />
            <Divider />
            <ToggleRow
              title="Resumen semanal"
              subtitle="Una vez a la semana: tus eventos y organización de los próximos días."
              value={s.weeklySummary}
              onChange={(v) => commit({ ...s, weeklySummary: v })}
            />
          </Card>

          <Card
            title="Alertas inteligentes"
            desc="Tu feature estrella: choques de horario y actualizaciones del grupo."
          >
            <ToggleRow
              title="Notificaciones de conflictos"
              subtitle="Cuando detectamos solapamientos, te lo decimos al instante."
              value={s.conflictAlerts}
              onChange={(v) => commit({ ...s, conflictAlerts: v })}
            />
            <Divider />
            <ToggleRow
              title="Notificaciones de pareja"
              subtitle="Cambios relevantes del grupo de pareja."
              value={s.partnerUpdates}
              onChange={(v) => commit({ ...s, partnerUpdates: v })}
            />
            <Divider />
            <ToggleRow
              title="Notificaciones de familia"
              subtitle="Cambios relevantes del grupo familiar."
              value={s.familyUpdates}
              onChange={(v) => commit({ ...s, familyUpdates: v })}
            />
          </Card>

          <Card
            title="Modo silencioso"
            desc="Bloquea notificaciones en horario de descanso (sin perder nada)."
          >
            <ToggleRow
              title="Activar horario silencioso"
              subtitle="Durante este rango, no enviamos alertas."
              value={s.quietHoursEnabled}
              onChange={(v) => commit({ ...s, quietHoursEnabled: v })}
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <TimeField
                label="Desde"
                value={s.quietFrom}
                disabled={!s.quietHoursEnabled}
                onChange={(v) => commit({ ...s, quietFrom: v })}
              />
              <TimeField
                label="Hasta"
                value={s.quietTo}
                disabled={!s.quietHoursEnabled}
                onChange={(v) => commit({ ...s, quietTo: v })}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
              Tip: Activa modo silencioso para que se sienta “producto real”.
            </div>
          </Card>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
          Los resúmenes se envían automáticamente cuando están activados. No tienes que hacer nada más.
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI ---------------- */

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{desc}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/30">
        {children}
      </div>
    </section>
  );
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
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-white/60">{subtitle}</div>
      </div>

      <button
        onClick={() => onChange(!value)}
        className={[
          "relative h-8 w-14 rounded-full border transition",
          value
            ? "border-emerald-400/30 bg-emerald-500/20"
            : "border-white/10 bg-white/5",
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

function TimeField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 text-xs font-semibold text-white/70">{label}</div>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "w-full rounded-xl border px-3 py-2 text-sm outline-none",
          disabled
            ? "border-white/5 bg-black/20 text-white/30"
            : "border-white/10 bg-black/30 text-white/90 focus:border-white/20",
        ].join(" ")}
      />
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/10" />;
}
