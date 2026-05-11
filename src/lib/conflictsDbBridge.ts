// src/lib/conflictsDbBridge.ts
"use client";

import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { normalizeGroupType as normalizeCanonicalGroupType } from "@/lib/naming";
import {
  getEventsForGroupsInRange,
  getMyEvents,
  type DbEventRow,
} from "@/lib/eventsDb";
import {
  normalizeEventGroupType,
  type CalendarEvent,
  type GroupType,
} from "@/lib/conflicts";

export type LoadEventsFromDbOptions = {
  groupId?: string | null;
  /**
   * Optional visible window. When present, loads only overlapping events.
   * This keeps conflict screens fast without changing the default behavior.
   */
  startIso?: string | null;
  endIso?: string | null;
};

export type LoadEventsFromDbResult = {
  events: CalendarEvent[];
  groups: GroupRow[];
  activeGroupId: string | null;
};

type GroupTypeMap = Map<string, GroupType>;
type DbEventWithDates = DbEventRow & {
  start?: string | null;
  end?: string | null;
};

type DbGroupWithType = {
  id?: string | number | null;
  type?: string | null;
};
function normalizeDbGroupType(raw: string | null | undefined): GroupType {
  return normalizeCanonicalGroupType(raw);
}

function buildGroupTypeMap(groups: GroupRow[]): GroupTypeMap {
  const m: GroupTypeMap = new Map();

  for (const g of groups ?? []) {
    const id = String(g.id ?? "");
    if (!id) continue;

    m.set(id, normalizeDbGroupType((g as DbGroupWithType).type));
  }

  return m;
}

function buildConflictWindowAround(startIso: string, endIso: string): {
  startIso: string;
  endIso: string;
} | null {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const windowStart = new Date(start);
  windowStart.setDate(windowStart.getDate() - 2);

  const windowEnd = new Date(end);
  windowEnd.setDate(windowEnd.getDate() + 2);

  return {
    startIso: windowStart.toISOString(),
    endIso: windowEnd.toISOString(),
  };
}

