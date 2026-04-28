-- 008_harden_public_invites_rls.sql
-- Hardening RLS for public_invites.
-- Public responses should go through /api/public-invite/[token] using service role,
-- not direct anonymous/client table updates.

alter table public.public_invites enable row level security;

drop policy if exists "public read by token" on public.public_invites;
drop policy if exists "update invites" on public.public_invites;
drop policy if exists "insert invites" on public.public_invites;

create policy "public_invites_insert_authenticated"
on public.public_invites
for insert
to authenticated
with check (auth.uid() is not null);

create policy "public_invites_select_authenticated_event_owner"
on public.public_invites
for select
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = public_invites.event_id
      and (
        e.owner_id = auth.uid()
        or e.user_id = auth.uid()
        or e.created_by = auth.uid()
      )
  )
);

create policy "public_invites_update_authenticated_event_owner"
on public.public_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.events e
    where e.id = public_invites.event_id
      and (
        e.owner_id = auth.uid()
        or e.user_id = auth.uid()
        or e.created_by = auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = public_invites.event_id
      and (
        e.owner_id = auth.uid()
        or e.user_id = auth.uid()
        or e.created_by = auth.uid()
      )
  )
);