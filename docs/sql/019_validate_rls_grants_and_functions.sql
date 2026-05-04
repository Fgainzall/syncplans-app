-- 019_validate_rls_grants_and_functions.sql
-- SyncPlans validation after 019_harden_rls_grants_and_functions.sql
-- Read-only.

with authenticated_dangerous_grants as (
  select
    '01_authenticated_dangerous_grants_remaining' as section,
    table_schema || '.' || table_name || ' -> ' || grantee || ':' || privilege_type as object_name,
    jsonb_build_object(
      'schema', table_schema,
      'table', table_name,
      'grantee', grantee,
      'privilege', privilege_type
    ) as detail
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'authenticated'
    and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
),

anon_execute_security_definer as (
  select
    '02_anon_execute_security_definer_remaining' as section,
    n.nspname || '.' || p.proname || '(' || pg_get_function_arguments(p.oid) || ')' as object_name,
    jsonb_build_object(
      'function', p.proname,
      'arguments', pg_get_function_arguments(p.oid),
      'anon_can_execute', has_function_privilege('anon', p.oid, 'EXECUTE'),
      'authenticated_can_execute', has_function_privilege('authenticated', p.oid, 'EXECUTE'),
      'function_config', p.proconfig
    ) as detail
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
    and has_function_privilege('anon', p.oid, 'EXECUTE') = true
),

view_security as (
  select
    '03_external_events_view_security' as section,
    n.nspname || '.' || c.relname as object_name,
    jsonb_build_object(
      'reloptions', c.reloptions,
      'owner', pg_get_userbyid(c.relowner)
    ) as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'external_events'
    and c.relkind = 'v'
),

view_grants as (
  select
    '04_external_events_view_grants' as section,
    table_schema || '.' || table_name || ' -> ' || grantee || ':' || privilege_type as object_name,
    jsonb_build_object(
      'view', table_name,
      'grantee', grantee,
      'privilege', privilege_type
    ) as detail
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'external_events'
    and grantee in ('anon', 'authenticated', 'public')
)

select * from authenticated_dangerous_grants
union all
select * from anon_execute_security_definer
union all
select * from view_security
union all
select * from view_grants
order by section, object_name;