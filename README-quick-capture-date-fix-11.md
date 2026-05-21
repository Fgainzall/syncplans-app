# SyncPlans — Quick Capture date hardening fix 11

Corrige el caso donde Quick Capture seguía priorizando el sábado más cercano sobre el número de día escrito por el usuario.

Ejemplo protegido:

"Almuerzo familiar ... el sábado 30 a la 1:15 pm hasta las 4:45..."

Debe quedar:
- Inicio: 30/05/2026 13:15
- Fin: 30/05/2026 16:45
- No debe caer al 23/05/2026.

Archivos tocados:
- src/app/summary/SummaryClient.tsx
- src/app/events/new/details/NewEventDetailsClient.tsx

No toca backend, RLS, Supabase, auth, Google Calendar, Smart Mobility ni motor de conflictos.
