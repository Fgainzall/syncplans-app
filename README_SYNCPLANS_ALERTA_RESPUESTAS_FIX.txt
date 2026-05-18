SyncPlans - Fix alerta de respuestas pendientes

Archivos modificados:
- src/app/panel/page.tsx
- src/app/events/EventsPageClient.tsx

Qué cambia:
1) La card del Panel deja de decir “respuesta esperando revisión”.
2) Ahora dice “Decisión pendiente” / “1 plan necesita revisión”.
3) El CTA pasa a “Revisar plan”.
4) El botón ya no manda a /events genérico: manda a /events?focus=pending-responses&focusEventId=<event_id>.
5) Eventos reconoce focus=pending-responses, muestra una alerta clara arriba y resalta/scroll al evento concreto.
6) Si el evento no aparece, muestra un mensaje honesto y permite volver al Panel.

Validación recomendada:
- npm run lint
- npm run build
- Abrir /panel con una respuesta externa pendiente.
- Click en “Revisar plan”.
- Debe abrir /events?focus=pending-responses&focusEventId=...
- Debe verse una card “Alerta abierta desde Panel” y el evento resaltado en la lista.
