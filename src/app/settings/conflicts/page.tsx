// src/app/settings/conflicts/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  getSettingsFromDb,
  saveSettingsToDb,
  type NotificationSettings,
} from "@/lib/settings";

export default function ConflictsSettingsPage() {
  const router = useRouter();

  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ title: string; subtitle?: string } | null>(
    null
  );

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const s = await getSettingsFromDb();
        if (!alive) return;
        setSettings(s);
      } catch (err) {
        console.error("[ConflictsSettings] load error", err);
        if (!alive) return;
        setToast({
          title: "No se pudieron cargar tus ajustes de conflictos",
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

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function update<K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) {
    setSettings((prev: NotificationSettings | null) =>
      prev ? { ...prev, [key]: value } : prev
    );
  }

  async function handleSave() {
    if (!settings) return;
    try {
      setSaving(true);
      setToast(null);

      await saveSettingsToDb(settings);

      setToast({
        title: "Ajustes guardados",
        subtitle: "Tus preferencias de conflictos se actualizaron correctamente.",
      });
    } catch (err) {
      console.error("[ConflictsSettings] save error", err);
      setToast({
        title: "No se pudieron guardar los cambios",
        subtitle: "Inténtalo de nuevo en unos segundos.",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <main className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-white/70">
          Cargando ajustes de conflictos…
        </div>
      </main>
    );
  }

  const currentResolution = settings.conflictDefaultResolution;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* ✅ Top shell premium */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <PremiumHeader />
          <LogoutButton />
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            SyncPlans · Preferencias de conflictos
          </div>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            Cómo quieres resolver los choques
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Cuando un evento nuevo choca con algo que ya existe, SyncPlans puede
            avisarte antes de guardar y aplicar una decisión por defecto si tú
            quieres.
          </p>

          <button
            onClick={() => router.push("/settings")}
            className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
          >
            Volver a Settings
          </button>
        </div>

        {/* Bloque: Avisar antes de guardar */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <h2 className="text-sm font-semibold">Avisarme antes de guardar</h2>
              </div>
              <p className="mt-1 text-xs text-white/60">
                Si esto está activado, cuando haya un choque verás una pantalla previa
                para decidir qué hacer con los eventos. Si lo apagas, SyncPlans usará
                directamente tu decisión por defecto.
              </p>
            </div>

            <Toggle
              checked={settings.conflictWarnBeforeSave}
              onChange={(v) => update("conflictWarnBeforeSave", v)}
            />
          </div>
        </section>

        {/* Bloque: Decisión por defecto */}
        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-5">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <h2 className="text-sm font-semibold">Decisión por defecto</h2>
            </div>
            <p className="mt-1 text-xs text-white/60">
              Esto se usa cuando hay conflictos y eliges aplicar tu decisión rápida
              (o cuando el aviso previo está apagado). Siempre podrás cambiar de idea
              caso por caso.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ResolutionCard
              title="Preguntarme siempre"
              description="Cada vez que haya un conflicto, quiero ver la pantalla con todas las opciones antes de guardar."
              selected={currentResolution === "ask_me"}
              onSelect={() => update("conflictDefaultResolution", "ask_me")}
            />

            <ResolutionCard
              title="Mantener existente"
              description="Si hay choque, por defecto se conserva el evento que ya estaba y el nuevo no se guarda."
              selected={currentResolution === "keep_existing"}
              onSelect={() => update("conflictDefaultResolution", "keep_existing")}
            />

            <ResolutionCard
              title="Reemplazar por el nuevo"
              description="Si hay choque, por defecto se borra el/los eventos existentes y se guarda el nuevo."
              selected={currentResolution === "replace_with_new"}
              onSelect={() =>
                update("conflictDefaultResolution", "replace_with_new")
              }
            />

            <ResolutionCard
              title="Conservar ambos"
              description="Si hay choque, por defecto se guardan ambos eventos. Después puedes ajustarlos manualmente."
              selected={currentResolution === "none"}
              onSelect={() => update("conflictDefaultResolution", "none")}
            />
          </div>
        </section>

        {/* Footer */}
        <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-4 text-xs text-white/60 sm:flex-row sm:items-center">
          <div>
            <div className="font-semibold text-white">
              Cómo se conecta esto con el calendario
            </div>
            <p className="mt-1 text-[11px] text-white/60">
              Estas preferencias se aplican cuando creas o editas eventos desde el calendario
              y SyncPlans detecta choques. Nada se borra sin que lo confirmes directa o
              indirectamente con estas reglas.
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
                : "border-rose-400/60 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25",
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

function ResolutionCard({
  title,
  description,
  selected,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex h-full flex-col justify-between rounded-2xl border p-3 text-left text-xs transition",
        selected
          ? "border-rose-400/80 bg-rose-500/20"
          : "border-white/10 bg-black/30 hover:bg-black/40",
      ].join(" ")}
    >
      <div>
        <div className="text-[12px] font-semibold text-white">{title}</div>
        <p className="mt-1 text-[11px] text-white/60">{description}</p>
      </div>
      <div className="mt-2 text-[10px] text-white/60">
        {selected ? "Seleccionado" : "Elegir como defecto"}
      </div>
    </button>
  );
}