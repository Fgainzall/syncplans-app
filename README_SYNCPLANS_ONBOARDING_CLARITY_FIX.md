# SyncPlans — Onboarding clarity fix

Cambio quirúrgico de onboarding enfocado en comprensión y activación.

## Qué cambia

- Reduce texto y repetición entre pantallas.
- Mantiene look premium: fondo oscuro, cards, gradientes y jerarquía visual.
- Explica SyncPlans en lenguaje más simple:
  - crea un espacio compartido,
  - invita a alguien,
  - crea planes,
  - evita confusiones y detecta choques.
- Reestructura el flujo:
  1. Problema: coordinar por chat genera confusión.
  2. Funcionamiento: crear espacio, invitar y planear.
  3. Diferencia: detectar choques y ayudar a decidir.
  4. Activación: crear primer espacio o entrar solo.
- Agrega `src/app/onboarding/OnboardingStep.tsx` para centralizar layout y reducir duplicación.

## Qué NO toca

- No toca Supabase/RLS.
- No toca auth.
- No toca BottomNav.
- No toca grupos ni eventos.
- No cambia la lógica de analytics, solo mantiene eventos existentes con metadata actualizada.

## Validación sugerida

```powershell
npm run lint
npm run build
```

Luego probar:

- `/onboarding/1`
- `/onboarding/2`
- `/onboarding/3`
- `/onboarding/4`

En mobile revisar que:

- cada pantalla se entienda en menos de 5 segundos,
- los CTA sean claros,
- no haya textos montados,
- la última pantalla empuje a crear espacio.
