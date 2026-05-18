# SyncPlans Planes UI Fix

Cambio quirúrgico sobre `src/app/planes/page.tsx`.

## Qué cambia

- Reduce el texto largo de la pantalla de Planes.
- Muestra primero el plan actual y el estado beta.
- Convierte la explicación premium en beneficios concretos.
- Mantiene la comparación Free vs Premium, pero más compacta.
- Conserva tracking/analytics e intención de upgrade.
- No toca BottomNav, backend, RLS ni arquitectura.

## Validación

```powershell
npm run lint
npm run build
```
