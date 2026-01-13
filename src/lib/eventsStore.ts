// src/lib/eventsStore.ts
import supabase from "@/lib/supabaseClient";
import { CalendarEvent, GroupType } from "@/lib/conflicts";

type DbEventRow = {
  id: string;
  owner_id: string;
  group_id: string | null;

  title: string;
  notes: string | null;

  start: string;
  end: string;
  created_at: string;
  updated_at: string | null;
};

function normalizeTs(v: string) {
  if (!v) return v;
  if (v.includes("T")) return v;
  return v.replace(" ", "T");
}

function toCalendarEvent(r: DbEventRow): CalendarEvent {
  const inferred: GroupType = r.group_id ? "pair" : "personal"; // fallback
  return {
    id: r.id,
    title: r.title,
    start: normalizeTs(r.start),
    end: normalizeTs(r.end),
    groupId: r.group_id ?? undefined,
    groupType: inferred,
    notes: r.notes ?? undefined,
  } as any;
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select("id, owner_id, group_id, title, notes, start, end, created_at, updated_at")
    .order("start", { ascending: true });

  if (error) throw error;
  return ((data ?? []) as DbEventRow[]).map(toCalendarEvent);
}

export async function createEvent(input: {
  groupType: GroupType;
  groupId?: string | null;
  title: string;
  notes?: string;
  startIso: string;
  endIso: string;
}): Promise<CalendarEvent> {
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) throw authErr || new Error("No auth user");

  if (!input.title?.trim()) throw new Error("Falta título.");
  const s = new Date(input.startIso);
  const e = new Date(input.endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new Error("Fecha/hora inválida.");
  if (e.getTime() <= s.getTime()) throw new Error("La hora de fin debe ser posterior al inicio.");

  if (input.groupType !== "personal" && !input.groupId) {
    throw new Error("Falta groupId para evento de grupo.");
  }

  const payload = {
    owner_id: user.id,
    group_id: input.groupType === "personal" ? null : input.groupId!,
    title: input.title.trim(),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    start: input.startIso,
    end: input.endIso,
  };

  const { data, error } = await supabase.from("events").insert(payload).select("*").single();
  if (error) throw error;

  return toCalendarEvent(data as DbEventRow);
}

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  if (!ids.length) return 0;
  const { error } = await supabase.from("events").delete().in("id", ids);
  if (error) throw error;
  return ids.length;
}
