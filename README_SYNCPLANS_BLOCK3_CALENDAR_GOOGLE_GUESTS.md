# SyncPlans Block 3 — Calendar coherente con Google · con invitados

## Objetivo
Evitar que un evento importado desde Google Calendar con invitados externos vuelva a comportarse como un evento "Personal" dentro del calendario.

## Archivos tocados
- `src/app/calendar/CalendarClient.tsx`
- `src/app/calendar/day/CalendarDayClient.tsx`

## Qué cambia
1. `CalendarClient.tsx`
   - Importa `isGoogleEventWithExternalGuests` desde `src/lib/naming.ts`.
   - En el scope/filtro `Personal`, ahora excluye explícitamente eventos Google con invitados externos.
   - No cambia la carga de eventos, Google sync, RLS, eventos, grupos ni invitaciones.

2. `CalendarDayClient.tsx`
   - Conserva `external_source` y `external_attendees_count` al mapear eventos.
   - En el scope/filtro `Personal`, también excluye eventos Google con invitados externos.
   - Usa `getEventAudienceLabel` para que el label visible pueda decir `Google · con invitados`.

## Qué NO toca
- No toca SQL.
- No toca Supabase RLS.
- No toca `events_select_clean`.
- No toca event-specific invites.
- No toca Google sync.
- No rediseña Calendar.

## Validación manual
1. Crear o usar un evento de Google Calendar sin invitados.
   - Debe aparecer como `Personal`.
   - Debe aparecer en filtro `Personal`.

2. Crear o usar un evento de Google Calendar con al menos un invitado.
   - Debe aparecer como `Google · con invitados`.
   - Debe aparecer en `Todo`.
   - No debe aparecer como `Personal` cuando el filtro/scope es `Personal`.

3. Probar `/calendar`.
4. Probar `/calendar/day` si esa ruta sigue accesible.
5. Confirmar que eventos de pareja/familia/compartido no cambiaron.

## Comandos recomendados
```powershell
npm run lint
npm run build
```

Si todo está verde:

```powershell
git add src/app/calendar/CalendarClient.tsx src/app/calendar/day/CalendarDayClient.tsx README_SYNCPLANS_BLOCK3_CALENDAR_GOOGLE_GUESTS.md
git commit -m "Align calendar filters with Google guest events"
git push
```
