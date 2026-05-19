-- 024_validate_event_invite_audit_logger_hotfix.sql
-- Run after applying 024_fix_event_invite_audit_logger_search_path.sql.

-- 1) Manual insert test
select public.log_event_invite_audit(
  p_action => 'manual_audit_test',
  p_outcome => 'success',
  p_invite_id => null,
  p_event_id => null,
  p_actor_user_id => null,
  p_actor_email => null,
  p_invited_email => 'test@example.com',
  p_token => 'manual-test-token',
  p_error_code => null,
  p_request_id => 'manual-sql-editor-test',
  p_metadata => jsonb_build_object('source', 'manual_sql_test_after_hotfix')
);

-- 2) Confirm logs are being written
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
limit 20;

-- 3) Confirm internal logger is not executable by anon/authenticated/public
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('public', p.oid, 'EXECUTE') as public_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'log_event_invite_audit'
order by p.proname, arguments;
