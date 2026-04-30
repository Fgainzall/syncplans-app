# SyncPlans

SyncPlans es una app web construida con Next.js + Supabase para coordinar tiempo compartido sin volverlo una discusión. No busca ser “otro calendario”: su valor está en centralizar eventos visibles, detectar choques, ordenar decisiones y dejar una sola versión clara de la semana.

## Qué problema resuelve

Cuando compartes tiempo con otra persona o con un grupo, el problema no suele ser ver horas en un grid. El problema real es coordinar, detectar cruces, decidir qué hacer y evitar que cada uno opere con una versión distinta del plan.

SyncPlans cubre ese hueco con cuatro capas:

- calendario visible y compartido
- grupos (pareja, familia, compartido)
- detección y resolución de conflictos
- flujos de invitación y respuesta

## Stack actual

- Next.js App Router
- React + TypeScript
- Supabase (Auth, Postgres, RLS)
- Zustand
- Vercel
- Resend (email)
- Tailwind / estilos inline según módulo

## Rutas operativas clave

- `/auth/login` y `/auth/register`
- `/summary` → vista operativa principal
- `/calendar` → vista temporal
- `/events` → lista y gestión de eventos
- `/events/new/details` → creación / edición
- `/conflicts/detected`, `/conflicts/compare`, `/conflicts/actions`
- `/groups`, `/groups/new`, `/groups/[id]`
- `/invitations` y `/invitations/accept`
- `/invite/[token]` → invitación pública

## Módulos sensibles

### Semántica de grupos

Fuente de verdad recomendada: `src/lib/naming.ts`

Ahí debe vivir la normalización de:

- personal / solo
- pair / couple
- family
- other / shared

Ningún componente debería volver a traducir esos valores manualmente.

### Eventos

Fuente principal: `src/lib/eventsDb.ts`

### Conflictos

Módulos principales:

- `src/lib/conflicts.ts`
- `src/lib/conflictsDbBridge.ts`

### Grupos

Módulos principales:

- `src/lib/groupsDb.ts`
- `src/lib/groupsStore.ts`

### Invitaciones y respuestas

Módulos principales:

- `src/lib/invitationsDb.ts`
- `src/lib/proposalResponsesDb.ts`
- `src/app/api/public-invite/[token]/route.ts`

### Analytics

Módulo principal: `src/lib/analytics.ts`

La tabla `public.events_analytics` se escribe desde cliente autenticado. Por eso debe tener RLS activo y no debe aceptar inserts con `user_id` nulo. El hardening correspondiente está versionado en:

- `db/migrations/016_harden_events_analytics_rls.sql`

Reglas actuales:

- `INSERT` solo para usuarios autenticados con `user_id = auth.uid()`.
- `SELECT` solo de analytics propios.
- Sin `UPDATE` ni `DELETE` desde cliente.
- Sin acceso `anon`.

## Gobernanza de base de datos

La base real vive en Supabase. El repo mantiene dos niveles de documentación:

1. `db/migrations/*`  
   Fuente versionada de cambios intencionales aplicados a la base.

2. `db/schema.sql`  
   Snapshot documental mínimo, útil para entender las tablas críticas, pero no sustituye un dump completo.

3. `supabase_schema.sql`  
   Contenedor reservado para un dump completo futuro de Supabase. No debe editarse a mano salvo para actualizar su nota operativa.

### Tablas críticas con RLS esperado

Según el snapshot limpio revisado en Supabase, estas tablas deben mantenerse con RLS activo:

- `profiles`
- `groups`
- `group_members`
- `group_invites`
- `events`
- `event_responses`
- `proposal_responses`
- `public_invites`
- `notifications`
- `push_subscriptions`
- `user_settings`
- `user_notification_settings`
- `external_busy_blocks`
- `external_calendar_settings`
- `connected_accounts`
- `google_accounts`
- `conflict_preferences`
- `conflict_resolutions`
- `conflict_resolutions_log`
- `events_analytics`

No tocar RLS/policies sin tener un bug confirmado o un snapshot actualizado de Supabase.

### Flujo correcto para cambios de DB

1. Crear una migration nueva en `db/migrations/`.
2. Ejecutar el SQL en Supabase SQL Editor o con Supabase CLI si el entorno local lo permite.
3. Probar:

```bash
npm run build
```

4. Commit solo de los archivos relacionados.
5. Verificar deploy en Vercel.

## Setup local

1. Instala dependencias

```bash
npm install
```

2. Crea `.env.local` con las variables necesarias.

Variables mínimas esperables según el código actual:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
APP_URL=
RESEND_API_KEY=
```

3. Levanta el proyecto

```bash
npm run dev
```

## Operación en Vercel

El proyecto usa crons en `vercel.json`. En plan Hobby, mantener horarios compatibles con los límites de Vercel. El cron de `leave-alerts` está configurado con frecuencia diaria para evitar bloqueos de deploy.

## Qué no tocar sin cuidado

- RLS y policies si no hay un bug real confirmado
- motor de conflictos por intuición
- estructura de grupos y membresías sin revisar impacto
- normalizaciones duplicadas repartidas en UI y librerías
- archivos grandes core sin un objetivo quirúrgico
- `supabase/.temp` si ya está trackeado por Git, salvo en un bloque separado de limpieza

## Regla de mantenimiento

Antes de tocar una pantalla o flujo, evaluar:

1. ¿reduce ruido o lo aumenta?
2. ¿aclara el producto o lo vuelve más ambiguo?
3. ¿sube percepción premium o la fragmenta?
4. ¿reduce deuda técnica o solo la tapa?
5. ¿deja una base más fácil de escalar?

## Estado documental actual

Este README reemplaza el template default de Next.js y sirve como base operativa inicial. La gobernanza de DB queda documentada, con `events_analytics` endurecida por migration 016 y con `db/schema.sql` como snapshot mínimo, no como dump reconstructivo completo.

## Environment & runtime governance

SyncPlans usa variables de entorno para Supabase, crons, emails, Google Calendar, Google Maps, push notifications y flags de debug.

El contrato operativo completo está en:

```txt
docs/ENVIRONMENT.md
```

Regla: no agregar nuevas variables de entorno sin documentarlas ahí. Nunca commitear valores secretos.
