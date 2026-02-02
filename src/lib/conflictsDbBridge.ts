// src/lib/conflictsDbBridge.ts
"use client";

import type { CalendarEvent, GroupType } from "@/lib/conflicts";
import { getMyEvents } from "@/lib/eventsDb";

/**
 * Cargador único de eventos para TODOS los flujos de conflictos
 * (detected / compare / actions).
 *
 * ✅ Usa getMyEvents() como source of truth (igual que el calendario).
 * ✅ Opcionalmente filtra por groupId si viene en la URL.
 */
export async function loadEventsFromDb(opts?: {
  groupId?: string | null;
}): Promise<{ events: CalendarEvent[] }> {
  const groupId = opts?.groupId ?? null;

  // 1) Traemos todos los eventos visibles para el usuario actual
  const dbEvents: any[] = (await getMyEvents()) as any[];

  // 2) Si hay groupId en la URL, filtramos solo esos;
  //    si NO hay groupId, usamos TODOS (personal + todos los grupos),
  //    igual que el calendario.
  const filtered = groupId
    ? dbEvents.filter((ev) => {
        const gid = ev.group_id ?? ev.groupId ?? null;
        return gid && String(gid) === String(groupId);
      })
    : dbEvents;

  // 3) Mapeamos a CalendarEvent (formato estándar de conflictos/calendario)
  const events: CalendarEvent[] = filtered
    .map((ev) => {
      const gid = ev.group_id ?? ev.groupId ?? null;

      // Inferimos el tipo de grupo si no viene explícito
      let gt: GroupType;
      if (ev.groupType) {
        gt = ev.groupType as GroupType;
      } else if (gid) {
        // Si tiene group_id, asumimos "pair" por defecto (pareja/familia
        // ya se distingue en el calendario con groupsDb, aquí solo importa
        // para el color de la UI).
        gt = "pair";
      } else {
        gt = "personal";
      }

      const start = String(ev.start ?? ev.start_at ?? "");
      const end = String(ev.end ?? ev.end_at ?? "");

      if (!start || !end) return null;

      return {
        id: String(ev.id),
        title: ev.title ?? "Evento",
        start,
        end,
        notes: ev.notes ?? ev.description ?? undefined,
        description: ev.description ?? undefined,
        groupId: gid ? String(gid) : null,
        groupType: gt,
      } as CalendarEvent;
    })
    .filter(Boolean) as CalendarEvent[];

  return { events };
}
