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

const whySyncPlans = [
  {
    title: "Un solo lugar para todos tus planes",
    text: "Personal, pareja, familia y amigos. SyncPlans junta todo para que veas tu vida completa, no solo un calendario suelto.",
  },
  {
    title: "Detecta choques antes de que exploten",
    text: "La app te avisa cuando dos planes se pisan y te obliga a decidir qué hacer antes del clásico “yo pensaba que era otro día”.",
  },
  {
    title: "Todos ven la misma verdad",
    text: "Nada de capturas, audios y mensajes perdidos. Si un plan cambia, se actualiza para todos los que dependen de él.",
  },
];

const whyPaidPlan = [
  {
    title: "Más grupos, más claridad",
    text: "Cuando tu vida se llena de reuniones, viajes, cumpleaños y planes con varias personas, el plan Premium mantiene todo ordenado.",
  },
  {
    title: "Resúmenes que llegan solos",
    text: "Cada mañana y cada semana recibes un resumen con lo importante, sin tener que entrar a la app si no quieres.",
  },
  {
    title: "Precio pensado para pareja / familia",
    text: "No es una suscripción por persona para que duela menos. Es un precio bajo para organizar la vida de varias personas a la vez.",
  },
];

const faqs = [
  {
    q: "¿Para quién es SyncPlans?",
    a: "Para personas que comparten más de un plan a la semana con alguien más: parejas que coordinan todo, familias con mil actividades, amigos que arman planes seguido o equipos pequeños que quieren menos caos.",
  },
  {
    q: "¿No basta con WhatsApp y un calendario normal?",
    a: "WhatsApp sirve para hablar, no para tener claridad. SyncPlans no reemplaza el chat: se encarga de que todos sepan qué quedó, cuándo y con quién, sin depender de revisar 100 mensajes.",
  },
  {
    q: "¿Por qué hay un plan pago si ahora mismo es gratis?",
    a: "Durante la beta todo es Gratis / Demo Premium. Más adelante habrá funciones que solo estarán en el plan pago (más grupos, resúmenes por correo, opciones avanzadas de conflictos). Si no las necesitas, te quedas en el plan Gratis.",
  },
  {
    q: "¿Qué pasará con mi cuenta cuando acabe la beta?",
    a: "Tu cuenta seguirá igual. Podrás elegir si te quedas en el plan Gratis o haces upgrade a Premium. Te avisaremos con tiempo y no cobraremos nada sin que tú lo confirmes.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 text-slate-50">
      <PremiumHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {/* Breadcrumb / contexto suave */}
        <div className="text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
          Cuenta · Planes
        </div>

        {/* Hero + cinta beta */}
        <section className="grid gap-6 lg:grid-cols-[1.4fr,1fr] lg:items-center">
          <div className="space-y-5">
            <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl">
              Coordinar horarios no debería ser un motivo de pelea.
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              SyncPlans no es “otro calendario más”. Es el árbitro neutral de
              tus planes compartidos: muestra la misma verdad a todos, detecta
              choques entre agendas y te obliga a decidir antes de que explote
              el problema.
            </p>

            <div className="inline-flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-100 ring-1 ring-emerald-500/40">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="font-semibold uppercase tracking-[0.16em]">
                  Demo Premium activa
                </span>
              </div>
              <p className="text-xs text-slate-400 sm:text-sm">
                Todos los usuarios tienen acceso completo mientras dure la beta.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl border border-amber-400/25 bg-gradient-to-b from-amber-500/10 via-slate-950/50 to-slate-950/80 p-5 shadow-lg shadow-amber-900/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
              Durante la beta
            </p>
            <p className="text-sm text-amber-50/90">
              Estamos probando SyncPlans con un grupo reducido de personas. Tu
              feedback va a definir cómo se queda el producto para el resto.
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-100/80">
              <li>• No se te va a cobrar nada sin avisarte antes.</li>
              <li>• Podrás quedarte en el plan Gratis cuando lancemos.</li>
              <li>• El precio fundador del plan Premium será más bajo para los
                que estuvieron en esta etapa.</li>
            </ul>
            <p className="mt-3 text-[11px] text-amber-100/70">
              Precios en <span className="font-semibold">USD</span>. Impuestos
              pueden variar según tu país.
            </p>
          </div>
        </section>

        {/* Cards de planes */}
        <section className="grid gap-6 lg:grid-cols-3">
          {/* Plan Gratis */}
          <article className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
            <div className="mb-3 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
              Gratis
            </div>
            <h2 className="mb-1 text-lg font-semibold text-slate-50">
              Plan Básico
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              Para probar el concepto y coordinar los primeros planes con tu
              pareja o familia.
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
                  <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-slate-400" />
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
          <article className="relative flex flex-col rounded-3xl border border-rose-500/70 bg-gradient-to-b from-rose-600/30 via-slate-950/70 to-slate-950/95 p-5 shadow-xl shadow-rose-900/40 lg:-mt-4 lg:mb-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-[0.25em] text-rose-200">
                Premium
              </div>
              <div className="rounded-full bg-rose-500/25 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-50">
                Plan principal
              </div>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-rose-50">
              Plan Mensual
            </h2>
            <p className="mb-4 text-sm text-rose-50/80">
              Para parejas, familias y grupos que de verdad se organizan aquí.
            </p>

            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-rose-50">
                US$4.90
              </span>
              <span className="text-xs text-rose-100/80">/ mes</span>
            </div>
            <p className="mb-4 text-xs text-rose-100/80">
              Menos que una hamburguesa al mes por tener paz con tu agenda
              compartida.
            </p>

            <ul className="mb-6 space-y-2 text-sm text-rose-50/90">
              {featuresMonthly.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-rose-300" />
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
              <p className="mt-2 text-[11px] text-rose-100/80">
                Durante la beta no se te cobrará nada. Más adelante podrás
                decidir si activas este plan.
              </p>
            </div>
          </article>

          {/* Plan Anual */}
          <article className="relative flex flex-col rounded-3xl border border-sky-500/50 bg-slate-900/70 p-5 shadow-md shadow-sky-900/40">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-[0.25em] text-sky-300">
                Premium
              </div>
              <div className="rounded-full bg-sky-500/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-100">
                Ahorra 15%
              </div>
            </div>
            <h2 className="mb-1 text-lg font-semibold text-sky-50">
              Plan Anual
            </h2>
            <p className="mb-4 text-sm text-sky-50/85">
              Para los que ya saben que SyncPlans encaja en su día a día y
              quieren pagar menos al año.
            </p>

            <div className="mb-1 flex items-baseline gap-2">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-sky-50">
                  US$49
                </span>
                <span className="text-xs text-sky-100/80">/ año</span>
              </div>
            </div>
            <p className="mb-4 text-xs text-sky-100/80">
              Equivalente a menos de US$4.10 al mes. Descuento fundador
              asegurado mientras mantengas el plan.
            </p>

            <ul className="mb-6 space-y-2 text-sm text-sky-50/90">
              {featuresYearly.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[4px] h-1.5 w-1.5 rounded-full bg-sky-300" />
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
              <p className="mt-2 text-[11px] text-sky-100/80">
                Cuando lancemos oficialmente, este será el plan recomendado para
                parejas y familias que usan SyncPlans todos los días.
              </p>
            </div>
          </article>
        </section>

        {/* ¿Qué hace distinto a SyncPlans? */}
        <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              ¿Qué hace distinto a SyncPlans?
            </h3>
            <div className="space-y-4 text-sm text-slate-200">
              {whySyncPlans.map((item) => (
                <div key={item.title} className="space-y-1.5">
                  <p className="font-medium text-slate-50">{item.title}</p>
                  <p className="text-sm text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              ¿Por qué existe un plan pago?
            </h3>
            <div className="space-y-4 text-sm text-slate-200">
              {whyPaidPlan.map((item) => (
                <div key={item.title} className="space-y-1.5">
                  <p className="font-medium text-slate-50">{item.title}</p>
                  <p className="text-sm text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        {/* FAQs */}
        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Preguntas frecuentes
          </h3>
          <p className="mb-5 text-sm text-slate-300">
            Respuestas rápidas a las dudas típicas antes de pagar por una app
            más en tu vida.
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            {faqs.map((item) => (
              <div
                key={item.q}
                className="rounded-2xl bg-slate-950/60 p-4 ring-1 ring-slate-800/80"
              >
                <p className="mb-2 text-sm font-semibold text-slate-50">
                  {item.q}
                </p>
                <p className="text-sm text-slate-300">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-slate-950/80 to-slate-950/90 p-5 shadow-md shadow-emerald-900/40 md:flex-row md:items-center">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-emerald-50">
              Empieza ahora y decide después.
            </h3>
            <p className="text-sm text-emerald-100/80">
              Mientras dure la beta, puedes usar todo como si ya fueras
              Premium. Cuando lancemos, tú decides si pagas o te quedas en el
              plan Gratis.
            </p>
          </div>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-md shadow-emerald-900/40 transition hover:bg-emerald-400"
          >
            Crear cuenta gratis
          </Link>
        </section>
      </main>
    </div>
  );
}
