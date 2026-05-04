# Runbook — Cron jobs SyncPlans

## Jobs activos

| Job | URL | Frecuencia |
|---|---|---|
| Daily Reminders | `/api/cron/daily-reminders` | Diario 7:00 AM Lima |
| Weekly Summary | `/api/cron/weekly-summary` | Domingo 7:00 PM Lima |
| Leave Alerts | `/api/cron/leave-alerts?lookaheadMinutes=180` | Cada 15 minutos |

Todos usan:

```txt
Authorization: Bearer CRON_SECRET
```

No usar `?token=`, `?secret=` ni `x-cron-secret`.

## Síntomas comunes

### Cron devuelve 401

Buscar `code`:

```txt
CRON_UNAUTHORIZED
```

Pasos:
1. Revisar que cron-job.org tenga header `Authorization`.
2. Confirmar que el valor sea `Bearer <CRON_SECRET>`.
3. Confirmar que `CRON_SECRET` en Vercel coincide.
4. Redeploy si se cambió env.

### Cron devuelve 500

Buscar `requestId` en Vercel Logs.

Códigos frecuentes:
- `EMAIL_DAILY_DIGEST_FAILED`
- `EMAIL_WEEKLY_SUMMARY_FAILED`
- `CRON_LEAVE_ALERTS_FAILED`

Pasos:
1. Copiar `requestId` de la respuesta.
2. Buscar en Vercel Logs.
3. Revisar `durationMs`, `job`, `processed`, `sent`, `failed`.
4. Revisar envs de Resend/Maps/Supabase según job.

## Prueba rápida PowerShell

```powershell
$baseUrl = "https://syncplansapp.com"
$cronSecret = "TU_CRON_SECRET"

Invoke-WebRequest `
  -Uri "$baseUrl/api/cron/daily-reminders" `
  -Method GET `
  -Headers @{ "Authorization" = "Bearer $cronSecret" } `
  -UseBasicParsing
```

Resultado esperado: `200 OK` con `requestId` y `x-request-id`.

## Rollback temporal

Si un cron genera errores repetidos:
1. Desactivar temporalmente el job en cron-job.org.
2. No borrar el job.
3. Revisar logs por `requestId`.
4. Reactivar cuando el endpoint responda 200 manualmente.
