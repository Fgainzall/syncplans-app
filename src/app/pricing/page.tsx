// src/app/pricing/page.tsx
import React from "react";
import Link from "next/link";
import PremiumHeader from "@/components/PremiumHeader";

const featuresFree = [
  "Calendario personal básico",
  "Hasta 1 grupo de pareja o familia",
  "Detección simple de choques de horario",
  "Sin tarjetas ni pagos durante la beta",
];

const featuresMonthly = [
  "Todos los grupos que necesites (pareja, familia, amigos, equipos)",
  "Detección avanzada de conflictos entre calendarios",
  "Resumen diario por email con tus planes del día",
  "Resumen semanal con próximos planes importantes",
  "Alertas cuando tu pareja o familia cambian algo importante",
];

const featuresYearly = [
  "Todo lo del plan mensual",
  "Precio fundador garantizado mientras mantengas el plan",
  "Ahorro de alrededor del 15% frente al pago mes a mes",
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <PremiumHeader />

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        {/* Cinta beta */}
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-100 shadow-lg shadow-amber-500/10">
          <span className="font-semibold">Demo Premium activo · </span>
          <span>
            Durante la beta tienes acceso a las funciones Premium sin costo.
            Más adelante podrás elegir si te quedas en el plan Gratis o haces
            upgrade.
          </span>
        </div>

        {/* Hero centrado */}
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center gap-3">
          <p className="text-[11px] sm:text-xs uppercase tracking-[0.3em] text-slate-400">
            PLANES DE SYNCPLANS
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">
            Coordinar horarios no debería ser un motivo de pelea.
          </h1>
          <p className="text-sm sm:text-base text-slate-300">
            SyncPlans no es “otro calendario”. Es el lugar donde todos ven la
            misma versión de los planes compartidos y los choques se detectan
            antes de que explote el problema.
          </p>
        </section>

        {/* Aviso de divisa */}
        <section className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] sm:text-xs text-slate-200 ring-1 ring-slate-700/80">
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950">
              Recomendado
            </span>
            <span>Plan anual: te sale más barato que un café al mes ☕</span>
          </div>
          <div className="text-slate-400">
            Precios en{" "}
            <span className="font-semibold text-slate-200">USD</span> · impuestos
            pueden variar según tu país
          </div>
        </section>

        {/* Cards de planes */}
        <section className="mx-auto grid w-full max-w-4xl gap-5 md:grid-cols-3">
          {/* Plan Gratis */}
          <article className="flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.25em] text-slate-500">
              Gratis
            </div>
            <h2 className="mb-1 text-lg font-semibold text-slate-50">
              Plan Básico
            </h2>
            <p className="mb-4 text-xs sm:text-sm text-slate-300">
              Para probar SyncPlans con tus primeros planes reales.
            </p>

            <div className="mb-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-slate-50">
                US$0
              </span>
              <span className="text-xs text-slate-400">/ mes</span>
            </div>

            <ul className="mb-6 space-y-2 text-xs sm:text-sm text-slate-200">
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
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-800"
              >
                Empezar gratis
              </Link>
            </div>
          </article>

          {/* Plan Mensual */}
          <article className="flex flex-col rounded-3xl border border-rose-500/70 bg-gradient-to-b from-rose-600/25 via-slate-950/70 to-slate-950/95 p-5 shadow-lg shadow-rose-900/40 md:-mt-4 md:mb-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-rose-200">
                Premium
              </div>
              <div className="rounded-full bg-rose-500/25 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-50">
                Más elegido
              </div>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-rose-50">
              Plan Mensual
            </h2>
            <p className="mb-4 text-xs sm:text-sm text-rose-50/80">
              Para parejas, familias y grupos que de verdad se coordinan aquí.
            </p>

            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-rose-50">
                US$4.90
              </span>
              <span className="text-xs text-rose-100/80">/ mes</span>
            </div>
            <p className="mb-4 text-[11px] text-rose-100/70">
              Algo menos que una hamburguesa al mes por tener paz con tu agenda
              compartida.
            </p>

            <ul className="mb-6 space-y-2 text-xs sm:text-sm text-rose-50/90">
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
                Durante la beta no se cobrará nada. Más adelante podrás decidir
                si activas este plan.
              </p>
            </div>
          </article>

          {/* Plan Anual */}
          <article className="flex flex-col rounded-3xl border border-sky-500/50 bg-slate-900/75 p-5 shadow-md shadow-sky-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.25em] text-sky-200">
                Premium
              </div>
              <div className="rounded-full bg-sky-500/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sky-50">
                Ahorra ~15%
              </div>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-sky-50">
              Plan Anual
            </h2>
            <p className="mb-4 text-xs sm:text-sm text-sky-50/80">
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
            <p className="mb-4 text-[11px] text-sky-100/70">
              Equivale a menos de US$4.10 al mes. Precio fundador para los que
              se quedan.
            </p>

            <ul className="mb-6 space-y-2 text-xs sm:text-sm text-sky-50/90">
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
                className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-500/70 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-sky-50 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-80"
                disabled
              >
                Disponible después de la beta
              </button>
              <p className="mt-2 text-[11px] text-sky-100/70">
                Cuando lancemos oficialmente, este será el plan recomendado para
                parejas y familias que usan SyncPlans todos los días.
              </p>
            </div>
          </article>
        </section>

        {/* Bloque corto de contexto, también centrado */}
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 text-xs sm:text-sm text-slate-300">
          <div className="rounded-2xl bg-slate-900/70 p-4 border border-slate-800/80">
            <h3 className="mb-1 text-sm sm:text-base font-semibold text-slate-50">
              ¿Para quién es SyncPlans?
            </h3>
            <p>
              Para personas que coordinan muchos planes con otros: parejas que
              no quieren discusiones por horarios, familias que mezclan trabajo,
              niños y viajes, y grupos de amigos o equipos que viven armando
              cosas juntos.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-slate-800/80">
            <h3 className="mb-1 text-sm sm:text-base font-semibold text-slate-50">
              ¿Por qué no basta con WhatsApp y un calendario normal?
            </h3>
            <p>
              Los chats se pierden, cada uno mira su propio calendario y nadie
              ve el cuadro completo. SyncPlans junta esos mundos: muestra todos
              los planes relevantes y marca cuándo algo se cruza o desaparece.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-900/70 p-4 border border-slate-800/80">
            <h3 className="mb-1 text-sm sm:text-base font-semibold text-slate-50">
              Empieza ahora y decide después.
            </h3>
            <p>
              Durante la beta utilizas SyncPlans con acceso Premium sin costo.
              Cuando lancemos, podrás quedarte en el plan Gratis o pasarte a un
              plan de pago si realmente te está ahorrando peleas, tiempo y
              dolores de cabeza.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
