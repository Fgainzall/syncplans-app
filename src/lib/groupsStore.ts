// src/lib/groupsStore.ts
"use client";

import { create, type StateCreator } from "zustand";
import { getMyGroups, type GroupRow as DbGroupRow, type GroupType as DbGroupType } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb, setActiveGroupIdInDb } from "@/lib/activeGroup";

export type GroupType = DbGroupType;

export type GroupItem = {
  id: string;
  name: string; // siempre “humano” (fallback si no hay groups.name)
  type: GroupType;
  role?: "owner" | "admin" | "member" | string;
  created_at?: string | null;
  created_by?: string | null;
  my_display_name?: string | null;
};

type GroupsState = {
  items: GroupItem[];
  loading: boolean;
  error: string | null;

  activeGroupId: string | null;
  activeGroup: GroupItem | null;

  hydrated: boolean;

  refresh: () => Promise<void>;
  setActive: (groupId: string | null) => Promise<void>;
};

function normalizeGroupType(t: DbGroupRow["type"]): GroupType {
  const v = String(t ?? "other");
  if (v === "pair" || v === "family" || v === "other" || v === "solo" || v === "personal") return v;
  return "other";
}

function getFallbackGroupName(type: GroupType) {
  if (type === "pair") return "Pareja";
  if (type === "family") return "Familia";
  if (type === "solo" || type === "personal") return "Personal";
  return "Grupo";
}

function getHumanGroupName(g: DbGroupRow): string {
  const type = normalizeGroupType(g.type);
  const raw = (g.name ?? "").trim();
  return raw.length > 0 ? raw : getFallbackGroupName(type);
}

const creator: StateCreator<GroupsState, [], [], GroupsState> = (set, get) => ({
  items: [],
  loading: false,
  error: null,

  activeGroupId: null,
  activeGroup: null,

  hydrated: false,

  refresh: async () => {
    set({ loading: true, error: null });

    try {
      // 1) cargar grupos
      const rows = await getMyGroups();

      // 2) leer activeGroupId (DB -> fallback)
      const activeId = await getActiveGroupIdFromDb().catch(() => null);

      // 3) normalizar items (name humano)
      const items: GroupItem[] = (rows ?? []).map((g: DbGroupRow) => {
        const type = normalizeGroupType(g.type);
        return {
          id: g.id,
          name: getHumanGroupName(g),
          type,
          role: (g as any).role ?? "member",
          created_at: (g as any).created_at ?? null,
          created_by: (g as any).created_by ?? null,
          my_display_name: (g as any).my_display_name ?? null,
        };
      });

      // 4) elegir activo: activeId válido -> primer grupo
      const firstId = items[0]?.id ?? null;
      const finalActiveId =
        activeId && items.some((x) => x.id === activeId) ? activeId : firstId;

      const activeGroup = finalActiveId
        ? items.find((x) => x.id === finalActiveId) ?? null
        : null;

      // 5) persistimos best-effort si cambió
      if (finalActiveId && finalActiveId !== activeId) {
        await setActiveGroupIdInDb(finalActiveId).catch(() => {});
      }

      set({
        items,
        loading: false,
        error: null,
        activeGroupId: finalActiveId,
        activeGroup,
        hydrated: true,
      });
    } catch (e: any) {
      set({
        loading: false,
        error: e?.message ?? "No se pudieron cargar tus grupos.",
        hydrated: true,
      });
    }
  },

  setActive: async (groupId: string | null) => {
    const items = get().items;
    const finalId =
      groupId && items.some((x) => x.id === groupId) ? groupId : null;

    set({
      activeGroupId: finalId,
      activeGroup: finalId ? items.find((x) => x.id === finalId) ?? null : null,
    });

    await setActiveGroupIdInDb(finalId).catch(() => {});
  },
});

export const useGroupsStore = create<GroupsState>()(creator);