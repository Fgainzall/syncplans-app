# SyncPlans - Group Detail UI Fix

Cambio quirúrgico aplicado solo a:

- `src/app/groups/[id]/page.tsx`

Objetivo:

- Corregir la pantalla rota de detalle de grupo en mobile.
- Evitar textos montados.
- Simplificar la jerarquía visual.
- Mostrar mejor miembros, rol, estado y acciones principales.
- Mantener BottomNav sin tocar.
- No tocar RLS, backend, Supabase ni arquitectura.

Validación recomendada:

```powershell
npm run lint
npm run build
```

Luego probar en mobile:

1. Entrar a Grupos.
2. Abrir un grupo.
3. Revisar que el hero no se monte.
4. Probar Crear plan.
5. Probar Invitar miembro.
6. Probar Ver miembros.
7. Probar Usar como activo si el grupo no está activo.
```
