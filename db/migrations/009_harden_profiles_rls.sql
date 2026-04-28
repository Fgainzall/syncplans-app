-- 009_harden_profiles_rls.sql
-- Remove globally open profile reads.
-- Users should only read their own profile or profiles of users
-- who share at least one group with them.

alter table public.profiles enable row level security;

drop policy if exists "profiles_select" on public.profiles;

-- Keep/replace explicit own-profile read.
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Keep/replace same-group profile read.
drop policy if exists "profiles_select_same_groups" on public.profiles;

create policy "profiles_select_same_groups"
on public.profiles
for select
to authenticated
using (
  id in (
    select gm2.user_id
    from public.group_members gm1
    join public.group_members gm2
      on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
  )
);