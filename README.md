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

## Qué no tocar sin cuidado

- RLS y policies si no hay un bug real confirmado
- motor de conflictos por intuición
- estructura de grupos y membresías sin revisar impacto
- normalizaciones duplicadas repartidas en UI y librerías
- archivos grandes core sin un objetivo quirúrgico

## Regla de mantenimiento

Antes de tocar una pantalla o flujo, evaluar:

1. ¿reduce ruido o lo aumenta?
2. ¿aclara el producto o lo vuelve más ambiguo?
3. ¿sube percepción premium o la fragmenta?
4. ¿reduce deuda técnica o solo la tapa?
5. ¿deja una base más fácil de escalar?

## Estado documental actual

Este README reemplaza el template default de Next.js y sirve como base operativa inicial. El snapshot de DB en `db/schema.sql` es intencionalmente mínimo y documental: prioriza dejar una referencia útil y honesta antes que fingir un dump completo no verificado.
<!-- trigger vercel rebuild -->
