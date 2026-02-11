// src/app/pricing/page.tsx
import React from "react";
import Link from "next/link";
import PremiumHeader from "@/components/PremiumHeader";

const featuresFree = [
  "Calendario personal básico",
  "Crea y prueba grupos de pareja / familia / amigos",
  "Detección inicial de choques entre algunos planes",
  "Sin tarjeta ni pago mientras dure la beta",
];

const featuresMonthly = [
  "Todos los grupos que necesites (pareja, familia, amigos, equipos)",
  "Detección avanzada de conflictos entre calendarios compartidos",
  "Resumen diario por email con tus planes del día",
  "Resumen semanal con próximos planes importantes",
  "Notificaciones de cambios relevantes de tu pareja / familia",
  "Conflictos visibles antes de que se armen malos entendidos",
];

const featuresYearly = [
  "Todo lo del plan mensual",
  "Precio fundador garantizado mientras mantengas el plan",
  "15% de descuento frente al pago mensual",
  "Prioridad en futuras funciones pensadas para parejas y familias",
];

const problems = [
  "“Pensé que era el sábado siguiente…”",
  "“No vi ese mensaje entre los 200 del grupo.”",
  "“Pero en mi calendario no estaba.”",
  "“Ya había quedado con alguien más y no me acordé.”",
];

const whoIsFor = [
  {
    title: "Parejas que quieren menos fricción",
    text: "Dos agendas, una vida en común. SyncPlans ayuda a ver en un solo lugar todo lo que ya está comprometido y evitar el clásico “no me avisaste”.",
  },
  {
    title: "Familias con mil actividades",
    text: "Niños, trabajo, viajes, reuniones del cole, almuerzos familiares… aquí todos ven lo mismo y los choques se detectan antes de que exploten.",
  },
  {
    title: "Grupos que realmente se juntan",
    text: "Amigos, equipos de trabajo, grupos de paddle, running o viajes: coordinar horarios no debería depender de quién fue el último en escribir en WhatsApp.",
  },
];

const valueBullets = [
  "No es otro calendario, es el árbitro neutral de los planes compartidos.",
  "No reemplaza WhatsApp: lo complementa. WhatsApp para conversar, SyncPlans para que nada se pierda.",
  "No te obliga a usarlo para todo: empieza solo con lo que más se te cruza.",
];

