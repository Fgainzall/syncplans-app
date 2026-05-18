# SyncPlans — Smart Mobility alert 1 hour before event

Cambio quirúrgico para `/api/cron/leave-alerts` y `src/lib/travelReminders.ts`.

## Qué cambia

- La alerta de Smart Mobility ahora usa como momento principal `event.start - 60 minutos`.
- Si el tráfico/ETA exige salir antes de esa hora, se mantiene una protección: alerta en la hora de salida calculada para no avisar tarde.
- Si el cron pierde la marca exacta de 1 hora, todavía puede alertar cerca de la hora de salida.
- Se reduce el lookahead máximo del cron a 15 minutos para evitar alertas demasiado tempranas aunque el endpoint reciba `lookaheadMinutes=180`.
- Se agrega al payload de la notificación `alert_time` y `alert_before_minutes: 60` para debug futuro.

## Archivos modificados

- `src/lib/travelReminders.ts`
- `src/app/api/cron/leave-alerts/route.ts`

## Qué NO cambia

- No toca Supabase/RLS.
- No toca diseño.
- No toca creación de eventos.
- No toca Google Maps/ETA.
- No toca BottomNav.

## Test recomendado

1. Crear evento con ubicación y Smart Mobility para 1 hora y 5-10 minutos en el futuro.
2. Ejecutar el cron manualmente cerca de la ventana:

```powershell
$headers = @{ Authorization = "Bearer TU_CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "https://syncplansapp.com/api/cron/leave-alerts" -Headers $headers
```

3. Confirmar que la notificación se crea cerca de 1 hora antes del evento, no varias horas antes.
