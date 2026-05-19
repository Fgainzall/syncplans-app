-- 023_validate_event_invite_audit_logs.sql
-- Valida tabla, permisos y últimos logs de event-specific invites.

select
  to_regclass('public.event_invite_audit_logs') as audit_table_exists,
  to_regprocedure('public.log_event_invite_audit(text,text,uuid,uuid,uuid,text,text,text,text,text,jsonb)') as internal_log_function_exists,
  to_regprocedure('public.log_event_invite_email_result(uuid,text,text,text,text,jsonb)') as email_log_function_exists;

select
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
    'get_event_invite_preview',
    'get_my_event_participant_events',
    'log_event_invite_email_result',
    'log_event_invite_audit'
  )
order by p.proname;

select
  action,
  outcome,
  count(*) as logs_count,
  max(created_at) as last_seen_at
from public.event_invite_audit_logs
group by action, outcome
order by last_seen_at desc nulls last, action asc;

select
  created_at,
  action,
  outcome,
  error_code,
  invite_id,
  event_id,
  actor_user_id,
  invited_email_masked,
  actor_email_masked,
  request_id,
  metadata
from public.event_invite_audit_logs
order by created_at desc
limit 25;
