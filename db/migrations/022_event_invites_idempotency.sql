-- 022_event_invites_idempotency.sql
-- Bloque 5: evita duplicar invitaciones event-specific para el mismo evento + correo.
-- Cambio quirúrgico: solo reemplaza create_event_invite(). No toca events_select_clean ni RLS principal.

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
  v_existing record;
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

  -- Si esa persona ya aceptó este mismo evento, no creamos otro link.
  if exists (
    select 1
    from public.event_invites ei
    where ei.event_id = p_event_id
      and lower(ei.invited_email) = v_email
      and ei.status = 'accepted'
  ) then
    raise exception 'Esta persona ya tiene acceso a este plan.';
  end if;

  -- Idempotencia segura: si ya hay un link pendiente para el mismo evento + correo,
  -- devolvemos ese mismo link en vez de crear otra invitación/email duplicado.
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

  if v_existing.id is not null then
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

  return query
  select v_invite_id, v_token, p_event_id, v_email, 'pending'::text;
end;
$$;

-- Mantener los grants endurecidos del Bloque 2 aunque la función haya sido reemplazada.
revoke execute on function public.create_event_invite(uuid, text) from public, anon;
grant execute on function public.create_event_invite(uuid, text) to authenticated;
