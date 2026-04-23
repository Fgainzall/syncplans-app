alter table public.events
  add column if not exists travel_mode text;

alter table public.events
  add column if not exists travel_eta_seconds integer;

alter table public.events
  add column if not exists leave_time timestamptz;

create index if not exists idx_events_leave_time
  on public.events(leave_time);

create unique index if not exists uq_notifications_leave_alert_once
  on public.notifications(user_id, entity_id)
  where type = 'leave_alert';