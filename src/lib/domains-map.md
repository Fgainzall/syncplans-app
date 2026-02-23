# SyncPlans — Mapa de Dominios (`src/lib/`)

Este archivo documenta qué hace cada módulo de `src/lib/` y a qué “dominio” pertenece.

La idea es:

- Que no haya archivos “sueltos” sin dueño.
- Que cualquier refactor futuro (Panel, tests, design system) sepa dónde tocar.
- Separar mentalmente **dominio**, **infraestructura** y **cosas de UI**.

---

## 0. Infraestructura base

**Propósito:** hablar con Supabase y manejar auth a nivel de servidor/cliente.

- `supabaseClient.ts`  
  Cliente de Supabase para usar en componentes cliente.

- `supabaseServer.ts`  
  Cliente de Supabase para usar en componentes servidor (usa cookies, etc.).

- `auth.ts`  
  Helpers de autenticación: login, logout, recuperación de sesión, etc.

- `auditDb.ts`  
  Helpers para registrar o leer eventos de auditoría relacionados con la base de datos.

---

## 1. Perfiles, Cuenta y Premium

**Propósito:** quién es el usuario, qué plan tiene y qué puede hacer.

- `profilesDb.ts`  
  Acceso a la tabla de perfiles (`profiles`): leer/crear/actualizar.

- `profile.ts`  
  Helpers de modelo de perfil (tipos, normalización, etc.).

- `premium.ts`  
  Lógica de plan:  
  - `isPremiumUser(profile)`  
  - `isTrialActive(profile)`  
  Todo basado en `plan_tier`, `subscription_status` / `plan_status`, `trial_ends_at`.

- `roles.ts`  
  Definición de roles y permisos lógicos a nivel de producto (ej. owner, admin, member).

---

## 2. Grupos (GroupsDomain)

**Propósito:** manejar grupos (pareja, familia, compartidos), miembros y acciones sobre grupos.

- `groupsDb.ts`  
  Acceso a la tabla `groups` y `group_members`.  
  Crear grupo, listar grupos del usuario, actualizar metadatos, etc.

- `groups.ts`  
  Lógica de estado de grupo en la app:  
  - modo de uso (`solo`, `pair`, `family`, `shared`)  
  - grupo activo  
  - helpers de UX.

- `groupsStore.ts`  
  Store/estado reactivo relacionado con grupos.  
  Maneja cambios de grupo activo en el cliente.

- `groupActionsDb.ts`  
  Acciones específicas sobre grupos que impactan en la DB  
  (ej. abandonar grupo, eliminar grupo, cambiar rol).

- `groupInvitesDb.ts`  
  Lógica de invitaciones a grupos:  
  - crear invitación  
  - aceptar / rechazar  
  - consultar invitaciones pendientes.

- `groupNotificationSettings.ts`  
  Configuración de notificaciones por grupo (ej. que grupos disparan correos / avisos).

---

## 3. Eventos (EventsDomain)

**Propósito:** todo lo que tenga que ver con eventos en el calendario.

- `eventsDb.ts`  
  Acceso a la tabla `events`:  
  - obtener eventos del usuario  
  - crear / actualizar / borrar eventos  
  - helpers para eventos de grupo.

- `events.ts`  
  Tipos y lógica de dominio alrededor de eventos:  
  - normalización  
  - conversión entre formatos  
  - helpers puros.

- `eventsMiniDb.ts`  
  Versión ligera de acceso a eventos (por ejemplo, usada en preflights o pantallas mini).

- `eventsStore.ts`  
  Store/estado reactivo para eventos en el cliente.

- `scheduling.ts`  
  Lógica de planificación:  
  - helpers de fecha/hora específicos de eventos  
  - reglas de scheduling más avanzadas.

---

## 4. Conflictos (ConflictsDomain)

**Propósito:** detectar, visualizar y resolver choques de eventos.

- `conflicts.ts`  
  Motor canónico de conflictos + helpers de UX:

  - Tipos: `GroupType`, `CalendarEvent`, `ConflictItem`, `ConflictResolution`.
  - Detección: `computeVisibleConflicts(events)`.
  - Overlap & claves estables: `overlapRange`, `conflictKey`, `chooseExistingIncoming`.
  - Enriquecimiento: `attachEvents(conflicts, allEvents)`.
  - UX: `conflictResolutionLabel`, `conflictResolutionHint`.
  - Cache local (solo cliente): `loadEvents`, `saveEvents`.
  - Ignorados (preflight): `loadIgnoredConflictKeys`, `ignoreConflictIds`, `filterIgnoredConflicts`.

- `conflictsDbBridge.ts`  
  Puente entre conflictos y base de datos:  
  cómo se guardan / leen resoluciones de conflictos.

- `conflictResolutionsDb.ts`  
  CRUD de resoluciones de conflictos en DB (tabla de resoluciones).

- `conflictPrefs.ts`  
  Preferencias de usuario relacionadas con conflictos  
  (ej. cómo quiere que se le muestren o resuelvan por defecto).

- `conflictsFlow.ts`  
  **Legacy** — versión antigua del motor de conflictos.  
  No debería usarse en código nuevo; se mantiene temporalmente solo como referencia histórica.

---

## 5. Notificaciones y Ajustes (NotificationsDomain / SettingsDomain)

**Propósito:** qué notificaciones recibe el usuario y cómo se configuran.

- `notificationsDb.ts`  
  Acceso a tabla de notificaciones (si existe en DB):  
  - listar notificaciones  
  - marcar como leídas, etc.

- `notificationSettingsDb.ts`  
  Acceso a la configuración de notificaciones a nivel DB.

- `userNotificationSettings.ts`  
  Modelo y helpers de configuración de notificaciones por usuario.

- `settings.ts`  
  Lógica de ajustes de la app a nivel de dominio  
  (no solo notificaciones, también otros toggles o preferencias).

- `settingsDb.ts`  
  Acceso a tabla de settings / configuration en base de datos.

---

## 6. Active Group / Otros helpers

**Propósito:** piezas auxiliares que apuntan a un dominio concreto.

- `activeGroup.ts`  
  Helpers para recuperar/guardar el grupo activo del usuario (por ejemplo, en DB o local).

- `auditDb.ts`  
  (también listado arriba) — logging / auditoría relacionada con acciones en base de datos.

---

## Notas finales

- **Regla general:** cuando añadas lógica nueva de dominio, piensa primero  
  “¿en qué dominio cae?” y crea/usa el archivo correcto aquí.
- Si una pantalla (`page.tsx` / `*Client.tsx`) está haciendo demasiada lógica de dominio,
  lo ideal es moverla a alguno de estos módulos de `src/lib/`.
- Cualquier refactor grande (ej. Panel como HUB, tests, integración avanzada con Google)
  debería referirse a este archivo para saber qué tocar y dónde.