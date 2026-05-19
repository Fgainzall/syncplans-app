# SyncPlans — Bloque 5: Event-specific invite idempotency

## Objetivo
Evitar que compartir el mismo evento con el mismo correo cree múltiples invitaciones pendientes y múltiples links.

## Alcance
Este bloque solo reemplaza la función SQL `public.create_event_invite(uuid, text)`.

No toca:
- `events_select_clean`
- RLS principal de `events`
- `groups`
- `group_members`
- Google sync
- frontend
- modelo de event-specific participants

## Comportamiento nuevo

### Caso 1 — No existe invitación previa
Crea una nueva invitación pendiente igual que antes.

### Caso 2 — Ya existe una invitación pendiente para el mismo evento + correo
Devuelve la invitación pendiente existente. No crea otra.

### Caso 3 — La persona ya aceptó ese evento
No crea un link nuevo. Devuelve error claro:

`Esta persona ya tiene acceso a este plan.`

## Aplicación
1. Ejecutar en Supabase SQL Editor:
   `db/migrations/022_event_invites_idempotency.sql`

2. Validar con:
   `docs/sql/022_validate_event_invites_idempotency.sql`

## Resultado esperado de validación
La primera query debería devolver 0 filas si no hay duplicados históricos pendientes.

La segunda query debería mostrar:

- `anon_can_execute = false`
- `authenticated_can_execute = true`
- `public_can_execute = false`

## Prueba manual
1. Comparte un mismo evento Google con invitados con `correo@ejemplo.com`.
2. Guarda/copia el link generado.
3. Vuelve a compartir el mismo evento con el mismo correo.
4. Debe devolver el mismo link o, como mínimo, no crear otro registro pendiente.
5. Comparte el mismo evento con otro correo: sí debe crear otra invitación.
6. Si el primer correo ya aceptó, volver a invitarlo debe mostrar que esa persona ya tiene acceso.

## Motivo de producto
Esto reduce emails duplicados, links duplicados y confusión para usuarios reales.
