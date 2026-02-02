// src/lib/conflictsDbBridge.ts
"use client";

import supabase from "@/lib/supabaseClient";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import type { CalendarEvent, GroupType } from "@/lib/conflicts";

type EventsTableRow = {
  id: string;
  title: string | null;
  start: string;
  end: string;
  notes: string | null;
  group_id: string | null;
};

/**
 * Carga eventos para el motor de conflictos.
 * - Si opts.groupId existe: trae eventos de ESE group + personales (group_id null).
 * - Si no: trae todos los eventos visibles por RLS.
 */
export async function loadEventsFromDb(
  opts?: { groupId?: string | null }
): Promise<{ groupId: string | null; events: CalendarEvent[] }> {
  const gid = opts?.groupId ?? (await getActiveGroupIdFromDb());

  // 1) groups para mapear pair/family
  let myGroups: GroupRow[] = [];
  try {
    myGroups = await getMyGroups();
  } catch {
    myGroups = [];
  }

  const groupTypeById = new Map<string, "couple" | "family">(
    myGroups.map((g) => {
      const id = String(g.id);
      const rawType = String(g.type ?? "").toLowerCase();
      const normalized: "couple" | "family" =
        rawType === "family" ? "family" : "couple";
      return [id, normalized];
    })
  );

  // 2) query eventos (start/end son las columnas reales)
  let q = supabase
    .from("events")
    .select("id, title, start, end, notes, group_id");

  // Si vino groupId: group + personales
  if (gid) {
    q = q.or(`group_id.eq.${gid},group_id.is.null`);
  }

  const { data, error } = await q.order("start", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as EventsTableRow[];

  const isValidIsoish = (v: unknown): v is string => {
    if (!v || typeof v !== "string") return false;
    const t = new Date(v).getTime();
    return !Number.isNaN(t);
  };

  const events: CalendarEvent[] = [];

  for (const r of rows) {
    const startRaw = r.start;
    const endRaw = r.end;

    if (!isValidIsoish(startRaw) || !isValidIsoish(endRaw)) {
      continue;
    }

    const groupId = r.group_id ? String(r.group_id) : null;

    let groupType: GroupType = "personal";
    if (groupId) {
      const t = groupTypeById.get(groupId);
      groupType = (t === "family" ? "family" : "couple") as GroupType;
    }

    const ev: CalendarEvent = {
      id: String(r.id),
      title: r.title ?? "Evento",
      start: String(startRaw),
      end: String(endRaw),
      notes: r.notes ?? undefined,
      groupId,
      groupType,
    };

    events.push(ev);
  }

  return { groupId: gid ?? null, events };
}

/** Usado en conflicts/actions para aplicar el plan */
export async function deleteEventsByIdsDb(ids: string[]): Promise<void> {
  if (!ids?.length) return;

  const cleaned = ids
    .map((id) => String(id).trim())
    .filter((id) => id.length > 0);

  if (!cleaned.length) return;

  const { error } = await supabase
    .from("events")
    .delete()
    .in("id", cleaned);

  if (error) throw error;
}
