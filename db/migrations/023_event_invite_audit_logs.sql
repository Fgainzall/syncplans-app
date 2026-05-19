-- 023_event_invite_audit_logs.sql
-- Bloque B1: observabilidad silenciosa para event-specific invites.
-- Objetivo: registrar creación/reutilización, preview, aceptación y email sin cambiar UX ni arquitectura.
-- Seguridad: no guarda tokens crudos ni emails completos. El logging nunca debe romper el flujo principal.

create extension if not exists pgcrypto;

create table if not exists public.event_invite_audit_logs (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid references public.event_invites(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  outcome text not null default 'unknown',
  error_code text,
  token_hash text,
  invited_email_masked text,
  actor_email_masked text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_invite_audit_logs_invite_id
  on public.event_invite_audit_logs(invite_id);

create index if not exists idx_event_invite_audit_logs_event_id
  on public.event_invite_audit_logs(event_id);

create index if not exists idx_event_invite_audit_logs_action_created_at
  on public.event_invite_audit_logs(action, created_at desc);

create index if not exists idx_event_invite_audit_logs_outcome_created_at
  on public.event_invite_audit_logs(outcome, created_at desc);

create index if not exists idx_event_invite_audit_logs_actor_user_id_created_at
  on public.event_invite_audit_logs(actor_user_id, created_at desc);

alter table public.event_invite_audit_logs enable row level security;

-- No lectura/escritura directa desde cliente. Solo funciones security definer.
revoke all on table public.event_invite_audit_logs from public, anon, authenticated;

create or replace function public.event_invite_mask_email(p_email text)
returns text
language sql
immutable
as $$
  select case
    when trim(coalesce(p_email, '')) = '' then null
    when position('@' in lower(trim(p_email))) <= 1 then '[masked]'
    else concat(
      left(split_part(lower(trim(p_email)), '@', 1), 1),
      '***@',
      split_part(lower(trim(p_email)), '@', 2)
    )
  end;
$$;

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
set search_path = public
as $$
declare
  v_action text := left(trim(coalesce(p_action, 'unknown')), 120);
  v_outcome text := left(trim(coalesce(p_outcome, 'unknown')), 80);
  v_token text := trim(coalesce(p_token, ''));
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
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
    case when v_token = '' then null else encode(digest(v_token, 'sha256'), 'hex') end,
    public.event_invite_mask_email(p_invited_email),
    public.event_invite_mask_email(coalesce(p_actor_email, auth.jwt() ->> 'email')),
    nullif(left(trim(coalesce(p_request_id, '')), 160), ''),
    v_metadata
  );
exception when others then
  -- El logging nunca debe romper creación, preview, aceptación ni email.
  null;
end;
$$;

create or replace function public.log_event_invite_email_result(
  p_invite_id uuid,
  p_action text,
  p_outcome text,
  p_error_code text default null,
  p_request_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite record;
begin
  if v_uid is null or p_invite_id is null then
    return;
  end if;

  select
    ei.id,
    ei.event_id,
    ei.invited_by,
    ei.invited_email,
    ei.status
  into v_invite
  from public.event_invites ei
  where ei.id = p_invite_id
  limit 1;

  if not found or v_invite.invited_by <> v_uid then
    return;
  end if;

  perform public.log_event_invite_audit(
    p_action => p_action,
    p_outcome => p_outcome,
    p_invite_id => v_invite.id,
    p_event_id => v_invite.event_id,
    p_actor_user_id => v_uid,
    p_actor_email => auth.jwt() ->> 'email',
    p_invited_email => v_invite.invited_email,
    p_token => null,
    p_error_code => p_error_code,
    p_request_id => p_request_id,
    p_metadata => coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('invite_status', v_invite.status)
  );
exception when others then
  null;
end;
$$;

-- Reemplaza create_event_invite() manteniendo idempotencia + hardening.
create or replace function public.create_event_invite(
  p_event_id uuid,
  p_invited_email text
)
returns table (
  invite_id uuid,
  token text,
  event_id uuid,
  invited_email text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_email text := lower(trim(coalesce(p_invited_email, '')));
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_invite_id uuid;
  v_existing record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_event_id is null then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_create_invalid_event',
      p_outcome => 'failed',
      p_actor_user_id => v_uid,
      p_actor_email => v_actor_email,
      p_invited_email => v_email,
      p_error_code => 'EVENT_INVITE_MISSING_EVENT'
    );
    raise exception 'Falta el evento.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_create_invalid_email',
      p_outcome => 'failed',
      p_event_id => p_event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_actor_email,
      p_invited_email => v_email,
      p_error_code => 'EVENT_INVITE_INVALID_EMAIL'
    );
    raise exception 'Correo inválido.';
  end if;

  if not exists (
    select 1
    from public.events e
    where e.id = p_event_id
      and (
        e.owner_id = v_uid
        or e.user_id = v_uid
        or e.created_by = v_uid
      )
  ) then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_create_forbidden',
      p_outcome => 'blocked',
      p_event_id => p_event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_actor_email,
      p_invited_email => v_email,
      p_error_code => 'EVENT_INVITE_CREATE_FORBIDDEN'
    );
    raise exception 'No puedes compartir este evento con esta sesión.';
  end if;

  if exists (
    select 1
    from public.event_invites ei
    where ei.event_id = p_event_id
      and lower(ei.invited_email) = v_email
      and ei.status = 'accepted'
  ) then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_already_accepted_blocked',
      p_outcome => 'blocked',
      p_event_id => p_event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_actor_email,
      p_invited_email => v_email,
      p_error_code => 'EVENT_INVITE_ALREADY_ACCEPTED'
    );
    raise exception 'Esta persona ya tiene acceso a este plan.';
  end if;

  select
    ei.id,
    ei.token,
    ei.event_id,
    lower(ei.invited_email) as invited_email,
    ei.status
  into v_existing
  from public.event_invites ei
  where ei.event_id = p_event_id
    and lower(ei.invited_email) = v_email
    and ei.status = 'pending'
  order by ei.created_at desc
  limit 1;

  if found and v_existing.id is not null then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_reused_pending',
      p_outcome => 'success',
      p_invite_id => v_existing.id,
      p_event_id => v_existing.event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_actor_email,
      p_invited_email => v_existing.invited_email,
      p_token => v_existing.token,
      p_metadata => jsonb_build_object('source', 'create_event_invite')
    );

    return query
    select
      v_existing.id::uuid,
      v_existing.token::text,
      v_existing.event_id::uuid,
      v_existing.invited_email::text,
      v_existing.status::text;
    return;
  end if;

  insert into public.event_invites (event_id, invited_by, invited_email, token, status)
  values (p_event_id, v_uid, v_email, v_token, 'pending')
  returning id into v_invite_id;

  perform public.log_event_invite_audit(
    p_action => 'event_invite_created',
    p_outcome => 'success',
    p_invite_id => v_invite_id,
    p_event_id => p_event_id,
    p_actor_user_id => v_uid,
    p_actor_email => v_actor_email,
    p_invited_email => v_email,
    p_token => v_token,
    p_metadata => jsonb_build_object('source', 'create_event_invite')
  );

  return query
  select v_invite_id, v_token, p_event_id, v_email, 'pending'::text;
