// src/lib/premium.ts

// ❌ Importante: NO "use client" aquí.
// Este módulo debe poder usarse tanto en server components como en client.

export type KnownPlanTier =
  | "free"
  | "trial"
  | "founder"
  | "premium_monthly"
  | "premium_yearly";

export type PlanTier = KnownPlanTier | string;

export type PlanStatus =
  | "active"
  | "trialing"
  | "inactive"
  | "canceled"
  | "cancelled"
  | "past_due"
  | "incomplete"
  | "unknown";

export type BillingCycle = "monthly" | "yearly" | null;

type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null;
  plan_status?: string | null; // legacy
  trial_ends_at?: string | null;
};

export type PlanSnapshot = {
  rawTier: string | null;
  tier: KnownPlanTier | string;
  rawStatus: string | null;
  status: PlanStatus;
  billingCycle: BillingCycle;
  isFree: boolean;
  isFounder: boolean;
  isTrialActive: boolean;
  isPremiumTier: boolean;
  hasPremiumAccess: boolean;
  accessKind: "free" | "trial" | "founder" | "premium";
  planLabel: string;
  planTag: string;
  statusLabel: string;
  planDescription: string;
};

const INACTIVE_STATUSES: PlanStatus[] = [
  "inactive",
  "canceled",
  "cancelled",
  "past_due",
  "incomplete",
];

function normalizeText(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length ? normalized : null;
}

export function normalizePlanTier(raw?: string | null): PlanTier {
  const value = normalizeText(raw);
  if (!value) return "free";

  if (value.startsWith("founder")) return "founder";
  if (value === "trial") return "trial";
  if (value === "premium_monthly") return "premium_monthly";
  if (value === "premium_yearly") return "premium_yearly";
  if (value === "free") return "free";

  return value;
}

export function normalizePlanStatus(profile?: AnyProfile | null): PlanStatus {
  const raw =
    normalizeText(profile?.subscription_status) ??
    normalizeText(profile?.plan_status);

  if (!raw) return "unknown";

  if (raw === "active") return "active";
  if (raw === "trialing") return "trialing";
  if (raw === "inactive") return "inactive";
  if (raw === "canceled") return "canceled";
  if (raw === "cancelled") return "cancelled";
  if (raw === "past_due") return "past_due";
  if (raw === "incomplete") return "incomplete";

  return "unknown";
}

/**
 * Devuelve true si el trial sigue activo a hoy.
 * Usa trial_ends_at como ISO string (UTC).
 */
export function isTrialActive(profile: AnyProfile | null | undefined): boolean {
  if (!profile?.trial_ends_at) return false;

  const endsAtMs = Date.parse(profile.trial_ends_at);
  if (!Number.isFinite(endsAtMs)) return false;

  return endsAtMs > Date.now();
}

export function isFounderTier(tier: PlanTier): boolean {
  return String(tier).startsWith("founder");
}

export function isPremiumTier(tier: PlanTier): boolean {
  return tier === "premium_monthly" || tier === "premium_yearly";
}

export function getBillingCycle(tier: PlanTier): BillingCycle {
  if (tier === "premium_monthly") return "monthly";
  if (tier === "premium_yearly") return "yearly";
  return null;
}

export function hasPremiumAccess(
  profile: AnyProfile | null | undefined
): boolean {
  if (!profile) return false;

  const tier = normalizePlanTier(profile.plan_tier);
  const status = normalizePlanStatus(profile);
  const trialActive = isTrialActive(profile);

  if (trialActive) return true;
  if (isFounderTier(tier)) return true;

  if (isPremiumTier(tier)) {
    if (status === "unknown") return true; // beta-safe fallback
    return !INACTIVE_STATUSES.includes(status);
  }

  return false;
}

export function isPremiumUser(
  profile: AnyProfile | null | undefined
): boolean {
  return hasPremiumAccess(profile);
}

export function getPlanSnapshot(
  profile: AnyProfile | null | undefined
): PlanSnapshot {
  const rawTier = profile?.plan_tier ?? null;
  const tier = normalizePlanTier(rawTier);
  const rawStatus =
    profile?.subscription_status ?? profile?.plan_status ?? null;
  const status = normalizePlanStatus(profile);
  const trialActive = isTrialActive(profile);
  const founder = isFounderTier(tier);
  const premiumTier = isPremiumTier(tier);
  const premiumAccess = hasPremiumAccess(profile);
  const billingCycle = getBillingCycle(tier);

  const isFree = !premiumAccess && !founder && !trialActive && tier === "free";

  let accessKind: PlanSnapshot["accessKind"] = "free";
  if (founder) accessKind = "founder";
  else if (trialActive) accessKind = "trial";
  else if (premiumAccess) accessKind = "premium";

  let planLabel = "Free";
  let planTag = "Plan Free";
  let statusLabel = "Modo Free";
  let planDescription =
    "Empieza con la base necesaria para ordenar tu tiempo y validar el hábito compartido sin pagar durante la beta.";

  if (founder) {
    planLabel = "Founder";
    planTag = "Plan Founder";
    statusLabel = "Founder activo";
    planDescription =
      "Acceso preferencial para quienes apostaron por SyncPlans desde el inicio y ayudaron a construir la capa premium antes que nadie.";
  } else if (trialActive) {
    planLabel = "Prueba Premium";
    planTag = "Prueba Premium";
    statusLabel = "Prueba Premium activa";
    planDescription =
      "Estás probando la capa que da más claridad, menos fricción y más control cuando coordinar con otros ya importa de verdad.";
  } else if (premiumAccess && billingCycle === "yearly") {
    planLabel = "Premium Anual";
    planTag = "Plan Premium";
    statusLabel = "Premium anual activo";
    planDescription =
      "Acceso completo para quienes ya usan SyncPlans como sistema real de coordinación y quieren sostener esa claridad en el tiempo.";
  } else if (premiumAccess && billingCycle === "monthly") {
    planLabel = "Premium Mensual";
    planTag = "Plan Premium";
    statusLabel = "Premium mensual activo";
    planDescription =
      "Acceso completo con flexibilidad mes a mes para reducir fricción, sumar contexto y decidir mejor sin depender del chat.";
  } else if (premiumAccess) {
    planLabel = "Premium";
    planTag = "Plan Premium";
    statusLabel = "Premium activo";
    planDescription =
      "Tienes acceso a la capa premium que convierte coordinación en decisiones más claras, visibles y controlables.";
  }

  return {
    rawTier,
    tier,
    rawStatus,
    status,
    billingCycle,
    isFree,
    isFounder: founder,
    isTrialActive: trialActive,
    isPremiumTier: premiumTier,
    hasPremiumAccess: premiumAccess,
    accessKind,
    planLabel,
    planTag,
    statusLabel,
    planDescription,
  };
}

