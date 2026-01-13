"use client";

import { useRouter } from "next/navigation";

type GroupKey = "personal" | "couple" | "family";

const cards: Array<{
  key: GroupKey;
  title: string;
  desc: string;
  badge: string;
  hint: string;
  ring: string;
  bg: string;
  text: string;
}> = [
  {
    key: "personal",
    title: "Personal",
    desc: "Tu agenda privada: trabajo, gym, amigos.",
    badge: "Privado",
    hint: "Solo tú lo ves",
    ring: "hover:ring-white/15",
    bg: "bg-white/5 hover:bg-white/7",
    text: "text-white",
  },
  {
    key: "couple",
    title: "Pareja",
    desc: "Planes con tu pareja: citas, viajes, cenas.",
    badge: "Compartido",
    hint: "Sincronizado en pareja",
    ring: "hover:ring-rose-300/20",
    bg: "bg-rose-500/10 hover:bg-rose-500/15",
    text: "text-rose-50",
  },
  {
    key: "family",
    title: "Familia",
    desc: "Eventos familiares: cumpleaños, reuniones, actividades.",
    badge: "Compartido",
    hint: "Sincronizado en familia",
    ring: "hover:ring-sky-300/20",
    bg: "bg-sky-500/10 hover:bg-sky-500/15",
    text: "text-sky-50",
  },
];

export default function EventTypePage() {
  const router = useRouter();

  function pick(group: GroupKey) {
    sessionStorage.setItem("new_event_group", group);
    router.push("/events/new/details");
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-20 -left-40 h-[420px] w-[420px] rounded-full bg-rose-500/10 blur-3xl" />
        <div className="absolute bottom-0 -right-40 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            ← Volver
          </button>

          <div className="text-sm text-white/60">
            Paso <span className="text-white/90 font-medium">1</span> de 2
          </div>
        </div>

        <div className="mt-10 text-center">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Nuevo evento
          </h1>
          <p className="mt-3 text-white/70 text-lg">
            Elige el tipo para aplicar color y sincronización.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 grid gap-4">
          {cards.map((c) => (
            <button
              key={c.key}
              onClick={() => pick(c.key)}
              className={[
                "group w-full text-left rounded-2xl border border-white/10",
                "ring-1 ring-transparent transition-all duration-200",
                "hover:scale-[1.01] hover:border-white/20",
                c.ring,
                c.bg,
              ].join(" ")}
            >
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className={["text-2xl font-semibold", c.text].join(" ")}>
                        {c.title}
                      </h2>
                      <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-white/70">
                        {c.badge}
                      </span>
                    </div>
                    <p className="mt-2 text-white/70">{c.desc}</p>
                    <p className="mt-3 text-sm text-white/60">{c.hint}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 group-hover:text-white transition">
                      Elegir
                    </span>
                    <span className="text-xl text-white/50 group-hover:text-white transition">
                      →
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-8 text-center text-sm text-white/55">
          Tip: luego verás alertas si un plan se cruza con Pareja/Familia ⭐
        </div>
      </div>
    </main>
  );
}
