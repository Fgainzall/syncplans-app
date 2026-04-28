-- 014_clean_events_rls.sql
-- Clean duplicated events policies and keep stricter authenticated rules.

alter table public.events enable row level security;

drop policy if exists "delete_own_events" on public.events;
drop policy if exists "events_select_member" on public.events;

-- Dejamos activas:
-- events_insert_clean
-- events_select_clean
-- events_update_clean
-- events_delete_clean