-- 022_validate_event_invites_idempotency.sql
-- Ejecutar en Supabase SQL Editor después de aplicar la migración 022.
-- Objetivo: detectar si ya existen duplicados pendientes históricos y validar grants.

select
  event_id,
  lower(invited_email) as invited_email,
  status,
  count(*) as invites_count,
  min(created_at) as first_created_at,
  max(created_at) as last_created_at
from public.event_invites
where status = 'pending'
group by event_id, lower(invited_email), status
having count(*) > 1
order by last_created_at desc;

select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'create_event_invite'
order by p.proname;
