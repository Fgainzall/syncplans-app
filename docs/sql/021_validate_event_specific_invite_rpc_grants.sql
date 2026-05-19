-- 021_validate_event_specific_invite_rpc_grants.sql
-- Consulta de validacion manual para revisar permisos de ejecucion de las RPCs event-specific invite.
-- Ejecutar en Supabase SQL Editor despues de aplicar la migracion 021.

select
  n.nspname as schema,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_event_invite',
    'accept_event_invite',
    'get_my_event_participant_events',
    'get_event_invite_preview'
  )
order by p.proname;

-- Resultado esperado:
-- create_event_invite: anon=false, authenticated=true, public=false
-- accept_event_invite: anon=false, authenticated=true, public=false
-- get_my_event_participant_events: anon=false, authenticated=true, public=false
-- get_event_invite_preview: anon=true, authenticated=true, public=false
