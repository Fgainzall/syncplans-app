// src/lib/premium.ts
"use client";

export type PlanTier =
  | "free"
  | "premium_monthly"
  | "premium_yearly"
  | "founder_monthly"
  | "founder_yearly"
  | "demo_premium"
  | string;

export function isPremiumUser(profile: any | null): boolean {
  if (!profile) return false;

  const tier = (profile.plan_tier ?? "free") as string;
  const status = (profile.subscription_status ?? "inactive") as string;

  // 🔹 Tiers que consideramos Premium "de verdad"
  const premiumTiers = [
    "premium_monthly",
    "premium_yearly",
    "founder_monthly",
    "founder_yearly",
  ];

  // Activo por suscripción
  if (premiumTiers.includes(tier) && status === "active") {
    return true;
  }

  // Activo por trial (da igual el tier)
  if (profile.trial_ends_at) {
    const trialDate = new Date(profile.trial_ends_at);
    if (trialDate > new Date()) return true;
  }

  return false;
}