function buildConflictsScreenWindow(): { startIso: string; endIso: string } {
  const now = new Date();

  const start = new Date(now);
  start.setDate(start.getDate() - 30);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setDate(end.getDate() + 180);
  end.setHours(23, 59, 59, 999);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function getDefaultConflictsScreenWindow(): {
  startIso: string;
  endIso: string;
} {
  return buildConflictsScreenWindow();
}

function mapDbEventToCalendarEvent(
  row: DbEventRow,
  groupTypeMap: GroupTypeMap
): CalendarEvent | null {
  const eventRow = row as DbEventWithDates;
  const start = String(eventRow.start ?? "").trim();
  const end = String(eventRow.end ?? "").trim();

  if (!start || !end) return null;

  const groupId = row.group_id ? String(row.group_id) : null;

  let groupType: GroupType = "personal";

  if (groupId) {
    groupType = groupTypeMap.get(groupId) ?? "other";
  }

  return {
    id: String(row.id),
    title: String(row.title ?? "Evento"),
    start,
    end,
    notes: row.notes ?? undefined,
    description: row.notes ?? undefined,
    groupId,
    groupType: normalizeEventGroupType(groupType),
  };
}

/**
 * Carga la base de eventos visibles para el usuario actual.
 *
 * Regla:
 * - sin groupId => devuelve personales + todos los grupos visibles
 * - con groupId => devuelve personales + ese grupo
 *
 * Esto deja alineados:
 * - conflictos
 * - resumen
 * - calendario
 */
export async function loadEventsFromDb(
  opts: LoadEventsFromDbOptions = {}
): Promise<LoadEventsFromDbResult> {
  const requestedGroupId = opts.groupId ? String(opts.groupId) : null;
  const startIso = opts.startIso ? String(opts.startIso).trim() : "";
  const endIso = opts.endIso ? String(opts.endIso).trim() : "";
  const hasRange = Boolean(startIso && endIso);

  const groups = await getMyGroups();

  const validGroups = Array.isArray(groups) ? groups : [];

  const activeGroupId =
    requestedGroupId &&
    validGroups.some((g) => String(g.id) === requestedGroupId)
      ? requestedGroupId
      : null;

  const groupIdsForQuery = activeGroupId
    ? [activeGroupId]
    : validGroups.map((g) => String(g.id)).filter(Boolean);

  // Importante: /calendar ya lee con esta semántica exacta
  // (personal + grupos visibles). /conflicts/detected debe usar la misma
  // fuente para no decir “todo claro” cuando el calendario sí muestra
  // un cruce entre Personal y Pareja/Familia/Compartido.
  const rows = hasRange
    ? await getEventsForGroupsInRange(groupIdsForQuery, startIso, endIso)
    : await getMyEvents();

  const validRows = Array.isArray(rows) ? rows : [];

  const groupTypeMap = buildGroupTypeMap(validGroups);

  const filteredRows = validRows.filter((row) => {
    const gid = row.group_id ? String(row.group_id) : null;

    if (!gid) return true; // personales siempre entran
    if (!activeGroupId) return true; // sin filtro, trae todos los visibles
    return gid === activeGroupId;
  });

  const events = filteredRows
    .map((row) => mapDbEventToCalendarEvent(row, groupTypeMap))
    .filter(Boolean) as CalendarEvent[];

  return {
    events,
    groups: validGroups,
    activeGroupId,
  };
}

/**
 * Preflight de conflicto para un evento nuevo/edited antes de guardar.
 *
 * Recibe el evento candidato y lo compara contra la base visible:
 * - personales
 * - + grupo activo si corresponde
 */
export async function loadEventsForConflictPreflight(args: {
  candidate: {
    id?: string | null;
    title: string;
    start: string;
    end: string;
    groupId?: string | null;
    groupType?: string | null;
    notes?: string | null;
  };
}): Promise<{
  baseEvents: CalendarEvent[];
  candidateEvent: CalendarEvent;
  groups: GroupRow[];
}> {
  const candidate = args.candidate;

  const groupId = candidate.groupId ? String(candidate.groupId) : null;
  const candidateWindow = buildConflictWindowAround(candidate.start, candidate.end);

  const { events, groups } = await loadEventsFromDb({
    groupId,
    startIso: candidateWindow?.startIso ?? null,
    endIso: candidateWindow?.endIso ?? null,
  });

  let candidateGroupType: GroupType = "personal";

  if (groupId) {
    const g = (groups ?? []).find((x) => String(x.id) === groupId);
    candidateGroupType = normalizeDbGroupType(
      (g as DbGroupWithType | undefined)?.type
    );
  } else if (candidate.groupType) {
    candidateGroupType = normalizeDbGroupType(candidate.groupType);
  }

  const candidateEvent: CalendarEvent = {
    id: String(candidate.id ?? "__candidate__"),
    title: String(candidate.title ?? "Evento"),
    start: String(candidate.start),
    end: String(candidate.end),
    notes: candidate.notes ?? undefined,
    description: candidate.notes ?? undefined,
    groupId,
    groupType: normalizeEventGroupType(candidateGroupType),
  };

  const baseEvents = events.filter(
    (e) => String(e.id) !== String(candidateEvent.id)
  );

  return {
    baseEvents,
    candidateEvent,
    groups,
  };
}

/**
 * Compat helper por si alguna pantalla antigua lo usa.
 */
export async function loadEventsForGroupConflict(groupId?: string | null) {
  return loadEventsFromDb({ groupId: groupId ?? null });
}

/**
 * Utilidad por si luego quieres usarla en otros módulos.
 */
export async function getVisibleCalendarEventsForGroup(
  groupId?: string | null
): Promise<CalendarEvent[]> {
  const { events } = await loadEventsFromDb({ groupId: groupId ?? null });
  return events;
}