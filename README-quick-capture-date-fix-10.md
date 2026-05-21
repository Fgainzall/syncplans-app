# SyncPlans — Quick Capture Date Fix 10

Este fix corrige un caso detectado en Quick Capture:

- Texto: `... el sábado 30 a la 1:15 pm hasta las 4:45 ...`
- Antes: podía tomar el sábado más cercano, por ejemplo 23/05, ignorando el número explícito `30`.
- Ahora: cuando el usuario escribe día de semana + número de día, SyncPlans prioriza el número explícito y mantiene la hora/duración correcta.

Archivo tocado:

- `src/app/summary/SummaryClient.tsx`

No toca backend, RLS, Supabase, Auth, Google Calendar, Smart Mobility ni motor de conflictos.
