// src/app/onboarding/3/Onboarding3Client.tsx
"use client";

import OnboardingStep from "../OnboardingStep";

export default function Onboarding3Client() {
  return (
    <OnboardingStep
      step={3}
      stepTitle="Por qué ayuda"
      eyebrow="La parte inteligente"
      title="Si un plan choca, SyncPlans te lo muestra antes."
      subtitle="No solo guardas eventos. Comparas, decides y mantienes una sola versión compartida."
      body="Cuando dos planes se cruzan, el problema aparece claro: qué se pisa, con quién y qué puedes hacer para resolverlo."
      bullets={[
        {
          title: "Detecta choques de horario",
          body: "Ves el conflicto antes de que se vuelva una discusión o un olvido.",
        },
        {
          title: "Te ayuda a decidir",
          body: "Puedes conservar uno, ajustar después o mantener claridad sobre lo pendiente.",
        },
        {
          title: "Mantiene a todos alineados",
          body: "Los cambios importantes se entienden desde el mismo lugar.",
        },
      ]}
      preview={{
        eyebrow: "Diferencia real",
        title: "Más coordinación, menos fricción",
        badge: "Choque visible",
        items: [
          {
            label: "Plan 1",
            title: "Cena · 8:00 p. m.",
            body: "Plan compartido con contexto y personas involucradas.",
            tone: "cyan",
          },
          {
            label: "Plan 2",
            title: "Salida · 8:30 p. m.",
            body: "SyncPlans detecta que los horarios se pisan.",
            tone: "amber",
          },
          {
            label: "Decisión",
            title: "Comparar y resolver",
            body: "El foco pasa de discutir a decidir qué hacer con claridad.",
            tone: "green",
          },
        ],
        footerTitle: "No es solo calendario",
        footerBody: "Es una capa para coordinar planes compartidos con menos ruido.",
      }}
      primaryCta="Empezar ahora"
      nextStep={4}
    />
  );
}
