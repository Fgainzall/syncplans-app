-- SyncPlans: shared event response visibility
-- Why:
--   If Fer accepts a shared event, Araceli needs to see that accepted state.
--   The old SELECT policy only allowed each user to read their own row in event_responses,
--   so the event creator could keep seeing "Esperando respuesta" even after the other
--   person accepted.
--
-- Safe scope:
--   This does NOT allow public access. It only lets authenticated members of the
--   same group read event responses for events inside that group.

begin;

drop policy if exists "event_responses_select_group_members" on public.event_responses;

create policy "event_responses_select_group_members"
on public.event_responses
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_member_of_group(group_id)
  )
  or exists (
    select 1
    from public.events e
    where e.id = event_responses.event_id
      and e.group_id is not null
      and public.is_member_of_group(e.group_id)
  )
);

create or replace function public.get_my_event_responses()
returns table(
  id uuid,
  event_id uuid,
  user_id uuid,
  group_id uuid,
  response_status text,
  comment text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
as $$
  select
    er.id,
    er.event_id,
    er.user_id,
    er.group_id,
    er.response_status,
    er.comment,
    er.created_at,
    er.updated_at
  from public.event_responses er
  left join public.events e on e.id = er.event_id
  where er.user_id = auth.uid()
     or (
       er.group_id is not null
       and public.is_member_of_group(er.group_id)
     )
     or (
       e.group_id is not null
       and public.is_member_of_group(e.group_id)
     )
  order by er.updated_at desc, er.created_at desc;
$$;

commit;
