# SyncPlans — RLS / Grants Production Audit

Fecha: 2026-05-04

## Objetivo

Verificar con evidencia que las tablas críticas tienen RLS activo, policies correctas y grants mínimos. Esta auditoría complementa las migrations versionadas y el snapshot `supabase_schema.sql`.

## Tablas críticas

- `events`
- `groups`
- `group_members`
- `group_invites`
- `public_invites`
- `notifications`
- `profiles`
- `user_settings`
- `google_accounts`
- `push_subscriptions`
- `event_responses`
- `conflict_preferences`
- `conflict_resolutions`
- `events_analytics`

## Query 1 — RLS por tabla

Ejecutar en Supabase SQL Editor:

```sql
select
  schemaname,
  tablename,
  rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
order by tablename;
```

Criterio: todas las tablas críticas deben tener `rls_enabled = true`.

## Query 2 — Policies activas

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

Criterio: cada tabla crítica debe tener policies explícitas alineadas a ownership/membership.

## Query 3 — Grants directos por rol

```sql
select
  table_schema,
  table_name,
  grantee,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;
```

Criterio:

- `anon` no debe tener acceso directo a tablas sensibles.
- `authenticated` puede tener grants base si RLS gobierna acceso.
- `service_role` puede tener acceso admin, pero su uso en código debe estar documentado.

## Query 4 — Views públicas

```sql
select
  table_schema,
  table_name,
  view_definition
from information_schema.views
where table_schema = 'public'
order by table_name;
```

Criterio: views como `external_events` no deben filtrar datos sensibles a `anon`.

## Query 5 — user_settings específico

```sql
select
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'user_settings'
order by policyname;
```

Criterio mínimo esperado para migrar `/api/user/location` fuera de service_role:

```sql
user_id = auth.uid()
```

para SELECT/INSERT/UPDATE/DELETE según corresponda.

## Evidencia a guardar

Pegar resultados en este archivo o exportarlos como CSV:

- RLS enabled table matrix
- policies list
- grants list
- decisión sobre `user_settings`

## Criterio de cierre

- 0 tablas críticas sin RLS.
- 0 grants peligrosos para `anon`.
- `user_settings` verificado antes de migrar `user/location`.
