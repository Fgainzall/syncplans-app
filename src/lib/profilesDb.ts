// src/lib/profilesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type CoordinationPrefs = {
  prefers_mornings: boolean;
  prefers_evenings: boolean;
  prefers_weekdays: boolean;
  prefers_weekends: boolean;
  blocked_note: string;
  decision_style: "decide_fast" | "discuss" | "depends";
};

export type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url?: string | null;
  display_name?: string | null;

  // 👇 Preferencias de coordinación globales
  coordination_prefs?: CoordinationPrefs | null;

  // 👇 Info básica de plan / monetización
  plan_tier?: string | null; // 'demo_premium', 'free', 'premium', etc.
  plan_status?: string | null; // 'trial', 'active', 'cancelled', etc.
  trial_ends_at?: string | null; // ISO string o null
};

async function requireUid(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const uid = data.user?.id;
  if (!uid) {
    throw new Error("Not authenticated");
  }
  return uid;
}

/**
 * Normaliza un objeto cualquiera a CoordinationPrefs completo.
 */
export function normalizeCoordinationPrefs(
  prefs?: CoordinationPrefs | null
): CoordinationPrefs {
  return {
    prefers_mornings: prefs?.prefers_mornings ?? false,
    prefers_evenings: prefs?.prefers_evenings ?? false,
    prefers_weekdays: prefs?.prefers_weekdays ?? false,
    prefers_weekends: prefs?.prefers_weekends ?? false,
    blocked_note: prefs?.blocked_note ?? "",
    decision_style: prefs?.decision_style ?? "depends",
  };
}

/**
 * Obtiene mi perfil desde la tabla `profiles`.
 * Si no existe, devuelve null.
 */
export async function getMyProfile(): Promise<Profile | null> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      display_name,
      coordination_prefs,
      plan_tier,
      plan_status,
      trial_ends_at
    `
    )
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const p = data as any;

  return {
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    avatar_url: p.avatar_url ?? null,
    display_name: p.display_name ?? null,
    coordination_prefs: p.coordination_prefs ?? null,
    plan_tier: p.plan_tier ?? null,
    plan_status: p.plan_status ?? null,
    trial_ends_at: p.trial_ends_at ?? null,
  };
}

/**
 * Crea o actualiza mi perfil (UPSERT).
 * Usa:
 *  - id = auth.uid()
 *  - display_name = "Nombre Apellido"
 * No toca coordinación ni plan; respeta lo que ya haya en la fila.
 */
export async function createMyProfile(input: {
  first_name: string;
  last_name: string;
}): Promise<Profile> {
  const uid = await requireUid();

  const first_name = input.first_name.trim();
  const last_name = input.last_name.trim();

  if (!first_name || !last_name) {
    throw new Error("Nombre y apellido son obligatorios.");
  }

  const display_name = `${first_name} ${last_name}`.trim();

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: uid,
        display_name,
        first_name,
        last_name,
      },
      { onConflict: "id" }
    )
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      display_name,
      coordination_prefs,
      plan_tier,
      plan_status,
      trial_ends_at
    `
    )
    .single();

  if (error) throw error;

  const p = data as any;

  return {
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    avatar_url: p.avatar_url ?? null,
    display_name: p.display_name ?? null,
    coordination_prefs: p.coordination_prefs ?? null,
    plan_tier: p.plan_tier ?? null,
    plan_status: p.plan_status ?? null,
    trial_ends_at: p.trial_ends_at ?? null,
  };
}

/**
 * Actualiza SOLO las preferencias de coordinación.
 * Si no existe fila en profiles, la crea.
 * Se asegura de no violar el NOT NULL de display_name.
 */
