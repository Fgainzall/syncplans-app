// src/app/pricing/page.tsx
import React from "react";
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
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <PremiumHeader
          title="Planes"
          subtitle="El mismo SyncPlans, con distintos niveles de compromiso."
        />

        <main className="mt-8 flex flex-col gap-10">
          {/* Cinta beta */}
          <section className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-50 shadow-lg shadow-amber-500/10 sm:text-sm">
            <p className="font-semibold">
              Demo Premium activo ·{" "}
              <span className="font-normal">
                Mientras dure la beta, todos los usuarios tienen acceso a las
                funciones Premium sin costo. Después podrás decidir si te quedas
                en Gratis o haces upgrade.
              </span>
            </p>
          </section>

          {/* Hero centrado */}
          <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-400">
              Planes de SyncPlans
            </p>
            <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
              Coordinar horarios no debería ser un motivo de pelea.
            </h1>
            <p className="text-sm text-slate-300 sm:text-base">
              SyncPlans no es “otro calendario más”. Es el lugar donde todos ven
              la misma versión de los planes compartidos y los choques se
              detectan antes de que explote el problema.
            </p>
          </section>

          {/* Badge anual + info USD */}
          <section className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1 text-slate-100 ring-1 ring-slate-700/80">
              <span className="rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950">
                Recomendado
              </span>
              <span>Plan anual: se ve más barato que el café del mes ☕</span>
            </div>
            <p className="text-slate-400">
              Precios en{" "}
              <span className="font-semibold text-slate-200">USD</span> ·
              impuestos pueden variar según tu país
            </p>
          </section>

          {/* Cards de planes centradas */}
          <section className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-3">
            {/* Plan Gratis */}
            <article className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                Gratis
              </div>
              <h2 className="mb-1 text-lg font-semibold text-slate-50">
                Plan Básico
              </h2>
              <p className="mb-4 text-xs text-slate-300">
                Para probar SyncPlans con tus primeros planes reales.
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
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-400 hover:bg-slate-900"
                  disabled
                >
                  Empezar gratis (durante la beta ya estás en Premium)
                </button>
              </div>
            </article>

            {/* Plan Mensual */}
            <article className="relative flex flex-col rounded-3xl border border-rose-500/60 bg-gradient-to-b from-rose-600/25 via-slate-950/70 to-slate-950/95 p-5 shadow-lg shadow-rose-900/40 md:-mt-4 md:mb-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
                  Premium
                </div>
                <div className="rounded-full bg-rose-500/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-50">
                  Plan principal
                </div>
              </div>
              <h2 className="mb-1 text-lg font-semibold text-rose-50">
                Plan Mensual
              </h2>
              <p className="mb-4 text-xs text-rose-50/80">
                Para parejas, familias y grupos que de verdad se coordinan todo
                por aquí.
              </p>

              <div className="mb-1 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-rose-50">
                  US$4.90
                </span>
                <span className="text-xs text-rose-100/80">/ mes</span>
              </div>
              <p className="mb-4 text-[11px] text-rose-100/80">
                Lo que pagas por un delivery al mes, pero te ahorras discusiones
                por horarios.
              </p>

              <ul className="mb-6 space-y-2 text-sm text-rose-50/90">
                {featuresMonthly.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-rose-300" />
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
                <p className="mt-2 text-[11px] text-rose-100/75">
                  Durante la beta no se te cobrará nada. Más adelante podrás
                  activar este plan si te encaja.
                </p>
              </div>
            </article>

            {/* Plan Anual */}
            <article className="relative flex flex-col rounded-3xl border border-sky-500/50 bg-slate-900/80 p-5 shadow-md shadow-sky-900/40">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-200">
                  Premium
                </div>
                <div className="rounded-full bg-sky-500/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-50">
                  Ahorra 15%
                </div>
              </div>
              <h2 className="mb-1 text-lg font-semibold text-sky-50">
                Plan Anual
              </h2>
              <p className="mb-4 text-xs text-sky-50/80">
                Para los que ya saben que SyncPlans encaja en su día a día y
                prefieren olvidarse del pago mes a mes.
              </p>

              <div className="mb-1 flex items-baseline gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-sky-50">
                    US$49
                  </span>
                  <span className="text-xs text-sky-100/80">/ año</span>
                </div>
              </div>
              <p className="mb-4 text-[11px] text-sky-100/75">
                Equivalente a menos de US$4.10 al mes. Descuento fundador
                asegurado mientras mantengas el plan.
              </p>

              <ul className="mb-6 space-y-2 text-sm text-sky-50/90">
                {featuresYearly.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-sky-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-500/70 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-sky-50 transition hover:bg-slate-950 disabled:cursor-not-allowed disabled:opacity-80"
                  disabled
                >
                  Disponible después de la beta
                </button>
                <p className="mt-2 text-[11px] text-sky-100/75">
                  Cuando lancemos oficialmente, este será el plan recomendado
                  para parejas y familias que usan SyncPlans todos los días.
                </p>
              </div>
            </article>
          </section>

          {/* Sección corta explicativa, también centrada */}
          <section className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                ¿Por qué no basta con WhatsApp y un calendario normal?
              </h3>
              <p className="text-sm text-slate-300">
                WhatsApp sirve para hablar, pero no para tener un plan claro y
                compartido. SyncPlans pone todo en un solo lugar, detecta
                choques automáticamente y evita el “yo pensé que era otro día”.
              </p>
            </article>

            <article className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
                Empieza ahora y decide después
              </h3>
              <p className="text-sm text-slate-300">
                Durante la beta usas SyncPlans con acceso Premium completo. Cuando
                lancemos, podrás quedarte en el plan Gratis o pasar a Premium.
                Tu feedback ahora define cómo será el producto final.
              </p>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
