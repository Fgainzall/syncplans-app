-- 012_clean_groups_rls.sql
-- Clean duplicated groups policies while preserving member and invite access.

alter table public.groups enable row level security;

drop policy if exists "groups_select_for_invited_users" on public.groups;
drop policy if exists "groups_select_for_invites" on public.groups;
drop policy if exists "groups_update_owner" on public.groups;
drop policy if exists "owners can update group meta" on public.groups;

create policy "groups_select_for_invited_users"
on public.groups
for select
to authenticated
using (
  exists (
    select 1
    from public.group_invites gi
    where gi.group_id = groups.id
      and gi.status = 'pending'
      and lower(coalesce(gi.invited_email, gi.email, '')) = lower(coalesce(auth.email(), ''))
  )
);

create policy "groups_update_owner"
on public.groups
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());