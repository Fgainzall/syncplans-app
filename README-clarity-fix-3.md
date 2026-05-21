# SyncPlans clarity fix 3

Objetivo: mejorar claridad visual y jerarquía de `/summary` sin tocar backend, RLS, Supabase, auth, Google Calendar, Smart Mobility backend ni motor de conflictos.

## Cambios incluidos

- `/summary` usa mejor el ancho en desktop con layout de dos columnas:
  - columna principal: siguiente acción + creación rápida de evento.
  - columna secundaria: estado del día, movilidad, resumen y próximo plan.
- El CTA “Invitar ahora” ahora lleva directo a `/groups/invite?groupId=...` cuando existe un grupo activo o disponible, en vez de mandar genéricamente a `/groups`.
- Se reemplaza el copy ambiguo “Planéalo en una línea” por “Crear evento rápido”.
- El header desktop queda más compacto y las tabs superiores pierden peso visual sin cambiar nombres: Resumen, Calendario, Eventos, Conflictos, Panel, Grupos, Miembros e Invitaciones.
- No se cambian rutas, tablas, policies, RPCs ni lógica crítica.

## Validación recomendada

1. Aplicar ZIP.
2. Ejecutar `npm run lint`.
3. Ejecutar `npm run build`.
4. Probar `/summary` en desktop al 100%.
5. Probar `/summary` en mobile.
6. Con un usuario que tenga grupo pero no eventos compartidos, verificar que “Invitar ahora” abra la pantalla de invitar del grupo.
