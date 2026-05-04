# SyncPlans — Load Test Plan

Fecha: 2026-05-04

## Objetivo

Validar resiliencia moderada de endpoints críticos bajo perfil beta realista sin quemar cuotas externas.

## Endpoints críticos

- `/api/public-invite/[token]`
- `/api/maps/autocomplete`
- `/api/maps/route-eta`
- `/api/google/sync`
- `/api/cron/daily-reminders`
- `/api/cron/weekly-summary`
- `/api/cron/leave-alerts`

## Perfil inicial

- 10 usuarios concurrentes.
- Pico corto: 5 minutos.
- Objetivo: validar rate limiting, errores controlados y p95.

## Métricas

- p95 latency.
- error rate.
- 429 rate.
- 5xx rate.
- costos externos observados.

## Herramientas recomendadas

- k6 para HTTP controlado.
- Vercel logs para requestId/error codes.
- Upstash dashboard para Redis calls/rate limit behavior.

## Criterio de cierre

- Happy-path error rate menor a 1–2%.
- 429 aparece solo cuando se excede cuota esperada.
- No hay spikes de 5xx.
- No hay consumo inesperado de Maps/Resend.
