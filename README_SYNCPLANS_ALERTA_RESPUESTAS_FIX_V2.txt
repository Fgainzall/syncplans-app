# SyncPlans - alerta de respuestas v2

Corrige dos problemas del fix anterior:

1. Eventos ya no queda forzado en "Todo visible" cuando entra desde /events?focus=pending-responses.
   Ahora los filtros vuelven a ser controlables por el usuario.

2. El Panel ya no trata una aceptación directa como "plan necesita revisión".
   La bandeja solo muestra respuestas realmente accionables: rechazo o propuesta de nueva fecha.

Archivos tocados:
- src/app/events/EventsPageClient.tsx
- src/lib/invitationsDb.ts
