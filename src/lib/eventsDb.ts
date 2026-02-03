// src/lib/eventsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

/* ======================================================
   Tipos base (DB)
====================================================== */

export type DbEventRow = {
  id: string;
  user_id: string | null;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // ISO string (timestamptz)
  end: string; // ISO string (timestamptz)
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateEventPayload = {
  title: string;
  notes?: string;
  start: string; // ISO
  end: string; // ISO
  groupId: string | null;
};

/* ======================================================
   Helper interno: uid actual
====================================================== */

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) {
    throw new Error("No hay sesión activa. Inicia sesión nuevamente.");
  }
  return uid;
}

/* ======================================================
   Lectura principal: getMyEvents
====================================================== */

/**
 * Devuelve TODOS los eventos visibles para el usuario actual.
 * (RLS manda la visibilidad.)
 *
 * El mapeo a CalendarEvent + groupType se hace en UI:
 * - CalendarClient
 * - /events
 * - /summary
 * - flujos de conflictos (vía conflictsDbBridge)
 */
export async function getMyEvents(_opts?: unknown): Promise<DbEventRow[]> {
  await requireUid();

  const { data, error } = await supabase
    .from("events")
    .select(
      "id, user_id, group_id, title, notes, start, end, created_at, updated_at"
    )
    .order("start", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((e: any) => ({
    id: String(e.id),
    user_id: e.user_id ?? null,
    group_id: e.group_id ?? null,
    title: e.title ?? null,
    notes: e.notes ?? null,
    start: String(e.start),
    end: String(e.end),
    created_at: e.created_at ?? null,
    updated_at: e.updated_at ?? null,
  }));
}

/* ======================================================
   Escritura: crear evento
====================================================== */

export async function createEventForGroup(
  payload: CreateEventPayload
): Promise<DbEventRow> {
  const uid = await requireUid();

  const insertPayload = {
    user_id: uid,
    group_id: payload.groupId,
    title: payload.title,
    notes: payload.notes ?? null,
    start: payload.start,
    end: payload.end,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(insertPayload)
    .select(
      "id, user_id, group_id, title, notes, start, end, created_at, updated_at"
    )
    .single();

  if (error) throw error;

  const row: any = data;

  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    group_id: row.group_id ?? null,
    title: row.title ?? null,
    notes: row.notes ?? null,
    start: String(row.start),
    end: String(row.end),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * Azúcar: crear evento personal (sin group_id)
 */
export async function createPersonalEvent(
  payload: Omit<CreateEventPayload, "groupId">
): Promise<DbEventRow> {
  return createEventForGroup({
    ...payload,
    groupId: null,
  });
}

/* ======================================================
   Borrado: uno o varios eventos
====================================================== */

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  // Normalizamos y evitamos llamadas vacías
  const cleaned = (ids ?? [])
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (cleaned.length === 0) return 0;

  await requireUid();

  // ✅ SOLO borramos por `id` con un array de UUIDs plano
  // ✅ NINGUNA subquery, nada de "select group_id from group_members"
  const { error, count } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .in("id", cleaned);

  if (error) {
    console.error("[deleteEventsByIds] error", error);
    throw error;
  }

  return count ?? 0;
}

/* ======================================================
   Aliases de compatibilidad (para no romper imports antiguos)
====================================================== */

/**
 * Compat: muchas pantallas antiguas llaman getEventsForGroups(groupIds)
 * Mantiene personal (group_id null) SIEMPRE, y si pasan groupIds filtra SOLO eventos de esos grupos.
 */
export async function getEventsForGroups(
  groupIds?: string[]
): Promise<DbEventRow[]> {
  const rows = await getMyEvents();

  // Si no pasaron ids, devolvemos todo lo visible
  if (!groupIds || groupIds.length === 0) return rows;

  const set = new Set(groupIds.map(String));

  // ✅ personal siempre incluido (group_id null)
  return rows.filter((r) => !r.group_id || set.has(String(r.group_id)));
}

/**
 * Compat: algunos sitios pueden esperar algo tipo "getAllEventsFlat"
 * → devolvemos exactamente lo mismo que getMyEvents().
 */
export async function getAllEventsFlat(): Promise<DbEventRow[]> {
  return getMyEvents();
}

/**
 * Compat: deleteEvent(id) → deleteEventsByIds([id])
 */
export async function deleteEvent(id: string): Promise<number> {
  if (!id) return 0;
  return deleteEventsByIds([id]);
}

/**
 * Alias adicionales por si quedaron imports antiguos:
 * - getEvents()
 * - getAllEvents()
 * - getEventsFlat()
 */
export async function getEvents(): Promise<DbEventRow[]> {
  return getMyEvents();
}

export async function getAllEvents(): Promise<DbEventRow[]> {
  return getMyEvents();
}

export async function getEventsFlat(): Promise<DbEventRow[]> {
  return getMyEvents();
}

/* ======================================================
   Helpers adicionales usados por otros módulos
====================================================== */

export type DbEvent = {
  id: string;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // timestamptz ISO
  end: string; // timestamptz ISO
};

export async function getEventById(eventId: string): Promise<DbEvent> {
  await requireUid();

  const { data, error } = await supabase
    .from("events")
    .select("id, group_id, title, notes, start, end")
    .eq("id", eventId)
    .single();

  if (error) throw error;
  return data as DbEvent;
}

export async function listEventsByGroup(groupId: string): Promise<DbEvent[]> {
  await requireUid();

  const { data, error } = await supabase
    .from("events")
    .select("id, group_id, title, notes, start, end")
    .eq("group_id", groupId)
    .order("start", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function deleteEventById(eventId: string): Promise<void> {
  await requireUid();

  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", eventId);

  if (error) throw error;
}

export async function updateEventTime(
  eventId: string,
  startIso: string,
  endIso: string
): Promise<void> {
  await requireUid();

  const { error } = await supabase
    .from("events")
    .update({ start: startIso, end: endIso })
    .eq("id", eventId);

  if (error) throw error;
}
