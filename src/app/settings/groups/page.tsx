// src/app/settings/groups/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getUser } from "@/lib/auth";
import {
  getSettingsFromDb,
  saveSettingsToDb,
  type NotificationSettings,
} from "@/lib/settings";

type PermMode = "owner_only" | "shared_read" | "shared_write";

export default function GroupPermsSettingsPage() {
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
        router.push("/auth/login?next=/settings/groups");
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

  const personal = ((s as any).permPersonal ?? "owner_only") as PermMode;
  const pair = ((s as any).permPair ?? "shared_write") as PermMode;
  const family = ((s as any).permFamily ?? "shared_read") as PermMode;

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <PremiumHeader />
          <LogoutButton />
        </div>

        <Header
          title="Permisos por grupo"
          subtitle="Define tus defaults para Personal / Pareja / Familia."
          onBack={() => router.push("/settings")}
          saving={saving}
          savedPulse={savedPulse}
        />

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="grid gap-4">
            <PermCard
              dot="bg-amber-300"
              title="Personal"
              hint="Recomendado: Solo yo."
              value={personal}
              onChange={(v) => commit({ ...(s as any), permPersonal: v })}
            />
            <PermCard
              dot="bg-rose-400"
              title="Pareja"
              hint="Recomendado: Edición compartida."
              value={pair}
              onChange={(v) => commit({ ...(s as any), permPair: v })}
            />
            <PermCard
              dot="bg-sky-400"
              title="Familia"
              hint="Recomendado: Lectura compartida."
              value={family}
              onChange={(v) => commit({ ...(s as any), permFamily: v })}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
            Esto guarda tus preferencias. En el siguiente upgrade conectamos
            esto a tu RLS / roles por grupo para que no sea solo UI.
          </div>
        </section>
      </div>
    </main>
  );
}

/* ---------- UI ---------- */

function Header({ title, subtitle, onBack, saving, savedPulse }: any) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="h-2 w-2 rounded-full bg-amber-300" />
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

function PermCard({
  dot,
  title,
  hint,
  value,
  onChange,
}: {
  dot: string;
  title: string;
  hint: string;
  value: string;
  onChange: (v: any) => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/30 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className={["h-2.5 w-2.5 rounded-full", dot].join(" ")} />
            <div className="text-sm font-semibold">{title}</div>
          </div>
          <div className="mt-2 text-xs text-white/60">{hint}</div>
        </div>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-4 w-full rounded-xl border border-white/10 bg-[#050816] px-3 py-2 text-sm text-white/90 outline-none focus:border-white/20"
      >
        <option value="owner_only" className="text-black">
          Solo yo (owner only)
        </option>
        <option value="shared_read" className="text-black">
          Compartido (solo lectura)
        </option>
        <option value="shared_write" className="text-black">
          Compartido (edición)
        </option>
      </select>
    </div>
  );
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