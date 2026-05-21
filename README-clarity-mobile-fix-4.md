# SyncPlans clarity mobile fix 4

Objetivo: corregir el layout roto en celular de la pantalla de invitar y prevenir el mismo patrón en la pantalla de aceptar invitación.

## Archivos incluidos

- `src/app/groups/invite/GroupInviteClient.tsx`
- `src/app/invitations/accept/AcceptInviteClient.tsx`

## Qué corrige

1. En `/groups/invite`, las secciones de hero, formulario y explicación ya no quedan en dos columnas en mobile.
2. El título principal de invitación ya no se pisa ni genera overflow horizontal.
3. Los botones principales se apilan full width en celular.
4. Las cards internas usan `minWidth: 0`, `maxWidth: 100%` y `overflow: hidden` en modo compacto para evitar desplazamiento horizontal accidental.
5. En `/invitations/accept`, se aplica el mismo guard responsive porque tenía el mismo riesgo de columnas fijas en mobile.
6. Se elimina un `onClick` duplicado en el botón “Ver calendario” de `/invitations/accept`.

## Qué NO toca

- Supabase
- RLS
- Auth
- Google Calendar
- Smart Mobility
- Motor de conflictos
- Base de datos
- Rutas

## Validación recomendada

Después de aplicar:

```powershell
npm run lint
npm run build
```

Y probar en celular:

1. `/groups/invite?groupId=...`
2. `/invitations/accept?invite=...`
3. `/summary`
4. `/groups/new`
5. `/events`
6. `/conflicts/detected`

