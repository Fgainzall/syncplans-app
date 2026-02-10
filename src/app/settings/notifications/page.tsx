// src/app/settings/notifications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

export default function NotificationsSettingsPage() {
  const router = useRouter();

  const [appSettings, setAppSettings] =
    useState<AppNotificationSettings | null>(null);
  const [userNotif, setUserNotif] =
    useState<UserNotificationSettings | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; subtitle?: string } | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const [s, u] = await Promise.all([
          getSettingsFromDb(),
          getMyNotificationSettings(),
        ]);
        if (!alive) return;
        setAppSettings(s);
        setUserNotif(u);
      } catch (err) {
        console.error("[NotificationsSettings] load error", err);
        if (!alive) return;
        setToast({
          title: "No se pudieron cargar tus ajustes",
          subtitle: "Refresca la página o intenta de nuevo en unos segundos.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Autocerrar toast suave
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function updateApp<K extends keyof AppNotificationSettings>(
    key: K,
    value: AppNotificationSettings[K]
  ) {
    setAppSettings((prev: AppNotificationSettings | null) =>
      prev ? { ...prev, [key]: value } : prev
    );
  }

  function updateUserNotif<K extends keyof UserNotificationSettings>(
    key: K,
    value: UserNotificationSettings[K]
  ) {
    setUserNotif((prev: UserNotificationSettings | null) =>
      prev ? { ...prev, [key]: value } : prev
    );
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

      setToast({
        title: "Ajustes guardados",
        subtitle: "Tus notificaciones se actualizaron correctamente.",
      });
    } catch (err) {
      console.error("[NotificationsSettings] save error", err);
      setToast({
        title: "No se pudieron guardar los cambios",
        subtitle: "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !appSettings || !userNotif) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-white/70">
          Cargando ajustes de notificaciones…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            SyncPlans · Notificaciones
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Notificaciones y resúmenes
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Decide qué cosas quieres que SyncPlans te recuerde y qué prefieres
            revisar tú cuando quieras.
          </p>

          <button
            onClick={() => router.push("/settings")}
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Volver a Settings
          </button>
        </div>

        {/* Bloque: Email / resúmenes */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-semibold">
                  Resumen diario por email
                </h2>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Cada mañana te enviamos un correo con los eventos de tu día
                (personales + compartidos) para que empieces con claridad.
                Puedes apagarlo si prefieres revisar el calendario manualmente.
              </p>
            </div>

            <Toggle
              checked={appSettings.dailySummary}
              onChange={(v) => updateApp("dailySummary", v)}
            />
          </div>

          <div className="mt-4 grid gap-3 text-xs text-white/70 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">
                  Recordatorios de eventos
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Notificaciones para eventos cercanos en el tiempo.
                </div>
              </div>
              <Toggle
                checked={appSettings.eventReminders}
                onChange={(v) => updateApp("eventReminders", v)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">
                  Resumen semanal
                </div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Un email con una vista general de la semana.
                </div>
              </div>
              <Toggle
                checked={appSettings.weeklySummary}
                onChange={(v) => updateApp("weeklySummary", v)}
              />
            </label>
          </div>
        </section>

        {/* Bloque: Alertas de conflictos */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <h2 className="text-sm font-semibold">Alertas de conflictos</h2>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Te avisamos cuando un evento nuevo choca con algo que ya existe
                en tu calendario, para que puedas decidir antes de guardar.
              </p>
            </div>

            <Toggle
              checked={appSettings.conflictAlerts}
              onChange={(v) => updateApp("conflictAlerts", v)}
            />
          </div>

          <div className="mt-4 rounded-2xl bg-black/40 p-3 text-[11px] text-white/60">
            Las alertas de conflicto funcionan junto con tus preferencias de
            resolución (en la sección de{" "}
            <span className="font-semibold">Preferencias de conflictos</span>).
          </div>
        </section>

        {/* Bloque: Notificaciones por tipo de grupo */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <h2 className="text-sm font-semibold">
                  Notificaciones por tipo de grupo
                </h2>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Elige de qué espacios quieres recibir notificaciones dentro de
                la app. Esto no apaga tus eventos, solo los avisos.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-white/70 sm:grid-cols-2">
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">Personal</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Actividad y cambios en tu espacio personal.
                </div>
              </div>
              <Toggle
                checked={userNotif.notify_personal}
                onChange={(v) => updateUserNotif("notify_personal", v)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">Pareja</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Eventos, cambios y mensajes en grupos de pareja.
                </div>
              </div>
              <Toggle
                checked={userNotif.notify_pair}
                onChange={(v) => updateUserNotif("notify_pair", v)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">Familia</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Actividad en grupos familiares (hijos, padres, etc.).
                </div>
              </div>
              <Toggle
                checked={userNotif.notify_family}
                onChange={(v) => updateUserNotif("notify_family", v)}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/40 px-3 py-2">
              <div>
                <div className="text-[11px] font-semibold">Conflictos</div>
                <div className="mt-0.5 text-[11px] text-white/50">
                  Notificaciones específicas cuando se detecten choques
                  importantes.
                </div>
              </div>
              <Toggle
                checked={userNotif.notify_conflicts}
                onChange={(v) => updateUserNotif("notify_conflicts", v)}
              />
            </label>
          </div>
        </section>

        {/* Footer con acciones */}
        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/60 sm:flex-row sm:items-center">
          <div>
            <div className="font-semibold text-white">
              Cómo usa SyncPlans tus notificaciones
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              Solo usamos estos ajustes para avisarte de cambios y resúmenes de
              tu propio calendario. No compartimos esta información con nadie.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={[
              "inline-flex items-center justify-center rounded-2xl border px-4 py-2 text-xs font-semibold transition",
              saving
                ? "border-white/20 bg-white/10 text-white/60 cursor-default"
                : "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
            ].join(" ")}
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>

        {toast && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/60 px-4 py-3 text-[11px]">
            <div className="font-semibold text-white">{toast.title}</div>
            {toast.subtitle && (
              <div className="mt-1 text-white/70">{toast.subtitle}</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        checked
          ? "border-emerald-400 bg-emerald-500/40"
          : "border-white/20 bg-white/10",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );
}
