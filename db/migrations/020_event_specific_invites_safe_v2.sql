-- 020_event_specific_invites_safe_v2.sql
-- Fase 2A segura: invitaciones a evento específico sin tocar la policy principal de events.

create extension if not exists pgcrypto;

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists idx_event_participants_event_id on public.event_participants(event_id);
create index if not exists idx_event_participants_user_id on public.event_participants(user_id);

create table if not exists public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invited_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invited_email text not null,
  token text not null unique,
  status text not null default 'pending',
  accepted_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_invites_event_id on public.event_invites(event_id);
create index if not exists idx_event_invites_invited_by on public.event_invites(invited_by);
create index if not exists idx_event_invites_token on public.event_invites(token);
create index if not exists idx_event_invites_invited_email on public.event_invites(lower(invited_email));

alter table public.event_invites enable row level security;
alter table public.event_participants enable row level security;

-- Nunca volver a agregar una policy SELECT sobre events desde event_participants aquí.
drop policy if exists events_select_event_participants on public.events;

-- Policies idempotentes para tablas auxiliares.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_invites'
      and policyname = 'event_invites_no_direct_insert'
  ) then
    create policy event_invites_no_direct_insert
      on public.event_invites
      for insert
      to authenticated
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_invites'
      and policyname = 'event_invites_no_direct_update'
  ) then
    create policy event_invites_no_direct_update
      on public.event_invites
      for update
      to authenticated
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_invites'
      and policyname = 'event_invites_select_relevant'
  ) then
    create policy event_invites_select_relevant
      on public.event_invites
      for select
      to authenticated
      using (
        invited_by = auth.uid()
        or accepted_user_id = auth.uid()
        or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_participants'
      and policyname = 'event_participants_no_direct_insert'
  ) then
    create policy event_participants_no_direct_insert
      on public.event_participants
      for insert
      to authenticated
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_participants'
      and policyname = 'event_participants_select_self_or_event_owner'
  ) then
    create policy event_participants_select_self_or_event_owner
      on public.event_participants
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or exists (
          select 1
          from public.events e
          where e.id = event_participants.event_id
            and (
              e.owner_id = auth.uid()
              or e.user_id = auth.uid()
              or e.created_by = auth.uid()
            )
        )
      );
  end if;
end $$;

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
  v_email text := lower(trim(coalesce(p_invited_email, '')));
  v_token text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_invite_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_event_id is null then
    raise exception 'Falta el evento.';
  end if;

  if v_email = '' or position('@' in v_email) = 0 then
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
    raise exception 'No puedes compartir este evento con esta sesión.';
  end if;

  insert into public.event_invites (event_id, invited_by, invited_email, token, status)
  values (p_event_id, v_uid, v_email, v_token, 'pending')
  returning id into v_invite_id;

  return query
  select v_invite_id, v_token, p_event_id, v_email, 'pending'::text;
end;
$$;

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
language sql
security definer
set search_path = public
as $$
  select
    ei.id as invite_id,
    ei.event_id,
    coalesce(e.title, 'Plan') as event_title,
    e.start as event_start,
    e."end" as event_end,
    lower(ei.invited_email) as invited_email,
    ei.invited_by,
    ei.status
  from public.event_invites ei
  join public.events e on e.id = ei.event_id
  where ei.token = trim(coalesce(p_token, ''))
  limit 1;
$$;

create or replace function public.accept_event_invite(p_token text)
returns table (event_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_auth_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  select *
    into v_invite
  from public.event_invites ei
  where ei.token = trim(coalesce(p_token, ''))
  limit 1;

  if v_invite.id is null then
    raise exception 'Invitación no encontrada.';
  end if;

  if lower(v_invite.invited_email) <> v_auth_email then
    raise exception 'Este link fue creado para otro correo.';
  end if;

  if v_invite.status = 'accepted' then
    return query select v_invite.event_id, 'accepted'::text;
    return;
  end if;

  if v_invite.status <> 'pending' then
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

  return query select v_invite.event_id, 'accepted'::text;
end;
$$;

create or replace function public.get_my_event_participant_events()
returns table (
  id uuid,
  user_id uuid,
  owner_id uuid,
  created_by uuid,
  group_id uuid,
  title text,
  notes text,
  start timestamptz,
  "end" timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  external_source text,
  external_id text,
  external_attendees_count integer,
  location_label text,
  location_address text,
  location_lat double precision,
  location_lng double precision,
  location_provider text,
  location_place_id text,
  travel_mode text,
  travel_eta_seconds integer,
  leave_time timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.user_id,
    e.owner_id,
    e.created_by,
    e.group_id,
    e.title,
    e.notes,
    e.start,
    e."end",
    e.created_at,
    e.updated_at,
    e.external_source,
    e.external_id,
    coalesce(e.external_attendees_count, 0) as external_attendees_count,
    e.location_label,
    e.location_address,
    e.location_lat,
    e.location_lng,
    e.location_provider,
    e.location_place_id,
    e.travel_mode,
    e.travel_eta_seconds,
    e.leave_time
  from public.event_participants ep
  join public.events e on e.id = ep.event_id
  where ep.user_id = auth.uid();
$$;

grant execute on function public.create_event_invite(uuid,text) to authenticated;
grant execute on function public.get_event_invite_preview(text) to anon, authenticated;
grant execute on function public.accept_event_invite(text) to authenticated;
grant execute on function public.get_my_event_participant_events() to authenticated;
