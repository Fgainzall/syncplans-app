// src/lib/eventsStore.ts
"use client";

/**
 * EVENTS STORE (UI BRIDGE)
 * ------------------------
 * Esta capa adapta la forma cruda de la tabla `events` (DbEventRow)
 * a la forma UI `CalendarEvent` que usan:
 *
 *  - CalendarClient
 *  - /events
 *  - /summary
 *
 * 👉 Source of truth REAL: src/lib/eventsDb.ts
 * 👉 No guarda nada en memoria global, ni en localStorage.
 */

import { type CalendarEvent, type GroupType } from "@/lib/conflicts";
import {
  getMyEvents,
  createEventForGroup,
  deleteEventsByIds as dbDeleteEventsByIds,
  type DbEventRow,
} from "@/lib/eventsDb";

function normalizeTs(v: string) {
  if (!v) return v;
  if (v.includes("T")) return v;
  return v.replace(" ", "T");
}

function inferGroupTypeFromRow(r: DbEventRow): GroupType {
  if (!r.group_id) return "personal";
  // Si quieres algo más fino (family vs pair) necesitaríamos join con groups.
  return "pair" as GroupType;
}

function toCalendarEvent(r: DbEventRow): CalendarEvent {
  const inferred = inferGroupTypeFromRow(r);

  const ev: CalendarEvent = {
    id: String(r.id),
    title: r.title ?? "Evento",
    start: normalizeTs(r.start),
    end: normalizeTs(r.end),
    groupId: r.group_id,
    groupType: inferred,
    notes: r.notes ?? undefined,
  };

  return ev;
}

/**
 * Devuelve todos los eventos del usuario como CalendarEvent[]
 * usando eventsDb como source of truth.
 */
export async function fetchEvents(): Promise<CalendarEvent[]> {
  const rows = await getMyEvents();
  return (rows ?? []).map(toCalendarEvent);
}

/**
 * Crea un evento desde UI legacy (calendario viejo).
 * Usa eventsDb como source of truth.
 */
export async function createEvent(input: {
  groupType: GroupType;
  groupId?: string | null;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
}): Promise<CalendarEvent> {
  if (!input.title?.trim()) throw new Error("Falta título.");

  const s = new Date(input.startIso);
  const e = new Date(input.endIso);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error("Fecha/hora inválida.");
  }
  if (e.getTime() <= s.getTime()) {
    throw new Error("La hora de fin debe ser posterior al inicio.");
  }

  if (input.groupType !== "personal" && !input.groupId) {
    throw new Error("Falta groupId para evento de grupo.");
  }

  const dbRow = await createEventForGroup({
    title: input.title.trim(),
    notes: input.notes?.trim() ? input.notes.trim() : undefined,
    start: input.startIso,
    end: input.endIso,
    groupId: input.groupType === "personal" ? null : input.groupId ?? null,
  });

  return toCalendarEvent(dbRow);
}

/**
 * Borrado por IDs, delegando al helper central de eventsDb.
 */
export async function deleteEventsByIds(ids: string[]): Promise<number> {
  const cleaned = (ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (!cleaned.length) return 0;
  return dbDeleteEventsByIds(cleaned);
}
