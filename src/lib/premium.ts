// src/lib/premium.ts
export type PlanTier =
  | "free"
  | "premium_monthly"
  | "premium_yearly"
  | "founder_monthly"
  | "founder_yearly";

/**
 * Devuelve true si el usuario debe ver experiencia Premium
 * (incluye founder_* como premium).
 */
export function isPremiumUser(profile: any | null): boolean {
  if (!profile) return false;

  const planTier: string = profile.plan_tier ?? "free";
  const subscriptionStatus: string = profile.subscription_status ?? "inactive";

  const isPaidPremium =
    (planTier.includes("premium") || planTier.startsWith("founder")) &&
    subscriptionStatus === "active";

  if (isPaidPremium) return true;

  // Activo por trial
  if (profile.trial_ends_at) {
    const trialDate = new Date(profile.trial_ends_at);
    if (trialDate > new Date()) return true;
  }

  return false;
}
