# SyncPlans — Service Role Review

Fecha: 2026-05-04

## Objetivo

Minimizar blast radius del `SUPABASE_SERVICE_ROLE_KEY`: mantenerlo solo donde sea estrictamente necesario y migrar rutas por usuario a cliente autenticado + RLS cuando sea viable.

## Inventario encontrado

| Archivo | Uso | Clase | Decisión | Comentario |
|---|---|---:|---|---|
| `src/app/api/cron/weekly-summary/route.ts` | Cron global; lee usuarios/settings/eventos y envía resumen | A | Mantener | Tarea backend global. Requiere acceso cross-user controlado por `CRON_SECRET`. |
| `src/app/api/daily-digest/route.ts` | Daily digest global/manual; envío Resend | A/B | Mantener por ahora | Cron global requiere admin. Revisar path manual para reducir alcance después. |
| `src/lib/travelReminders.ts` | Leave alerts globales | A | Mantener | Job backend global llamado por cron. |
| `src/app/api/google/sync/route.ts` | Lee/actualiza `google_accounts`, refresh token, upsert eventos externos | A controlada | Mantener por ahora | Endpoint exige sesión de usuario y opera scoped a `user.id`; tokens sensibles no deben exponerse al cliente. |
| `src/app/api/public-invite/[token]/route.ts` | Lookup por token público y DTO mínimo | A controlada | Mantener | Flujo público por token. Ya usa DTO mínimo, rate limit, observabilidad. |
| `src/app/api/push/test/route.ts` | Test admin de push subscriptions | A controlada | Mantener | Protegido por `PUSH_TEST_SECRET`; no es ruta usuario normal. |
| `src/app/api/user/location/route.ts` | Leer/escribir settings de ubicación del usuario | B | Migrar después de validar RLS | Es acción por usuario. Debe migrar a `createSupabaseUserClient(req)` cuando las policies de `user_settings` estén verificadas. |

## Clasificación

### Clase A — puede quedarse

- Crons globales: weekly summary, daily digest, leave alerts.
- Procesos backend con secretos externos: Google refresh token, push test admin.
- Token público controlado: public-invite, siempre con DTO mínimo y rate limit.

### Clase B — migrable

- `src/app/api/user/location/route.ts`.

Motivo: opera únicamente sobre `user_settings` del usuario autenticado. En principio debería poder usar RLS (`user_id = auth.uid()`), pero antes hay que verificar policies productivas.

## Guardrails nuevos recomendados

1. No crear `createClient(url, SUPABASE_SERVICE_ROLE_KEY)` ad-hoc en rutas nuevas.
2. Crear helper futuro:

```ts
getServiceRoleClient({ reason, requestId, endpoint })
```

3. Cada uso nuevo de service role debe documentar:
   - endpoint
   - tablas afectadas
   - por qué RLS no basta
   - controles compensatorios

## Próximo fix recomendado

Bloque 5A.1:

1. Ejecutar auditoría RLS de `user_settings` en producción.
2. Si existe policy segura `user_id = auth.uid()`, migrar `src/app/api/user/location/route.ts` a cliente autenticado.
3. Si no existe, crear migración RLS específica para `user_settings` antes de migrar.

## Criterio de cierre

- Inventario documentado.
- Rutas Clase A justificadas.
- Al menos una ruta Clase B migrada o bloqueada explícitamente por falta de policy.
