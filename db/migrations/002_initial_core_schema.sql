-- SP-003: initial core schema migration (minimal, no RLS/policies/functions)

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key,
  first_name text,
  last_name text,
  avatar_url text,
  display_name text,
  coordination_prefs jsonb,
  plan_tier text,
  plan_status text,
  trial_ends_at timestamptz,
  daily_digest_enabled boolean default false,
  daily_digest_hour_local integer,
  daily_digest_timezone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  type text not null check (type in ('pair', 'family', 'other', 'solo', 'shared')),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  display_name text,
  relationship_role text,
  coordination_prefs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index if not exists idx_group_members_user_id on public.group_members(user_id);
create index if not exists idx_group_members_group_id on public.group_members(group_id);

create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text,
  invited_email text,
  invited_user_id uuid references public.profiles(id) on delete set null,
  invited_by uuid references public.profiles(id) on delete set null,
  role text not null default 'member',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_group_invites_group_id on public.group_invites(group_id);
create index if not exists idx_group_invites_status on public.group_invites(status);
create index if not exists idx_group_invites_invited_email on public.group_invites(invited_email);
create index if not exists idx_group_invites_email on public.group_invites(email);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  title text,
  notes text,
  start timestamptz not null,
  "end" timestamptz not null,
  external_source text,
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_events_user_id on public.events(user_id);
create index if not exists idx_events_group_id on public.events(group_id);
create index if not exists idx_events_start on public.events(start);

create table if not exists public.public_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  contact text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  proposed_date timestamptz,
  message text,
  creator_response text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_public_invites_event_id on public.public_invites(event_id);
create index if not exists idx_public_invites_status on public.public_invites(status);

create table if not exists public.event_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete set null,
  response_status text not null check (response_status in ('pending', 'accepted', 'declined')),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists idx_event_responses_user_id on public.event_responses(user_id);
create index if not exists idx_event_responses_event_id on public.event_responses(event_id);

create table if not exists public.conflict_resolutions (
  id uuid primary key default gen_random_uuid(),
  conflict_id text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  resolution text not null check (resolution in ('keep_existing', 'replace_with_new', 'none', 'ask_me')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conflict_id, user_id)
);
create index if not exists idx_conflict_resolutions_user_id on public.conflict_resolutions(user_id);

create table if not exists public.conflict_resolutions_log (
  id uuid primary key default gen_random_uuid(),
  conflict_id text not null,
  group_id uuid references public.groups(id) on delete set null,
  decided_by uuid references public.profiles(id) on delete set null,
  decision_type text not null,
  final_action text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_conflict_resolutions_log_conflict_id on public.conflict_resolutions_log(conflict_id);
create index if not exists idx_conflict_resolutions_log_group_id on public.conflict_resolutions_log(group_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_id text,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id_created_at on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_id_read_at on public.notifications(user_id, read_at);

create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notif_enabled boolean default true,
  notif_event_invites boolean default true,
  notif_conflicts boolean default true,
  notif_weekly_summary boolean default true,
  conflict_default_resolution text default 'ask_me',
  conflict_warn_before_save boolean default true,
  perm_mode_pair text default 'shared_write',
  perm_mode_family text default 'shared_write',
  event_reminders boolean default true,
  daily_summary boolean default true,
  conflict_alerts boolean default true,
  partner_updates boolean default true,
  family_updates boolean default true,
  weekly_summary boolean default true,
  quiet_hours_enabled boolean default false,
  quiet_from text default '22:00',
  quiet_to text default '07:30',
  perm_personal text default 'owner_only',
  perm_pair text default 'shared_write',
  perm_family text default 'shared_read',
  active_group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);