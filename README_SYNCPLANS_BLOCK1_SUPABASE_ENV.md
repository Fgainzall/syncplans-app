# SyncPlans — Bloque 1: Supabase client env/build guard

## Qué cambia

Este bloque toca solo:

- `src/lib/supabaseClient.ts`

Antes, el archivo hacía `throw` en el import si faltaban:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Eso puede romper prerender/build por import temprano en rutas cliente o rutas que importan helpers cliente.

Ahora el cliente Supabase se inicializa de forma diferida:

- importar `supabase` ya no rompe el build inmediatamente;
- si una pantalla intenta usar Supabase sin env vars, se lanza un error claro en runtime;
- se conserva el default export `supabase`, así que no hay que tocar imports existentes.

## Qué NO cambia

- No toca DB.
- No toca RLS.
- No toca `events_select_clean`.
- No toca grupos.
- No toca event-specific invites.
- No cambia arquitectura.

## Validación recomendada

```powershell
cd "C:\Users\ASUS\Desktop\SyncPlans\syncplans-app"

Expand-Archive -Path "$env:USERPROFILE\Downloads\syncplans-block1-supabase-env-guard.zip" -DestinationPath "." -Force

npm run lint
npm run build
```

Luego probar manualmente:

- `/summary`
- `/calendar`
- `/calendar/day`
- `/events`
- `/event-invite/[token]` con un token real

## Variables que deben existir en Vercel

Production y Preview deberían tener:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `APP_URL=https://syncplansapp.com`
- `NEXT_PUBLIC_APP_URL=https://syncplansapp.com`

Este patch evita que un import temprano rompa el build, pero no reemplaza la necesidad de tener env vars reales en Vercel.
