// src/lib/eventsMiniDb.ts
import supabase from "@/lib/supabaseClient";

export type DbEvent = {
  id: string;
  group_id: string | null;
  title: string | null;
  notes: string | null;
  start: string; // timestamptz ISO
  end: string;   // timestamptz ISO
};

export async function getEventById(eventId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("id, group_id, title, notes, start, end")
    .eq("id", eventId)
    .single();

  if (error) throw error;
  return data as DbEvent;
}

export async function listEventsByGroup(groupId: string) {
  const { data, error } = await supabase
    .from("events")
    .select("id, group_id, title, notes, start, end")
    .eq("group_id", groupId)
    .order("start", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DbEvent[];
}

export async function deleteEventById(eventId: string) {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function updateEventTime(eventId: string, startIso: string, endIso: string) {
  const { error } = await supabase
    .from("events")
    .update({ start: startIso, end: endIso })
    .eq("id", eventId);

  if (error) throw error;
}
