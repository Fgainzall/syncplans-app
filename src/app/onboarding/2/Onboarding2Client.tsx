// src/app/onboarding/2/Onboarding2Client.tsx
"use client";

import OnboardingStep from "../OnboardingStep";

export default function Onboarding2Client() {
  return (
    <OnboardingStep
      step={2}
      stepTitle="Cómo se usa"
      eyebrow="Funciona en tres pasos"
      title="Crea un espacio, invita y empieza a planear."
      subtitle="Cada espacio tiene sus miembros, planes e invitaciones. Así separas pareja, familia o cualquier grupo."
      body="El objetivo no es llenar otra agenda. Es que las personas correctas tengan el mismo contexto cuando toca coordinar."
      bullets={[
        {
          title: "1. Crea un espacio",
          body: "Puede ser para tu pareja, tu familia o un grupo específico.",
        },
        {
          title: "2. Invita a la otra persona",
          body: "Cuando acepta, ambos ven el mismo contexto y pueden coordinar desde ahí.",
        },
        {
          title: "3. Crea el primer plan compartido",
          body: "SyncPlans lo guarda en el espacio correcto y reduce la coordinación por mensajes.",
        },
      ]}
      preview={{
        eyebrow: "Flujo ideal",
        title: "De idea suelta a plan compartido",
        badge: "Ordenado",
        items: [
          {
            label: "Espacio",
            title: "Familia / Pareja / Grupo",
            body: "Cada contexto queda separado para no mezclar conversaciones ni planes.",
            tone: "violet",
          },
          {
            label: "Invitación",
            title: "La otra persona entra al mismo espacio",
            body: "Ya no dependes de que alguien revise un mensaje perdido.",
            tone: "cyan",
          },
          {
            label: "Plan",
            title: "Todos ven lo mismo",
            body: "Fecha, hora, lugar y próximos pasos quedan visibles para el grupo.",
            tone: "green",
          },
        ],
        footerTitle: "Para el usuario nuevo",
        footerBody: "Solo necesitas empezar con un espacio y una persona invitada.",
      }}
      primaryCta="Ver qué lo hace distinto"
      nextStep={3}
    />
  );
}
