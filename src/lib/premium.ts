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

export type PlanCardId = "free" | "premium_monthly" | "premium_yearly";
export type PlanAccessSource = "free" | "trial" | "founder" | "paid";

export type PlanAccessState = PlanSnapshot & {
  currentPlanCardId: PlanCardId | null;
  accessSource: PlanAccessSource;
  planStatusHint: string;
};

export const FREE_GROUP_LIMIT = 1;

// Beta pública: mientras estamos validando uso real, todos los usuarios
// tienen acceso premium para no bloquear creación de grupos ni prueba del core.
export const BETA_PREMIUM_FOR_ALL = true;

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
  if (BETA_PREMIUM_FOR_ALL) return true;

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
  let planTag = "Plan base";
  let statusLabel = "Base Free activa";
  let planDescription =
    "La base para probar la promesa sin fricción: crear un espacio, invitar a la otra persona y comprobar si una sola verdad compartida reduce coordinación por chat.";

  if (BETA_PREMIUM_FOR_ALL) {
    planLabel = "Beta Premium";
    planTag = "Beta abierta";
    statusLabel = "Premium activo durante beta";
    planDescription =
      "Durante la beta, todos los usuarios tienen acceso premium para probar grupos, coordinación compartida, conflictos y funciones avanzadas sin bloqueos.";
  } else if (founder) {
    planLabel = "Founder";
    planTag = "Acceso Founder";
    statusLabel = "Founder activo";
    planDescription =
      "Acceso preferencial para quienes apostaron por SyncPlans desde el inicio y conservaron una posición especial dentro de la capa premium.";
  } else if (trialActive) {
    planLabel = "Prueba Premium";
    planTag = "Trial Premium";
    statusLabel = "Prueba Premium activa";
    planDescription =
      "Estás probando la capa que reduce ida y vuelta, da más contexto y ayuda a decidir mejor cuando coordinar con otros ya importa de verdad.";
  } else if (premiumAccess && billingCycle === "yearly") {
    planLabel = "Premium Anual";
    planTag = "Plan Premium";
    statusLabel = "Premium anual activo";
    planDescription =
      "Acceso completo para quienes ya usan SyncPlans como sistema real de coordinación y quieren sostener claridad compartida en el tiempo.";
  } else if (premiumAccess && billingCycle === "monthly") {
    planLabel = "Premium Mensual";
    planTag = "Plan Premium";
    statusLabel = "Premium mensual activo";
    planDescription =
      "Acceso completo con flexibilidad mes a mes para reducir ida y vuelta, sumar contexto y decidir mejor sin volver al chat como fuente principal de verdad.";
  } else if (premiumAccess) {
    planLabel = "Premium";
    planTag = "Plan Premium";
    statusLabel = "Premium activo";
    planDescription =
      "Tienes acceso a la capa premium que convierte coordinación dispersa en decisiones más claras, visibles y compartidas.";
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
): PlanCardId | null {
  const snapshot = getPlanSnapshot(profile);

  if (snapshot.isFounder) return null;
  if (snapshot.accessKind === "trial") return "premium_monthly";
  if (snapshot.accessKind === "free") return "free";
  if (snapshot.tier === "premium_monthly") return "premium_monthly";
  if (snapshot.tier === "premium_yearly") return "premium_yearly";

  return null;
}

/**
 * Helpers de capacidades premium.
 * Mantén estos gates suaves y alineados a la narrativa:
 * Free deja vivir bien el caso base.
 * Premium aparece cuando el sistema ya necesita más claridad, más contexto y menos fricción.
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


export type PremiumContextKey =
  | "conflicts"
  | "shared_coordination"
  | "smart_mobility"
  | "weekly_density"
  | "groups"
  | "google_calendar";

export type PremiumContextCopy = {
  key: PremiumContextKey;
  label: string;
  title: string;
  copy: string;
  outcome: string;
  proof: string;
};

export function normalizePremiumContextKey(
  value?: string | null
): PremiumContextKey | null {
  const normalized = normalizeText(value);

  if (
    normalized === "conflicts" ||
    normalized === "shared_coordination" ||
    normalized === "smart_mobility" ||
    normalized === "weekly_density" ||
    normalized === "groups" ||
    normalized === "google_calendar"
  ) {
    return normalized;
  }

  return null;
}

export function getPremiumContextCopy(
  key?: PremiumContextKey | null
): PremiumContextCopy {
  switch (key) {
    case "conflicts":
      return {
        key,
        label: "Decisiones compartidas",
        title: "Premium tiene sentido cuando los conflictos ya te ahorran discusiones",
        copy:
          "No pagas por otro calendario. Pagas por resolver mejor los momentos donde dos planes compiten por el mismo tiempo y todos necesitan una sola versión clara.",
        outcome: "Menos ida y vuelta cuando hay que decidir qué queda y qué se mueve.",
        proof: "Conflictos detectados, comparación clara y decisión visible para todos.",
      };
    case "shared_coordination":
      return {
        key,
        label: "Coordinación compartida",
        title: "Premium aparece cuando coordinar con otros ya dejó de ser ocasional",
        copy:
          "Cuando hay grupos, invitaciones, propuestas y respuestas, el valor premium es mantener contexto y decisiones dentro de SyncPlans en vez de perseguirlas por chat.",
        outcome: "Más claridad compartida sin reconstruir la historia cada vez.",
        proof: "Grupos, respuestas, invitaciones y próximos planes en el mismo lugar.",
      };
    case "smart_mobility":
      return {
        key,
        label: "Llegar a tiempo",
        title: "Premium se vuelve natural cuando la app también te ayuda a moverte",
        copy:
          "Smart Mobility no es un adorno. Tiene valor cuando SyncPlans entiende el plan, mira ubicación y te acerca a la acción correcta: salir a tiempo.",
        outcome: "Menos planes que empiezan tarde por falta de contexto.",
        proof: "Ubicación, ruta y momento de salida conectados al plan real.",
      };
    case "groups":
      return {
        key,
        label: "Más espacios",
        title: "Premium tiene lógica cuando tu coordinación ya no cabe en un solo grupo",
        copy:
          "Free activa el hábito. Premium entra cuando quieres manejar pareja, familia y otros espacios sin mezclar contexto ni perder claridad.",
        outcome: "Cada relación con su propio contexto y menos ruido cruzado.",
        proof: "Más grupos y lectura más clara de cada espacio compartido.",
      };
    case "google_calendar":
      return {
        key,
        label: "Contexto externo",
        title: "Premium vale más cuando SyncPlans se conecta con la agenda que ya usas",
        copy:
          "La integración no es para duplicar eventos. Es para que las decisiones compartidas consideren mejor tu contexto real antes de crear choques.",
        outcome: "Menos sorpresas porque el sistema ve más contexto antes de decidir.",
        proof: "Agenda externa como señal para coordinar mejor dentro de SyncPlans.",
      };
    case "weekly_density":
    default:
      return {
        key: "weekly_density",
        label: "Uso real",
        title: "Premium debería aparecer cuando SyncPlans ya se volvió parte de tu semana",
        copy:
          "Si ya estás capturando planes, revisando próximos eventos y cerrando decisiones, Premium no es más decoración: es más contexto y menos coordinación manual sobre un hábito real.",
        outcome: "Más control cuando la coordinación empieza a repetirse cada semana.",
        proof: "Uso frecuente, próximos planes y coordinación activa en una sola capa.",
      };
  }
}

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
    "Estás usando la base Free para empezar bien. Premium aparece cuando coordinar con otros ya te pide menos ida y vuelta, más claridad y más contexto compartido.";

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