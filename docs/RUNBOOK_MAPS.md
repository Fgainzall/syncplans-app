# Runbook — Maps / Smart Mobility

## Endpoints

- `/api/maps/autocomplete`
- `/api/maps/route-eta`

Ambos requieren usuario autenticado y tienen rate limiting.

## Síntomas comunes

### Smart Mobility muestra error o no calcula ETA

1. Abrir DevTools → Network.
2. Filtrar por `maps`, `autocomplete` o `route-eta`.
3. Revisar status y copiar `requestId` de la respuesta o header `x-request-id`.
4. Buscar en Vercel Logs.

Códigos frecuentes:
- `AUTH_REQUIRED`: la sesión no llegó al endpoint.
- `MAPS_RATE_LIMITED`: exceso de uso temporal.
- `MAPS_INVALID_BODY`: payload inválido desde frontend.
- `MAPS_PROVIDER_FAILED`: Google Maps falló o rechazó.

## Verificaciones

- Usuario está logueado.
- Cookies/session llegan al endpoint.
- `GOOGLE_MAPS_API_KEY` existe en Vercel.
- Google Maps APIs requeridas están habilitadas.
- Cuotas/billing de Google Cloud OK.

## Rollback temporal

Si Maps falla globalmente:
1. Mantener app usable sin ETA.
2. Ocultar o degradar Smart Mobility en frontend si fuera necesario.
3. No abrir endpoints sin auth para “arreglar rápido”.
