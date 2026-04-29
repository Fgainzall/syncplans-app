-- SyncPlans schema snapshot (documental mínimo, no reconstructivo completo)
-- Última actualización: 2026-04-29
--
-- Este archivo sirve como referencia humana de tablas críticas.
-- No sustituye supabase_schema.sql cuando exista un dump completo.
-- RLS/policies/triggers/RPCs viven en Supabase y en db/migrations/*.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key,
  display_name text not null,
  avatar_url text,
  first_name text,
  last_name text,
  timezone text,
  language text,
  coordination_prefs jsonb,
  plan_tier text default 'demo_premium',
  plan_status text default 'trial',
  trial_ends_at timestamptz,
  daily_digest_enabled boolean not null default false,
  daily_digest_hour_local smallint,
  daily_digest_timezone text,
  paddle_customer_id text,
  subscription_status text default 'inactive',
  subscription_renews_at timestamptz,
  onboarding_completed boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  type text not null,
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  user_id uuid not null,
  role text not null default 'member',
  display_name text,
  relationship_role text,
  coordination_prefs jsonb,
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  email text,
  invited_email text not null,
  invited_user_id uuid,
  invited_by uuid default auth.uid(),
  role text default 'member',
  status text default 'pending',
  accepted_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_group_invites_group_id on public.group_invites(group_id);
create index if not exists idx_group_invites_invited_email on public.group_invites(invited_email);
create index if not exists group_invites_invited_user_id_idx on public.group_invites(invited_user_id);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  group_id uuid,
  title text not null,
  notes text,
  start timestamptz not null,
  "end" timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  time_range tstzrange,
  created_by uuid not null default auth.uid(),
  user_id uuid default auth.uid(),
  external_source text,
  external_id text,
  external_updated_at timestamptz,
  travel_mode text,
  travel_eta_seconds integer,
  leave_time timestamptz,
  location_label text,
  location_address text,
  location_lat double precision,
  location_lng double precision,
  location_provider text,
  location_place_id text
);
create index if not exists idx_events_owner on public.events(owner_id);
create index if not exists idx_events_group on public.events(group_id);
create index if not exists idx_events_group_range_gist on public.events using gist (group_id, time_range);
create index if not exists idx_events_leave_time on public.events(leave_time);
create unique index if not exists events_user_external_unique on public.events(user_id, external_source, external_id);

create table if not exists public.event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  user_id uuid not null,
  group_id uuid,
  response_status text not null default 'pending',
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_event_responses_event_id on public.event_responses(event_id);
create index if not exists idx_event_responses_user_id on public.event_responses(user_id);
create index if not exists idx_event_responses_group_id on public.event_responses(group_id);

create table if not exists public.proposal_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  user_id uuid not null,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists proposal_responses_event_id_idx on public.proposal_responses(event_id);
create index if not exists proposal_responses_user_id_idx on public.proposal_responses(user_id);

create table if not exists public.public_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  contact text,
  token text not null unique,
  status text default 'pending',
  proposed_date timestamptz,
  message text,
  created_at timestamptz default now(),
  creator_response text
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  type text not null,
  title text not null,
  body text,
  entity_id uuid,
  created_at timestamptz default now(),
  read_at timestamptz,
  payload jsonb
);
create unique index if not exists uq_notifications_leave_alert_once
on public.notifications (user_id, entity_id)
where type = 'leave_alert';

create table if not exists public.events_analytics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  event_type text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_events_analytics_user_created_at
on public.events_analytics (user_id, created_at desc);
create index if not exists idx_events_analytics_event_type_created_at
on public.events_analytics (event_type, created_at desc);

create table if not exists public.user_settings (
  user_id uuid primary key,
  event_reminders boolean not null default true,
  conflict_alerts boolean not null default true,
  partner_updates boolean not null default true,
  family_updates boolean not null default true,
  weekly_summary boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_from text not null default '22:00',
  quiet_to text not null default '07:30',
  conflict_warn_before_save boolean not null default true,
  conflict_default_resolution text not null default 'ask_me',
  perm_personal text not null default 'owner_only',
  perm_pair text not null default 'shared_write',
  perm_family text not null default 'shared_read',
  daily_summary boolean not null default true,
  last_known_lat double precision,
  last_known_lng double precision,
  last_known_at timestamptz,
  last_known_accuracy_m double precision,
  location_enabled boolean not null default false,
  location_prompt_status text not null default 'unknown',
  location_prompted_at timestamptz,
  location_dismissed_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conflict_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conflict_key text not null,
  event_a_id uuid,
  event_b_id uuid,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, conflict_key)
);

create table if not exists public.conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  group_id text,
  existing_event_id text,
  incoming_event_id text,
  resolution text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  group_id_norm text,
  conflict_id text not null,
  unique (conflict_id, user_id)
);

create table if not exists public.conflict_resolutions_log (
  id uuid primary key default gen_random_uuid(),
  conflict_id text not null,
  group_id uuid,
  decided_by uuid not null,
  decision_type text not null,
  final_action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Tablas adicionales reales no expandidadas aquí para mantener este snapshot corto:
-- connected_accounts, google_accounts, external_calendar_settings,
-- external_busy_blocks, group_messages, group_notification_settings,
-- push_subscriptions, user_notification_settings.
--
-- Nota honesta de alcance:
-- Este snapshot prioriza tablas críticas usadas por la app y el hueco de
-- seguridad corregido en events_analytics. Las policies RLS, funciones RPC,
-- triggers y vistas deben consultarse en Supabase y en db/migrations/*.
