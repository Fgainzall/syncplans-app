# SyncPlans — Environment Variables

Contrato operativo de variables de entorno para SyncPlans.

No guardar valores secretos en Git. Este documento solo define nombres, uso y criticidad.

## Core app

- NEXT_PUBLIC_APP_URL: URL publica del frontend. Requerida en produccion.
- APP_URL: URL server-side para emails, callbacks y redirects. Requerida en produccion.
- NEXT_PUBLIC_SUPABASE_URL: URL publica de Supabase. Requerida.
- NEXT_PUBLIC_SUPABASE_ANON_KEY: anon key de Supabase para cliente. Requerida.
- SUPABASE_SERVICE_ROLE_KEY: operaciones admin/server-side. Requerida en produccion.

## Cron y jobs

- CRON_SECRET: protege endpoints cron. Requerida en produccion.

Contrato unico de autenticacion cron:

```txt
Authorization: Bearer CRON_SECRET
```

No usar secretos en query params. Estos formatos quedan intencionalmente rechazados:

```txt
?token=CRON_SECRET
?secret=CRON_SECRET
x-cron-secret: CRON_SECRET
```

Endpoints cron relacionados:
- /api/cron/daily-reminders
- /api/cron/weekly-summary
- /api/cron/leave-alerts

Notas operativas:
- /api/cron/daily-reminders acepta opcionalmente `?date=YYYY-MM-DD` para pruebas controladas. El secreto debe seguir llegando por Authorization Bearer.
- /api/cron/leave-alerts acepta opcionalmente `?lookaheadMinutes=180`. El secreto debe seguir llegando por Authorization Bearer.
- /api/daily-digest GET queda reservado para cron con Authorization Bearer.
- /api/daily-digest POST mantiene compatibilidad para uso manual autenticado por usuario; si el Bearer coincide con CRON_SECRET, ejecuta el digest global.

Configuracion recomendada en cron-job.org:

```txt
URL: https://syncplansapp.com/api/cron/daily-reminders
Header: Authorization: Bearer <CRON_SECRET>

URL: https://syncplansapp.com/api/cron/weekly-summary
Header: Authorization: Bearer <CRON_SECRET>

URL: https://syncplansapp.com/api/cron/leave-alerts?lookaheadMinutes=180
Header: Authorization: Bearer <CRON_SECRET>
```

## Email / Resend

- RESEND_API_KEY: envio de emails. Requerida si emails estan activos.
- RESEND_FROM: remitente principal. Requerida si emails estan activos.
- EMAIL_FROM: alias/fallback de remitente. Mantener alineada con RESEND_FROM mientras exista compatibilidad.

## Google Calendar

- GOOGLE_OAUTH_CLIENT_ID: OAuth Google Calendar. Requerida si Google Calendar esta activo.
- GOOGLE_OAUTH_CLIENT_SECRET: OAuth Google Calendar. Requerida si Google Calendar esta activo.
- GOOGLE_CLIENT_ID: alias legacy/compatibilidad. Revisar hasta estandarizar.
- GOOGLE_CLIENT_SECRET: alias legacy/compatibilidad. Revisar hasta estandarizar.

## Google Maps / Smart Mobility

- GOOGLE_MAPS_API_KEY: autocomplete y route ETA. Requerida si Smart Mobility esta activo.

Endpoints relacionados:
- /api/maps/autocomplete
- /api/maps/route-eta

## Push notifications

- NEXT_PUBLIC_VAPID_PUBLIC_KEY: clave publica VAPID para navegador.
- VAPID_PRIVATE_KEY: clave privada VAPID server-side.
- VAPID_SUBJECT: identidad VAPID.
- PUSH_TEST_SECRET: protege endpoint de prueba push.

## Feature flags / debug

- NEXT_PUBLIC_ENABLE_PUSH_PROMPT: controla prompt de push.
- NEXT_PUBLIC_ENABLE_LOCATION_PROMPT: controla prompt de ubicacion.
- NEXT_PUBLIC_SYNCPLANS_TRACE: trazas/debug frontend. Debe estar apagado en produccion salvo debugging controlado.

## Checklist antes de beta

- [ ] NEXT_PUBLIC_APP_URL apunta a https://syncplansapp.com
- [ ] APP_URL apunta a https://syncplansapp.com
- [ ] NEXT_PUBLIC_SUPABASE_URL existe
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY existe
- [ ] SUPABASE_SERVICE_ROLE_KEY existe
- [ ] CRON_SECRET existe y coincide con los crons configurados
- [ ] RESEND_API_KEY existe si emails estan activos
- [ ] RESEND_FROM / EMAIL_FROM estan alineados
- [ ] GOOGLE_MAPS_API_KEY existe si Smart Mobility esta activo
- [ ] Google OAuth vars existen si Google Calendar esta activo
- [ ] VAPID vars existen si push esta activo
- [ ] NEXT_PUBLIC_SYNCPLANS_TRACE no esta activo en produccion salvo debugging

## Regla operativa

Toda nueva feature que dependa de una variable de entorno debe actualizar este documento en el mismo PR/commit.

Nunca commitear valores secretos.

## Rate limiting distribuido

Estas variables son recomendadas en producción para que los límites de abuso no dependan de memoria local de una instancia serverless:

- UPSTASH_REDIS_REST_URL: endpoint REST de Upstash Redis.
- UPSTASH_REDIS_REST_TOKEN: token REST de Upstash Redis.

Endpoints protegidos por este rate limit:
- /api/public-invite/[token]
- /api/email/invite
- /api/maps/autocomplete
- /api/maps/route-eta

Si estas variables no existen, el código usa fallback local en memoria para desarrollo/QA, pero no debe considerarse protección suficiente para abrir a más usuarios.

## Observabilidad operativa MVP

Las APIs críticas instrumentadas devuelven errores con este contrato:

```json
{
  "ok": false,
  "error": "Mensaje público seguro",
  "code": "CRON_UNAUTHORIZED",
  "requestId": "req_...",
  "ts": "2026-05-04T12:00:00.000Z"
}
```

También agregan header:

```txt
x-request-id: req_...
```

Si el cliente manda `x-request-id`, el servidor lo reutiliza cuando el formato es seguro. Si no, genera uno nuevo.

Logs estructurados:
- Usar JSON por línea en Vercel Logs.
- Buscar por `requestId` para correlacionar frontend/API/provider.
- No loguear tokens, cookies, API keys, service role key, `CRON_SECRET`, access tokens ni refresh tokens.
- Para emails, usar masking (`f***@dominio.com`) salvo necesidad explícita.

Docs operativas relacionadas:
- `docs/OPERATIONS_ERRORS.md`
- `docs/RUNBOOK_CRON.md`
- `docs/RUNBOOK_EMAIL.md`
- `docs/RUNBOOK_MAPS.md`

Runbooks adicionales para integraciones externas:
- `docs/RUNBOOK_GOOGLE_SYNC.md`
- `docs/RUNBOOK_PUSH.md`
