// src/app/onboarding/1/Onboarding1Client.tsx
"use client";

import OnboardingStep from "../OnboardingStep";

export default function Onboarding1Client() {
  return (
    <OnboardingStep
      step={1}
      stepTitle="Entiende el problema"
      eyebrow="La idea en 5 segundos"
      title="Coordina planes sin depender del chat."
      subtitle="SyncPlans crea un espacio compartido para que todos vean la misma versión del plan."
      body="Cuando un plan vive entre mensajes, audios y memoria, aparecen confusiones: otra hora, otro día o alguien que nunca vio el cambio."
      bullets={[
        {
          title: "Un solo lugar para el plan",
          body: "Fecha, hora, personas y contexto quedan juntos. No repartidos en conversaciones.",
        },
        {
          title: "Menos ‘yo entendí otra cosa’",
          body: "Todos revisan la misma información antes de coordinar o cambiar algo.",
        },
        {
          title: "Pensado para pareja, familia o grupos",
          body: "Empiezas con un espacio compartido y luego creas planes dentro de ese contexto.",
        },
      ]}
      preview={{
        eyebrow: "Ejemplo simple",
        title: "El chat conversa. SyncPlans ordena.",
        badge: "Más claro",
        items: [
          {
            label: "En chat",
            title: "‘¿Era hoy o mañana?’",
            body: "La información queda mezclada con mensajes, audios y cambios sueltos.",
            tone: "amber",
          },
          {
            label: "En SyncPlans",
            title: "Cena · Viernes · 8:30 p. m.",
            body: "Todos ven la misma versión, con el grupo y el contexto correcto.",
            tone: "cyan",
          },
        ],
        footerTitle: "La diferencia real",
        footerBody: "No reemplaza tus calendarios. Ordena la coordinación compartida.",
      }}
      primaryCta="Ver cómo funciona"
      nextStep={2}
      allowSkip
      showLogin
    />
  );
}
