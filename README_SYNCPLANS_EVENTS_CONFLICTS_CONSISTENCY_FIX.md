# SyncPlans — Events / Conflicts consistency fix

## Qué corrige

La pantalla `/events` estaba mostrando "Hay choques por resolver" usando una lógica diferente a `/conflicts/detected`.

Antes:
- `/events` contaba choques con `buildConflictsByEventId(upcomingEvents)`.
- Ese conteo no consideraba bien conflictos ignorados ni resoluciones ya guardadas.
- Resultado visible: Eventos decía que había choques, pero Conflictos mostraba "Todo claro".

Ahora:
- `/events` usa el mismo motor de conflictos que `/conflicts/detected`:
  - `computeVisibleConflicts`
  - `filterIgnoredConflicts`
  - `getMyConflictResolutionsMap`
  - `getIgnoredConflictKeys`
  - `getConflictDecisionSnapshot`
- Si el conflicto ya fue resuelto o ignorado, `/events` ya no lo cuenta como pendiente.

## Alcance

Solo se toca:

- `src/app/events/EventsPageClient.tsx`

No se toca:
- Backend
- Supabase
- RLS
- BottomNav
- Diseño global
- Flujo de resolución de conflictos

## Validación esperada

1. Entrar a `/events`.
2. Revisar que el bloque "Hay choques por resolver" solo aparezca si `/conflicts/detected` también tiene choques pendientes.
3. Entrar a `/conflicts/detected`.
4. Si dice "Todo claro", entonces `/events` también debe dejar de mostrar alerta de choques.
5. Crear dos eventos realmente solapados.
6. Confirmar que `/events` muestra alerta y `/conflicts/detected` muestra el mismo conflicto.
7. Resolver o ignorar el choque.
8. Confirmar que la alerta desaparece también en `/events`.
