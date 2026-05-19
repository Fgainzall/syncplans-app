-- SyncPlans — Google Calendar external guests classification
-- Adds the minimum metadata needed for Phase 1:
-- Google event + attendees_count > 0 => "Google · con invitados" in UI.

alter table public.events
  add column if not exists external_attendees_count integer not null default 0;

update public.events
set external_attendees_count = 0
where external_attendees_count is null;

create index if not exists idx_events_external_attendees_count
  on public.events(external_source, external_attendees_count);
