// src/lib/premium.ts

// ❌ Importante: NO "use client" aquí.
// Este módulo debe poder usarse tanto en server components como en client.

export type PlanTier =
  | "free"
  | "premium_monthly"
  | "premium_yearly"
  | string;

type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null; // opcional, por si mañana lo usas con Stripe/Paddle
  plan_status?: string | null; // legacy: "active" | "inactive" | "canceled" | ...
  trial_ends_at?: string | null;
};

/**
 * Normaliza el plan_tier a algo razonable.
 * Regla actual:
 * - null/undefined/"" => "free"
 * - cualquier otro string => se respeta tal cual (aunque no sea uno de los "conocidos")
 */
function normalizePlanTier(raw?: string | null): PlanTier {
  if (!raw) return "free";
  return raw.toLowerCase() as PlanTier;
}

/**
 * Determina si un tier es de pago.
 *
 * Regla actual (simple y segura para beta):
 * - "free" => NO es de pago
 * - cualquier otro string => se considera de pago
 *
 * Si mañana quieres afinar esto (ej. solo premium_* y founder_*),
 * se cambia esta función y todo el resto sigue igual.
 */
function isPaidTier(tier: PlanTier): boolean {
  if (!tier) return false;
  if (tier === "free") return false;
  return true;
}

/**
 * Devuelve true si el trial sigue activo a hoy.
 * Usa trial_ends_at como ISO string (UTC).
 */
export function isTrialActive(profile: AnyProfile | null | undefined): boolean {
  if (!profile?.trial_ends_at) return false;

  const endsAtMs = Date.parse(profile.trial_ends_at);
  if (!Number.isFinite(endsAtMs)) return false;

  const now = Date.now();
  return endsAtMs > now;
}

/**
 * Determina si el usuario es "premium" a ojos de producto.
 *
 * Regla:
 * 1) Si tiene un tier de pago Y el status NO es "inactive"/"canceled" => premium.
 * 2) Si tiene trial activo => también premium.
 *
 * Todo lo que no cumpla esto => no premium.
 */
export function isPremiumUser(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile) return false;

  const tier = normalizePlanTier(profile.plan_tier ?? "free");
  const paidTier = isPaidTier(tier);

  const statusRaw =
    profile.subscription_status ?? profile.plan_status ?? null;
  const status = statusRaw ? statusRaw.toLowerCase() : null;

  const trialActive = isTrialActive(profile);

  // Caso 1: plan de pago + status OK
  if (
    paidTier &&
    status &&
    status !== "inactive" &&
    status !== "canceled"
  ) {
    return true;
  }

  // Caso 2: trial activo => también cuenta como premium
  if (trialActive) return true;

  // En cualquier otro caso => no premium
  return false;
}