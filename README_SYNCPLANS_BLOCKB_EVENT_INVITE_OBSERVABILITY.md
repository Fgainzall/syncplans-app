# SyncPlans Bloque B — Event Invite Observability

## Objetivo

Agregar trazabilidad silenciosa al flujo de event-specific invites sin cambiar arquitectura, UX, RLS principal ni `events_select_clean`.

## Qué registra

- Creación de invitación específica.
- Reutilización de invitación pending.
- Bloqueo si la persona ya aceptó.
- Preview público por token.
- Token inválido o inexistente.
- Aceptación correcta.
- Aceptación con correo equivocado.
- Invitación ya aceptada / no pendiente.
- Resultado del email: enviado, fallido, mismatch, no pending, config fail, provider fail.

## Seguridad

- No guarda tokens crudos.
- Guarda `token_hash` con SHA-256.
- No guarda emails completos; guarda emails enmascarados.
- La tabla tiene RLS activado y no tiene acceso directo para `anon` ni `authenticated`.
- El logging está protegido con `exception when others then null`; si falla el log, no debe fallar el flujo principal.

## Archivos tocados

- `db/migrations/023_event_invite_audit_logs.sql`
- `docs/sql/023_validate_event_invite_audit_logs.sql`
- `src/app/api/email/invite/route.ts`

## Qué NO toca

- `events_select_clean`
- RLS principal de `events`
- Grupos
- `group_members`
- Google Calendar sync
- Calendar / Events / Summary UI
- Fast Launch

## Validación esperada

Después de ejecutar la migración y correr el SQL de validación:

- `create_event_invite`: anon=false, authenticated=true, public=false
- `accept_event_invite`: anon=false, authenticated=true, public=false
- `get_my_event_participant_events`: anon=false, authenticated=true, public=false
- `get_event_invite_preview`: anon=true, authenticated=true, public=false
- `log_event_invite_email_result`: anon=false, authenticated=true, public=false
- `log_event_invite_audit`: anon=false, authenticated=false, public=false

Luego probar manualmente:

1. Crear invitación event-specific.
2. Abrir link en incógnito para preview.
3. Aceptar con el correo correcto.
4. Intentar aceptar con correo incorrecto.
5. Enviar email correctamente o forzar error de Resend.
6. Revisar `event_invite_audit_logs` con el SQL de validación.
