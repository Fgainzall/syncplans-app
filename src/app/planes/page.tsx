// src/app/planes/page.tsx
"use client";

import React, { useEffect, useState, type CSSProperties } from "react";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { isPremiumUser, isTrialActive, type PlanTier } from "@/lib/premium";

import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

type PlanCardId = "free" | "premium_monthly" | "premium_yearly";

type PlanCardConfig = {
  id: PlanCardId;
  label: string;
  tag: string;
  price: string;
  priceSuffix: string;
  description: string;
  badge?: string;
  highlight?: boolean;
  features: string[];
};

const freeFeatures: string[] = [
  "Calendario personal para organizar tu día a día.",
  "Un par de grupos (pareja / familia) para probar la idea.",
  "Detección básica de conflictos al guardar eventos.",
  "Sin tarjeta ni pagos durante la beta privada.",
];

const premiumCoreFeatures: string[] = [
  "Detección avanzada de conflictos entre personas y grupos.",
  "Panel con métricas de uso y conflictos abiertos.",
  "Integración con Google Calendar (solo lectura, fase 1).",
  "Resúmenes por correo para mantener a todos alineados.",
];

const premiumMonthlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Flexibilidad mes a mes para probar Premium sin compromiso.",
];

const premiumYearlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Precio anual optimizado para uso constante con tu pareja o familia.",
  "Mejor relación valor / precio si ya usas SyncPlans en serio.",
];

function buildPlanCards(): PlanCardConfig[] {
  return [
    {
      id: "free",
      label: "Free",
      tag: "Plan Free",
      price: "US$0",
      priceSuffix: "/ mes",
      description:
        "Para empezar a probar SyncPlans con tu pareja o familia, sin fricción ni tarjetas.",
      features: freeFeatures,
    },
    {
      id: "premium_monthly",
      label: "Premium Mensual",
      tag: "Plan Premium",
      price: "US$X",
      priceSuffix: "/ mes",
      description:
        "Para cuando ya sabes que SyncPlans te ahorra discusiones, pero quieres flexibilidad mes a mes.",
      badge: "Recomendado",
      highlight: true,
      features: premiumMonthlyFeatures,
    },
    {
      id: "premium_yearly",
      label: "Premium Anual",
      tag: "Premium Anual",
      price: "US$Y",
      priceSuffix: "/ año",
      description:
        "Para parejas y familias que ya integraron SyncPlans en su rutina de coordinación.",
      features: premiumYearlyFeatures,
    },
  ];
}

