"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { setMode } from "@/lib/groups";

export default function FamilyGroupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/login?next=/groups/family");
    }
  }, [router]);

  async function activateFamily() {
    try {
      setLoading(true);
      setMode("family");
      router.push("/members");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-14">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            SyncPlans · Familia
          </div>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Organización para toda tu familia
          </h1>

          <p className="mt-2 max-w-xl text-sm text-white/60">
            Coordina agendas, evita choques de horarios y mantén a todos alineados
            en un solo calendario compartido.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Feature
              title="Calendario compartido"
              desc="Visibilidad clara entre todos los miembros."
            />
            <Feature
              title="Conflictos guiados"
              desc="Decisiones simples cuando hay choques."
            />
            <Feature
              title="Resumen semanal"
              desc="Una vista clara de la semana familiar."
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={activateFamily}
              disabled={loading}
              className="rounded-xl border border-white/10 bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/15 disabled:opacity-50"
            >
              {loading ? "Activando…" : "Activar modo Familia →"}
            </button>

            <button
              onClick={() => router.push("/groups")}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Volver
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
            Modo demo: esta acción guarda el estado local y activa la experiencia
            familiar completa.
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-white/60">{desc}</div>
    </div>
  );
}
