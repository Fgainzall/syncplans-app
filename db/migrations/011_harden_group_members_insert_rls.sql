-- 011_harden_group_members_insert_rls.sql
-- Remove unsafe self-insert policy on group_members.
-- Users should not be able to join arbitrary groups just by knowing group_id.
-- Membership insertion should happen via owner/admin actions or controlled invite RPC.

alter table public.group_members enable row level security;

drop policy if exists "gm_insert_self" on public.group_members;

drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_insert_owner" on public.group_members;

create policy "group_members_insert_admin"
on public.group_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.groups g
    where g.id = group_members.group_id
      and g.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.group_members gm
    where gm.group_id = group_members.group_id
      and gm.user_id = auth.uid()
      and coalesce(gm.role, '') = any (array['owner', 'admin'])
  )
);