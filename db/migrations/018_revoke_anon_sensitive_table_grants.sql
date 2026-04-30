-- db/migrations/018_revoke_anon_sensitive_table_grants.sql
-- Harden direct anonymous access to sensitive user-scoped tables.
-- RLS remains the primary row-level protection, but anon should not have
-- broad table privileges on private app data.

revoke all on table public.connected_accounts from anon;
revoke all on table public.events from anon;
revoke all on table public.external_busy_blocks from anon;
revoke all on table public.external_calendar_settings from anon;
revoke all on table public.google_accounts from anon;
revoke all on table public.group_invites from anon;
revoke all on table public.group_members from anon;
revoke all on table public.notifications from anon;
revoke all on table public.profiles from anon;
revoke all on table public.public_invites from anon;
revoke all on table public.push_subscriptions from anon;

revoke all on table public.conflict_preferences from anon;
revoke all on table public.conflict_resolutions from anon;
revoke all on table public.conflict_resolutions_log from anon;
revoke all on table public.event_responses from anon;
revoke all on table public.group_messages from anon;
revoke all on table public.group_notification_settings from anon;
revoke all on table public.groups from anon;
revoke all on table public.proposal_responses from anon;
revoke all on table public.user_notification_settings from anon;
revoke all on table public.user_settings from anon;