# SyncPlans — Group detail alignment fix

Cambio quirúrgico sobre `src/app/groups/[id]/page.tsx`.

Qué corrige:
- Quita `PremiumHeader` de la pantalla de detalle de grupo para evitar la mezcla visual `ACTIVO / Personal` con el estado real del grupo.
- Alinea el header local, la card principal y las secciones inferiores bajo un mismo sistema de ancho/padding.
- Elimina duplicación entre el hero superior y la card del grupo.
- Simplifica la jerarquía: volver, tipo/estado, nombre del grupo, métricas, acciones principales, miembros e invitaciones.
- Mantiene BottomNav, backend, RLS y arquitectura sin tocar.

Validación recomendada:
1. Abrir `/groups`.
2. Entrar al detalle de un grupo.
3. Confirmar que ya no aparece `Personal` arriba en una pantalla de grupo.
4. Confirmar que no hay textos montados ni cards desalineadas.
5. Probar `Crear plan`, `Invitar miembro`, `Ver miembros` y `Usar como activo`.
