-- 024_fix_event_invite_audit_logger_search_path.sql
-- SyncPlans Bloque B hotfix
-- Fix: ensure audit logger can resolve pgcrypto digest() in Supabase when pgcrypto lives in extensions schema.
-- Safe behavior is preserved: audit logging must never break invite creation, preview, accept, or email flow.

create or replace function public.log_event_invite_audit(
  p_action text,
  p_outcome text default 'unknown',
  p_invite_id uuid default null,
  p_event_id uuid default null,
  p_actor_user_id uuid default auth.uid(),
  p_actor_email text default null,
  p_invited_email text default null,
  p_token text default null,
  p_error_code text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_action text := left(trim(coalesce(p_action, 'unknown')), 120);
  v_outcome text := left(trim(coalesce(p_outcome, 'unknown')), 80);
  v_token text := trim(coalesce(p_token, ''));
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_token_hash text := null;
begin
  if v_token <> '' then
    begin
      v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
    exception when others then
      v_token_hash := null;
    end;
  end if;

  insert into public.event_invite_audit_logs (
    invite_id,
    event_id,
    actor_user_id,
    action,
    outcome,
    error_code,
    token_hash,
    invited_email_masked,
    actor_email_masked,
    request_id,
    metadata
  ) values (
    p_invite_id,
    p_event_id,
    p_actor_user_id,
    v_action,
    v_outcome,
    nullif(left(trim(coalesce(p_error_code, '')), 120), ''),
    v_token_hash,
    public.event_invite_mask_email(p_invited_email),
    public.event_invite_mask_email(p_actor_email),
    nullif(left(trim(coalesce(p_request_id, '')), 160), ''),
    v_metadata
  );
exception when others then
  -- Audit logging is intentionally non-blocking.
  -- Never break creation, preview, acceptance, or email if logging fails.
  null;
end;
$$;

revoke execute on function public.log_event_invite_audit(
  text, text, uuid, uuid, uuid, text, text, text, text, text, jsonb
) from public, anon, authenticated;
