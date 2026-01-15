"use client";

import supabase from "@/lib/supabaseClient";
import type { CalendarEvent, GroupType } from "@/lib/conflicts";

/**
 * events (DB) esperado:
 * - id uuid
 * - owner_id uuid
 * - title text
 * - notes text nullable
 * - start timestamptz
 * - end timestamptz
 * - group_id uuid nullable
 */

export type DbEventRow = {
  id: string;
  owner_id?: string | null;
  title: string | null;
  notes: string | null;
  start: string; // ISO
  end: string; // ISO
  group_id: string | null;
  created_at?: string;
  updated_at?: string;
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function toCalendarEvent(r: DbEventRow): CalendarEvent {
  return {
    id: r.id,
    title: r.title ?? "Evento",
    notes: r.notes ?? undefined,
    start: r.start,
    end: r.end,
    groupId: r.group_id ?? null,
    // se enriquece luego con groups.type
    groupType: "personal" as GroupType,
  };
}

export async function getMyEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,notes,start,end,group_id")
    .order("start", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as DbEventRow[]).map(toCalendarEvent);
}

/**
 * ✅ Importante:
 * Si pasas groupIds, trae:
 * - eventos de esos grupos
 * - + eventos personales (group_id is null)
 */
export async function getEventsForGroups(groupIds?: string[]): Promise<CalendarEvent[]> {
  if (!groupIds) return getMyEvents();

  if (groupIds.length === 0) {
    // si no hay grupos, al menos trae personales
    const { data, error } = await supabase
      .from("events")
      .select("id,title,notes,start,end,group_id")
      .is("group_id", null)
      .order("start", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DbEventRow[]).map(toCalendarEvent);
  }

  // ✅ Supabase OR syntax: group_id.in.(uuid1,uuid2) OR group_id.is.null
  // Importante: NO uses comillas dentro del in.(...)
  const inList = groupIds.join(",");

  const { data, error } = await supabase
    .from("events")
    .select("id,title,notes,start,end,group_id")
    .or(`group_id.in.(${inList}),group_id.is.null`)
    .order("start", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as DbEventRow[]).map(toCalendarEvent);
}

export async function createEventForGroup(input: {
  title: string;
  notes?: string;
  start: string; // ISO
  end: string; // ISO
  groupId: string | null;
}): Promise<{ id: string }> {
  const uid = await requireUid();

  const payload = {
    owner_id: uid,
    title: input.title,
    notes: input.notes ?? null,
    start: input.start,
    end: input.end,
    group_id: input.groupId ?? null,
  };

  const { data, error } = await supabase
    .from("events")
    .insert([payload])
    .select("id")
    .single();

  if (error) throw error;
  return { id: (data as any).id };
}

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;

  const { error, count } = await supabase
    .from("events")
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) throw error;
  return count ?? 0;
}
