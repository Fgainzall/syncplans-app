-- SyncPlans Google Calendar sync hardening
-- Run in Supabase SQL editor if /api/google/sync returns GOOGLE_SYNC_UPSERT_FAILED.
-- This is additive: it does not change RLS, auth, groups, invites, or conflict logic.

alter table public.events
  add column if not exists external_source text,
  add column if not exists external_id text,
  add column if not exists external_updated_at timestamptz,
  add column if not exists external_attendees_count integer default 0;

update public.events
set external_attendees_count = 0
where external_attendees_count is null;

alter table public.events
  alter column external_attendees_count set default 0;

-- Required by Supabase/PostgREST upsert with onConflict: "user_id,external_source,external_id".
-- Multiple normal SyncPlans events with null external_source/external_id are allowed by Postgres unique semantics.
create unique index if not exists events_user_external_source_id_uidx
  on public.events (user_id, external_source, external_id);

create index if not exists events_user_external_source_idx
  on public.events (user_id, external_source);
