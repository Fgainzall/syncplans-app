-- db/migrations/016_harden_events_analytics_rls.sql
-- Harden analytics table for beta-readiness.
-- events_analytics is written from the client via src/lib/analytics.ts,
-- so it must not remain open without RLS.

alter table public.events_analytics enable row level security;

revoke all on table public.events_analytics from anon;
revoke all on table public.events_analytics from public;
revoke update, delete on table public.events_analytics from authenticated;

grant insert, select on table public.events_analytics to authenticated;

drop policy if exists events_analytics_insert_own on public.events_analytics;
drop policy if exists events_analytics_select_own on public.events_analytics;

create policy events_analytics_insert_own
on public.events_analytics
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy events_analytics_select_own
on public.events_analytics
for select
to authenticated
using (
  user_id = auth.uid()
);

create index if not exists idx_events_analytics_user_created_at
on public.events_analytics (user_id, created_at desc);

create index if not exists idx_events_analytics_event_type_created_at
on public.events_analytics (event_type, created_at desc);