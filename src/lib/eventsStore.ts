// src/lib/eventsStore.ts
import supabase from "@/lib/supabaseClient";
import { type CalendarEvent, type GroupType } from "@/lib/conflicts";

type DbEventRow = {
  id: string;
  user_id: string | null;
  group_id: string | null;

  title: string | null;
  notes: string | null;

  start: string;
  end: string;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeTs(v: string) {
  if (!v) return v;
  if (v.includes("T")) return v;
  return v.replace(" ", "T");
}

function toCalendarEvent(r: DbEventRow): CalendarEvent {
  const inferred: GroupType = r.group_id ? "pair" : "personal";

  const ev: CalendarEvent = {
    id: String(r.id),
    title: r.title ?? "Evento",
    start: normalizeTs(r.start),
    end: normalizeTs(r.end),
    groupId: r.group_id,
    groupType: inferred,
    notes: r.notes ?? undefined,
  };

  return ev;
}

export async function fetchEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, user_id, group_id, title, notes, start, end, created_at, updated_at"
    )
    .order("start", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as DbEventRow[];
  return rows.map(toCalendarEvent);
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
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    throw new Error("Fecha/hora inválida.");
  }
  if (e.getTime() <= s.getTime()) {
    throw new Error("La hora de fin debe ser posterior al inicio.");
  }

  if (input.groupType !== "personal" && !input.groupId) {
    throw new Error("Falta groupId para evento de grupo.");
  }

  const payload = {
    user_id: user.id,
    group_id: input.groupType === "personal" ? null : input.groupId!,
    title: input.title.trim(),
    notes: input.notes?.trim() ? input.notes.trim() : null,
    start: input.startIso,
    end: input.endIso,
  };

  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select(
      "id, user_id, group_id, title, notes, start, end, created_at, updated_at"
    )
    .single();

  if (error) throw error;

  return toCalendarEvent(data as DbEventRow);
}

export async function deleteEventsByIds(ids: string[]): Promise<number> {
  const cleaned = ids
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (!cleaned.length) return 0;

  const { error } = await supabase
    .from("events")
    .delete()
    .in("id", cleaned);

  if (error) throw error;
  return cleaned.length;
}
