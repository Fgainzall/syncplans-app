-- 010_clean_event_responses_rls.sql
-- Clean duplicated event_responses policies and restrict them to authenticated users.

alter table public.event_responses enable row level security;

drop policy if exists "er_select_own" on public.event_responses;
drop policy if exists "er_insert_own" on public.event_responses;
drop policy if exists "er_update_own" on public.event_responses;
drop policy if exists "er_delete_own" on public.event_responses;

drop policy if exists "event_responses_select_own" on public.event_responses;
drop policy if exists "event_responses_insert_own" on public.event_responses;
drop policy if exists "event_responses_update_own" on public.event_responses;
drop policy if exists "event_responses_delete_own" on public.event_responses;

create policy "event_responses_select_own"
on public.event_responses
for select
to authenticated
using (user_id = auth.uid());

create policy "event_responses_insert_own"
on public.event_responses
for insert
to authenticated
with check (user_id = auth.uid());

create policy "event_responses_update_own"
on public.event_responses
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "event_responses_delete_own"
on public.event_responses
for delete
to authenticated
using (user_id = auth.uid());