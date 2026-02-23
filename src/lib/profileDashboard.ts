// src/lib/profileDashboard.ts

import { type DbEventRow } from "@/lib/eventsDb";
import { type GroupRow } from "@/lib/groupsDb";
import { isPremiumUser, isTrialActive } from "@/lib/premium";
import { computeVisibleConflicts } from "@/lib/conflicts";

/* Tipos compartidos con la pantalla de Perfil */

export type DashboardStats = {
  totalEvents: number;
  eventsLast7: number;
  totalGroups: number;
  pairGroups: number;
  familyGroups: number;
  otherGroups: number;
  conflictsNow: number;
};

export type Recommendation = {
  title: string;
  hint: string;
  ctaLabel?: string;
  ctaTarget?:
    | "groups_new"
    | "calendar"
    | "events_new"
    | "conflicts"
    | "invitations";
};

export type AnyProfile = {
  plan_tier?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  daily_digest_enabled?: boolean | null;
  daily_digest_hour_local?: number | null;
  daily_digest_timezone?: string | null;
};

/* Helpers de dominio para el dashboard de perfil */

export function buildDashboardStats(
  events: DbEventRow[],
  groups: GroupRow[]
): DashboardStats {
  const totalEvents = events.length;

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const eventsLast7 = events.filter((e) => {
    const t = new Date(e.start).getTime();
    return Number.isFinite(t) && t >= sevenDaysAgo;
  }).length;

  const totalGroups = groups.length;
  const pairGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t === "pair" || t === "couple";
  }).length;
  const familyGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t === "family";
  }).length;
  const otherGroups = groups.filter((g) => {
    const t = String(g.type).toLowerCase();
    return t !== "pair" && t !== "couple" && t !== "family";
  }).length;

  // ✅ FIX: groupType coherente con conflictos (group vs personal)
  const eventsForConflicts = events.map((e) => ({
    id: e.id,
    title: e.title ?? "(Sin título)",
    start: e.start,
    end: e.end,
    groupType: e.group_id ? ("group" as const) : ("personal" as const),
    groupId: e.group_id ?? null,
  }));

  const conflicts = computeVisibleConflicts(eventsForConflicts as any);

  return {
    totalEvents,
    eventsLast7,
    totalGroups,
    pairGroups,
    familyGroups,
    otherGroups,
    conflictsNow: conflicts.length,
  };
}

export function buildRecommendation(
  verified: boolean,
  stats: DashboardStats | null
): Recommendation | null {
  if (!stats) return null;

  if (!verified) {
    return {
      title: "Verifica tu correo",
      hint: "Cerrar el ciclo de verificación protege tus grupos y eventos compartidos.",
    };
  }

  if (stats.totalGroups === 0) {
    return {
      title: "Crea tu primer grupo",
      hint: "Empieza por un grupo de pareja o familia para compartir eventos y detectar conflictos. Luego suma grupos compartidos como amigos o equipos.",
      ctaLabel: "Crear grupo",
      ctaTarget: "groups_new",
    };
  }

  if (stats.totalEvents === 0) {
    return {
      title: "Crea tu primer evento",
      hint: "Agenda algo real — una cena, un viaje o una reunión — y deja que SyncPlans trabaje.",
      ctaLabel: "Nuevo evento",
      ctaTarget: "events_new",
    };
  }

  if (stats.conflictsNow > 0) {
    return {
      title: "Tienes conflictos activos",
      hint: "Hay conflictos de horario detectados. Revísalos y decide qué conservar.",
      ctaLabel: "Revisar conflictos",
      ctaTarget: "conflicts",
    };
  }

  return {
    title: "Saca más valor de tus grupos",
    hint: "Invita a alguien nuevo o revisa tu calendario compartido para la próxima semana.",
    ctaLabel: "Invitar a alguien",
    ctaTarget: "invitations",
  };
}

/**
 * Lógica central de plan actual (free / trial / premium / founder / fallback demo).
 */
export function getPlanInfo(profile: AnyProfile | null) {
  const tierRaw = profile?.plan_tier ?? "free";
  const tier = tierRaw.toLowerCase();
  const premiumActive = isPremiumUser(profile as any);
  const trialActive = isTrialActive(profile as any);

  let planLabel = "";
  let planHint = "";
  let planCtaLabel = "";

  if (premiumActive && tier.startsWith("founder_")) {
    if (tier === "founder_yearly") {
      planLabel = "Plan fundador (anual)";
      planHint =
        "Formas parte del grupo fundador de SyncPlans con plan anual y precio especial mientras mantengas la suscripción.";
    } else {
      planLabel = "Plan fundador (mensual)";
      planHint =
        "Formas parte de la beta privada con un precio especial mientras mantengas el plan.";
    }
    planCtaLabel = "Pronto podrás gestionar tu suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  if (premiumActive) {
    if (tier === "premium_yearly") {
      planLabel = "Premium anual";
      planHint = "Tu suscripción anual Premium (US$69) está activa.";
      planCtaLabel = "Gestionar suscripción";
      return { planLabel, planHint, planCtaLabel };
    }
    planLabel = "Premium mensual";
    planHint = "Tu suscripción mensual Premium (US$6.90) está activa.";
    planCtaLabel = "Gestionar suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  if (trialActive) {
    planLabel = "Demo Premium activa";
    planHint =
      "Estás usando todas las funciones Premium sin costo como parte de la beta privada. El precio público será US$6.90/mes o US$69/año.";
    planCtaLabel = "Ver planes y precios";
    return { planLabel, planHint, planCtaLabel };
  }

  if (tier === "free") {
    planLabel = "Plan gratuito";
    planHint =
      "Estás usando SyncPlans en modo básico. Puedes pasar a Premium (US$6.90/mes o US$69/año) cuando quieras. Durante la beta no se te cobrará nada.";
    planCtaLabel = "Ver planes Premium";
    return { planLabel, planHint, planCtaLabel };
  }

  if (tier.includes("premium")) {
    planLabel = "Premium (pendiente)";
    planHint =
      (profile?.subscription_status ?? "").toLowerCase() === "canceled"
        ? "Tu suscripción Premium se canceló. Puedes reactivarla en cualquier momento."
        : "Tu suscripción Premium aún no está activa. Revisa tu método de pago o finaliza el proceso.";
    planCtaLabel = "Revisar suscripción";
    return { planLabel, planHint, planCtaLabel };
  }

  planLabel = "Demo Premium (beta)";
  planHint =
    "Estás en la beta privada de SyncPlans con acceso extendido a funciones Premium.";
  planCtaLabel = "Ver opciones de plan";
  return { planLabel, planHint, planCtaLabel };
}