# SyncPlans — Bloque D: Fix mobile layout crear grupo

## Objetivo
Corregir la pantalla `/groups/new` en mobile para que no se monte el texto, no haya overflow horizontal y el BottomNav no tape la experiencia de creación de grupo.

## Alcance
Este bloque toca solo frontend/layout:

- `src/app/groups/new/page.tsx`

No toca SQL, RLS, eventos, invitaciones, Google Calendar, permisos ni arquitectura.

## Cambios
- Agrega detección mobile con `matchMedia('(max-width: 760px)')`.
- En mobile, cambia el layout principal a una sola columna.
- Apila las tarjetas de tipo de grupo verticalmente.
- Quita el `sticky` del panel lateral en mobile.
- Reduce tamaños/paddings para iPhone.
- Agrega bottom padding suficiente para que el BottomNav no tape el contenido.
- Fuerza wrapping seguro de textos largos.

## QA manual
En iPhone o responsive:

1. Entrar a `/groups/new`.
2. Validar que no haya texto montado.
3. Validar que no haya scroll horizontal.
4. Validar que las tarjetas Pareja/Familia/Compartido aparezcan una debajo de la otra.
5. Validar que el panel “Por qué importa” quede debajo del formulario.
6. Validar que los botones se puedan tocar sin que el BottomNav los tape.
7. Crear un grupo y verificar que redirige al primer plan compartido.

## Validación técnica

```powershell
npm run lint
npm run build
```
