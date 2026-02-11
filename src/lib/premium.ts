// src/lib/premium.ts

export type PlanTier =
  | "free"
  | "premium_monthly"
  | "premium_yearly"
  | string; // dejamos string para soportar "founder_monthly", etc.

type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

/**
 * Devuelve true si el usuario está en trial activo.
 */
export function isTrialActive(profile: AnyProfile | null | undefined): boolean {
  if (!profile || !profile.trial_ends_at) return false;

  const trialEnd = new Date(profile.trial_ends_at);
  if (Number.isNaN(trialEnd.getTime())) return false;

  const now = new Date();
  return trialEnd > now;
}

/**
 * Devuelve true si el usuario tiene un plan premium o founder ACTIVO,
 * o si está en periodo de prueba.
 */
export function isPremiumUser(profile: AnyProfile | null | undefined): boolean {
  if (!profile) return false;

  const tier = (profile.plan_tier || "").toLowerCase();
  const status = (profile.subscription_status || "").toLowerCase();

  const hasPremiumLikeTier =
    tier.includes("premium") || tier.includes("founder");

  const isActiveSub = status === "active";

  // Plan de pago activo (premium o founder)
  if (hasPremiumLikeTier && isActiveSub) {
    return true;
  }

  // O está en periodo de prueba
  if (isTrialActive(profile)) {
    return true;
  }

  return false;
}
