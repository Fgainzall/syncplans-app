alter table public.events
  add column if not exists location_label text;

alter table public.events
  add column if not exists location_address text;

alter table public.events
  add column if not exists location_lat double precision;

alter table public.events
  add column if not exists location_lng double precision;

alter table public.events
  add column if not exists location_provider text;

alter table public.events
  add column if not exists location_place_id text;

create index if not exists idx_events_location_place_id
  on public.events(location_place_id);