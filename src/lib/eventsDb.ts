// src/lib/eventsDb.ts
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
  start: string; // ISO string
  end: string; // ISO string
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
 *
 * El mapeo a CalendarEvent + groupType se hace en:
 * - CalendarClient
 * - /calendar
 * - /calendar/month
 * - /events
 * - /summary
 */
export async function getMyEvents(_opts?: unknown): Promise<DbEventRow[]> {
  // Solo para forzar que haya sesión; RLS hace el resto
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

  return {
    id: String(data.id),
    user_id: data.user_id ?? null,
    group_id: data.group_id ?? null,
    title: data.title ?? null,
    notes: data.notes ?? null,
    start: String(data.start),
    end: String(data.end),
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
  };
}

/* ======================================================
   Borrado: uno o varios eventos
====================================================== */

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;

  const uid = await requireUid();

  const { error, count } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .in(
      "id",
      ids.map((id) => String(id))
    )
    // Seguridad extra: solo borro lo que le pertenece al usuario
    .or(
      `user_id.eq.${uid},group_id.in.(select group_id from group_members where user_id.eq.${uid})`
    );

  if (error) throw error;
  return count ?? 0;
}

/* ======================================================
   Aliases de compatibilidad
====================================================== */

/**
 * Alias plano: reutiliza getMyEvents.
 */
export async function getAllEventsFlat(): Promise<DbEventRow[]> {
  return getMyEvents();
}

/**
 * API para código viejo. Acepta opcionalmente una lista de groupIds
 * pero por ahora los filtros de grupo se hacen en el frontend.
 */
export async function getEventsForGroups(
  _groupIds?: string[]
): Promise<DbEventRow[]> {
  return getMyEvents();
}

/**
 * Alias de borrado de un solo evento.
 */
export async function deleteEvent(id: string): Promise<number> {
  if (!id) return 0;
  return deleteEventsByIds([id]);
}
