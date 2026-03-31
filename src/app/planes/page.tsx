// src/app/planes/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyProfile, type Profile } from "@/lib/profilesDb";
import {
  getPlanAccessState,
  type PlanCardId,
  type PlanAccessState,
} from "@/lib/premium";

import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

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
  idealFor: string;
};

const freeFeatures: string[] = [
  "Tu calendario personal y la base para empezar a coordinar sin caos.",
  "Un espacio suficiente para probar la dinámica con tu pareja o familia.",
  "Detección básica de conflictos al guardar nuevos eventos.",
  "Sin tarjetas ni cobros automáticos durante la beta privada.",
];

const premiumCoreFeatures: string[] = [
  "Coordinación externa más útil: respuestas, propuestas y acciones dentro de la app.",
  "Más contexto para decidir conflictos sin perseguir mensajes por fuera.",
  "Panel y métricas para entender qué está pasando en el tiempo compartido.",
  "Integraciones y automatizaciones premium a medida que SyncPlans madure.",
];

const premiumMonthlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Flexibilidad para activar Premium mientras validas cuánto valor real te aporta semana a semana.",
];

const premiumYearlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Mejor relación valor / precio para hogares o parejas que ya usan SyncPlans como hábito.",
  "Pensado para una coordinación sostenida, no para un uso esporádico.",
];

function buildPlanCards(): PlanCardConfig[] {
  return [
    {
      id: "free",
      label: "Free",
      tag: "Base",
      price: "US$0",
      priceSuffix: "/ mes",
      description:
        "La puerta de entrada para ordenar el tiempo compartido y entender el problema antes de pagar por resolverlo mejor.",
      idealFor:
        "Ideal si recién estás empezando y todavía quieres validar el hábito.",
      features: freeFeatures,
    },
    {
      id: "premium_monthly",
      label: "Premium Mensual",
      tag: "Premium",
      price: "US$X",
      priceSuffix: "/ mes",
      description:
        "Para quien ya sintió el valor de coordinar mejor y quiere menos fricción sin comprometerse todavía a largo plazo.",
      idealFor:
        "Ideal si ya usas SyncPlans en serio, pero todavía quieres flexibilidad.",
      badge: "Recomendado",
      highlight: true,
      features: premiumMonthlyFeatures,
    },
    {
      id: "premium_yearly",
      label: "Premium Anual",
      tag: "Premium",
      price: "US$Y",
      priceSuffix: "/ año",
      description:
        "Para parejas y familias que ya entendieron que la tranquilidad compartida vale más que resolver todo por chat.",
      idealFor:
        "Ideal si SyncPlans ya se volvió parte de la rutina.",
      features: premiumYearlyFeatures,
    },
  ];
}

