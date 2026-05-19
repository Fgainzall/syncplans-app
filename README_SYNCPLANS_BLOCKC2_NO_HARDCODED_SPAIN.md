# SyncPlans Bloque C2 — Remove hardcoded Spain reference

## Objetivo
Eliminar la referencia fija a España peninsular en emails de event-specific invites.

## Por qué
El Bloque C corrigió el bug principal de UTC usando `timeZone: "America/Lima"`, pero agregó una referencia fija a `Europe/Madrid` por el caso probado con España. Eso no debe aplicarse a todos los invitados porque SyncPlans todavía no sabe de forma dinámica la zona horaria del invitado.

## Archivo tocado
- `src/app/api/email/invite/route.ts`

## Qué queda
- El correo muestra explícitamente la hora base de SyncPlans en Perú.
- Ya no muestra España peninsular salvo que en el futuro se implemente detección real de timezone del invitado.
- No toca SQL, RLS, Google sync, Calendar, Events, Summary ni arquitectura.

## Validación esperada
Para `event_start = 2026-05-21 16:30:00+00`, el email debe mostrar:
- `11:30 a. m. hora Perú`
- No debe mostrar `España peninsular`.

## Futuro premium
Más adelante, cuando tengamos `timezone` del invitado o del evento externo, podremos mostrar:
- Hora del creador
- Hora local del invitado
sin hardcodear países.
