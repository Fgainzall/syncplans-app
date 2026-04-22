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

export type OnboardingState = {
  completed: boolean;
  completed_at: string | null;
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
  plan_tier?: string | null; // 'demo_premium', 'free', 'premium_monthly', etc.
  plan_status?: string | null; // 'trial', 'active', 'canceled', 'cancelled', etc.
  trial_ends_at?: string | null; // ISO string o null

  // 👇 Resumen diario por correo
  daily_digest_enabled?: boolean | null;
  daily_digest_hour_local?: number | null;
  daily_digest_timezone?: string | null;

  // 👇 Nuevo: onboarding persistente (si la columna ya existe en DB)
  onboarding_completed?: boolean | null;
  onboarding_completed_at?: string | null;
};

type ProfileRow = Record<string, any>;

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

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
    avatar_url: row.avatar_url ?? null,
    display_name: row.display_name ?? null,
    coordination_prefs: row.coordination_prefs ?? null,
    plan_tier: row.plan_tier ?? null,
    plan_status: row.plan_status ?? null,
    trial_ends_at: row.trial_ends_at ?? null,
    daily_digest_enabled: row.daily_digest_enabled ?? null,
    daily_digest_hour_local: row.daily_digest_hour_local ?? null,
    daily_digest_timezone: row.daily_digest_timezone ?? null,
    onboarding_completed: row.onboarding_completed ?? null,
    onboarding_completed_at: row.onboarding_completed_at ?? null,
  };
}

export function getOnboardingStateFromProfile(
  profile?: Profile | null
): OnboardingState {
  return {
    completed: profile?.onboarding_completed === true,
    completed_at: profile?.onboarding_completed_at ?? null,
  };
}

export function isOnboardingCompleted(profile?: Profile | null): boolean {
  return getOnboardingStateFromProfile(profile).completed;
}

function getOnboardingSchemaErrorMessage(): string {
  return [
    'Falta soportar onboarding persistente en la tabla "profiles".',
    "Antes de usar estas helpers, crea las columnas:",
    "- onboarding_completed boolean default false",
    "- onboarding_completed_at timestamptz null",
  ].join(" ");
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
      trial_ends_at,
      daily_digest_enabled,
      daily_digest_hour_local,
      daily_digest_timezone
    `
    )
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return mapProfileRow(data as ProfileRow);
}

/**
 * Lee el estado de onboarding desde profiles usando `select("*")`
 * para no romper el app si la columna todavía no existe.
 */
export async function getMyOnboardingState(): Promise<OnboardingState> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return {
      completed: false,
      completed_at: null,
    };
  }

  return getOnboardingStateFromProfile(mapProfileRow(data as ProfileRow));
}

/**
 * Marca el onboarding como completado.
 * OJO: esta función requiere que la tabla `profiles` ya tenga
 * `onboarding_completed` y `onboarding_completed_at`.
 */
export async function markMyOnboardingCompleted(): Promise<OnboardingState> {
  const uid = await requireUid();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      onboarding_completed_at: now,
    })
    .eq("id", uid)
    .select("*")
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("onboarding_completed")) {
      throw new Error(getOnboardingSchemaErrorMessage());
    }
    throw error;
  }

  if (!data) {
    throw new Error(
      'No se pudo marcar el onboarding como completado en la tabla "profiles".'
    );
  }

  return getOnboardingStateFromProfile(mapProfileRow(data as ProfileRow));
}

/**
 * Permite resetear onboarding durante pruebas.
 * OJO: esta función requiere que la tabla `profiles` ya tenga
 * `onboarding_completed` y `onboarding_completed_at`.
 */
export async function resetMyOnboardingState(): Promise<OnboardingState> {
  const uid = await requireUid();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      onboarding_completed: false,
      onboarding_completed_at: null,
    })
    .eq("id", uid)
    .select("*")
    .maybeSingle();

  if (error) {
    const message = String(error.message ?? "").toLowerCase();
    if (message.includes("onboarding_completed")) {
      throw new Error(getOnboardingSchemaErrorMessage());
    }
    throw error;
  }

  if (!data) {
    throw new Error(
      'No se pudo resetear el onboarding en la tabla "profiles".'
    );
  }

  return getOnboardingStateFromProfile(mapProfileRow(data as ProfileRow));
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
      trial_ends_at,
      daily_digest_enabled,
      daily_digest_hour_local,
      daily_digest_timezone
    `
    )
    .single();

  if (error) throw error;

  return mapProfileRow(data as ProfileRow);
}

