# SyncPlans Multi-day Quick Capture Fix

Este bloque hace que Quick Capture entienda rangos tipo:

- Alexandra en Lima del 15 de agosto al 3 de septiembre
- Viaje a Cusco del 15 al 20 de agosto
- Alexandra en Lima desde el 15/08/2026 hasta el 03/09/2026

Cambios:
- quickCaptureParser ahora devuelve endDate cuando detecta un rango.
- Summary pasa end_date al formulario de creación.
- NewEventDetailsClient hidrata inicio y fin reales desde Quick Capture.
- UI muestra “Evento de varios días” y duración por días, no cientos de horas.

No toca RLS, base de datos ni arquitectura.
