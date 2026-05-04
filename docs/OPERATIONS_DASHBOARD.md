# SyncPlans — Operations Dashboard Plan

Fecha: 2026-05-04

## Objetivo

Tener una vista operativa mínima para detectar incidentes sin leer logs crudos manualmente.

## MVP de paneles

1. Crons
   - Última ejecución.
   - Duración.
   - ok/fail.
   - processed/sent/failed.

2. Email
   - Emails enviados por día.
   - Fallos Resend.
   - Rate limited.

3. Google Sync
   - sync ok/fail.
   - refresh failures.
   - imported/fetched/calendars.
   - skipped informational events.

4. Maps
   - requests autocomplete/ETA.
   - provider failures.
   - 429/rate limit.
   - Redis mode.

5. Push
   - subscriptions.
   - test success/fail.
   - VAPID/env errors.

## Alertas mínimas

- Cron fail consecutivo.
- 5xx spike.
- Google token refresh fail spike.
- Resend failure spike.
- Maps provider/quota/rate limit spike.

## Proveedores posibles

- Vercel Logs / Observability.
- Better Stack / Logtail.
- Grafana Cloud.

## Criterio de cierre

Operador puede detectar incidente crítico en menos de 5 minutos usando requestId/code/event sin entrar al código.
