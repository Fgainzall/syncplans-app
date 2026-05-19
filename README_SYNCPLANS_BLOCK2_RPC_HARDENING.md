# SyncPlans Bloque 2 — Hardening RPCs event-specific invites

## Objetivo
Cerrar permisos de ejecucion de las RPCs nuevas de invitaciones a evento especifico sin tocar arquitectura.

Este bloque NO toca:
- `events_select_clean`
- policies principales de `events`
- grupos
- `group_members`
- frontend
- Google Calendar sync

## Archivos incluidos

- `db/migrations/021_harden_event_specific_invite_rpcs.sql`
- `docs/sql/021_validate_event_specific_invite_rpc_grants.sql`

## Que cambia

Deja explicito que:

- `create_event_invite(uuid, text)` solo lo ejecuta `authenticated`.
- `accept_event_invite(text)` solo lo ejecuta `authenticated`.
- `get_my_event_participant_events()` solo lo ejecuta `authenticated`.
- `get_event_invite_preview(text)` lo pueden ejecutar `anon` y `authenticated` porque el preview publico por token es parte del flujo antes de login/registro.

## Como aplicar

### Opcion A — Supabase SQL Editor

1. Abre Supabase.
2. Ve a SQL Editor.
3. Ejecuta el contenido de:

```txt
 db/migrations/021_harden_event_specific_invite_rpcs.sql
```

4. Luego ejecuta:

```txt
 docs/sql/021_validate_event_specific_invite_rpc_grants.sql
```

### Opcion B — psql desde PowerShell

Ajusta `$dbUrl` con tu connection string real:

```powershell
cd "C:\Users\ASUS\Desktop\SyncPlans\syncplans-app"

$dbUrl = "postgresql://postgres.xxxxx:TU_PASSWORD@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

psql $dbUrl -f "db/migrations/021_harden_event_specific_invite_rpcs.sql"
psql $dbUrl -f "docs/sql/021_validate_event_specific_invite_rpc_grants.sql"
```

## Resultado esperado de validacion

```txt
create_event_invite                 anon=false   authenticated=true   public=false
accept_event_invite                 anon=false   authenticated=true   public=false
get_my_event_participant_events     anon=false   authenticated=true   public=false
get_event_invite_preview            anon=true    authenticated=true   public=false
```

## Pruebas manuales despues de aplicar

1. Usuario creador comparte un evento Google con invitados.
2. Se crea invitacion y link.
3. El link abre preview sin sesion.
4. Usuario invitado inicia sesion con el correo correcto y acepta.
5. Usuario invitado ve solo ese evento en `/events` y `/calendar`.
6. Usuario invitado no ve otros eventos del creador.
7. Usuario con correo equivocado no puede aceptar.

## Commit recomendado

```powershell
git status
git diff --stat

git add db/migrations/021_harden_event_specific_invite_rpcs.sql docs/sql/021_validate_event_specific_invite_rpc_grants.sql README_SYNCPLANS_BLOCK2_RPC_HARDENING.md
git commit -m "Harden event-specific invite RPC grants"
git push
```
