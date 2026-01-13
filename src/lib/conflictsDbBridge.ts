// src/lib/conflictsDbBridge.ts
"use client";

import supabase from "@/lib/supabaseClient";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getMyGroups } from "@/lib/groupsDb";
import type { CalendarEvent, GroupType } from "@/lib/conflicts";

/**
 * Carga eventos para el motor de conflictos.
 * - Si opts.groupId existe: trae eventos de ESE group + personales (group_id null).
 * - Si no: trae todos los eventos visibles por RLS.
 *
 * Requiere columnas en `events`: start, end (timestamptz), group_id (uuid nullable), notes (nullable).
 */
export async function loadEventsFromDb(opts?: { groupId?: string | null }) {
  const gid = opts?.groupId ?? (await getActiveGroupIdFromDb());

  // 1) groups para mapear pair/family
  const myGroups = await getMyGroups().catch(() => []);
  const groupTypeById = new Map<string, "couple" | "family">(
  (myGroups || []).map((g: any) => {
    const id = String(g.id);
    const rawType = String(g.type ?? "").toLowerCase();
    const normalized: "couple" | "family" = rawType === "family" ? "family" : "couple";
    return [id, normalized];
  })
);


  // 2) query eventos (start/end son las columnas reales)
  let q = supabase.from("events").select("id, title, start, end, notes, group_id");

  // Si vino groupId: group + personales
  if (gid) {
    q = q.or(`group_id.eq.${gid},group_id.is.null`);
  }

  const { data, error } = await q.order("start", { ascending: true });
  if (error) throw error;

  // ✅ Validación mínima sin re-serializar fechas
  const isValidIsoish = (v: any) => {
    if (!v || typeof v !== "string") return false;
    const t = new Date(v).getTime();
    return !Number.isNaN(t);
  };

  const events: CalendarEvent[] = (data ?? [])
    .map((r: any) => {
      const startRaw = r.start;
      const endRaw = r.end;

      // ✅ Importante: NO hacemos new Date(...).toISOString()
      // Usamos exactamente lo que viene de DB (timestamptz -> string ISO)
      if (!isValidIsoish(startRaw) || !isValidIsoish(endRaw)) return null;

      const groupId = r.group_id ? String(r.group_id) : null;

      let groupType: GroupType = "personal";
      if (groupId) {
        const t = groupTypeById.get(groupId);
      groupType = t === "family" ? "family" : "couple";
      }

      return {
        id: String(r.id),
        title: r.title ?? "Evento",
        start: String(startRaw),
        end: String(endRaw),
        notes: r.notes ?? undefined,
        groupId,
        groupType,
      } as CalendarEvent;
    })
    .filter(Boolean) as CalendarEvent[];

  return { groupId: gid ?? null, events };
}

/** Usado en conflicts/actions para aplicar el plan */
export async function deleteEventsByIdsDb(ids: string[]) {
  if (!ids?.length) return;
  const { error } = await supabase.from("events").delete().in("id", ids);
  if (error) throw error;
}
