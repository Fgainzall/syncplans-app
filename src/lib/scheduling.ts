// src/lib/scheduling.ts

import type { CalendarEvent } from "@/lib/conflicts";
import { groupMeta } from "@/lib/conflicts";

// ✅ Re-export para que puedas hacer:
// import { groupMeta } from "@/lib/scheduling";
export { groupMeta };

/* =========================
   Overlap helpers
   ========================= */

export function overlaps(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

function clampDay(date: Date, hour: number, minute: number) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(iso: string, mins: number) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + mins);
  return d.toISOString();
}

function durationMins(start: string, end: string) {
  return Math.max(
    0,
    Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  );
}

function isSlotFree(
  all: CalendarEvent[],
  startISO: string,
  endISO: string,
  excludeId?: string
) {
  for (const e of all) {
    if (excludeId && e.id === excludeId) continue;
    if (overlaps(startISO, endISO, e.start, e.end)) return false;
  }
  return true;
}

/* =========================
   Scheduling core
   ========================= */

export function findNextFreeSlot(params: {
  allEvents: CalendarEvent[];
  baseStart: string;
  durationMinutes: number;
  excludeId?: string;
  stepMins?: number;
  maxSearchMins?: number;
  // ventana diaria (por defecto 06:00–23:00)
  dayStartHour?: number;
  dayStartMin?: number;
  dayEndHour?: number;
  dayEndMin?: number;
}): { start: string; end: string } | null {
  const {
    allEvents,
    baseStart,
    durationMinutes,
    excludeId,
    stepMins,
    maxSearchMins,
    dayStartHour,
    dayStartMin,
    dayEndHour,
    dayEndMin,
  } = params;

  const step = stepMins ?? 15;
  const maxSearch = maxSearchMins ?? 24 * 60;

  const base = new Date(baseStart);

  const dsH = dayStartHour ?? 6;
  const dsM = dayStartMin ?? 0;
  const deH = dayEndHour ?? 23;
  const deM = dayEndMin ?? 0;

  let cursor = new Date(base.getTime());

  // si baseStart cae antes del inicio del día, arrancamos en inicio de día
  const dayStart = clampDay(cursor, dsH, dsM);
  const dayEnd = clampDay(cursor, deH, deM);
  if (cursor.getTime() < dayStart.getTime()) cursor = new Date(dayStart.getTime());

  const limit = new Date(cursor.getTime() + maxSearch * 60000);

  while (cursor.getTime() <= limit.getTime()) {
    // si ya pasamos el fin del día, saltamos a mañana inicio del día
    const curDayEnd = clampDay(cursor, deH, deM);
    if (cursor.getTime() > curDayEnd.getTime()) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      cursor = clampDay(next, dsH, dsM);
      continue;
    }

    const startISO = cursor.toISOString();
    const endISO = addMinutes(startISO, durationMinutes);

    // si el evento terminaría después del fin del día, no cabe: saltamos al siguiente slot/día
    if (new Date(endISO).getTime() > curDayEnd.getTime()) {
      const next = new Date(cursor);
      next.setDate(next.getDate() + 1);
      cursor = clampDay(next, dsH, dsM);
      continue;
    }

    if (isSlotFree(allEvents, startISO, endISO, excludeId)) {
      return { start: startISO, end: endISO };
    }

    cursor = new Date(cursor.getTime() + step * 60000);
  }

  return null;
}

export function buildMoveSuggestions(event: CalendarEvent, allEvents: CalendarEvent[]) {
  const dur = durationMins(event.start, event.end);

  // Sugerencias rápidas “forward”
  const candidates = [15, 30, 60];

  const out: Array<{
    label: string;
    start: string;
    end: string;
    deltaMins: number;
  }> = [];

  for (const delta of candidates) {
    const s = addMinutes(event.start, delta);
    const e = addMinutes(event.end, delta);
    if (isSlotFree(allEvents, s, e, event.id)) {
      out.push({
        label: `Mover +${delta}m`,
        start: s,
        end: e,
        deltaMins: delta,
      });
    }
  }

  // “Próximo hueco” real
  const next = findNextFreeSlot({
    allEvents,
    baseStart: event.end,
    durationMinutes: dur,
    excludeId: event.id,
    stepMins: 15,
    maxSearchMins: 24 * 60,
  });

  if (next) {
    const delta = Math.round(
      (new Date(next.start).getTime() - new Date(event.start).getTime()) / 60000
    );

    out.push({
      label: "Próximo hueco",
      start: next.start,
      end: next.end,
      deltaMins: delta,
    });
  }

  return out;
}
