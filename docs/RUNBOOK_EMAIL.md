# Runbook — Email / Resend

## Flujos cubiertos

- Invitaciones por email: `/api/email/invite`
- Daily reminders: `/api/cron/daily-reminders`
- Weekly summary: `/api/cron/weekly-summary`

## Síntomas comunes

### No llega una invitación

1. Revisar la respuesta del endpoint y copiar `requestId`.
2. Buscar `requestId` en Vercel Logs.
3. Revisar `code`.

Códigos frecuentes:
- `EMAIL_INVITE_FORBIDDEN`: el usuario no creó esa invitación.
- `EMAIL_INVITE_EMAIL_MISMATCH`: el email enviado no coincide con la invitación.
- `EMAIL_PROVIDER_REJECTED`: Resend rechazó el envío.
- `EMAIL_RESEND_API_KEY_MISSING`: falta env.
- `EMAIL_FROM_MISSING`: falta remitente.

### Daily/Weekly no envía correos

1. Abrir cron-job.org.
2. Revisar último run.
3. Si no fue 200, copiar `requestId`.
4. Buscar `EMAIL_DAILY_DIGEST_FAILED` o `EMAIL_WEEKLY_SUMMARY_FAILED`.
5. Verificar contadores `processed`, `sent`, `skipped`, `failed`.

## Verificaciones

- `RESEND_API_KEY` existe en Vercel.
- `EMAIL_FROM` o `RESEND_FROM` existe.
- Dominio de Resend está verified/sending ON.
- El usuario tiene email real.
- El usuario tiene `daily_summary` o `weekly_summary` activo según flujo.

## Rollback temporal

Si Resend falla globalmente:
1. Desactivar temporalmente cron de daily/weekly.
2. Mantener invitaciones si el problema no afecta `/api/email/invite`.
3. Revisar dashboard de Resend.
