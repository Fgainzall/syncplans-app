SyncPlans pending alert final fix

Archivos modificados:
- src/app/panel/page.tsx
- src/app/events/EventsPageClient.tsx
- src/lib/invitationsDb.ts

Qué corrige:
1. Una aceptación normal ya no aparece como "decisión pendiente".
2. /events?focus=pending-responses valida si la alerta sigue activa antes de mostrarla.
3. Si la alerta ya fue cerrada o el plan ya fue aceptado, Eventos limpia la URL y deja de resaltar ese plan como pendiente.
4. La sección "Foco operativo" pasa a "Próximo plan" para no confundir cercanía con urgencia.
5. La bandeja de acción ya no cuenta un evento confirmado como acción abierta solo por ser próximo o compartido.

Aplicación:
Expand-Archive -Path "$env:USERPROFILE\Downloads\syncplans-pending-alert-final-fix.zip" -DestinationPath "." -Force
npm run lint
npm run build
