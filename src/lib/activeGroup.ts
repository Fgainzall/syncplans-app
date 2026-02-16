// src/lib/activeGroup.ts
"use client";

import supabase from "@/lib/supabaseClient";

/**
 * Active Group (DEMO + producción temprana)
 *
 * Lectura (rápido y robusto):
 * 1) localStorage: "sp_active_group_id"
 * 2) DB: user_settings (key="active_group_id") (best-effort)
 * 3) fallback: último group_members
 *
 * Escritura:
 * 1) localStorage (siempre)
 * 2) DB user_settings (best-effort, no rompe demo)
 *
 * ✅ Event bus:
 * - "sp:active-group-changed" para que Calendar/Summary reaccionen sin reload.
 */

const LS_KEY = "sp_active_group_id";
const DB_KEY = "active_group_id";
const EVENT_NAME = "sp:active-group-changed";

function emitActiveGroupChanged(groupId: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { groupId } }));
  } catch {
    // ignore
  }
}

/**
 * ✅ Suscripción a cambios de active group (runtime).
 * Retorna un cleanup.
 */
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

  // No validamos UUID hard para no romper ambientes/seed raros,
  // pero evitamos basura obvia.
  if (s.length < 10) return null;

  // Evitar strings tipo "null" / "undefined"
  if (s === "null" || s === "undefined") return null;

  return s;
}

/**
 * Lee el active group siguiendo el orden:
 * localStorage → user_settings → último group_members
 */
export async function getActiveGroupIdFromDb(): Promise<string | null> {
  // 1) cache local
  const cached = normalizeGroupId(safeGetLocal());
  if (cached) return cached;

  // 2) auth (best-effort)
  const userId = await requireUid().catch(() => null);
  if (!userId) return null;

  // 3) DB user_settings (best-effort)
  try {
    const { data: s, error: sErr } = await supabase
      .from("user_settings")
      .select("value")
      .eq("user_id", userId)
      .eq("key", DB_KEY)
      .maybeSingle();

    if (!sErr) {
      const gid = normalizeGroupId((s as any)?.value);
      if (gid) {
        safeSetLocal(gid);
        return gid;
      }
    }
  } catch {
    // ignore (tabla/policy no existe, etc.)
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
    // Si ni siquiera podemos leer memberships, devolvemos null
    return null;
  }
}

/**
 * Guarda el active group:
 * - siempre en localStorage
 * - best-effort en user_settings
 * - emite evento para que otras pantallas refresquen sin reload
 */
export async function setActiveGroupIdInDb(
  groupId: string | null
): Promise<void> {
  const normalized = normalizeGroupId(groupId);

  // 1) local cache siempre + evento
  safeSetLocal(normalized);
  emitActiveGroupChanged(normalized);

  // 2) DB (best-effort)
  const userId = await requireUid().catch(() => null);
  if (!userId) return;

  // Si null → intentamos borrar en DB (best-effort)
  if (!normalized) {
    try {
      await supabase
        .from("user_settings")
        .delete()
        .eq("user_id", userId)
        .eq("key", DB_KEY);
    } catch {
      // ignore
    }
    return;
  }

  // Upsert best-effort sin asumir columnas extra (ej: updated_at)
  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: userId,
        key: DB_KEY,
        value: normalized,
      },
      { onConflict: "user_id,key" }
    );

    if (error) {
      console.warn(
        "setActiveGroupIdInDb: user_settings upsert failed:",
        error.message
      );
    }
  } catch (e: any) {
    console.warn("setActiveGroupIdInDb: user_settings error:", e?.message ?? e);
  }
}