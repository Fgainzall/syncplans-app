# SyncPlans Database Recovery

## Purpose

This document defines the minimum process to generate, store, and validate a reconstructive Supabase database snapshot for SyncPlans.

## Current recovery artifacts

The production schema dump is versioned in:

- `supabase_schema.sql`

This file is generated from the linked Supabase production project using Supabase CLI.

A private local backup bundle should also include:

- `schema.sql`
- `roles.sql`
- `MANIFEST.txt`
- `CHECKSUMS.txt`

Data dumps are intentionally not committed to Git because they may contain private user data, emails, events, tokens, invitations, notification payloads, or other sensitive records.

## Required local tools

- Docker Desktop
- Supabase CLI via `npx supabase`
- Access to the SyncPlans Supabase project

## Generate schema dump

```powershell
cd "C:\Users\ASUS\Desktop\SyncPlans\syncplans-app"

npx supabase login

npx supabase link --project-ref cucptwfgttpymcwbvkxa

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpDir = "_supabase_recovery_dump_$stamp"

New-Item -ItemType Directory -Path $dumpDir | Out-Null

npx supabase db dump --linked -f "$dumpDir\schema.sql"