// src/lib/premium.ts
"use client";

export type PlanTier =
  | "free"
  | "premium_monthly"
  | "premium_yearly"
  | string;

type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null;
  plan_status?: string | null; // 👈 legacy
  trial_ends_at?: string | null;
};

/**
 * ¿Tiene trial activo basado en la fecha?
 */
export function isTrialActive(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile?.trial_ends_at) return false;

  const d = new Date(profile.trial_ends_at);
  if (Number.isNaN(d.getTime())) return false;

  return d.getTime() > Date.now();
}

/**
 * isPremiumUser
 *
 * Reglas:
 * - Es premium si:
 *   - plan_tier contiene "premium" o "founder"
 *   - Y el estado NO es "inactive" ni "canceled"
 *     (usamos subscription_status y, si falta, plan_status)
 * - O si está en trial por fecha (trial_ends_at en el futuro)
 */
export function isPremiumUser(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile) return false;

  const tierRaw = (profile.plan_tier ?? "").toLowerCase();
  const statusRaw = (
    profile.subscription_status ??
    profile.plan_status ??
    ""
  ).toLowerCase();

  const paidTier =
    tierRaw.includes("premium") || tierRaw.includes("founder");

  const trialActive = isTrialActive(profile);

  // Si tiene un tier de pago y el estado NO es inactivo / cancelado,
  // lo consideramos premium activo.
  if (
    paidTier &&
    statusRaw &&
    statusRaw !== "inactive" &&
    statusRaw !== "canceled"
  ) {
    return true;
  }

  // Trial por fecha también cuenta como premium.
  if (trialActive) return true;

  return false;
}