end;
$$;

-- Reemplaza preview SQL por PL/pgSQL para poder auditar apertura de links.
create or replace function public.get_event_invite_preview(p_token text)
returns table (
  invite_id uuid,
  event_id uuid,
  event_title text,
  event_start timestamptz,
  event_end timestamptz,
  invited_email text,
  invited_by uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := trim(coalesce(p_token, ''));
  v_actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_row record;
begin
  if v_token = '' then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_preview_invalid_token',
      p_outcome => 'failed',
      p_actor_user_id => auth.uid(),
      p_actor_email => v_actor_email,
      p_error_code => 'EVENT_INVITE_PREVIEW_MISSING_TOKEN'
    );
    return;
  end if;

  select
    ei.id as invite_id,
    ei.event_id,
    coalesce(e.title, 'Plan') as event_title,
    e.start as event_start,
    e."end" as event_end,
    lower(ei.invited_email) as invited_email,
    ei.invited_by,
    ei.status,
    ei.token
  into v_row
  from public.event_invites ei
  join public.events e on e.id = ei.event_id
  where ei.token = v_token
  limit 1;

  if not found then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_preview_not_found',
      p_outcome => 'failed',
      p_actor_user_id => auth.uid(),
      p_actor_email => v_actor_email,
      p_token => v_token,
      p_error_code => 'EVENT_INVITE_PREVIEW_NOT_FOUND'
    );
    return;
  end if;

  perform public.log_event_invite_audit(
    p_action => 'event_invite_preview_success',
    p_outcome => 'success',
    p_invite_id => v_row.invite_id,
    p_event_id => v_row.event_id,
    p_actor_user_id => auth.uid(),
    p_actor_email => v_actor_email,
    p_invited_email => v_row.invited_email,
    p_token => v_row.token,
    p_metadata => jsonb_build_object('invite_status', v_row.status)
  );

  return query
  select
    v_row.invite_id::uuid,
    v_row.event_id::uuid,
    v_row.event_title::text,
    v_row.event_start::timestamptz,
    v_row.event_end::timestamptz,
    v_row.invited_email::text,
    v_row.invited_by::uuid,
    v_row.status::text;
