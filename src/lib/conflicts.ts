// src/lib/conflicts.ts
/**
 * Motor canónico de conflictos en SyncPlans.
 *
 * Todas las pantallas (Calendario, Conflictos, Eventos) deben usar
 * computeVisibleConflicts() como única fuente de verdad.
 *
 * Si mañana necesitas otro criterio (ej. ignorar ciertos tipos de eventos,
 * tratar viajes de varios días distinto, etc.), se extiende AQUÍ.
 *
 * ⚠️ Importante: conflictsFlow.ts es legacy y puede eliminarse.
 */

export type GroupType = "personal" | "pair" | "family" | "couple";
export type SyncPlansGroupType = GroupType;
export function normalizeGroupType(
  gt: GroupType
): "personal" | "pair" | "family" {
  if (gt === "couple") return "pair";
  if (gt === "pair") return "pair";
  if (gt === "family") return "family";
  return "personal";
}

export function groupMeta(groupType: GroupType) {
  const gt = normalizeGroupType(groupType);

  if (gt === "personal") {
    return {
      label: "Personal",
      dot: "#FBBF24", // amarillo
    };
  }

  if (gt === "pair") {
    return {
      label: "Pareja",
      dot: "#F87171", // rojo suave
    };
  }

  // familia (y cualquier otro que no sea par/personal)
  return {
    label: "Familia",
    dot: "#60A5FA", // azul
  };
}
export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO-ish
  end: string; // ISO-ish

  groupType: GroupType;
  groupId?: string | null;

  // UI estándar
  description?: string;

  // compat viejo
  notes?: string;
};

export type ConflictResolution = "keep_existing" | "replace_with_new" | "none";

export type ConflictItem = {
  id: string; // ✅ estable (determinístico)
  kind: "overlap";
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;

  // alias nuevo
  existingEvent?: CalendarEvent | null;
  incomingEvent?: CalendarEvent | null;

  resolution?: ConflictResolution;
};

export const EVENTS_KEY = "syncplans_events_v1";
export const RESOLUTIONS_KEY = "syncplans_conflict_resolutions_v1";

// 🆕 Conflictos ignorados a nivel local (para "Conservar ambos" del preflight)
export const IGNORED_CONFLICTS_KEY = "syncplans_conflicts_ignored_v1";

export function loadIgnoredConflictKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(IGNORED_CONFLICTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

export function saveIgnoredConflictKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    IGNORED_CONFLICTS_KEY,
    JSON.stringify(Array.from(keys))
  );
}

/** Marcar una lista de conflictos como ignorados (por id) */
export function ignoreConflictIds(ids: string[]) {
  if (!ids || !ids.length) return;
  const set = loadIgnoredConflictKeys();
  for (const id of ids) {
    if (!id) continue;
    set.add(String(id));
  }
  saveIgnoredConflictKeys(set);
}

/** Devolver solo los conflictos NO ignorados (por id) */
export function filterIgnoredConflicts(
  conflicts: ConflictItem[],
  ignored?: Set<string>,
): ConflictItem[] {
  if (!conflicts?.length) return [];
  const set = ignored ?? loadIgnoredConflictKeys();
  if (!set.size) return conflicts;
  return conflicts.filter((c) => !set.has(String(c.id)));
}

/* =========================
   Motor de conflictos visible
   ========================= */

function toMs(iso: string) {
  return new Date(iso).getTime();
}

function conflictKey(aId: string, bId: string) {
  return aId < bId ? `${aId}__${bId}` : `${bId}__${aId}`;
}

/**
 * Elección de "existing" vs "incoming" para UX:
 * - existing: el que ya está en el calendario
 * - incoming: el que estás intentando crear/modificar
 *
 * Ahora mismo la heurística es simple: por defecto, el más antiguo (start más temprano)
 * se considera "existing". Si empatas, rompe por id.
 */
function chooseExistingIncoming(
  a: CalendarEvent,
  b: CalendarEvent,
): { existing: CalendarEvent; incoming: CalendarEvent } {
  const aS = toMs(a.start);
  const bS = toMs(b.start);
  if (aS < bS) return { existing: a, incoming: b };
  if (bS < aS) return { existing: b, incoming: a };
  // empate: rompemos por id
  return a.id < b.id ? { existing: a, incoming: b } : { existing: b, incoming: a };
}

/**
 * computeVisibleConflicts
 *
 * - Recibe una lista genérica (CalendarEvent-like).
 * - Normaliza y descarta eventos sin rango válido.
 * - Aplica un barrido por tiempo (sweep line) para detectar solapamientos.
 * - Genera ConflictItem[] con ids determinísticos.
 */
export function computeVisibleConflicts(events: unknown): ConflictItem[] {
  const list: CalendarEvent[] = Array.isArray(events)
    ? (events.filter(Boolean) as CalendarEvent[])
    : [];

  const normalized = list
    .map((e) => {
      const s = toMs(e.start);
      const en = toMs(e.end);
      if (!Number.isFinite(s) || !Number.isFinite(en)) return null;
      if (en <= s) return null;
      return { e, s, en };
    })
    .filter(Boolean) as Array<{ e: CalendarEvent; s: number; en: number }>;

  if (!normalized.length) return [];

  // Ordenamos por inicio (s)
  normalized.sort((a, b) => a.s - b.s);

  const active: Array<{ e: CalendarEvent; s: number; en: number }> = [];
  const out: ConflictItem[] = [];
  const seen = new Set<string>();

  for (const cur of normalized) {
    // Limpiamos activos que ya terminaron
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].en <= cur.s) {
        active.splice(i, 1);
      }
    }

    // Comprobamos solape con cada activo restante
    for (const prev of active) {
      const oStart = Math.max(prev.s, cur.s);
      const oEnd = Math.min(prev.en, cur.en);
      if (oStart >= oEnd) continue;

      const pick = chooseExistingIncoming(prev.e, cur.e);
      const id = conflictKey(pick.existing.id, pick.incoming.id);
      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        kind: "overlap",
        existingEventId: pick.existing.id,
        incomingEventId: pick.incoming.id,
        overlapStart: new Date(oStart).toISOString(),
        overlapEnd: new Date(oEnd).toISOString(),
        existingEvent: pick.existing,
        incomingEvent: pick.incoming,
      });
    }

    active.push(cur);
  }

  return out;
}

/* =========================
   UX helpers
   ========================= */

export function conflictResolutionLabel(r?: ConflictResolution) {
  if (!r) return "Pendiente";
  if (r === "keep_existing") return "Conservar A";
  if (r === "replace_with_new") return "Conservar B";
  return "Sin resolución";
}

export function conflictResolutionHint(r?: ConflictResolution) {
  if (!r) return "Aún no has decidido qué hacer con este conflicto.";
  if (r === "keep_existing") {
    return "Se mantendrá el evento original y se descartará el nuevo.";
  }
  if (r === "replace_with_new") {
    return "Se reemplazará el evento original con el nuevo.";
  }
  return "Este conflicto quedará marcado como sin cambios.";
}

/* =========================
   Cache local opcional
   ========================= */

export function loadEventsFromCache(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter(Boolean) as CalendarEvent[];
  } catch {
    return [];
  }
}

export function saveEventsToCache(events: CalendarEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    EVENTS_KEY,
    JSON.stringify(Array.isArray(events) ? events : [])
  );
}