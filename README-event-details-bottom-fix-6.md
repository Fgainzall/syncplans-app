# SyncPlans — Event Details Mobile Bottom Fix 6

Corrige el problema en mobile donde el botón final de guardar evento quedaba parcialmente tapado por la navegación inferior fija.

## Archivo tocado

- `src/app/events/new/details/NewEventDetailsClient.tsx`

## Cambios

- Aumenta el padding inferior real de la pantalla de creación/edición de evento.
- Usa `100dvh` para mejorar el cálculo de alto en navegadores móviles.
- Añade margen/scroll margin al footer de botones para que `Volver` y `Guardar` puedan quedar completamente visibles por encima del BottomNav.

## No toca

- Backend
- Supabase / RLS
- Auth
- Google Calendar
- Smart Mobility
- Motor de conflictos
- Lógica de guardado

## Validación sugerida

1. Abrir `/events/new/details` en celular.
2. Completar título, fecha, tipo de evento y notas.
3. Scrollear hasta el final.
4. Confirmar que los botones `Volver` y `Guardar plan` / `Guardar plan compartido` quedan completamente visibles sin tener que sostener el scroll.
5. Guardar un evento personal y uno de grupo.
