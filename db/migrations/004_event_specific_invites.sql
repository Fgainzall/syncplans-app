-- 004_event_specific_invites.sql
-- Fase 2A SyncPlans: invitaciones a un evento específico, sin crear grupo.

create extension if not exists pgcrypto;

create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant',
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create index if not exists idx_event_participants_event_id
  on public.event_participants(event_id);

create index if not exists idx_event_participants_user_id
  on public.event_participants(user_id);

create table if not exists public.event_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  invited_email text not null,
  token text not null unique default ('sei_' || encode(gen_random_bytes(18), 'hex')),
  status text not null default 'pending',
  accepted_user_id uuid references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint event_invites_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

create index if not exists idx_event_invites_event_id
  on public.event_invites(event_id);

create index if not exists idx_event_invites_invited_by
  on public.event_invites(invited_by);

create index if not exists idx_event_invites_invited_email
  on public.event_invites(lower(invited_email));

create index if not exists idx_event_invites_token
  on public.event_invites(token);

alter table public.event_participants enable row level security;
alter table public.event_invites enable row level security;

-- Lectura de participantes: el participante se ve a sí mismo; el dueño del evento ve los participantes del evento.
drop policy if exists event_participants_select_self_or_event_owner on public.event_participants;
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

-- El acceso real al evento para invitados aceptados vive aquí.
drop policy if exists events_select_event_participants on public.events;
create policy events_select_event_participants
on public.events
for select
to authenticated
using (
  exists (
    select 1
    from public.event_participants ep
    where ep.event_id = events.id
      and ep.user_id = auth.uid()
  )
);

-- Lectura de invitaciones: creador, invitado por email o usuario que ya aceptó.
drop policy if exists event_invites_select_relevant on public.event_invites;
create policy event_invites_select_relevant
on public.event_invites
for select
to authenticated
using (
  invited_by = auth.uid()
  or accepted_user_id = auth.uid()
  or lower(invited_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- La creación/aceptación se hace por RPC para controlar permisos y evitar escrituras abiertas.
drop policy if exists event_invites_no_direct_insert on public.event_invites;
create policy event_invites_no_direct_insert
on public.event_invites
for insert
to authenticated
with check (false);

drop policy if exists event_invites_no_direct_update on public.event_invites;
create policy event_invites_no_direct_update
on public.event_invites
for update
to authenticated
using (false)
with check (false);

drop policy if exists event_participants_no_direct_insert on public.event_participants;
create policy event_participants_no_direct_insert
on public.event_participants
for insert
to authenticated
with check (false);

create or replace function public.create_event_invite(
  p_event_id uuid,
  p_email text
)
returns table (
  invite_id uuid,
  event_id uuid,
  token text,
  invited_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_invite_id uuid;
  v_token text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_event_id is null then
    raise exception 'Falta el evento.';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Email inválido.';
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
    raise exception 'No tienes permisos para compartir este evento.';
  end if;

  select ei.id, ei.token
    into v_invite_id, v_token
  from public.event_invites ei
  where ei.event_id = p_event_id
    and lower(ei.invited_email) = v_email
    and ei.status = 'pending'
  order by ei.created_at desc
  limit 1;

  if v_invite_id is null then
    insert into public.event_invites (event_id, invited_by, invited_email)
    values (p_event_id, v_uid, v_email)
    returning id, token into v_invite_id, v_token;
  end if;

  return query
  select v_invite_id, p_event_id, v_token, v_email;
end;
$$;

create or replace function public.get_event_invite_preview(
  p_token text
)
returns table (
  invite_id uuid,
  event_id uuid,
  event_title text,
  event_start timestamptz,
  event_end timestamptz,
  invited_email text,
  status text,
  created_at timestamptz
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
    ei.invited_email,
    ei.status,
    ei.created_at
  from public.event_invites ei
  join public.events e on e.id = ei.event_id
  where ei.token = trim(coalesce(p_token, ''))
  limit 1;
$$;

create or replace function public.accept_event_invite(
  p_token text
)
returns table (
  event_id uuid,
  status text
)
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

grant select on public.event_participants to authenticated;
grant select on public.event_invites to authenticated;
grant execute on function public.create_event_invite(uuid, text) to authenticated;
grant execute on function public.get_event_invite_preview(text) to authenticated;
grant execute on function public.accept_event_invite(text) to authenticated;
