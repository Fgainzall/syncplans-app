# SyncPlans — Bloque A1 Fast Launch / Premium Navigation

Objetivo: que la app se sienta más rápida y premium al abrir y al cambiar de pestañas, sin tocar DB, RLS, Supabase policies, Google sync ni arquitectura.

## Archivos tocados

- `src/components/AppLaunchSplash.tsx`
- `src/app/summary/useSummaryData.tsx`
- `src/app/summary/SummaryClient.tsx`
- `src/app/events/EventsPageClient.tsx`
- `src/app/calendar/CalendarClient.tsx`

## Cambios

1. Splash global más corto y genérico: ya no dice “Preparando tu resumen”.
2. Guard en memoria + sessionStorage para evitar que el splash aparezca en navegación interna.
3. Warm cache en Summary: al volver a Resumen, muestra datos recientes inmediatamente y refresca silenciosamente.
4. Warm cache en Events: al volver a Eventos, evita pantalla de carga grande si ya había datos recientes.
5. Warm cache en Calendar: al volver a Calendario, evita loader inicial si hay datos recientes.
6. Refresh en Events con guard de 12s para focus/visibilitychange, evitando cargas repetitivas al cambiar pestañas.
7. Smart Mobility sigue diferido y no bloquea el primer render.

## Qué NO toca

- SQL
- RLS
- `events_select_clean`
- invitaciones
- grupos
- Google sync backend
- emails
- conflictos

## Validación

```powershell
npm run lint
npm run build
```

Luego probar en móvil/PWA:

1. Abrir app desde ícono.
2. Entrar a Resumen.
3. Cambiar Resumen → Calendario → Eventos → Resumen.
4. Confirmar que no aparece “Preparando tu resumen” al cambiar tabs.
5. Confirmar que las pestañas abren con datos recientes primero y refrescan sin pantalla pesada.
6. Crear/editar evento y confirmar que el refresh por `sp:events-changed` sigue funcionando.
