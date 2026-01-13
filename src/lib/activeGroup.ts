"use client";

import supabase from "@/lib/supabaseClient";

/**
 * Active Group (DEMO + producción temprana)
 *
 * Orden de lectura (rápido y seguro):
 * 1) localStorage: "sp_active_group_id" (cache)
 * 2) DB: user_settings (key="active_group_id") (si existe y RLS ok)
 * 3) fallback: heurística (último group_members)
 *
 * Orden de escritura:
 * 1) localStorage (siempre)
 * 2) DB user_settings (best-effort, sin romper demo)
 */

const LS_KEY = "sp_active_group_id";
const DB_KEY = "active_group_id";

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

export async function getActiveGroupIdFromDb(): Promise<string | null> {
  // 1) cache local (rápido)
  const cached = safeGetLocal();
  if (cached) return cached;

  // 2) auth
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

    if (!sErr && s?.value) {
      const gid = String(s.value);
      safeSetLocal(gid);
      return gid;
    }
  } catch {
    // ignore
  }

  // 4) fallback: último group_members
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;

  const gid = data?.[0]?.group_id ?? null;
  if (gid) safeSetLocal(gid);
  return gid;
}

export async function setActiveGroupIdInDb(groupId: string | null): Promise<void> {
  // siempre guardamos local (demo fluida)
  safeSetLocal(groupId);

  const userId = await requireUid();

  // borrar setting si null
  if (!groupId) {
    try {
      await supabase.from("user_settings").delete().eq("user_id", userId).eq("key", DB_KEY);
    } catch {
      // ignore
    }
    return;
  }

  // upsert best-effort
  try {
    const payload: any = {
      user_id: userId,
      key: DB_KEY,
      value: groupId,
    };

    // si existe updated_at, ok; si no, lo ignora en error
    payload.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from("user_settings")
      .upsert(payload, { onConflict: "user_id,key" });

    if (error) {
      console.warn("setActiveGroupIdInDb: user_settings upsert failed:", error.message);
    }
  } catch (e: any) {
    console.warn("setActiveGroupIdInDb: user_settings error:", e?.message ?? e);
  }
}
