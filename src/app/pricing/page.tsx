// src/app/pricing/page.tsx
import React from "react";
import Link from "next/link";
import PremiumHeader from "@/components/PremiumHeader";

const featuresFree = [
  "Calendario personal básico",
  "Grupos limitados para probar (pareja / familia / otros)",
  "Detección de algunos conflictos entre planes",
  "Sin tarjetas ni pagos durante la beta",
];

const featuresMonthly = [
  "Todos los grupos que necesites (pareja, familia, amigos, equipos)",
  "Detección avanzada de conflictos entre calendarios",
  "Resumen diario por email con tus planes del día",
  "Resumen semanal con próximos planes importantes",
  "Notificaciones de cambios relevantes de tu pareja / familia",
];

const featuresYearly = [
  "Todo lo del plan mensual",
  "Precio fundador garantizado mientras mantengas el plan",
  "15% de descuento frente al pago mensual",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* 👇 misma “caja” que /profile y /events */}
      <div className="mx-auto max-w-[1120px] px-[18px] pt-6 pb-16">
        <PremiumHeader
          title="Planes"
          subtitle="El mismo SyncPlans, con distintos niveles de compromiso."
        />

        <main className="mt-6 flex flex-col gap-10">
          {/* Cinta de beta / demo */}
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-500/10">
            <span className="font-semibold">Demo Premium activo · </span>
            <span>
              Mientras dure la beta, todos los usuarios tienen acceso a las
              funciones Premium sin costo. Más adelante podrás elegir si te
              quedas en el plan Gratis o haces upgrade.
            </span>
          </div>

          {/* Hero */}
          <section className="space-y-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">
              PLANES DE SYNCPLANS
            </p>
            <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
              Coordinar horarios no debería ser un motivo de pelea.
            </h1>
            <p className="mx-auto max-w-2xl text-sm text-slate-300 sm:text-base">
              SyncPlans no es “otro calendario más”. Es el lugar donde todos ven
              la misma versión de los planes compartidos y los choques se
              detectan antes de que explote el problema.
            </p>
          </section>

          {/* Toggle conceptual (texto, sin lógica de estado por ahora) */}
          <section className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-xs text-slate-200 ring-1 ring-slate-700/80">
              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-950">
                Recomendado
              </span>
              <span>Plan anual: se ve más barato que un café al mes ☕</span>
            </div>
            <div className="text-xs text-slate-400 sm:text-sm">
              Precios en{" "}
              <span className="font-semibold text-slate-200">USD</span> ·
              impuestos pueden variar según tu país
            </div>
          </section>

          {/* Cards de planes */}
          <section className="grid gap-6 md:grid-cols-3">
            {/* Plan Gratis */}
            <article className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm shadow-slate-950/40">
              <div className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
                Gratis
              </div>
              <h2 className="mb-2 text-lg font-semibold text-slate-50">
                Plan Básico
              </h2>
              <p className="mb-4 text-sm text-slate-300">
                Ideal para probar el concepto y coordinar los primeros planes
                con tu pareja o familia.
              </p>

              <div className="mb-4 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-slate-50">
                  US$0
                </span>
                <span className="text-xs text-slate-400">/ mes</span>
              </div>

              <ul className="mb-6 space-y-2 text-sm text-slate-200">
                {featuresFree.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Link
                  href="/register"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900"
                >
                  Empezar gratis
                </Link>
              </div>
            </article>

            {/* Plan Mensual */}
            <article className="relative flex flex-col rounded-3xl border border-rose-500/60 bg-gradient-to-b from-rose-600/20 via-slate-950/60 to-slate-950/90 p-5 shadow-lg shadow-rose-900/40 md:-mt-4 md:mb-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-[0.25em] text-rose-300">
                  Premium
                </div>
                <div className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100">
                  Plan principal
                </div>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-rose-50">
                Plan Mensual
              </h2>
              <p className="mb-4 text-sm text-rose-50/80">
                Para parejas, familias y grupos que de verdad se coordinan por
                aquí.
              </p>

              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-rose-50">
                  US$4.90
                </span>
                <span className="text-xs text-rose-100/80">/ mes</span>
              </div>
              <p className="mb-4 text-xs text-rose-100/70">
                Menos que una hamburguesa al mes por tener paz con tu agenda
                compartida.
              </p>

              <ul className="mb-6 space-y-2 text-sm text-rose-50/90">
                {featuresMonthly.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-rose-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-500 px-3 py-2 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-900/40 transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-80"
                  disabled
                >
                  Demo Premium activo
                </button>
                <p className="mt-2 text-[11px] text-rose-100/70">
                  Durante la beta no se te cobrará nada. Más adelante podrás
                  decidir si activas este plan.
                </p>
              </div>
            </article>

            {/* Plan Anual */}
            <article className="relative flex flex-col rounded-3xl border border-sky-500/40 bg-slate-900/70 p-5 shadow-md shadow-sky-900/40">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xs font-medium uppercase tracking-[0.25em] text-sky-300">
                  Premium
                </div>
                <div className="rounded-full bg-sky-500/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                  Ahorra 15%
                </div>
              </div>
              <h2 className="mb-2 text-lg font-semibold text-sky-50">
                Plan Anual
              </h2>
              <p className="mb-4 text-sm text-sky-50/80">
                Para los que ya saben que SyncPlans encaja en su día a día y
                prefieren pagar menos al año.
              </p>

              <div className="mb-1 flex items-baseline gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-sky-50">
                    US$49
                  </span>
                  <span className="text-xs text-sky-100/80">/ año</span>
                </div>
              </div>
              <p className="mb-4 text-xs text-sky-100/70">
                Equivalente a menos de US$4.10 al mes. Precio fundador
                garantizado mientras mantengas el plan.
              </p>

              <ul className="mb-6 space-y-2 text-sm text-sky-50/90">
                {featuresYearly.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-500/60 bg-slate-950/60 px-3 py-2 text-sm font-semibold text-sky-50 transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-80"
                  disabled
                >
                  Disponible después de la beta
                </button>
                <p className="mt-2 text-[11px] text-sky-100/70">
                  Cuando lancemos oficialmente, este será el plan recomendado
                  para parejas y familias que usan SyncPlans todos los días.
                </p>
              </div>
            </article>
          </section>

          {/* Bloques cortos (menos texto, pero claros) */}
          <section className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <h3 className="mb-2 text-sm font-semibold text-slate-50">
                ¿Para quién es SyncPlans?
              </h3>
              <p>
                Para personas que coordinan con otros: parejas que ya no quieren
                discusiones por horarios, familias que cruzan trabajo, niños y
                viajes, y grupos de amigos que quieren dejar de adivinar quién
                puede y quién no.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <h3 className="mb-2 text-sm font-semibold text-slate-50">
                ¿Por qué no basta WhatsApp + calendario?
              </h3>
              <p>
                WhatsApp sirve para hablar, pero no para ver el cuadro completo.
                SyncPlans junta tus planes en un solo lugar, detecta choques de
                horario y te obliga a decidir antes de que algo se caiga.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              <h3 className="mb-2 text-sm font-semibold text-slate-50">
                Empieza ahora y decide después.
              </h3>
              <p>
                Durante la beta, usas SyncPlans con acceso Premium completo.
                Cuando lancemos, podrás quedarte en el plan Gratis o pasar a
                Premium. Tu feedback ahora define cómo se ve el producto final.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
