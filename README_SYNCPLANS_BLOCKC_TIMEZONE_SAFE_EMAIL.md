# SyncPlans Bloque C — Timezone-safe event invite emails

## Objetivo
Evitar que los emails de invitaciones event-specific muestren la hora en UTC por accidente cuando corren en Vercel.

## Archivo tocado
- `src/app/api/email/invite/route.ts`

## Qué cambia
- El formatter de fecha/hora del email ahora usa `timeZone: "America/Lima"` explícitamente.
- El email muestra la hora del plan como `hora Perú`.
- Agrega una referencia en `Europe/Madrid` / `España peninsular` para evitar confusión en el caso internacional validado.
- Muestra rango de hora si existe `event.end`.
- No cambia el evento guardado, no toca RLS, no toca Google sync, no toca Calendar/Events/Summary.

## Por qué
Antes el email dependía del timezone del runtime. En Vercel puede caer en UTC, por eso un evento 11:30 Perú se veía como 4:30 p. m. en el correo.

## Validación esperada
Para un evento con `event_start = 2026-05-21 16:30:00+00`:
- Email debe mostrar `11:30 a. m. hora Perú`.
- Referencia España peninsular debe mostrar `6:30 p. m.` si corresponde a horario de verano en España.

## Comandos
```powershell
npm run lint
npm run build
```

## QA manual
1. Crear/usar un evento Google · con invitados.
2. Compartir este plan por email.
3. Revisar el email recibido.
4. Confirmar que no muestra 4:30 p. m. sin contexto.
5. Confirmar que muestra hora Perú y referencia España peninsular.
