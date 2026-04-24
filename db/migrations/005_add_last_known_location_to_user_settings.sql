-- Smart Mobility - Last known user location
-- Safe additive migration

alter table public.user_settings
add column if not exists last_known_lat double precision,
add column if not exists last_known_lng double precision,
add column if not exists last_known_at timestamptz;

comment on column public.user_settings.last_known_lat is
'Last known latitude for smart mobility leave-time calculations.';

comment on column public.user_settings.last_known_lng is
'Last known longitude for smart mobility leave-time calculations.';

comment on column public.user_settings.last_known_at is
'Timestamp when the last known location was captured.';