"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getSettingsFromDb, saveSettingsToDb, type NotificationSettings } from "@/lib/settings";

type ConflictResolution = "ask_me" | "keep_existing" | "replace_with_new";

export default function ConflictsSettingsPage() {
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
        router.push("/auth/login?next=/settings/conflicts");
        return;
      }
      try {
        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
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

  if (!ready) return null;
  if (!s) return <Fallback router={router} />;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Header
          title="Preferencias de conflictos"
          subtitle="Define tu estilo: avisos antes de guardar y resolución por defecto."
          onBack={() => router.push("/settings")}
          saving={saving}
          savedPulse={savedPulse}
        />

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="rounded-2xl border border-white/10 bg-black/30">
            <Row
              title="Avisarme antes de guardar si hay conflicto"
              subtitle="Activa esto para el preview de conflictos (tu wow moment)."
              value={!!(s as any).conflictWarnBeforeSave}
              onChange={(v) => commit({ ...(s as any), conflictWarnBeforeSave: v })}
            />
            <Divider />
            <SelectRow
              title="Resolución por defecto"
              subtitle="Si hay choque, ¿qué preseleccionamos?"
              value={((s as any).conflictDefaultResolution ?? "ask_me") as ConflictResolution}
              onChange={(v) => commit({ ...(s as any), conflictDefaultResolution: v })}
              options={[
                { value: "ask_me", label: "Preguntarme (recomendado)" },
                { value: "keep_existing", label: "Conservar existente" },
                { value: "replace_with_new", label: "Reemplazar por el nuevo" },
              ]}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
            En el próximo paso, conectamos esto al flujo de crear evento para mostrar el preview antes de guardar.
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Header({
  title,
  subtitle,
  onBack,
  saving,
  savedPulse,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  saving: boolean;
  savedPulse: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="h-2 w-2 rounded-full bg-rose-400" />
          SyncPlans · Ajustes
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-white/60">{subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onBack}
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
  );
}

function Row({
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

function SelectRow({
  title,
  subtitle,
  value,
  onChange,
  options,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (v: any) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{subtitle}</div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="text-black">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Divider() {
  return <div className="h-px w-full bg-white/10" />;
}

function Fallback({ router }: any) {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          No pude cargar tus ajustes todavía. Revisa sesión / SQL.
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
