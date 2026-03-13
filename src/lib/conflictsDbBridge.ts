// src/lib/conflictsDbBridge.ts
"use client";

import type { CalendarEvent, GroupType } from "@/lib/conflicts";
import { getMyEvents } from "@/lib/eventsDb";
import { getMyGroups } from "@/lib/groupsDb";

function normalizeDbGroupType(value: unknown): GroupType {
  const t = String(value ?? "").toLowerCase();

  if (t === "family") return "family";
  if (t === "other" || t === "shared") return "other" as GroupType;
  if (t === "pair" || t === "couple") return "pair";
  return "personal";
}

/**
 * Cargador único de eventos para TODOS los flujos de conflictos
 * (detected / compare / actions).
 *
 * ✅ Usa getMyEvents() como source of truth (igual que el calendario).
 * ✅ Opcionalmente filtra por groupId si viene en la URL.
 * ✅ Respeta el tipo real del grupo usando groupsDb en vez de asumir
 *    que todo evento con group_id es "pair/couple".
 */
export async function loadEventsFromDb(opts?: {
  groupId?: string | null;
}): Promise<{ events: CalendarEvent[] }> {
  const groupId = opts?.groupId ?? null;

  const [dbEvents, dbGroups] = await Promise.all([
    getMyEvents().catch(() => [] as any[]),
    getMyGroups().catch(() => [] as any[]),
  ]);

  const typeByGroupId = new Map<string, GroupType>();
  for (const g of Array.isArray(dbGroups) ? dbGroups : []) {
    const gid = g?.id ? String(g.id) : "";
    if (!gid) continue;
    typeByGroupId.set(gid, normalizeDbGroupType(g?.type));
  }

  const filtered = groupId
    ? (dbEvents ?? []).filter((ev: any) => {
        const gid = ev?.group_id ?? ev?.groupId ?? null;
        return gid && String(gid) === String(groupId);
      })
    : dbEvents ?? [];

  const events: CalendarEvent[] = filtered
    .map((ev: any) => {
      const gid = ev?.group_id ?? ev?.groupId ?? null;
      const start = String(ev?.start ?? ev?.start_at ?? "");
      const end = String(ev?.end ?? ev?.end_at ?? "");

      if (!start || !end) return null;

      const inferredGroupType: GroupType = gid
        ? typeByGroupId.get(String(gid)) ?? ("other" as GroupType)
        : "personal";

      return {
        id: String(ev.id),
        title: ev.title ?? "Evento",
        start,
        end,
        notes: ev.notes ?? ev.description ?? undefined,
        description: ev.description ?? undefined,
        groupId: gid ? String(gid) : null,
        groupType: (ev.groupType as GroupType | undefined) ?? inferredGroupType,
      } as CalendarEvent;
    })
    .filter(Boolean) as CalendarEvent[];

  return { events };
}