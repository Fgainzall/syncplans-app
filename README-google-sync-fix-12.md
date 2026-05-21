# syncplans-google-sync-fix-12

Fix quirúrgico para `/api/google/sync`.

## Qué cambia

- No toca RLS, auth, grupos, invitaciones, conflictos ni Google OAuth connect/callback.
- La sincronización ya no intenta guardar todos los eventos en un solo upsert gigante; guarda en lotes de 100.
- Si Google falla, el endpoint devuelve un error JSON más claro (`GOOGLE_SYNC_PROVIDER_FAILED` o `GOOGLE_REAUTH_REQUIRED`) en vez de caer en un 500 genérico.
- Si el problema viene de la tabla `events`, el error queda con pista clara: revisar columnas externas y el índice único usado por `onConflict`.
- Incluye una migración SQL aditiva para asegurar que `events` tenga lo que Google sync necesita.

## Archivos

- `src/app/api/google/sync/route.ts`
- `db/migrations/012_google_sync_events_hardening.sql`

## Validación

Después de aplicar el ZIP:

```powershell
npm run lint
npm run build
```

Si build pasa, corre la migración SQL en Supabase si aún no existe ese índice/columnas. Luego prueba desde `/calendar` con “Sincronizar ahora”.
