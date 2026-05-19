# SyncPlans Block 4 — Event-specific invite read-only UX

## Objetivo

Alinear la experiencia de los eventos compartidos por invitación específica con el modelo de permisos real:

- El invitado ve solo ese evento.
- El invitado no debe sentir que puede editar, borrar o controlar el plan.
- El creador mantiene sus acciones normales.
- No se toca SQL, RLS, `events_select_clean`, grupos ni Google sync.

## Archivos tocados

- `src/lib/eventsDb.ts`
- `src/components/eventsTimelineHelpers.tsx`
- `src/components/EventTimelineCard.tsx`

## Cambio técnico

`getMyEventParticipantEvents()` ahora marca los eventos traídos por la RPC `get_my_event_participant_events()` con:

```ts
visibility_source: "event_participant"
```

Luego la tarjeta de eventos usa esa señal para mostrar el evento como acceso puntual de solo lectura cuando el usuario actual no es owner.

## Cambio de UX

Para el invitado event-specific:

- Se desactiva el checkbox de selección.
- Se oculta el acceso de edición (`Abrir` hacia `/events/new/details`).
- Se muestra `Solo este plan`.
- Se muestra badge `Acceso puntual · solo lectura`.
- El estado dice que el evento fue compartido solo como evento puntual, sin acceso al calendario completo ni permisos de edición.

## Qué no cambia

- No cambia la visibilidad real de datos.
- No abre permisos nuevos.
- No toca `events_select_clean`.
- No cambia el flujo de aceptar invitación.
- No cambia la forma en que el creador comparte el plan.

## Validación manual

1. Creador crea/importa un Google event con invitados.
2. Creador comparte ese plan con otra cuenta.
3. Invitado acepta desde `/event-invite/[token]`.
4. Invitado entra a `/events`.
5. El evento debe verse como solo lectura.
6. El invitado no debe ver botón de editar ni eliminar.
7. El invitado no debe poder seleccionar ese evento para eliminar selección.
8. El creador sí debe seguir viendo sus acciones normales.

## Comandos

```powershell
npm run lint
npm run build
```
