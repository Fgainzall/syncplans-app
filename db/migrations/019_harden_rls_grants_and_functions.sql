-- 019_harden_rls_grants_and_functions.sql
-- SyncPlans - RLS / grants / SECURITY DEFINER hardening
--
-- Purpose:
-- 1) Remove dangerous table privileges from authenticated/anon/PUBLIC:
--    TRUNCATE, TRIGGER, REFERENCES.
-- 2) Prevent anon/public direct execution of SECURITY DEFINER functions.
-- 3) Grant authenticated only the RPC/helper functions the app needs.
-- 4) Harden SECURITY DEFINER search_path.
-- 5) Make external_events view security_invoker so base table RLS is respected.
--
-- Safe intent:
-- - Does not delete data.
-- - Does not change table RLS policies.
-- - Does not revoke normal SELECT/INSERT/UPDATE/DELETE permissions.

begin;

-- 1) Remove dangerous broad privileges from app roles.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'revoke truncate, trigger, references on table %I.%I from authenticated',
      r.schema_name,
      r.table_name
    );

    execute format(
      'revoke truncate, trigger, references on table %I.%I from anon',
      r.schema_name,
      r.table_name
    );

    execute format(
      'revoke truncate, trigger, references on table %I.%I from public',
      r.schema_name,
      r.table_name
    );
  end loop;
end $$;

-- 2) Harden the external_events view.
-- security_invoker makes the view respect permissions/RLS of the querying role
-- instead of using the view owner's privileges.
do $$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'external_events'
      and c.relkind = 'v'
  ) then
    execute 'alter view public.external_events set (security_invoker = true)';
    execute 'revoke all on table public.external_events from public';
    execute 'revoke all on table public.external_events from anon';
    execute 'grant select on table public.external_events to authenticated';
  end if;
end $$;

-- 3) Harden SECURITY DEFINER function search_path.
-- All functions below were confirmed by the production audit.
alter function public.accept_group_invite(uuid) set search_path = public;
alter function public.accept_pending_invites() set search_path = public;
alter function public.can_read_group(uuid) set search_path = public;
alter function public.create_group(text, text) set search_path = public;
alter function public.decline_group_invite(uuid) set search_path = public;
alter function public.delete_group(uuid) set search_path = public;
alter function public.ensure_group_owner_member() set search_path = public;
alter function public.get_user_id_by_email(text) set search_path = public;
alter function public.handle_new_user_profile() set search_path = public;
alter function public.invite_to_group(uuid, text, text) set search_path = public;
alter function public.is_group_admin(uuid) set search_path = public;
alter function public.is_group_manager(uuid, uuid) set search_path = public;
alter function public.is_group_member(uuid, uuid) set search_path = public;
alter function public.is_member_of_group(uuid) set search_path = public;
alter function public.jwt_email() set search_path = public;
alter function public.leave_group(uuid) set search_path = public;
alter function public.notify_event_created() set search_path = public;
alter function public.notify_event_deleted() set search_path = public;
alter function public.set_group_message_author() set search_path = public;
alter function public.trg_events_conflict_notify() set search_path = public;

-- 4) Remove direct public/anon/authenticated execution on SECURITY DEFINER functions first.
-- We grant back only the RPC/policy helper functions authenticated users need.
revoke execute on function public.accept_group_invite(uuid) from public, anon, authenticated;
revoke execute on function public.accept_pending_invites() from public, anon, authenticated;
revoke execute on function public.can_read_group(uuid) from public, anon, authenticated;
revoke execute on function public.create_group(text, text) from public, anon, authenticated;
revoke execute on function public.decline_group_invite(uuid) from public, anon, authenticated;
revoke execute on function public.delete_group(uuid) from public, anon, authenticated;
revoke execute on function public.ensure_group_owner_member() from public, anon, authenticated;
revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;
revoke execute on function public.invite_to_group(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.is_group_admin(uuid) from public, anon, authenticated;
revoke execute on function public.is_group_manager(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_group_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.is_member_of_group(uuid) from public, anon, authenticated;
revoke execute on function public.jwt_email() from public, anon, authenticated;
revoke execute on function public.leave_group(uuid) from public, anon, authenticated;
revoke execute on function public.notify_event_created() from public, anon, authenticated;
revoke execute on function public.notify_event_deleted() from public, anon, authenticated;
revoke execute on function public.set_group_message_author() from public, anon, authenticated;
revoke execute on function public.trg_events_conflict_notify() from public, anon, authenticated;

-- 5) Grant authenticated only the RPCs/policy helpers the app uses.

-- Group/invite RPCs.
grant execute on function public.accept_group_invite(uuid) to authenticated;
grant execute on function public.accept_pending_invites() to authenticated;
grant execute on function public.create_group(text, text) to authenticated;
grant execute on function public.decline_group_invite(uuid) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
grant execute on function public.invite_to_group(uuid, text, text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;

-- RLS policy/helper functions.
grant execute on function public.can_read_group(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.is_group_manager(uuid, uuid) to authenticated;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_member_of_group(uuid) to authenticated;
grant execute on function public.jwt_email() to authenticated;

-- Intentionally NOT granted:
-- - get_user_id_by_email(text): sensitive user enumeration helper. Keep internal only.
-- - trigger functions: should be invoked by triggers, not directly by clients.
--   ensure_group_owner_member, handle_new_user_profile, notify_event_created,
--   notify_event_deleted, set_group_message_author, trg_events_conflict_notify.

commit;