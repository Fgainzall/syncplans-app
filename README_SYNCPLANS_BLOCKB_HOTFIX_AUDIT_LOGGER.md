# SyncPlans Block B Hotfix — Event Invite Audit Logger

## What this fixes

The audit table and RPC calls existed, but logs were not inserted because the internal logger could fail silently while resolving `digest()` from `pgcrypto` in Supabase.

This hotfix updates `log_event_invite_audit()` with:

- `search_path = public, extensions`
- safe `digest()` handling
- non-blocking behavior: if audit logging fails, invites still work
- execute permissions remain closed to `public`, `anon`, and `authenticated`

## Files

- `db/migrations/024_fix_event_invite_audit_logger_search_path.sql`
- `docs/sql/024_validate_event_invite_audit_logger_hotfix.sql`

## Apply

Run the migration SQL in Supabase SQL Editor, then run the validation SQL.

Expected validation:

- latest logs include `manual_audit_test`
- internal logger is not executable by `anon`, `authenticated`, or `public`
