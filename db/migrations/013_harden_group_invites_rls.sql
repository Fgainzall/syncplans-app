-- 013_harden_group_invites_rls.sql
-- Restrict group_invites policies to authenticated users
-- and add safer WITH CHECK clauses for updates.

alter table public.group_invites enable row level security;

drop policy if exists "invites_delete_inviter" on public.group_invites;
drop policy if exists "invites_insert_by_group_member" on public.group_invites;
drop policy if exists "invites_select_own" on public.group_invites;
drop policy if exists "invites_update_admin" on public.group_invites;
drop policy if exists "invites_update_self" on public.group_invites;

create policy "group_invites_delete_inviter"
on public.group_invites
for delete
to authenticated
using (invited_by = auth.uid());

create policy "group_invites_insert_admin"
on public.group_invites
for insert
to authenticated
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_invites.group_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_invites.group_id
      and gm.user_id = auth.uid()
      and coalesce(gm.role, 'member') = any (array['owner', 'admin'])
  )
);

create policy "group_invites_select_own"
on public.group_invites
for select
to authenticated
using (
  lower(coalesce(invited_email, email, '')) = lower(coalesce(auth.email(), ''))
  or invited_by = auth.uid()
);

create policy "group_invites_update_admin"
on public.group_invites
for update
to authenticated
using (
  exists (
    select 1
    from public.groups g
    where g.id = group_invites.group_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_invites.group_id
      and gm.user_id = auth.uid()
      and coalesce(gm.role, 'member') = any (array['owner', 'admin'])
  )
)
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_invites.group_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_invites.group_id
      and gm.user_id = auth.uid()
      and coalesce(gm.role, 'member') = any (array['owner', 'admin'])
  )
);

create policy "group_invites_update_self"
on public.group_invites
for update
to authenticated
using (
  lower(coalesce(invited_email, email, '')) = lower(coalesce(auth.email(), ''))
)
with check (
  lower(coalesce(invited_email, email, '')) = lower(coalesce(auth.email(), ''))
);