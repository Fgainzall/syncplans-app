// src/app/onboarding/4/Onboarding4Client.tsx
"use client";

import OnboardingStep from "../OnboardingStep";

export default function Onboarding4Client() {
  return (
    <OnboardingStep
      step={4}
      stepTitle="Activa el producto"
      eyebrow="Tu primer paso real"
      title="Empieza con tu primer espacio compartido."
      subtitle="Invita a una persona y crea un plan. Ahí SyncPlans empieza a tener valor."
      body="Puedes empezar con pareja, familia o un grupo. Lo importante es llegar rápido al primer momento de coordinación real."
      bullets={[
        {
          title: "Crea el espacio",
          body: "Dale un contexto claro a los planes que van a coordinar.",
        },
        {
          title: "Invita a alguien",
          body: "SyncPlans funciona mejor cuando no estás coordinando solo.",
        },
        {
          title: "Crea el primer plan",
          body: "Ese primer plan compartido es el inicio del hábito.",
        },
      ]}
      preview={{
        eyebrow: "Meta del onboarding",
        title: "Llegar al primer uso real",
        badge: "Listo",
        items: [
          {
            label: "1",
            title: "Crear espacio",
            body: "Pareja, familia o grupo. Un lugar para coordinar juntos.",
            tone: "cyan",
          },
          {
            label: "2",
            title: "Invitar miembro",
            body: "La otra persona entra y ve el mismo contexto.",
            tone: "violet",
          },
          {
            label: "3",
            title: "Crear plan",
            body: "Empieza la coordinación compartida de verdad.",
            tone: "green",
          },
        ],
        footerTitle: "Lo importante",
        footerBody: "No es terminar pantallas. Es crear tu primer espacio y usarlo.",
      }}
      options={[
        {
          title: "Crear mi primer espacio",
          body: "Recomendado. Empieza con un espacio compartido e invita a una persona para coordinar juntos.",
          cta: "Crear espacio",
          target: "/groups/new",
          kind: "shared",
          featured: true,
        },
        {
          title: "Entrar solo por ahora",
          body: "Puedes explorar la app primero y crear tu espacio compartido después.",
          cta: "Entrar solo",
          target: "/summary",
          kind: "solo",
        },
      ]}
    />
  );
}
