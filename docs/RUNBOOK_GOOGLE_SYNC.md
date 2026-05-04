# Runbook — Google Calendar Sync

Objetivo: diagnosticar fallas de conexión, estado y sincronización de Google Calendar sin exponer tokens.

## Endpoints

- `GET /api/google/connect`
- `GET /api/google/callback`
- `GET /api/google/status`
- `POST /api/google/sync`
- `GET /api/integrations/google/list`

Todas las respuestas JSON instrumentadas incluyen:

```json
{
  "ok": false,
  "error": "Mensaje seguro",
  "code": "GOOGLE_TOKEN_REFRESH_FAILED",
  "requestId": "req_...",
  "ts": "2026-05-04T12:00:00.000Z"
}
```

Los redirects OAuth incluyen `x-request-id` en headers y, cuando aplica, `requestId` en la URL de retorno.

## Síntomas frecuentes

### Usuario ve Google desconectado

Códigos probables:
- `GOOGLE_NO_ACCOUNT`
- `GOOGLE_REAUTH_REQUIRED`
- `GOOGLE_STATUS_LOOKUP_FAILED`

Pasos:
1. Abrir `/api/google/status` estando logueado.
2. Confirmar `requestId`, `connection_state` y `code` si falla.
3. Revisar en Supabase si existe fila en `google_accounts` para el usuario.
4. Si falta `refresh_token`, pedir reconexión desde Panel.

### Sync no importa eventos

Códigos probables:
- `GOOGLE_SYNC_INVALID_SESSION`
- `GOOGLE_TOKEN_REFRESH_FAILED`
- `GOOGLE_SYNC_UPSERT_FAILED`
- `GOOGLE_SYNC_FAILED`

Pasos:
1. Buscar el `requestId` en Vercel Logs.
2. Revisar `providerStatus` y `providerCode`.
3. Si hay `GOOGLE_TOKEN_REFRESH_FAILED`, reconectar Google.
4. Si hay `GOOGLE_SYNC_UPSERT_FAILED`, revisar schema/constraints de `events`.
5. Confirmar que `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` estén en Vercel.

### Callback OAuth vuelve con error

Códigos/razones probables:
- `bad_state`
- `missing_code`
- `exchange_failed`
- `save_failed`
- `unexpected`

Pasos:
1. Reintentar desde `/api/google/connect` sin abrir múltiples pestañas simultáneas.
2. Verificar Redirect URI exacto en Google Cloud:
   - `https://syncplansapp.com/api/google/callback`
3. Buscar `requestId` en logs.
4. No loguear ni copiar access tokens ni refresh tokens.

## Checks de env

- `APP_URL=https://syncplansapp.com`
- `NEXT_PUBLIC_APP_URL=https://syncplansapp.com`
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Rollback temporal

Si Google sync falla pero la app funciona:
1. Ocultar CTA de sync manual si fuera necesario.
2. Mantener eventos internos funcionando.
3. Pedir reconexión Google solo al usuario afectado.

## Feriados/cumpleaños importados como conflictos

Síntomas:
- Aparecen conflictos con eventos como `Fiesta del Sol`, `Día del Campesino`, `Día de la Bandera`, `Domingo de Pascua`, cumpleaños o calendarios informativos.
- Los eventos aparecen “de la nada” después de conectar o sincronizar Google Calendar.

Causa probable:
- Google Calendar incluyó calendarios visibles de feriados/cumpleaños/contactos y se importaron como eventos normales.

Comportamiento esperado:
- SyncPlans debe saltarse calendarios informativos durante sync.
- SyncPlans debe limpiar eventos Google informativos ya importados cuando se vuelve a ejecutar sync.
- Los eventos Google informativos no deben aparecer en Summary/Calendar/Conflicts aunque sigan en BD hasta la próxima limpieza.

Pasos de verificación:
1. Ejecutar `/api/google/sync` desde sesión autenticada.
2. Confirmar respuesta con `skippedInformationalCalendars`, `skippedInformationalEvents` o `removedInformationalEvents`.
3. Volver a `/conflicts/detected`.
4. Confirmar que feriados/cumpleaños ya no aparezcan como conflictos accionables.
