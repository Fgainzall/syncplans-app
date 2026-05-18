# SyncPlans — Planes compact UI fix

Cambio quirúrgico aplicado solo en:

- `src/app/planes/page.tsx`

## Qué corrige

- Elimina el `PremiumHeader` pesado de la pantalla de Planes.
- Evita la duplicación visual de “ACTIVO / Personal” arriba.
- Reduce texto y altura vertical.
- Corrige el problema de tarjetas estrechas donde “Completo” se partía en dos líneas.
- Reorganiza la pantalla en: encabezado compacto, plan actual, beneficios, comparación rápida y nota beta.
- Agrega padding inferior local para que el BottomNav no tape contenido.

## Qué NO toca

- Backend.
- Supabase.
- RLS.
- BottomNav global.
- Arquitectura.
