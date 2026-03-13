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

export type DbEvent = {
  id: string;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // timestamptz ISO
  end: string; // timestamptz ISO
};

/**
 * Payload para actualización completa de un evento.
 * Lo usamos en el formulario de edición.
 */
export type UpdateEventPayload = {
  id: string;
  title?: string;
  notes?: string;
  start?: string; // ISO
  end?: string; // ISO
  groupId?: string | null;
};

export type DeleteEventsResult = {
  requestedIds: string[];
  ownIds: string[];
  blockedIds: string[];
  deletedCount: number;
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

function normalizeIds(ids: string[]): string[] {
  return Array.from(
    new Set(
      (ids ?? [])
        .map((id) => String(id ?? "").trim())
        .filter((id) => id.length > 0)
    )
  );
}

/**
 * Devuelve un diagnóstico real del borrado.
 *
 * Regla importante:
 * - solo borra eventos cuyo `user_id` sea el usuario actual
 * - si el evento pertenece a otro usuario, queda en `blockedIds`
 *
 * Con esto evitamos el falso escenario de:
 * - UI dice "deleted=1"
 * - pero en realidad la BD borró 0
 */
export async function deleteEventsByIdsDetailed(
  ids: string[]
): Promise<DeleteEventsResult> {
  const requestedIds = normalizeIds(ids);

  if (requestedIds.length === 0) {
    return {
      requestedIds: [],
      ownIds: [],
      blockedIds: [],
      deletedCount: 0,
    };
  }

  const uid = await requireUid();

  const { data, error } = await supabase
    .from("events")
    .select("id, user_id")
    .in("id", requestedIds);

  if (error) {
    console.error("[deleteEventsByIdsDetailed] select error", error);
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  const ownIds = rows
    .filter((row: any) => String(row.user_id ?? "") === uid)
    .map((row: any) => String(row.id));

  const visibleIds = new Set(rows.map((row: any) => String(row.id)));
  const ownSet = new Set(ownIds);

  const blockedIds = requestedIds.filter(
    (id) => !visibleIds.has(id) || !ownSet.has(id)
  );

  let deletedCount = 0;

  if (ownIds.length > 0) {
    const { error: deleteError, count } = await supabase
      .from("events")
      .delete({ count: "exact" })
      .in("id", ownIds);

    if (deleteError) {
      console.error("[deleteEventsByIdsDetailed] delete error", deleteError);
      throw deleteError;
    }

    deletedCount = count ?? 0;
  }

  return {
    requestedIds,
    ownIds,
    blockedIds,
    deletedCount,
  };
}

/**
 * Compat vieja:
 * devuelve solo el número realmente borrado.
 */
export async function deleteEventsByIds(ids: string[]): Promise<number> {
  const result = await deleteEventsByIdsDetailed(ids);
  return result.deletedCount;
}

/* ======================================================
  Lecturas auxiliares
====================================================== */

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

  const { error } = await supabase.from("events").delete().eq("id", eventId);

  if (error) throw error;
}

/**
 * Actualizar solo las horas (drag & resize del timeline)
 */
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

/**
 * 📝 Actualizar un evento completo (formulario de edición)
 * - Título
 * - Notas
 * - Fechas
 * - group_id
 */
export async function updateEvent(
  payload: UpdateEventPayload
): Promise<void> {
  await requireUid();

  const { id, title, notes, start, end, groupId } = payload;

  if (!id) {
    throw new Error("Falta el id del evento a actualizar.");
  }

  const update: Record<string, any> = {};
  if (typeof title !== "undefined") update.title = title;
  if (typeof notes !== "undefined") update.notes = notes ?? null;
  if (typeof start !== "undefined") update.start = start;
  if (typeof end !== "undefined") update.end = end;
  if (typeof groupId !== "undefined") update.group_id = groupId;

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("events")
    .update(update)
    .eq("id", id);

  if (error) throw error;
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

  if (!groupIds || groupIds.length === 0) return rows;

  const set = new Set(groupIds.map(String));

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