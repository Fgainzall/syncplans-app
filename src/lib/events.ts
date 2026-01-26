// src/lib/events.ts
/**
 * LEGACY / DEMO EVENTS STORE (LOCAL ONLY)
 * ---------------------------------------
 * Esta capa usa localStorage a través de helpers de `conflicts.ts` para guardar eventos
 * de manera LOCAL en el navegador. No habla con Supabase ni con la tabla `events`.
 *
 * 👉 Fuente de verdad REAL de eventos compartidos:
 *    - src/lib/eventsDb.ts  (Supabase)
 *
 * Usa este módulo SOLO para:
 *  - demos locales
 *  - tests rápidos en el navegador
 *  - compatibilidad con pantallas antiguas que esperan `SyncPlans.getEvents()`, etc.
 *
 * Para cualquier feature nueva de SyncPlans, usa SIEMPRE `eventsDb.ts`.
 */

import {
  loadEvents as _loadEvents,
  saveEvents as _saveEvents,
  type CalendarEvent,
  type GroupType,
} from "@/lib/conflicts";

export type { CalendarEvent, GroupType };
export type SyncPlansGroupType = GroupType;

/** uid local (no dependas de exports inexistentes) */
function uid(prefix = "ev") {
  try {
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/* =========================================
   Normalizador (compat notes <-> description)
   ========================================= */
function normalizeEvent(e: any): CalendarEvent {
  return {
    id: String(e?.id ?? uid("ev")),
    title: String(e?.title ?? ""),
    start: String(e?.start ?? new Date().toISOString()),
    end: String(e?.end ?? new Date(Date.now() + 60 * 60 * 1000).toISOString()),
    groupType: (e?.groupType ?? "personal") as GroupType,
    groupId: e?.groupId ?? null,

    // ✅ estándar UI
    description:
      typeof e?.description === "string"
        ? e.description
        : typeof e?.notes === "string"
        ? e.notes
        : "",

    // 🧯 compat
    notes:
      typeof e?.notes === "string"
        ? e.notes
        : typeof e?.description === "string"
        ? e.description
        : "",
  };
}

/* =========================================
   API legacy: getEvents / updateEvent
   ========================================= */

export async function getEvents(): Promise<CalendarEvent[]> {
  const list = _loadEvents().map(normalizeEvent);
  _saveEvents(list);
  return list;
}

export async function addEvent(
  payload: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  const all = await getEvents();
  const ev = normalizeEvent({ ...payload, id: uid("ev") });
  const next = [ev, ...all];
  _saveEvents(next);
  return ev;
}

export async function updateEvent(
  id: string,
  patch: Partial<CalendarEvent>
): Promise<CalendarEvent | null> {
  const all = await getEvents();
  const next = all.map((e) =>
    String(e.id) === String(id) ? normalizeEvent({ ...e, ...patch }) : e
  );
  _saveEvents(next);
  return next.find((e) => String(e.id) === String(id)) ?? null;
}

export async function deleteEvent(id: string): Promise<boolean> {
  const all = await getEvents();
  const next = all.filter((e) => String(e.id) !== String(id));
  _saveEvents(next);
  return true;
}

/* =========================================
   API nueva: SyncPlans (compat)
   ========================================= */

export const SyncPlans = {
  getEvents,
  addEvent: (payload: Partial<CalendarEvent>) => addEvent(payload),
  updateEvent: (id: string, patch: Partial<CalendarEvent>) =>
    updateEvent(id, patch),
  deleteEvent: (id: string) => deleteEvent(id),
};