export default function PlanesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const p = await getMyProfile();
        if (!active) return;
        setProfile(p);
      } catch (err) {
        console.error("Error cargando perfil en /planes:", err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const normalizedTier = String(tier || "free").toLowerCase();
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);

  let planLabel = "Free";
  let planTag = "Plan Free";
  let planDescription =
    "Todas las funciones básicas para organizar tu tiempo sin pagar nada durante la beta.";
  let planStatusHint = "Estás usando SyncPlans en modo Free.";

  if (normalizedTier.startsWith("founder")) {
    planLabel = "Founder";
    planTag = "Plan Founder";
    planDescription =
      "Mantienes un precio preferencial por ser de las primeras personas en apostar por SyncPlans.";
    planStatusHint =
      "Tu plan Founder se conservará incluso cuando lancemos la versión pública.";
  } else if (premiumActive && !trialActive) {
    planLabel = "Premium";
    planTag = "Plan Premium";
    planDescription =
      "Tienes activadas las funciones avanzadas para coordinar mejor con tu pareja y familia.";
    planStatusHint = "Tu plan Premium está activo.";
  } else if (trialActive) {
    planLabel = "Prueba Premium";
    planTag = "Prueba Premium";
    planDescription =
      "Estás probando todas las funciones Premium por tiempo limitado, sin riesgo.";
    planStatusHint =
      "Cuando termine tu prueba podrás decidir si continúas en Free o pasas a Premium.";
  }

  const cards = buildPlanCards();

  const isFreeTier = normalizedTier === "free";
  const isFounderTier = normalizedTier.startsWith("founder");
  const isAnyPremium = premiumActive || trialActive || isFounderTier;

  const resolveIsCurrent = (id: PlanCardId): boolean => {
    if (isFounderTier) {
      // Conceptualmente Founder es un Premium “especial”
      return id === "premium_monthly";
    }
    if (isFreeTier) return id === "free";
    if (premiumActive || trialActive) {
      return id === "premium_monthly" || id === "premium_yearly";
    }
    return false;
  };

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Planes"
        subtitle="Elige hasta dónde quieres llevar el árbitro neutral de tu tiempo compartido."
      />

      <div style={sectionWrapperStyle}>
        {/* BLOQUE: TU PLAN ACTUAL */}
        <section style={planCardStyle}>
          <div style={planHeaderRowStyle}>
            <div style={planLabelColumnStyle}>
              <div style={planPillStyle}>
                <span style={planDotStyle} />
                <span style={planPillTextStyle}>
                  {loading ? "Cargando plan..." : planTag}
                </span>
              </div>
              <h2 style={planTitleStyle}>
                {loading ? " " : `Tu plan: ${planLabel}`}
              </h2>
              <p style={planSubtitleStyle}>
                {loading
                  ? "Leyendo tu información de cuenta..."
                  : planDescription}
              </p>
            </div>
            <div style={planActionsColumnStyle}>
              <div style={planStatusPillStyle}>
                {isAnyPremium ? "Premium activo / Founder" : "Modo Free"}
              </div>
            </div>
          </div>

          <p style={planHintTextStyle}>{planStatusHint}</p>

          <div style={betaNoteStyle}>
            <p style={betaNoteTitleStyle}>Beta privada</p>
            <p style={betaNoteBodyStyle}>
              Durante esta etapa no se realizan cobros automáticos. Cualquier
              cambio de plan se coordina directamente contigo para que tengas
              control total.
            </p>
          </div>
        </section>

        {/* BLOQUE: PLANES DISPONIBLES */}
        <section style={plansSectionStyle}>
          <header style={plansHeaderRowStyle}>
            <div>
              <h3 style={plansTitleStyle}>Planes de SyncPlans</h3>
              <p style={plansSubtitleStyle}>
                Todos los planes comparten la misma idea: una sola verdad sobre
                el tiempo compartido. Lo que cambia es cuánto quieres
                automatizar y cuánta tranquilidad buscas.
              </p>
            </div>
          </header>

          <div style={plansGridStyle}>
            {cards.map((card) => {
              const isCurrent = resolveIsCurrent(card.id);

              return (
                <article
                  key={card.id}
                  style={{
                    ...planOptionCardStyle,
                    border: isCurrent
                      ? `1px solid ${colors.accentPrimary}`
                      : `1px solid ${colors.borderSubtle}`,
                    boxShadow: shadows.card,
                    background: card.highlight
                      ? "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(37,99,235,0.20))"
                      : colors.surfaceRaised,
                  }}
                >
                  <div style={planOptionHeaderStyle}>
                    <div style={planOptionTitleBlockStyle}>
                      <div style={planOptionTagRowStyle}>
                        <span style={planOptionTagStyle}>{card.tag}</span>
                        {card.badge ? (
                          <span style={planOptionBadgeStyle}>
                            {card.badge}
                          </span>
                        ) : null}
                      </div>
                      <h4 style={planOptionTitleStyle}>{card.label}</h4>
                      <p style={planOptionDescriptionStyle}>
                        {card.description}
                      </p>
                    </div>

                    <div style={planOptionPriceBlockStyle}>
                      <div style={planOptionPriceRowStyle}>
                        <span style={planOptionPriceStyle}>{card.price}</span>
                        <span style={planOptionPriceSuffixStyle}>
                          {card.priceSuffix}
                        </span>
                      </div>
                      {isCurrent ? (
                        <span style={planOptionCurrentChipStyle}>
                          Tu plan actual
                        </span>
                      ) : isFounderTier && card.id !== "free" ? (
                        <span style={planOptionCurrentChipStyle}>
                          Beneficios similares a tu plan Founder
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <ul style={planFeaturesListStyle}>
                    {card.features.map((feature) => (
                      <li key={feature} style={planFeatureItemStyle}>
                        <span style={planFeatureBulletStyle} />
                        <span style={planFeatureTextStyle}>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={planCtaRowStyle}>
                    <button
                      type="button"
                      style={{
                        ...planPrimaryButtonStyle,
                        opacity: isCurrent ? 0.8 : 1,
                      }}
                      disabled
                    >
                      {isCurrent
                        ? "Ya estás en este plan"
                        : card.id === "free"
                        ? "Empezar en Free"
                        : "Premium disponible pronto"}
                    </button>
                    <p style={planCtaHintStyle}>
                      Los cambios de plan se habilitarán oficialmente al salir
                      de la beta privada. Si quieres comentar tu caso, háblame
                      directo.
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </MobileScaffold>
  );
}

// ===== Estilos =====

const sectionWrapperStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const planCardStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const planHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.lg,
  flexWrap: "wrap",
};

const planLabelColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
};

const planActionsColumnStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  minWidth: 0,
};

const planPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${colors.accentPrimary}`,
  background: "rgba(56,189,248,0.10)",
};

const planDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: colors.accentPrimary,
};

const planPillTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: colors.textSecondary,
};

const planTitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 8,
  fontSize: 20,
  fontWeight: 900,
  color: colors.textPrimary,
};

const planSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 14,
  lineHeight: 1.4,
  color: colors.textSecondary,
};

const planStatusPillStyle: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  fontSize: 11,
  fontWeight: 600,
  color: colors.textSecondary,
};

const planHintTextStyle: CSSProperties = {
  margin: 0,
  marginTop: spacing.sm,
  fontSize: 13,
  color: colors.textSecondary,
};

const betaNoteStyle: CSSProperties = {
  marginTop: spacing.md,
  borderRadius: radii.lg,
  border: `1px dashed ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.sm}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const betaNoteTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: colors.textSecondary,
};

const betaNoteBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: colors.textSecondary,
};

const plansSectionStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const plansHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
  flexWrap: "wrap",
};

const plansTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: colors.textPrimary,
};

const plansSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const plansGridStyle: CSSProperties = {
  marginTop: spacing.md,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: spacing.md,
};

const planOptionCardStyle: CSSProperties = {
  borderRadius: radii.lg,
  padding: `${spacing.md}px ${spacing.md}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const planOptionHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
  flexWrap: "wrap",
};

const planOptionTitleBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
};

const planOptionTagRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const planOptionTagStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: colors.textSecondary,
};

const planOptionBadgeStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: 999,
  background: "rgba(56,189,248,0.22)",
  border: `1px solid ${colors.accentPrimary}`,
  color: colors.textPrimary,
};

const planOptionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: colors.textPrimary,
};

const planOptionDescriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const planOptionPriceBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
};

const planOptionPriceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 4,
};

const planOptionPriceStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: colors.textPrimary,
};

const planOptionPriceSuffixStyle: CSSProperties = {
  fontSize: 12,
  color: colors.textSecondary,
};

const planOptionCurrentChipStyle: CSSProperties = {
  alignSelf: "flex-end",
  padding: "4px 8px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  fontSize: 11,
  fontWeight: 600,
  color: colors.textSecondary,
};

const planFeaturesListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const planFeatureItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
};

const planFeatureBulletStyle: CSSProperties = {
  marginTop: 6,
  width: 6,
  height: 6,
  borderRadius: 999,
  background: colors.accentPrimary,
  flexShrink: 0,
};

const planFeatureTextStyle: CSSProperties = {
  fontSize: 13,
  color: colors.textSecondary,
};

const planCtaRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: spacing.sm,
};

const planPrimaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderStrong}`,
  background: colors.surfaceLow,
  color: colors.textPrimary,
  fontSize: 13,
  fontWeight: 800,
  cursor: "not-allowed",
};

const planCtaHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.5,
  color: colors.textMuted,
};