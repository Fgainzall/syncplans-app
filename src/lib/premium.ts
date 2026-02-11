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
  trial_ends_at?: string | null;
};

export function isTrialActive(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile?.trial_ends_at) return false;

  const d = new Date(profile.trial_ends_at);
  if (Number.isNaN(d.getTime())) return false;

  return d.getTime() > Date.now();
}

export function isPremiumUser(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile) return false;

  const plan = (profile.plan_tier ?? "").toLowerCase();
  const status = (profile.subscription_status ?? "").toLowerCase();

  const paidTier =
    plan.includes("premium") || plan.includes("founder");

  if (paidTier && status === "active") {
    return true;
  }

  if (isTrialActive(profile)) {
    return true;
  }

  return false;
}
