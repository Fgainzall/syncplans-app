SyncPlans — Google Calendar invitados externos — Fase 1

Qué cambia:
1. El sync de Google Calendar ahora lee attendees del evento de Google.
2. Guarda un conteo mínimo en events.external_attendees_count.
3. Si un evento no tiene group_id, viene de Google y external_attendees_count > 0, la UI lo muestra como:
   Google · con invitados
4. Si un evento Google no tiene invitados, se mantiene como Personal.
5. No se toca RLS, auth, grupos ni permisos.
6. No se invita automáticamente a nadie.

IMPORTANTE antes de probar:
Ejecuta primero este SQL en Supabase SQL Editor:

db/migrations/004_google_external_attendees_count.sql

Luego aplica el ZIP, corre lint/build y vuelve a sincronizar Google Calendar desde la app.
Los eventos ya importados necesitan una nueva sincronización para rellenar external_attendees_count.

Validación esperada:
- Google sin invitados -> Personal
- Google con invitados -> Google · con invitados
- SyncPlans con group_id -> Pareja/Familia/Compartido/Nombre del grupo
