# SyncPlans — Summary conflict loading fix 5

## Objetivo
Evitar el flash falso en `/summary` donde aparece “Resuelve 1 conflicto” durante la carga inicial y luego desaparece cuando termina de reconciliar la data real.

## Causa
`useSummaryData` hacía un primer paint rápido con grupos/eventos y cargaba después, en segundo plano, resoluciones de conflictos, conflictos ignorados y respuestas. Durante ese intervalo, Summary podía calcular conflictos con datos incompletos y mostrar un falso positivo.

## Cambios
- `src/app/summary/useSummaryData.tsx`
  - Agrega `conflictDataReady`.
  - Lo pone en `false` durante cada refresh.
  - Solo lo pone en `true` cuando ya cargaron resoluciones, conflictos ignorados, declined events y responses.

- `src/app/summary/SummaryClient.tsx`
  - Oculta alerts/contadores de conflicto mientras `conflictDataReady` está en `false`.
  - Evita marcar eventos como conflictivos hasta que la data secundaria esté lista.
  - Mantiene el estado “Actualizando…” mientras el resumen se reconcilia.

## No toca
- RLS
- Supabase policies
- Auth
- Google Calendar
- Smart Mobility backend
- Motor real de conflictos
- Base de datos

## Validación
1. Abrir `/summary` en mobile.
2. Refrescar duro.
3. No debe aparecer “Resuelve 1 conflicto” si luego no hay conflicto real.
4. Si existe un conflicto real, debe aparecer después de terminar la carga.
5. Revisar `/conflicts/detected` para confirmar que la pantalla de conflictos sigue funcionando.
