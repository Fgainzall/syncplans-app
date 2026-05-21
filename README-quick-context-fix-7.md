# SyncPlans quick capture context fix 7

Cambios incluidos:

- Evita que frases familiares como “donde Papapa” terminen como Ubicación cuando no hay una dirección real.
- Ese contexto pasa a Notas como “Lugar/contexto: Donde Papapa.”
- Se elimina la sección de Templates sugeridos en la pantalla de crear evento.
- No toca backend, RLS, auth, Supabase, Google Calendar, Smart Mobility ni motor de conflictos.

Archivos tocados:

- src/app/summary/SummaryClient.tsx
- src/app/events/new/details/NewEventDetailsClient.tsx
