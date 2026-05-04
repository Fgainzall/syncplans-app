# SyncPlans — Catálogo operativo de errores

Este documento define códigos estables para operar APIs críticas. El objetivo es poder buscar por `code` y `requestId` en Vercel Logs sin exponer secretos.

## Contrato estándar de error

```json
{
  "ok": false,
  "error": "Mensaje público seguro",
  "code": "GOOGLE_SYNC_REFRESH_FAILED",
  "requestId": "req_...",
  "ts": "2026-05-04T12:00:00.000Z"
}
```

Reglas:
- `error`: mensaje legible y seguro. No incluir stack traces, SQL raw, tokens ni secretos.
- `code`: string estable para runbooks, dashboards y búsqueda en logs.
- `requestId`: correlación entre respuesta, navegador, cron-job.org y Vercel Logs.
- `ts`: timestamp UTC.

## Headers operativos

Toda respuesta instrumentada debe incluir:

```txt
x-request-id: req_...
Cache-Control: no-store
```

Si el cliente manda `x-request-id`, el servidor lo reutiliza cuando tiene formato seguro. Si no, genera uno nuevo.

## Logs estructurados

Formato recomendado:

```json
{
  "level": "warn",
  "event": "api.request.failed",
  "ts": "2026-05-04T12:00:00.000Z",
  "requestId": "req_...",
  "endpoint": "/api/maps/route-eta",
  "method": "POST",
  "code": "MAPS_PROVIDER_FAILED",
  "status": 502,
  "durationMs": 328
}
```

Nunca loguear:
- `CRON_SECRET`
- access tokens / refresh tokens
- API keys
- cookies
- service role key
- payloads completos sensibles
- emails completos cuando no sea estrictamente necesario

Usar `maskEmail()` para correos si hace falta.

## CRON_*

| Code | Significado | Acción inicial |
|---|---|---|
| `CRON_UNAUTHORIZED` | Falta o no coincide `Authorization: Bearer CRON_SECRET`. | Revisar header en cron-job.org y env `CRON_SECRET` en Vercel. |
| `CRON_SECRET_MISSING` | No existe `CRON_SECRET` en runtime. | Configurar env en Vercel y redeploy. |
| `INVALID_CRON_DATE` | `date` no cumple `YYYY-MM-DD`. | Corregir query param de prueba. |
| `CRON_DAILY_REMINDERS_FAILED` | Falló wrapper cron de daily reminders. | Buscar `requestId`, revisar `EMAIL_DAILY_DIGEST_FAILED`. |
| `CRON_LEAVE_ALERTS_FAILED` | Falló job de leave alerts. | Buscar `requestId`, revisar Google Maps/env y travel reminders. |

## EMAIL_*

| Code | Significado | Acción inicial |
|---|---|---|
| `EMAIL_INVALID_INVITE_REQUEST` | Body inválido para envío de invitación. | Revisar caller frontend. |
| `EMAIL_INVITE_RATE_LIMITED` | Rate limit corto de invitaciones. | Esperar ventana o revisar abuso. |
| `EMAIL_INVITE_DAILY_LIMITED` | Límite diario por usuario. | Revisar abuso o subir límite con cuidado. |
| `EMAIL_INVITE_LOOKUP_FAILED` | Falló lectura de invitación. | Revisar Supabase/RLS/logs. |
| `EMAIL_INVITE_NOT_FOUND` | Invitación no existe o no es visible. | Revisar `inviteId`. |
| `EMAIL_INVITE_FORBIDDEN` | Usuario no creó esa invitación. | Revisar permisos y caller. |
| `EMAIL_INVITE_EMAIL_MISMATCH` | Email de body no coincide con la invitación. | Revisar payload. |
| `EMAIL_INVITE_NOT_PENDING` | Invitación ya usada/cerrada. | No reenviar o crear una nueva. |
| `EMAIL_RESEND_API_KEY_MISSING` | Falta `RESEND_API_KEY`. | Configurar env. |
| `EMAIL_FROM_MISSING` | Falta remitente `EMAIL_FROM`/`RESEND_FROM`. | Configurar env. |
| `EMAIL_PROVIDER_REJECTED` | Resend rechazó el envío. | Revisar dominio, reputación, payload y logs de Resend. |
| `EMAIL_DAILY_DIGEST_FAILED` | Falló digest diario global. | Buscar `requestId`, revisar Resend/Supabase. |
| `EMAIL_WEEKLY_SUMMARY_FAILED` | Falló resumen semanal global. | Buscar `requestId`, revisar Resend/Supabase. |
| `EMAIL_MANUAL_DIGEST_FAILED` | Falló digest manual. | Revisar usuario y email. |

## MAPS_*

| Code | Significado | Acción inicial |
|---|---|---|
| `MAPS_RATE_LIMITED` | Usuario/IP excedió límite. | Esperar ventana o revisar abuso. |
| `MAPS_INVALID_BODY` | JSON inválido o payload grande. | Revisar caller frontend. |
| `MAPS_PROVIDER_FAILED` | Falló Google Maps u otro proveedor. | Revisar `GOOGLE_MAPS_API_KEY`, cuotas y status provider. |

## PUBLIC_INVITE_*

| Code | Significado | Acción inicial |
|---|---|---|
| `PUBLIC_INVITE_INVALID_TOKEN` | Token inválido o no encontrado. | Revisar link compartido. |
| `PUBLIC_INVITE_RATE_LIMITED` | Demasiados intentos. | Esperar o revisar abuso. |
| `PUBLIC_INVITE_LOAD_FAILED` | Falló carga desde Supabase. | Revisar service role/env/logs. |
| `PUBLIC_INVITE_TOKEN_USED` | Link ya fue usado. | Crear nuevo link si aplica. |
| `PUBLIC_INVITE_TOKEN_EXPIRED` | Link expiró. | Crear nuevo link. |
| `PUBLIC_INVITE_INVALID_STATUS` | Status de respuesta inválido. | Revisar caller público. |
| `PUBLIC_INVITE_INVALID_PROPOSED_DATE` | Fecha propuesta inválida. | Revisar input. |
| `PUBLIC_INVITE_UPDATE_FAILED` | No se pudo guardar respuesta pública. | Revisar Supabase/logs. |
| `PUBLIC_INVITE_GET_FAILED` | Error inesperado en GET. | Buscar `requestId`. |
| `PUBLIC_INVITE_POST_FAILED` | Error inesperado en POST. | Buscar `requestId`. |

## PUSH_* y GOOGLE_*

Estos dominios se instrumentan en el Bloque 3B.