export function getCurrentPlanCardId(
  profile: AnyProfile | null | undefined
): "free" | "premium_monthly" | "premium_yearly" | null {
  const snapshot = getPlanSnapshot(profile);

  if (snapshot.isFounder) return null;
  if (snapshot.accessKind === "trial") return "premium_monthly";
  if (snapshot.accessKind === "free") return "free";
  if (snapshot.tier === "premium_monthly") return "premium_monthly";
  if (snapshot.tier === "premium_yearly") return "premium_yearly";

  return null;
}

/**
 * Helpers de capacidades premium
 * Úsalos después para gates suaves dentro del producto.
 */

export function canUseAdvancedExternalCoordination(
  profile: AnyProfile | null | undefined
): boolean {
  return hasPremiumAccess(profile);
}

export function canUseAdvancedAnalytics(
  profile: AnyProfile | null | undefined
): boolean {
  return hasPremiumAccess(profile);
}

export function canUseGoogleCalendarIntegration(
  profile: AnyProfile | null | undefined
): boolean {
  return hasPremiumAccess(profile);
}

export function canUseUnlimitedGroups(
  profile: AnyProfile | null | undefined
): boolean {
  return hasPremiumAccess(profile);
}

export const FREE_GROUP_LIMIT = 1;

export type GroupLimitState = {
  limit: number | null;
  used: number;
  remaining: number | null;
  reached: boolean;
  isUnlimited: boolean;
};

export function getGroupLimit(
  profile: AnyProfile | null | undefined
): number | null {
  return canUseUnlimitedGroups(profile) ? null : FREE_GROUP_LIMIT;
}

export function getGroupLimitState(
  profile: AnyProfile | null | undefined,
  currentGroupCount: number
): GroupLimitState {
  const used = Math.max(0, Number(currentGroupCount) || 0);
  const limit = getGroupLimit(profile);

  if (limit === null) {
    return {
      limit: null,
      used,
      remaining: null,
      reached: false,
      isUnlimited: true,
    };
  }

  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    reached: used >= limit,
    isUnlimited: false,
  };
}

export function hasReachedGroupLimit(
  profile: AnyProfile | null | undefined,
  currentGroupCount: number
): boolean {
  return getGroupLimitState(profile, currentGroupCount).reached;
}

export type PlanCardId = "free" | "premium_monthly" | "premium_yearly";

export type PlanAccessSource = "free" | "trial" | "founder" | "paid";

export type PlanAccessState = PlanSnapshot & {
  currentPlanCardId: PlanCardId | null;
  accessSource: PlanAccessSource;
  planStatusHint: string;
};

export function getPlanAccessState(
  profile: AnyProfile | null | undefined
): PlanAccessState {
  const snapshot = getPlanSnapshot(profile);
  const currentPlanCardId = getCurrentPlanCardId(profile);

  let accessSource: PlanAccessSource = "free";
  if (snapshot.isFounder) {
    accessSource = "founder";
  } else if (snapshot.isTrialActive) {
    accessSource = "trial";
  } else if (snapshot.hasPremiumAccess) {
    accessSource = "paid";
  }

  let planStatusHint =
    "Estás usando la base Free para empezar. Premium entra cuando necesitas más claridad, menos fricción y más control sobre la coordinación compartida.";

  if (accessSource === "founder") {
    planStatusHint =
      "Tu acceso Founder mantiene beneficios preferenciales y se trata como una capa premium estable durante la beta.";
  } else if (accessSource === "trial") {
    planStatusHint =
      "Tu trial te deja probar la diferencia entre registrar cosas y coordinar de verdad antes de cualquier cobro.";
  } else if (currentPlanCardId === "premium_yearly") {
    planStatusHint =
      "Tu acceso Premium Anual está pensado para una coordinación sostenida, con más claridad compartida y menos desgaste operativo.";
  } else if (currentPlanCardId === "premium_monthly") {
    planStatusHint =
      "Tu acceso Premium Mensual te da flexibilidad mientras validas cuánto valor real te aporta tener más contexto y menos fricción.";
  }

  return {
    ...snapshot,
    currentPlanCardId,
    accessSource,
    planStatusHint,
  };
}