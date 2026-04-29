-- db/migrations/017_harden_external_events_view.sql
-- Harden legacy compatibility view.
-- external_events is a view over external_busy_blocks and is not used directly
-- by the app client. It must not be exposed to anon/authenticated roles.

revoke all on table public.external_events from anon;
revoke all on table public.external_events from authenticated;
revoke all on table public.external_events from public;

grant select on table public.external_events to service_role;