function getCurrentPlanNote(state: PlanAccessState): string {
  if (state.isFounder) {
    return "Tu acceso Founder se trata como una capa premium estable y preferencial durante la beta.";
  }

  if (state.accessSource === "trial") {
    return "Hoy tienes acceso premium por trial, así que esta pantalla debe ayudarte a entender el valor antes que el precio.";
  }

  if (state.currentPlanCardId === "premium_yearly") {
    return "Tu acceso actual corresponde a Premium Anual.";
  }

  if (state.currentPlanCardId === "premium_monthly") {
    return "Tu acceso actual corresponde a Premium Mensual.";
  }

  return "Hoy estás usando SyncPlans desde la base Free.";
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

  const cards = useMemo(() => buildPlanCards(), []);
  const planState = useMemo(() => getPlanAccessState(profile), [profile]);

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Planes"
        subtitle="No se trata de vender más calendario. Se trata de reducir fricción real en el tiempo compartido."
      />

      <div style={sectionWrapperStyle}>
        <section style={planCardStyle}>
          <div style={planHeaderRowStyle}>
            <div style={planLabelColumnStyle}>
              <div style={planPillStyle}>
                <span style={planDotStyle} />
                <span style={planPillTextStyle}>
                  {loading ? "Cargando plan..." : planState.planTag}
                </span>
              </div>

              <h2 style={planTitleStyle}>
                {loading ? " " : `Tu plan: ${planState.planLabel}`}
              </h2>

              <p style={planSubtitleStyle}>
                {loading
                  ? "Leyendo tu información de cuenta..."
                  : planState.planDescription}
              </p>
            </div>

            <div style={planActionsColumnStyle}>
              <div style={planStatusPillStyle}>
                {loading ? "Leyendo estado..." : planState.statusLabel}
              </div>
            </div>
          </div>

          <p style={planHintTextStyle}>
            {loading ? "" : planState.planStatusHint}
          </p>

          <div style={statusSummaryGridStyle}>
            <div style={statusSummaryItemStyle}>
              <span style={statusSummaryLabelStyle}>Acceso</span>
              <strong style={statusSummaryValueStyle}>
                {loading
                  ? "Cargando..."
                  : planState.hasPremiumAccess
                  ? "Premium habilitado"
                  : "Solo base Free"}
              </strong>
            </div>

            <div style={statusSummaryItemStyle}>
              <span style={statusSummaryLabelStyle}>Origen</span>
              <strong style={statusSummaryValueStyle}>
                {loading
                  ? "Cargando..."
                  : planState.accessSource === "founder"
                  ? "Founder"
                  : planState.accessSource === "trial"
                  ? "Trial"
                  : planState.accessSource === "paid"
                  ? "Pago / beta"
                  : "Free"}
              </strong>
            </div>

            <div style={statusSummaryItemStyle}>
              <span style={statusSummaryLabelStyle}>Ciclo</span>
              <strong style={statusSummaryValueStyle}>
                {loading
                  ? "Cargando..."
                  : planState.billingCycle === "yearly"
                  ? "Anual"
                  : planState.billingCycle === "monthly"
                  ? "Mensual"
                  : "No aplica"}
              </strong>
            </div>
          </div>

          <p style={currentPlanNoteStyle}>{loading ? "" : getCurrentPlanNote(planState)}</p>

          <div style={betaNoteStyle}>
            <p style={betaNoteTitleStyle}>Beta privada</p>
            <p style={betaNoteBodyStyle}>
              Durante esta etapa no se realizan cobros automáticos. Primero
              estamos cerrando bien la lógica de planes, acceso y valor del
              producto antes de activar pagos reales.
            </p>
          </div>
        </section>

        <section style={plansSectionStyle}>
          <header style={plansHeaderRowStyle}>
            <div>
              <h3 style={plansTitleStyle}>Planes de SyncPlans</h3>
              <p style={plansSubtitleStyle}>
                La diferencia real entre planes no es “tener más calendario”,
                sino cuánto contexto, cuánta coordinación y cuánta tranquilidad
                quieres recuperar cuando varias personas comparten el tiempo.
              </p>
            </div>
          </header>

          <div style={plansGridStyle}>
            {cards.map((card) => {
              const isCurrent = planState.currentPlanCardId === card.id;
              const founderEquivalent =
                planState.isFounder && card.id !== "free";

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
                          <span style={planOptionBadgeStyle}>{card.badge}</span>
                        ) : null}
                      </div>
                      <h4 style={planOptionTitleStyle}>{card.label}</h4>
                      <p style={planOptionDescriptionStyle}>{card.description}</p>
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
                      ) : founderEquivalent ? (
                        <span style={planOptionCurrentChipStyle}>
                          Tu acceso Founder se parece a esta capa
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p style={planIdealForStyle}>{card.idealFor}</p>

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
                        ? "Seguir con Free"
                        : "Premium disponible pronto"}
                    </button>

                    <p style={planCtaHintStyle}>
                      Por ahora estamos afinando acceso y narrativa de valor.
                      Luego activaremos bloqueos premium elegantes y recién
                      después cobros reales.
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

const statusSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: spacing.sm,
  marginTop: spacing.sm,
};

const statusSummaryItemStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.sm}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const statusSummaryLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.3,
  color: colors.textMuted,
};

const statusSummaryValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: colors.textPrimary,
};

const currentPlanNoteStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: colors.textMuted,
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

const planIdealForStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textMuted,
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