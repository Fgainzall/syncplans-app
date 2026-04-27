alter table public.user_settings
add column if not exists last_known_accuracy_m double precision;

alter table public.user_settings
add column if not exists location_enabled boolean not null default false;

alter table public.user_settings
add column if not exists location_prompt_status text not null default 'unknown';

alter table public.user_settings
add column if not exists location_prompted_at timestamptz;

alter table public.user_settings
add column if not exists location_dismissed_until timestamptz;