export async function updateMyCoordinationPrefs(
  prefs: CoordinationPrefs
): Promise<Profile> {
  const uid = await requireUid();
  const normalized = normalizeCoordinationPrefs(prefs);

  // 1) Intentar leer perfil actual para no pisar datos
  let existing: Profile | null = null;
  try {
    existing = await getMyProfile();
  } catch {
    existing = null;
  }

  // 2) Si no existe, necesitamos un display_name no nulo
  let displayNameForInsert: string | null = null;
  if (!existing) {
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;

    const metaName =
      (u?.user_metadata?.full_name as string | undefined) ||
      (u?.user_metadata?.name as string | undefined) ||
      "";

    const emailName =
      (u?.email ? u.email.split("@")[0] : "") || "Usuario SyncPlans";

    displayNameForInsert = (metaName || emailName).trim() || "Usuario SyncPlans";
  }

  const payload: any = {
    id: uid,
    coordination_prefs: normalized,
  };

  // Solo seteamos display_name si estamos insertando por primera vez
  if (!existing && displayNameForInsert) {
    payload.display_name = displayNameForInsert;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      display_name,
      coordination_prefs,
      plan_tier,
      plan_status,
      trial_ends_at
    `
    )
    .single();

  if (error) throw error;

  const p = data as any;

  return {
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    avatar_url: p.avatar_url ?? null,
    display_name: p.display_name ?? null,
    coordination_prefs: p.coordination_prefs ?? null,
    plan_tier: p.plan_tier ?? null,
    plan_status: p.plan_status ?? null,
    trial_ends_at: p.trial_ends_at ?? null,
  };
}

/**
 * (Opcional) Helper para debug / ajustes manuales:
 * cambia plan_tier / plan_status / trial_ends_at del usuario actual.
 * Útil mientras no hay Stripe todavía.
 */
export async function updateMyPlanDebug(input: {
  plan_tier?: string | null;
  plan_status?: string | null;
  trial_ends_at?: string | null;
}): Promise<Profile> {
  const uid = await requireUid();

  const payload: Record<string, any> = { id: uid };

  if (input.plan_tier !== undefined) {
    payload.plan_tier = input.plan_tier;
  }
  if (input.plan_status !== undefined) {
    payload.plan_status = input.plan_status;
  }
  if (input.trial_ends_at !== undefined) {
    payload.trial_ends_at = input.trial_ends_at;
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      display_name,
      coordination_prefs,
      plan_tier,
      plan_status,
      trial_ends_at
    `
    )
    .single();

  if (error) throw error;

  const p = data as any;

  return {
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    avatar_url: p.avatar_url ?? null,
    display_name: p.display_name ?? null,
    coordination_prefs: p.coordination_prefs ?? null,
    plan_tier: p.plan_tier ?? null,
    plan_status: p.plan_status ?? null,
    trial_ends_at: p.trial_ends_at ?? null,
  };
}

/**
 * Obtiene perfiles por un listado de ids (para Members, etc.)
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id)))).filter(
    Boolean
  );
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select(
      `
      id,
      first_name,
      last_name,
      avatar_url,
      display_name,
      coordination_prefs,
      plan_tier,
      plan_status,
      trial_ends_at
    `
    )
    .in("id", uniqueIds);

  if (error) throw error;

  return (data ?? []).map((p: any) => ({
    id: p.id,
    first_name: p.first_name ?? null,
    last_name: p.last_name ?? null,
    avatar_url: p.avatar_url ?? null,
    display_name: p.display_name ?? null,
    coordination_prefs: p.coordination_prefs ?? null,
    plan_tier: p.plan_tier ?? null,
    plan_status: p.plan_status ?? null,
    trial_ends_at: p.trial_ends_at ?? null,
  }));
}

/**
 * Devuelve iniciales "FG" a partir de first_name/last_name o display_name.
 */
export function getInitials(p: {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
}): string {
  let first = (p.first_name ?? "").trim();
  let last = (p.last_name ?? "").trim();

  if (!first || !last) {
    const dn = (p.display_name ?? "").trim();
    if (dn) {
      const parts = dn.split(/\s+/);
      if (!first && parts.length > 0) first = parts[0];
      if (!last && parts.length > 1) last = parts[parts.length - 1];
    }
  }

  const a = first ? first[0].toUpperCase() : "";
  const b = last ? last[0].toUpperCase() : "";

  if (a || b) return `${a}${b}`;
  return "U";
}
