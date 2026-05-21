# SyncPlans context copy fix 8

Ajuste quirúrgico de copy para lugares familiares detectados por Quick Capture.

## Cambios

- `en la casa de pepito` ahora queda como nota humana: `Contexto: en la casa de Pepito.`
- `donde papapa` queda como `Contexto: donde Papapa.`
- Se elimina el texto robótico `Casa/lugar familiar:`.
- La ubicación queda vacía cuando el texto parece contexto familiar y no una dirección/local real.

## Archivos

- `src/app/summary/SummaryClient.tsx`
- `src/app/events/new/details/NewEventDetailsClient.tsx`

No toca backend, Supabase, RLS, auth, Google Calendar, Smart Mobility ni conflictos.
