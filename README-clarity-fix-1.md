# SyncPlans Clarity Fix 1

Alcance seguro: cambios de UX/copy y flujo inicial. No toca RLS, Supabase policies, auth, Google Calendar backend, Smart Mobility backend ni motor de conflictos.

Cambios principales:
- Mantiene los nombres base: Eventos, Conflictos y Grupos.
- Simplifica la Home/Resumen para usuarios sin grupos: prioridad única = crear primer grupo compartido.
- Oculta módulos secundarios en primer uso sin grupos para reducir ruido cognitivo.
- Cambia “Quick Capture” por “Crear plan rápido” y “Capture completo” por “Abrir formulario completo”.
- Después de crear grupo, lleva a invitar antes de crear el primer evento compartido.
- En la pantalla de invitación, después de enviar una invitación aparece CTA para crear el primer evento.
- En /home, “Ver cómo funciona” baja a la sección explicativa en la misma landing en vez de mandar a onboarding operativo sin sesión.

Validación recomendada:
1. Expandir ZIP en la raíz del proyecto.
2. npm run lint
3. npm run build
4. Probar usuario nuevo sin grupos: /summary debe mostrar una sola tarjeta fuerte para crear grupo.
5. Crear grupo: debe redirigir a /groups/invite?groupId=...
6. Enviar invitación: debe aparecer “Crear primer evento”.
