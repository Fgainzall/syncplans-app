// src/lib/activeGroup.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * Active Group (DEMO + producción temprana)
 *
 * Lectura:
 * 1) localStorage: "sp_active_group_id"
 * 2) DB: user_settings.active_group_id (best-effort, si existe)
 * 3) fallback: último group_members
 *
 * Escritura:
 * 1) localStorage (siempre)
 * 2) DB user_settings.active_group_id (best-effort, si existe)
 *
 * ✅ Event bus:
 * - "sp:active-group-changed"
 */

const LS_KEY = "sp_active_group_id";
const EVENT_NAME = "sp:active-group-changed";
const DB_DISABLED_KEY = "sp_active_group_db_disabled"; // si falta columna, lo desactivamos

function emitActiveGroupChanged(groupId: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { groupId } }));
  } catch {
    // ignore
  }
}

export function onActiveGroupChanged(cb: (groupId: string | null) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (ev: any) => cb(ev?.detail?.groupId ?? null);
  window.addEventListener(EVENT_NAME as any, handler as any);
  return () => window.removeEventListener(EVENT_NAME as any, handler as any);
}

function safeGetLocal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function safeSetLocal(v: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!v) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, v);
  } catch {
    // ignore
  }
}

function isDbDisabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DB_DISABLED_KEY) === "1";
  } catch {
    return false;
  }
}

function disableDbForever() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_DISABLED_KEY, "1");
  } catch {
    // ignore
  }
}

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) throw new Error("Not authenticated");
  return uid;
}

function normalizeGroupId(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (s === "null" || s === "undefined") return null;
  if (s.length < 10) return null;
  return s;
}

export async function getActiveGroupIdFromDb(): Promise<string | null> {
  // 1) cache local
  const cached = normalizeGroupId(safeGetLocal());
  if (cached) return cached;

  // 2) auth best-effort
  const userId = await requireUid().catch(() => null);
  if (!userId) return null;

  // 3) DB best-effort (solo si no fue deshabilitado por error previo)
  if (!isDbDisabled()) {
    try {
      const { data, error } = await supabase
        .from("user_settings")
        .select("active_group_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        // si la columna no existe / schema mismatch -> deshabilitamos DB para no spammear 400
        disableDbForever();
      } else {
        const gid = normalizeGroupId((data as any)?.active_group_id);
        if (gid) {
          safeSetLocal(gid);
          return gid;
        }
      }
    } catch {
      disableDbForever();
    }
  }

  // 4) fallback: último group_members
  try {
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;

    const gid = normalizeGroupId(data?.[0]?.group_id);
    if (gid) safeSetLocal(gid);
    return gid;
  } catch {
    return null;
  }
}

export async function setActiveGroupIdInDb(groupId: string | null): Promise<void> {
  const normalized = normalizeGroupId(groupId);

  // 1) local siempre + evento
  safeSetLocal(normalized);
  emitActiveGroupChanged(normalized);

  // 2) DB best-effort (solo si no está deshabilitado)
  if (isDbDisabled()) return;

  const userId = await requireUid().catch(() => null);
  if (!userId) return;

  try {
    // upsert en user_settings usando columna active_group_id
    const { error } = await supabase
      .from("user_settings")
      .upsert(
        { user_id: userId, active_group_id: normalized },
        { onConflict: "user_id" }
      );

    if (error) {
      disableDbForever();
    }
  } catch {
    disableDbForever();
  }
}