/**
 * Actualiza SOLO las preferencias de coordinación.
 * Si no existe fila en profiles, la crea.
 * Se asegura de no violar el NOT NULL de display_name enviando siempre uno.
 */
export async function updateMyCoordinationPrefs(
  prefs: CoordinationPrefs
): Promise<Profile> {
  const uid = await requireUid();
  const normalized = normalizeCoordinationPrefs(prefs);

  let existing: Profile | null = null;
  try {
    existing = await getMyProfile();
  } catch {
    existing = null;
  }

  let displayName: string | null = null;

  if (existing?.display_name && existing.display_name.trim()) {
    displayName = existing.display_name.trim();
  }

  if (!displayName) {
    const first = existing?.first_name?.trim() ?? "";
    const last = existing?.last_name?.trim() ?? "";
    const combined = `${first} ${last}`.trim();
    if (combined) {
      displayName = combined;
    }
  }

  if (!displayName) {
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;

    const metaName =
      (u?.user_metadata?.full_name as string | undefined) ||
      (u?.user_metadata?.name as string | undefined) ||
      "";

    const emailName =
      (u?.email ? u.email.split("@")[0] : "") || "Usuario SyncPlans";

    displayName = (metaName || emailName).trim() || "Usuario SyncPlans";
  }

  const payload: ProfileRow = {
    id: uid,
    coordination_prefs: normalized,
    display_name: displayName,
  };

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
      trial_ends_at,
      daily_digest_enabled,
      daily_digest_hour_local,
      daily_digest_timezone
    `
    )
    .single();

  if (error) throw error;

  return mapProfileRow(data as ProfileRow);
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

  const payload: ProfileRow = { id: uid };

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
      trial_ends_at,
      daily_digest_enabled,
      daily_digest_hour_local,
      daily_digest_timezone
    `
    )
    .single();

  if (error) throw error;

  return mapProfileRow(data as ProfileRow);
}

/**
 * Obtiene perfiles por un listado de ids (para Members, etc.)
 */
export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  const uniqueIds = Array.from(
    new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))
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
      trial_ends_at,
      daily_digest_enabled,
      daily_digest_hour_local,
      daily_digest_timezone
    `
    )
    .in("id", uniqueIds);

  if (error) throw error;

  return (data ?? []).map((profileRow: ProfileRow) => mapProfileRow(profileRow));
}

/**
 * Actualizar ajustes de resumen diario por correo.
 */
export async function updateDailyDigestSettings(input: {
  daily_digest_enabled: boolean;
  daily_digest_hour_local: number | null;
  daily_digest_timezone: string | null;
}): Promise<void> {
  const uid = await requireUid();

  let existing: Profile | null = null;
  try {
    existing = await getMyProfile();
  } catch {
    existing = null;
  }

  let displayName: string | null = null;

  if (existing?.display_name && existing.display_name.trim()) {
    displayName = existing.display_name.trim();
  }

  if (!displayName) {
    const first = existing?.first_name?.trim() ?? "";
    const last = existing?.last_name?.trim() ?? "";
    const combined = `${first} ${last}`.trim();
    if (combined) displayName = combined;
  }

  if (!displayName) {
    const { data: userData } = await supabase.auth.getUser();
    const u = userData?.user;

    const metaName =
      (u?.user_metadata?.full_name as string | undefined) ||
      (u?.user_metadata?.name as string | undefined) ||
      "";

    const emailName =
      (u?.email ? u.email.split("@")[0] : "") || "Usuario SyncPlans";

    displayName = (metaName || emailName).trim() || "Usuario SyncPlans";
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      id: uid,
      display_name: displayName,
      daily_digest_enabled: input.daily_digest_enabled,
      daily_digest_hour_local: input.daily_digest_hour_local,
      daily_digest_timezone: input.daily_digest_timezone,
    },
    { onConflict: "id" }
  );

  if (error) throw error;
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

export async function getProfilesMapByIds(
  ids: string[]
): Promise<Record<string, Profile>> {
  const profiles = await getProfilesByIds(ids);

  return profiles.reduce<Record<string, Profile>>((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
  }, {});
}

export function getDisplayName(p?: Profile | null): string {
  if (!p) return "Alguien";

  if (p.display_name?.trim()) return p.display_name.trim();

  const first = p.first_name?.trim() ?? "";
  const last = p.last_name?.trim() ?? "";

  const combined = `${first} ${last}`.trim();
  if (combined) return combined;

  return "Alguien";
}