# SyncPlans — Runbook Rate Limiting

Objetivo: proteger endpoints caros o públicos sin romper la experiencia normal.

## Endpoints cubiertos

| Endpoint | Límite base | Clave lógica |
|---|---:|---|
| `/api/maps/autocomplete` | 30/min | userId + IP |
| `/api/maps/route-eta` | 20/min | userId + IP |
| `/api/email/invite` | 5/min y 30/día | userId + IP + email / userId |
| `/api/public-invite/[token]` GET | 30/min | IP + token |
| `/api/public-invite/[token]` POST | 10/min | IP + token |
| `/api/google/sync` | 5/min | userId + IP |
| `/api/push/test` | 5/min | IP |

## Variables requeridas para protección distribuida

En producción configurar:

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Si faltan, el sistema cae a memoria local (`X-RateLimit-Mode: memory`). Eso sirve para desarrollo/QA, pero no protege globalmente en Vercel/serverless.

## Cómo reconocer un rate limit

Respuesta esperada:

```json
{
  "ok": false,
  "error": "Demasiadas solicitudes. Intenta nuevamente en unos segundos.",
  "code": "MAPS_RATE_LIMITED",
  "requestId": "req_...",
  "ts": "2026-05-04T12:00:00.000Z"
}
```

Headers útiles:

```txt
x-request-id: req_...
Retry-After: 30
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1770000000
X-RateLimit-Mode: redis|memory
```

## Diagnóstico rápido

1. Buscar `requestId` en Vercel Logs.
2. Revisar `code`:
   - `MAPS_RATE_LIMITED`
   - `EMAIL_INVITE_RATE_LIMITED`
   - `EMAIL_INVITE_DAILY_LIMITED`
   - `PUBLIC_INVITE_RATE_LIMITED`
   - `GOOGLE_SYNC_RATE_LIMITED`
   - `PUSH_TEST_RATE_LIMITED`
3. Revisar `X-RateLimit-Mode`:
   - `redis`: protección distribuida activa.
   - `memory`: fallback local; configurar Upstash antes de beta pública.

## Si usuarios legítimos chocan con límites

- Revisar si el frontend está haciendo loops o llamadas repetidas.
- Confirmar si hay reintentos automáticos sin backoff.
- Subir límites solo con evidencia.
- Priorizar caching/debounce antes que aumentar límites de Maps.

## Si hay abuso real

- Mantener límites.
- Revisar IP/userId/token en logs.
- Rotar tokens públicos comprometidos si aplica.
- Para Maps, revisar consumo en Google Cloud Console.
- Para email, revisar logs/reputación en Resend.

## Rollback temporal

- No desactivar rate limiting en código.
- Para recuperar operación en caso extremo, subir temporalmente límites en el endpoint afectado y redeploy.
- Si Upstash cae, el fallback memory permite continuidad, pero no es protección global.