end;
$$;

-- Reemplaza accept_event_invite() manteniendo comportamiento y agregando auditoría.
create or replace function public.accept_event_invite(p_token text)
returns table (event_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_token text := trim(coalesce(p_token, ''));
  v_invite record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if v_token = '' then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_accept_invalid_token',
      p_outcome => 'failed',
      p_actor_user_id => v_uid,
      p_actor_email => v_auth_email,
      p_error_code => 'EVENT_INVITE_ACCEPT_MISSING_TOKEN'
    );
    raise exception 'Invitación no encontrada.';
  end if;

  select *
    into v_invite
  from public.event_invites ei
  where ei.token = v_token
  limit 1;

  if not found then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_accept_invalid_token',
      p_outcome => 'failed',
      p_actor_user_id => v_uid,
      p_actor_email => v_auth_email,
      p_token => v_token,
      p_error_code => 'EVENT_INVITE_ACCEPT_NOT_FOUND'
    );
    raise exception 'Invitación no encontrada.';
  end if;

  if lower(v_invite.invited_email) <> v_auth_email then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_accept_wrong_email',
      p_outcome => 'blocked',
      p_invite_id => v_invite.id,
      p_event_id => v_invite.event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_auth_email,
      p_invited_email => v_invite.invited_email,
      p_token => v_invite.token,
      p_error_code => 'EVENT_INVITE_ACCEPT_WRONG_EMAIL'
    );
    raise exception 'Este link fue creado para otro correo.';
  end if;

  if v_invite.status = 'accepted' then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_accept_already_accepted',
      p_outcome => 'success',
      p_invite_id => v_invite.id,
      p_event_id => v_invite.event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_auth_email,
      p_invited_email => v_invite.invited_email,
      p_token => v_invite.token
    );
    return query select v_invite.event_id, 'accepted'::text;
    return;
  end if;

  if v_invite.status <> 'pending' then
    perform public.log_event_invite_audit(
      p_action => 'event_invite_accept_not_pending',
      p_outcome => 'blocked',
      p_invite_id => v_invite.id,
      p_event_id => v_invite.event_id,
      p_actor_user_id => v_uid,
      p_actor_email => v_auth_email,
      p_invited_email => v_invite.invited_email,
      p_token => v_invite.token,
      p_error_code => 'EVENT_INVITE_ACCEPT_NOT_PENDING',
      p_metadata => jsonb_build_object('invite_status', v_invite.status)
    );
    raise exception 'Esta invitación ya no está pendiente.';
  end if;

  insert into public.event_participants (event_id, user_id, role)
  values (v_invite.event_id, v_uid, 'participant')
  on conflict (event_id, user_id) do nothing;

  update public.event_invites
  set status = 'accepted',
      accepted_user_id = v_uid,
      accepted_at = now()
  where id = v_invite.id;

  perform public.log_event_invite_audit(
    p_action => 'event_invite_accept_success',
    p_outcome => 'success',
    p_invite_id => v_invite.id,
    p_event_id => v_invite.event_id,
    p_actor_user_id => v_uid,
    p_actor_email => v_auth_email,
    p_invited_email => v_invite.invited_email,
    p_token => v_invite.token
  );

  return query select v_invite.event_id, 'accepted'::text;
end;
$$;

-- Permisos explícitos. Mantiene los hardenings previos.
revoke execute on function public.event_invite_mask_email(text) from public, anon, authenticated;
revoke execute on function public.log_event_invite_audit(text, text, uuid, uuid, uuid, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.log_event_invite_email_result(uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.log_event_invite_email_result(uuid, text, text, text, text, jsonb) to authenticated;

revoke execute on function public.create_event_invite(uuid, text) from public, anon;
revoke execute on function public.accept_event_invite(text) from public, anon;
revoke execute on function public.get_my_event_participant_events() from public, anon;
revoke execute on function public.get_event_invite_preview(text) from public;

grant execute on function public.create_event_invite(uuid, text) to authenticated;
grant execute on function public.accept_event_invite(text) to authenticated;
grant execute on function public.get_my_event_participant_events() to authenticated;
grant execute on function public.get_event_invite_preview(text) to anon, authenticated;