const faqs = [
  {
    q: "¿Por qué no es completamente gratis para siempre?",
    a: "Porque queremos que SyncPlans sea un producto serio, con continuidad, soporte y mejoras reales en el tiempo. Un plan Premium permite mantener servidores, seguridad, nuevas funciones e integraciones, sin depender de publicidad ni vender tus datos.",
  },
  {
    q: "¿Tengo que pagar algo ahora mismo?",
    a: "No. Mientras dure la beta, todos los usuarios están en modo Demo Premium. Puedes usar las funciones avanzadas sin pagar nada y decidir más adelante si te quedas en el plan Gratis o activas el plan Premium.",
  },
  {
    q: "¿Puedo usar SyncPlans solo con mi pareja o solo con amigos?",
    a: "Claro. Puedes crear un grupo de pareja, o uno de amigos, o varios. La idea es que tengas un solo lugar donde todos vean la misma verdad respecto a fechas y horarios.",
  },
  {
    q: "¿Qué pasa si dejo de pagar el plan Premium?",
    a: "Siempre tendrás acceso a tu cuenta y a un plan Gratis. Podrías perder algunas funciones avanzadas (como resúmenes por email o detección más profunda de conflictos), pero tus eventos no desaparecen ni se pierden.",
  },
  {
    q: "¿Van a subir el precio más adelante?",
    a: "Los precios pueden cambiar con el tiempo, pero el objetivo del plan anual fundador es premiar a quienes confían al inicio: si mantienes tu suscripción activa, tu precio se respeta mientras la mantengas.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <PremiumHeader />

      <main className="mx-auto flex max-w-6xl flex-col gap-12 px-4 pb-20 pt-6 sm:px-6 lg:px-8">
        {/* Cinta beta / demo */}
        <div className="mt-2 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-slate-950 to-amber-500/10 px-4 py-3 text-sm text-amber-100 shadow-lg shadow-amber-500/15">
          <span className="font-semibold">Demo Premium activo · </span>
          <span>
            Mientras dure la beta, todos los usuarios tienen acceso a las
            funciones Premium sin costo. Más adelante podrás elegir si te quedas
            en el plan Gratis o haces upgrade.
          </span>
        </div>

        {/* Hero principal */}
        <section className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              PLANES DE SYNCPLANS
            </p>
            <h1 className="text-3xl font-semibold text-slate-50 sm:text-4xl lg:text-5xl">
              Coordinar horarios no debería ser un motivo de pelea.
            </h1>
            <p className="max-w-xl text-sm text-slate-300 sm:text-base">
              SyncPlans no es “otro calendario más”. Es el árbitro neutral de
              tus planes compartidos: muestra la misma verdad a todos, detecta
              choques entre agendas y te obliga a decidir antes de que explote
              el problema.
            </p>

            <div className="space-y-3 text-sm text-slate-300">
              <p className="font-medium text-slate-200">
                Ideal si estás cansado de:
              </p>
              <ul className="space-y-1.5">
                {problems.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-rose-400" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-900/40 hover:bg-rose-400 transition"
              >
                Empezar gratis en beta
              </Link>
              <span className="text-xs text-slate-400">
                Sin tarjeta. Solo crea tu cuenta y prueba cómo se siente
                coordinar sin fricción.
              </span>
            </div>
          </div>

          {/* Tarjeta lateral de “no es otro calendario” */}
          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-slate-950/40">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-800/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>No es solo un calendario</span>
            </div>
            <p className="text-sm text-slate-200">
              Los calendarios tradicionales fueron diseñados para una persona.
              Pero tu vida no es solo “tú”: es tu pareja, tu familia, tus
              amigos, tu equipo.
            </p>
            <p className="text-sm text-slate-300">
              SyncPlans pone{" "}
              <span className="font-semibold text-slate-50">
                una sola verdad en el centro
              </span>
              : si algo se cruza, todos lo ven, todos entienden qué pasa y nadie
              se entera tarde.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              {valueBullets.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Toggle conceptual / info de precios */}
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-700/80">
            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-950">
              Recomendado
            </span>
            <span>Plan anual: menos que tu café de la semana ☕</span>
          </div>
          <div className="text-xs text-slate-400 sm:text-sm">
            Precios en{" "}
            <span className="font-semibold text-slate-200">USD</span> · impuestos
            pueden variar según tu país
          </div>
        </section>

        {/* Cards de planes */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Plan Gratis */}
          <article className="relative flex flex-col rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-slate-950/40">
            <div className="mb-4 text-xs font-medium uppercase tracking-[0.25em] text-slate-500">
              Gratis
            </div>
            <h2 className="mb-2 text-lg font-semibold text-slate-50">
              Plan Básico
            </h2>
            <p className="mb-4 text-sm text-slate-300">
              Ideal para probar el concepto y coordinar los primeros planes con
              tu pareja o familia sin compromiso.
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

            <div className="mt-auto space-y-2">
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-900 transition"
              >
                Empezar gratis
              </Link>
              <p className="text-[11px] text-slate-400">
                Perfecto para ver si SyncPlans encaja en tu día a día antes de
                pensar en un plan pago.
              </p>
            </div>
          </article>

          {/* Plan Mensual */}
          <article className="relative flex flex-col rounded-3xl border border-rose-500/60 bg-gradient-to-b from-rose-600/20 via-slate-950/70 to-slate-950/95 p-5 shadow-lg shadow-rose-900/40 md:-mt-4 md:mb-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-medium uppercase tracking-[0.25em] text-rose-300">
                Premium
              </div>
              <div className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100">
                Más elegido
              </div>
            </div>
            <h2 className="mb-2 text-lg font-semibold text-rose-50">
              Plan Mensual
            </h2>
            <p className="mb-4 text-sm text-rose-50/80">
              Para parejas, familias y grupos que de verdad se coordinan todo
              por aquí y quieren paz con su agenda compartida.
            </p>

            <div className="mb-1 flex items-baseline gap-1">
              <span className="text-3xl font-semibold text-rose-50">
                US$4.90
              </span>
              <span className="text-xs text-rose-100/80">/ mes</span>
            </div>
            <p className="mb-4 text-xs text-rose-100/70">
              Menos que una hamburguesa al mes por reducir discusiones,
              malentendidos y planes duplicados.
            </p>

            <ul className="mb-6 space-y-2 text-sm text-rose-50/90">
              {featuresMonthly.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-rose-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-2">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-rose-500 px-3 py-2 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-900/40 hover:bg-rose-400 transition disabled:cursor-not-allowed disabled:opacity-80"
                disabled
              >
                Demo Premium activo
              </button>
              <p className="text-[11px] text-rose-100/70">
                Durante la beta no se te cobrará nada. Más adelante podrás
                decidir si activas este plan o te quedas en el Gratis.
              </p>
            </div>
          </article>

          {/* Plan Anual */}
          <article className="relative flex flex-col rounded-3xl border border-sky-500/40 bg-slate-900/75 p-5 shadow-md shadow-sky-900/40">
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
              Para los que ya saben que SyncPlans encaja en su vida y quieren
              pagar menos asegurando el precio fundador.
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
              Equivalente a menos de US$4.10 al mes. Descuento fundador
              asegurado mientras mantengas el plan activo.
            </p>

            <ul className="mb-6 space-y-2 text-sm text-sky-50/90">
              {featuresYearly.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-sky-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto space-y-2">
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-2xl border border-sky-500/60 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-sky-50 hover:bg-slate-950 transition disabled:cursor-not-allowed disabled:opacity-80"
                disabled
              >
                Disponible después de la beta
              </button>
              <p className="text-[11px] text-sky-100/70">
                Cuando lancemos oficialmente, este será el plan recomendado para
                parejas y familias que usan SyncPlans todos los días.
              </p>
            </div>
          </article>
        </section>

        {/* Sección: Para quién es esto */}
        <section className="space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
                ¿Para quién es SyncPlans?
              </h2>
              <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                No es una herramienta para “frikis de la productividad”. Es para
                personas normales que solo quieren menos fricción al coordinar
                con la gente que más les importa.
              </p>
            </div>
            <p className="text-xs text-slate-500 sm:text-sm">
              Puedes empezar con un solo grupo y, si funciona, sumar más.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {whoIsFor.map((item) => (
              <article
                key={item.title}
                className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm shadow-slate-950/40"
              >
                <h3 className="mb-2 text-sm font-semibold text-slate-100 sm:text-base">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-300">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Comparación conceptual WhatsApp / Calendario / SyncPlans */}
        <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-inner shadow-slate-950/60">
          <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
            ¿Por qué no basta con WhatsApp y un calendario normal?
          </h2>
          <p className="max-w-3xl text-sm text-slate-300 sm:text-base">
            WhatsApp es perfecto para conversar. Los calendarios clásicos son
            buenos para tu agenda personal. El problema es lo que queda en ese
            punto medio: los{" "}
            <span className="font-semibold text-slate-100">
              planes compartidos
            </span>{" "}
            que nadie ve completos.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-100">
                WhatsApp
              </h3>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                Chat / Conversación
              </p>
              <p className="text-sm text-slate-300">
                Todo se mezcla: memes, audios, links, fotos y planes. Algo
                importante se puede perder en el scroll infinito.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <h3 className="mb-1 text-sm font-semibold text-slate-100">
                Calendario clásico
              </h3>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                Agenda individual
              </p>
              <p className="text-sm text-slate-300">
                Está pensado para ti, no para todos. Si tu pareja o tus amigos
                no lo ven, el choque llega igual… solo que más tarde.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-600/20 via-slate-950/70 to-slate-950/90 p-4">
              <h3 className="mb-1 text-sm font-semibold text-emerald-50">
                SyncPlans
              </h3>
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-emerald-200/80">
                Centro de verdad compartida
              </p>
              <p className="text-sm text-emerald-50/90">
                Pone todos los planes compartidos en un mismo lugar, detecta
                choques entre personas y te obliga a decidir qué hacer antes de
                que haya dramas.
              </p>
            </div>
          </div>
        </section>

        {/* Sección: Por qué cobramos */}
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-center">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
              ¿Por qué hay un plan pago si ahora mismo es gratis?
            </h2>
            <p className="text-sm text-slate-300 sm:text-base">
              Porque SyncPlans está pensado para quedarse contigo años, no solo
              como “app de moda”. Un plan Premium permite:
            </p>
            <ul className="space-y-2 text-sm text-slate-200">
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>
                  Mantener servidores estables y seguros, sin depender de
                  publicidad invasiva.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>
                  Invertir en nuevas funciones que realmente reduzcan fricción
                  al coordinar (no solo “features bonitas”).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>
                  Asegurar que el producto no tenga que “vender tus datos” para
                  sobrevivir.
                </span>
              </li>
            </ul>
            <p className="text-sm text-slate-300">
              Durante la beta no hay decisión difícil: usas SyncPlans en modo
              Demo Premium, ves si encaja en tu vida y{" "}
              <span className="font-semibold text-slate-100">
                después decides
              </span>{" "}
              si te quedas en Gratis o activas Premium.
            </p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 text-sm text-slate-300 shadow-md shadow-slate-950/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
              DECISIÓN SIMPLE
            </p>
            <p className="mb-3 text-slate-100">
              Hoy: prueba sin riesgo. Mañana: decides con calma.
            </p>
            <p className="mb-3">
              No pedimos tarjeta para entrar. Solo queremos que experimentes cómo
              se siente tener un lugar claro donde todos vean lo mismo y los
              conflictos no te sorprendan a última hora.
            </p>
            <p>
              Si después de usarlo ves que te ahorra peleas, olvidos y
              malentendidos, el plan Premium costará menos que una salida al
              mes. Si no, siempre tendrás el plan Gratis.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-50 sm:text-2xl">
                Preguntas frecuentes
              </h2>
              <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
                Lo importante: no tienes que decidir hoy si pagar o no. Solo
                probar si SyncPlans reduce el ruido en tu vida compartida.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article
                key={item.q}
                className="rounded-3xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300"
              >
                <h3 className="mb-2 text-sm font-semibold text-slate-100 sm:text-base">
                  {item.q}
                </h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-4 rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-5 py-6 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-50 sm:text-xl">
                Empieza ahora y decide después.
              </h2>
              <p className="max-w-xl text-sm text-slate-300 sm:text-base">
                Crea tu cuenta, arma un grupo con tu pareja o familia y úsalo
                como si fuera tu centro de coordinación real por unas semanas.
                Si al final no sientes más claridad, simplemente te quedas con
                el plan Gratis.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-2xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-lg shadow-rose-900/40 hover:bg-rose-400 transition"
              >
                Crear cuenta y probar
              </Link>
              <p className="text-[11px] text-slate-500">
                Sin tarjeta. Sin letra chica. Solo ver si te da más paz con tus
                planes compartidos.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
