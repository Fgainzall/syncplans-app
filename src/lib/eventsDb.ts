// src/lib/eventsDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import {
  getOrCreatePublicInvite,
  type PublicInviteRow,
} from "@/lib/invitationsDb";

/* ======================================================
  Tipos base (DB)
====================================================== */

export type DbEventRow = {
  id: string;
  user_id: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // ISO string (timestamptz)
  end: string; // ISO string (timestamptz)
  created_at?: string | null;
  updated_at?: string | null;
  external_source?: string | null;
  external_id?: string | null;
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
  user_id: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // timestamptz ISO
  end: string; // timestamptz ISO
  created_at?: string | null;
  updated_at?: string | null;
  external_source?: string | null;
  external_id?: string | null;
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

export type GeneratePublicInviteLinkInput = {
  eventId: string;
  contact?: string | null;
  baseUrl?: string | null;
};

export type GeneratePublicInviteLinkResult = {
  invite: PublicInviteRow;
  link: string;
};

/* ======================================================
  Select común
====================================================== */

const EVENT_SELECT =
  "id, user_id, owner_id, created_by, group_id, title, notes, start, end, created_at, updated_at, external_source, external_id";

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
  Helpers internos de mapeo / ownership
====================================================== */

function mapDbEventRow(row: any): DbEventRow {
  return {
    id: String(row.id),
    user_id: row.user_id ?? null,
    owner_id: row.owner_id ?? null,
    created_by: row.created_by ?? null,
    group_id: row.group_id ?? null,
    title: row.title ?? null,
    notes: row.notes ?? null,
    start: String(row.start),
    end: String(row.end),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
    external_source: row.external_source ?? null,
    external_id: row.external_id ?? null,
  };
}

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
 * Intenta resolver la "autoridad" del evento de la forma más robusta posible
 * con el modelo actual de la BD.
 *
 * Prioridad:
 * 1) owner_id
 * 2) user_id
 * 3) created_by
 */
function resolveEventOwnerId(row: any): string {
  return String(
    row?.owner_id ?? row?.user_id ?? row?.created_by ?? ""
  ).trim();
}

function resolvePublicAppBaseUrl(explicitBaseUrl?: string | null): string {
  const explicit = String(explicitBaseUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  if (explicit) return explicit;

  const envBase = String(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  )
    .trim()
    .replace(/\/$/, "");
  if (envBase) return envBase;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
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
    .select(EVENT_SELECT)
    .order("start", { ascending: true });

  if (error) throw error;

  return (data ?? []).map(mapDbEventRow);
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
    owner_id: uid,
    created_by: uid,
    group_id: payload.groupId,
    title: payload.title,
    notes: payload.notes ?? null,
    start: payload.start,
    end: payload.end,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(insertPayload)
    .select(EVENT_SELECT)
    .single();

  if (error) throw error;

  return mapDbEventRow(data);
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

/**
 * Devuelve un diagnóstico real del borrado.
 *
 * Regla importante:
 * - solo borra eventos cuyo owner efectivo sea el usuario actual
 * - si el evento pertenece a otro usuario, queda en blockedIds
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
    .select("id, user_id, owner_id, created_by")
    .in("id", requestedIds);

  if (error) {
    console.error("[deleteEventsByIdsDetailed] select error", error);
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  const ownIds = rows
    .filter((row: any) => resolveEventOwnerId(row) === uid)
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
    .select(EVENT_SELECT)
    .eq("id", eventId)
    .single();

  if (error) throw error;
  return mapDbEventRow(data);
}

export async function listEventsByGroup(groupId: string): Promise<DbEvent[]> {
  await requireUid();

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("group_id", groupId)
    .order("start", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapDbEventRow);
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
  Invitaciones públicas externas
====================================================== */

export async function generatePublicInviteLink(
  input: GeneratePublicInviteLinkInput | string
): Promise<GeneratePublicInviteLinkResult> {
  const safeInput =
    typeof input === "string"
      ? { eventId: input, contact: null, baseUrl: null }
      : input;

  const eventId = String(safeInput.eventId ?? "").trim();
  const contact =
    safeInput.contact === undefined ? null : safeInput.contact ?? null;

  if (!eventId) {
    throw new Error("Falta el evento para generar el link público.");
  }

  await getEventById(eventId);

  const invite = await getOrCreatePublicInvite({
    eventId,
    contact,
  });

  const baseUrl = resolvePublicAppBaseUrl(safeInput.baseUrl);
  const link = `${baseUrl}/invite/${encodeURIComponent(invite.token)}`;

  return {
    invite,
    link,
  };
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