"use client";

import supabase from "@/lib/supabaseClient";
import type { CalendarEvent, GroupType } from "@/lib/conflicts";

/**
 * events (DB) esperado:
 * - id uuid
 * - owner_id uuid  ✅ (recomendado con RLS)
 * - title text
 * - notes text nullable
 * - start timestamptz
 * - end timestamptz
 * - group_id uuid nullable
 *
 * IMPORTANTE:
 * - NO usamos events.group_type (NO existe)
 * - El groupType se resuelve en UI usando group_id -> groups.type
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
    // se “enriquece” bien en /calendar
    groupType: "personal" as GroupType,
  } as CalendarEvent;
}

export async function getMyEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id,title,notes,start,end,group_id")
    .order("start", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as DbEventRow[]).map(toCalendarEvent);
}

export async function getEventsForGroups(groupIds?: string[]): Promise<CalendarEvent[]> {
  if (!groupIds) return getMyEvents();
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("events")
    .select("id,title,notes,start,end,group_id")
    .in("group_id", groupIds)
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

  const payload: any = {
    owner_id: uid, // ✅ explícito (evita depender de triggers)
    title: input.title,
    notes: input.notes ?? null,
    start: input.start,
    end: input.end,
    group_id: input.groupId ?? null,
  };

  const { data, error } = await supabase.from("events").insert([payload]).select("id").single();
  if (error) throw error;

  return { id: (data as any).id };
}

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;

  const { error, count } = await supabase.from("events").delete({ count: "exact" }).in("id", ids);

  if (error) throw error;
  return count ?? 0;
}
