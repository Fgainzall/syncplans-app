# Runbook — Push Notifications

Objetivo: diagnosticar suscripción y pruebas de Web Push.

## Endpoints

- `POST /api/push/subscribe`
- `GET|POST /api/push/test`

## Contrato de error

```json
{
  "ok": false,
  "error": "Mensaje seguro",
  "code": "PUSH_TEST_UNAUTHORIZED",
  "requestId": "req_...",
  "ts": "2026-05-04T12:00:00.000Z"
}
```

## Síntomas frecuentes

### El usuario no recibe push

Códigos probables:
- `PUSH_NO_VALID_SUBSCRIPTIONS`
- `PUSH_SEND_FAILED`
- `PUSH_SUBSCRIPTION_INVALID`
- `PUSH_SUBSCRIPTION_SAVE_FAILED`

Pasos:
1. Confirmar permiso de notificaciones en navegador/sistema operativo.
2. Revisar que exista fila reciente en `push_subscriptions`.
3. Ejecutar `/api/push/test` con `PUSH_TEST_SECRET`.
4. Buscar `requestId` en Vercel Logs.
5. Si `PUSH_SEND_FAILED`, revisar `failures.statusCode` y re-suscribir.

### Push test da unauthorized

Código:
- `PUSH_TEST_UNAUTHORIZED`

Pasos:
1. Confirmar env `PUSH_TEST_SECRET` en Vercel.
2. Enviar uno de estos formatos:
   - Header `x-push-test-secret: <PUSH_TEST_SECRET>`
   - Header `Authorization: Bearer <PUSH_TEST_SECRET>`
   - Query `?secret=<PUSH_TEST_SECRET>` solo para pruebas manuales controladas.
3. No guardar el secreto en capturas públicas.

### Falta configuración VAPID

Código:
- `PUSH_ENV_MISSING`
- `PUSH_VAPID_SUBJECT_INVALID`

Pasos:
1. Revisar `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
2. Revisar `VAPID_PRIVATE_KEY`.
3. Revisar `VAPID_SUBJECT` con formato `mailto:` o `https://`.
4. Redeploy después de cambiar envs.

## Rollback temporal

Si push falla:
1. No bloquear creación de eventos.
2. Mantener notificaciones in-app.
3. Re-suscribir usuarios afectados desde settings/notificaciones.
