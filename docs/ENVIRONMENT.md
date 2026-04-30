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

Endpoints relacionados:
- /api/cron/daily-reminders
- /api/cron/weekly-summary
- /api/cron/leave-alerts
- /api/daily-digest

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
