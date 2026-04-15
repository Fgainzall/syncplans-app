// src/app/planes/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyProfile, type Profile } from "@/lib/profilesDb";
import {
  FREE_GROUP_LIMIT,
  getPlanAccessState,
  type PlanCardId,
  type PlanAccessState,
} from "@/lib/premium";

import { colors, radii, shadows, spacing } from "@/styles/design-tokens";
import { trackEvent, trackScreenView } from "@/lib/analytics";

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
  emotionalHook: string;
};

const freeFeatures: string[] = [
  "La base para empezar a ordenar tu tiempo sin improvisar desde el día uno.",
  `Hasta ${FREE_GROUP_LIMIT} grupo incluido para empezar sin fricción y probar si SyncPlans ya te está ahorrando desgaste real.`,
  "Detección básica de conflictos para que el sistema ya empiece a avisarte cuando algo choca.",
  "Sin tarjetas ni cobros automáticos durante la beta privada.",
];

const premiumCoreFeatures: string[] = [
  "Más de un grupo cuando tu coordinación ya no cabe en un solo espacio compartido.",
  "Más contexto dentro del sistema: respuestas, propuestas y acciones sin perseguir mensajes por fuera.",
  "Más claridad para decidir conflictos sin reconstruir la historia en chats sueltos.",
  "Más visibilidad desde el panel para entender qué está pasando en el tiempo compartido.",
  "Integraciones premium para traer contexto externo al mismo lugar donde decides.",
];

const premiumMonthlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Flexibilidad para activar Premium mientras validas cuánto valor real te aporta semana a semana.",
];

const premiumYearlyFeatures: string[] = [
  ...premiumCoreFeatures,
  "Mejor relación valor / precio para parejas, familias y grupos que ya usan SyncPlans como hábito.",
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
        "La base para empezar a coordinar sin ruido y entender el valor antes de pagar por una capa más potente.",
      idealFor:
        "Ideal si recién estás empezando y todavía quieres validar el hábito.",
      features: freeFeatures,
      emotionalHook:
        "Free te deja empezar. Premium aparece cuando la coordinación ya no puede depender de memoria, chats y buena suerte.",
    },
    {
      id: "premium_monthly",
      label: "Premium Mensual",
      tag: "Premium",
      price: "US$X",
      priceSuffix: "/ mes",
      description:
        "Para quien ya sintió el valor de coordinar mejor y quiere más claridad, menos fricción y más control sin comprometerse todavía a largo plazo.",
      idealFor:
        "Ideal si ya usas SyncPlans en serio y quieres probar Premium con flexibilidad.",
      badge: "Recomendado",
      highlight: true,
      features: premiumMonthlyFeatures,
      emotionalHook:
        "La diferencia no es más calendario. Es menos desgaste todas las semanas.",
    },
    {
      id: "premium_yearly",
      label: "Premium Anual",
      tag: "Premium",
      price: "US$Y",
      priceSuffix: "/ año",
      description:
        "Para parejas, familias y grupos que ya entendieron que la tranquilidad compartida vale más que resolver todo por chat.",
      idealFor:
        "Ideal si SyncPlans ya se volvió parte de la rutina.",
      features: premiumYearlyFeatures,
      emotionalHook:
        "Cuando coordinar bien ya es parte de tu rutina, la tranquilidad compartida vale más que el precio.",
    },
  ];
}

function getCurrentPlanNote(state: PlanAccessState): string {
  if (state.isFounder) {
    return "Tu acceso Founder ya vive en una capa preferencial y estable dentro de SyncPlans.";
  }

  if (state.accessSource === "trial") {
    return "Hoy tienes acceso premium por trial, así que esta pantalla debe ayudarte a medir el valor real antes que el precio.";
  }

  if (state.currentPlanCardId === "premium_yearly") {
    return "Tu acceso actual corresponde a Premium Anual.";
  }

  if (state.currentPlanCardId === "premium_monthly") {
    return "Tu acceso actual corresponde a Premium Mensual.";
  }

  return `Hoy estás usando SyncPlans desde la base Free con hasta ${FREE_GROUP_LIMIT} grupo incluido antes de que la coordinación se vuelva más compleja.`;
}

function getDecisionHeadline(state: PlanAccessState): string {
  if (state.isFounder) return "Tu acceso ya está en una capa preferencial.";
  if (state.accessSource === "trial")
    return "Ahora mismo ya estás sintiendo el valor completo de Premium.";
  if (state.hasPremiumAccess)
    return "Tu coordinación ya funciona con más claridad, menos fricción y más control.";
  return "Free sirve para empezar. Premium aparece cuando coordinar con otros deja de ser una prueba y te pide más claridad, menos fricción y más control.";
}

function getDecisionCopy(state: PlanAccessState): string {
  if (state.isFounder) {
    return "Founder no necesita presión. Necesita reconocer que entraste antes y conservas una posición especial dentro de la capa premium.";
  }
  if (state.accessSource === "trial") {
    return "La decisión no es pagar por más funciones. Es no volver al modo improvisado después de haber probado más claridad, menos fricción y más control.";
  }
  if (state.hasPremiumAccess) {
    return "Cuando Premium está activo, el valor no se nota en una lista. Se nota en menos desgaste, menos mensajes sueltos y mejores decisiones compartidas.";
  }
  return "El problema no es guardar eventos. El problema es alinear personas, contexto y decisiones sin perseguir chats ni versiones distintas de la realidad.";
}

function getWhyPayBullets(state: PlanAccessState): string[] {
  if (state.isFounder) {
    return [
      "Porque Founder reconoce tu entrada temprana y tu confianza inicial.",
      "Porque tu acceso ya vive dentro de una capa premium preferencial, sin fricción extra.",
      "Porque esta posición debe sentirse especial, no genérica.",
    ];
  }

  if (state.accessSource === "trial") {
    return [
      "Porque ya viste la diferencia entre registrar cosas y coordinarlas bien.",
      "Porque Premium reduce fricción justo donde más se siente: decisiones, contexto e integración.",
      "Porque volver atrás se nota cuando todos dejan de ver la misma verdad compartida.",
    ];
  }

  if (state.hasPremiumAccess) {
    return [
      "Porque una buena coordinación no se mide en funciones, sino en fricción evitada.",
      "Porque mantener claridad compartida vale más que resolver malentendidos después.",
      "Porque el valor real está en la tranquilidad operativa, no en la decoración visual.",
    ];
  }

  return [
    `Porque Free te deja empezar con hasta ${FREE_GROUP_LIMIT} grupo, pero la coordinación real suele crecer más allá de un solo espacio.`,
    "Porque el problema no es guardar eventos, sino alinear personas, contexto y decisiones.",
    "Porque Premium convierte respuestas, contexto e integración en decisiones dentro del sistema.",
    "Porque coordinar bien cuesta menos que corregir enredos después.",
  ];
}


function useIsCompactWidth(maxWidth = 720) {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsCompact(media.matches);

    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    media.addListener(apply);
    return () => media.removeListener(apply);
  }, [maxWidth]);

  return isCompact;
}

function getShortPlanDescription(state: PlanAccessState): string {
  if (state.isFounder) return "Acceso preferente";
  if (state.accessSource === "trial") return "Probando Premium";
  if (state.currentPlanCardId === "premium_yearly") return "Acceso completo";
  if (state.currentPlanCardId === "premium_monthly") return "Acceso completo";
  return "Base activa";
}


function getOutcomeCards(state: PlanAccessState) {
  if (state.isFounder) {
    return [
      { label: "Posición", value: "Founder", copy: "Entraste antes y tu acceso ya vive en una capa preferencial." },
      { label: "Valor", value: "Estable", copy: "Tu lugar no depende de un upsell agresivo ni de presión comercial." },
      { label: "Lectura", value: "Reconocimiento", copy: "Founder debe sentirse especial porque llegaste cuando todavía todo se estaba construyendo." },
    ];
  }

  if (state.accessSource === "trial" || state.hasPremiumAccess) {
    return [
      { label: "Menos ruido", value: "Más contexto", copy: "Más respuestas, más visibilidad y menos ida y vuelta fuera del sistema." },
      { label: "Decisión", value: "Más rápida", copy: "Resolver deja de depender de reconstruir chats y versiones cruzadas." },
      { label: "Sensación", value: "Más control", copy: "La coordinación se vuelve más clara, más compartida y menos frágil." },
    ];
  }

  return [
    { label: "Free", value: `Hasta ${FREE_GROUP_LIMIT} grupo`, copy: "Suficiente para empezar y validar si SyncPlans ya te evita desgaste real." },
    { label: "Premium", value: "Más claridad", copy: "Cuando ya coordinas con otros, aparece una capa más potente de contexto y control." },
    { label: "Resultado", value: "Menos fricción", copy: "La diferencia no es más app. Es menos desgaste cada semana." },
  ];
}

function getPlanButtonLabel(card: PlanCardConfig, isCurrent: boolean, founderEquivalent: boolean) {
  if (isCurrent) return "Ya tienes este acceso";
  if (founderEquivalent) return "Tu acceso ya cubre esta capa";
  if (card.id === "free") return "Seguir con Free";
  return "Quiero este plan";
}

function getPlanHint(card: PlanCardConfig, state: PlanAccessState, isCurrent: boolean, founderEquivalent: boolean) {
  if (isCurrent) return "Ya estás en esta capa, así que aquí la clave es medir si el valor que sientes coincide con lo que promete tu plan.";
  if (founderEquivalent) return "Founder ya vive en una capa preferencial. Aquí no necesitas hacer upgrade, sino entender el valor que ya conservas.";
  if (card.id === "free") return "Free te deja empezar. Subir solo tiene sentido cuando la coordinación ya te pide más claridad y menos desgaste.";
  if (state.accessSource === "trial") return "Todavía estás probando Premium. Este click sirve para leer intención real dentro de la beta, no para cobrarte ahora.";
  return "Durante la beta privada no se cobra ni se activa desde aquí. Este paso nos sirve para medir intención real de upgrade.";
}

export default function PlanesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [interestPlanId, setInterestPlanId] = useState<PlanCardId | null>(null);
  const isCompact = useIsCompactWidth();

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

  useEffect(() => {
    void trackScreenView({ screen: "planes", metadata: { area: "premium" } });
    void trackEvent({
      event: "premium_viewed",
      metadata: { screen: "planes", area: "premium", placement: "plans_page" },
    });
  }, []);

  const cards = useMemo(() => buildPlanCards(), []);
  const planState = useMemo(() => getPlanAccessState(profile), [profile]);
  const whyPayBullets = useMemo(() => getWhyPayBullets(planState), [planState]);
  const shortPlanDescription = useMemo(
    () =>
      loading
        ? "Leyendo tu información de cuenta..."
        : getShortPlanDescription(planState),
    [loading, planState]
  );
  const outcomeCards = useMemo(() => getOutcomeCards(planState), [planState]);

  const handlePlanClick = async (card: PlanCardConfig, isCurrent: boolean, founderEquivalent: boolean) => {
    if (isCurrent || founderEquivalent) return;

    if (card.id === "free") {
      await trackEvent({
        event: "plan_navigation_clicked",
        metadata: {
          screen: "planes",
          source: "plans_card",
          target: "free",
          current_access: planState.accessSource,
        },
      });
      router.push("/summary");
      return;
    }

    setInterestPlanId(card.id);

    await trackEvent({
      event: "premium_cta_clicked",
      metadata: {
        screen: "planes",
        source: "plans_card",
        target: card.id,
        current_access: planState.accessSource,
        billing_cycle: card.id === "premium_yearly" ? "yearly" : "monthly",
      },
    });

    await trackEvent({
      event: "premium_interest_registered",
      metadata: {
        screen: "planes",
        target: card.id,
        current_access: planState.accessSource,
      },
    });
  };

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Planes"
        subtitle="Premium no existe para darte más pantallas. Existe para darte más claridad, menos fricción y más control cuando coordinar con otros ya importa de verdad."
      />

      <div style={{ ...sectionWrapperStyle, ...(isCompact ? sectionWrapperCompactStyle : null) }}>
        <section style={{ ...decisionHeroStyle, ...(isCompact ? decisionHeroCompactStyle : null) }}>
          <div style={{ ...decisionHeroTopStyle, ...(isCompact ? decisionHeroTopCompactStyle : null) }}>
            <div style={{ ...decisionHeroTextStyle, ...(isCompact ? decisionHeroTextCompactStyle : null) }}>
              <div style={decisionEyebrowStyle}>Premium real</div>
              <h2 style={{ ...decisionTitleStyle, ...(isCompact ? decisionTitleCompactStyle : null) }}>
                {loading ? "Cargando estado del plan..." : getDecisionHeadline(planState)}
              </h2>
              <p style={{ ...decisionCopyStyle, ...(isCompact ? decisionCopyCompactStyle : null) }}>
                {loading ? "Leyendo tu información de cuenta..." : getDecisionCopy(planState)}
              </p>
            </div>

            <div style={{ ...decisionSidePillStyle, ...(isCompact ? decisionSidePillCompactStyle : null) }}>
              {loading ? "Leyendo..." : planState.statusLabel}
            </div>
          </div>

          <div style={{ ...decisionBulletsGridStyle, ...(isCompact ? decisionBulletsGridCompactStyle : null) }}>
            {whyPayBullets.map((item) => (
              <div key={item} style={{ ...decisionBulletCardStyle, ...(isCompact ? decisionBulletCardCompactStyle : null) }}>
                <span style={decisionBulletDotStyle} />
                <span style={{ ...decisionBulletTextStyle, ...(isCompact ? decisionBulletTextCompactStyle : null) }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...proofStripStyle, ...(isCompact ? proofStripCompactStyle : null) }}>
          {outcomeCards.map((item) => (
            <article key={item.label} style={proofCardStyle}>
              <span style={proofLabelStyle}>{item.label}</span>
              <strong style={proofValueStyle}>{item.value}</strong>
              <p style={proofCopyStyle}>{item.copy}</p>
            </article>
          ))}
        </section>

        <section style={{ ...planCardStyle, ...(isCompact ? planCardCompactStyle : null) }}>
          <div style={{ ...planHeaderRowStyle, ...(isCompact ? planHeaderRowCompactStyle : null) }}>
            <div style={planLabelColumnStyle}>
              <div style={planPillStyle}>
                <span style={planDotStyle} />
                <span style={planPillTextStyle}>
                  {loading ? "Cargando plan..." : planState.planTag}
                </span>
              </div>

              <h2 style={{ ...planTitleStyle, ...(isCompact ? planTitleCompactStyle : null) }}>
                {loading ? " " : planState.planLabel}
              </h2>

              <p style={{ ...planSubtitleStyle, ...(isCompact ? planSubtitleCompactStyle : null) }}>{shortPlanDescription}</p>
            </div>

            <div style={{ ...planActionsColumnStyle, ...(isCompact ? planActionsColumnCompactStyle : null) }}>
              <div style={{ ...planStatusPillStyle, ...(isCompact ? planStatusPillCompactStyle : null) }}>
                {loading ? "Leyendo estado..." : planState.statusLabel}
              </div>
            </div>
          </div>

          <p style={planHintTextStyle}>
            {loading ? "" : getCurrentPlanNote(planState)}
          </p>

          <div style={{ ...statusSummaryGridStyle, ...(isCompact ? statusSummaryGridCompactStyle : null) }}>
            <div style={statusSummaryItemStyle}>
              <span style={statusSummaryLabelStyle}>Acceso</span>
              <strong style={statusSummaryValueStyle}>
                {loading
                  ? "Cargando..."
                  : planState.hasPremiumAccess
                  ? "Capa premium activa"
                  : "Base Free activa"}
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
              Sin cobros automáticos por ahora. Esta pantalla existe para que entiendas qué parte del desgaste diario desaparece cuando Premium entra en la coordinación.
            </p>
          </div>
        </section>

        <section style={{ ...plansSectionStyle, ...(isCompact ? plansSectionCompactStyle : null) }}>
          <header style={plansHeaderRowStyle}>
            <div>
              <h3 style={plansTitleStyle}>Planes de SyncPlans</h3>
              <p style={plansSubtitleStyle}>
                La diferencia real entre planes no es “tener más funciones”. Es cuánto contexto, cuánta visibilidad y cuánta fricción quieres sacar de la coordinación cuando ya no te organizas solo ni quieres volver al caos.
              </p>
            </div>
          </header>

          {interestPlanId ? (
            <div style={interestBannerStyle}>
              <div style={interestBannerBadgeStyle}>Interés registrado</div>
              <div style={interestBannerTextWrapStyle}>
                <strong style={interestBannerTitleStyle}>Gracias. Ya registramos intención real por {interestPlanId === "premium_yearly" ? "Premium Anual" : "Premium Mensual"} dentro de esta beta.</strong>
                <p style={interestBannerBodyStyle}>
                  Todavía no estamos cobrando ni activando desde esta pantalla. Este click sí nos sirve para medir qué tan deseable se siente Premium antes de abrir pagos reales.
                </p>
              </div>
            </div>
          ) : null}

          <div style={{ ...plansGridStyle, ...(isCompact ? plansGridCompactStyle : null) }}>
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

                  <div style={planEmotionalHookStyle}>{card.emotionalHook}</div>

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
                        ...(card.id !== "free" && !isCurrent && !founderEquivalent
                          ? planPrimaryButtonActiveStyle
                          : null),
                        opacity: isCurrent || founderEquivalent ? 0.75 : 1,
                        cursor: isCurrent || founderEquivalent ? "default" : "pointer",
                      }}
                      disabled={isCurrent || founderEquivalent}
                      onClick={() => {
                        void handlePlanClick(card, isCurrent, founderEquivalent);
                      }}
                    >
                      {getPlanButtonLabel(card, isCurrent, founderEquivalent)}
                    </button>

                    <p style={planCtaHintStyle}>
                      {getPlanHint(card, planState, isCurrent, founderEquivalent)}
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

const decisionHeroStyle: CSSProperties = {
  borderRadius: radii.xl,
  border: `1px solid ${colors.borderStrong}`,
  background:
    "radial-gradient(900px 280px at 0% 0%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(700px 220px at 100% 0%, rgba(168,85,247,0.12), transparent 60%), rgba(15,23,42,0.96)",
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const decisionHeroTopStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
  flexWrap: "wrap",
};

const decisionHeroTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  flex: 1,
  minWidth: 0,
};

const decisionEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  color: colors.accentPrimary,
};

const decisionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  lineHeight: 1.1,
  fontWeight: 950,
  color: colors.textPrimary,
};

const decisionCopyStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.textSecondary,
};

const decisionSidePillStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  background: "rgba(255,255,255,0.05)",
  fontSize: 12,
  fontWeight: 800,
  color: colors.textPrimary,
  whiteSpace: "nowrap",
};

const decisionBulletsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: spacing.sm,
};

const decisionBulletCardStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: `${spacing.sm}px ${spacing.md}px`,
  display: "flex",
  alignItems: "flex-start",
  gap: spacing.sm,
};

const decisionBulletDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: colors.accentPrimary,
  marginTop: 6,
  flexShrink: 0,
};

const decisionBulletTextStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: colors.textPrimary,
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
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: spacing.md,
  alignItems: "start",
};

const planLabelColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
};

const planActionsColumnStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
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
  fontSize: 18,
  fontWeight: 900,
  color: colors.textPrimary,
  lineHeight: 1.15,
};

const planSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 2,
  fontSize: 14,
  lineHeight: 1.45,
  color: colors.textSecondary,
  maxWidth: 420,
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
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const statusSummaryGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
  lineHeight: 1.55,
  color: colors.textSecondary,
};

const proofStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: spacing.sm,
};

const proofStripCompactStyle: CSSProperties = {
  gridTemplateColumns: "1fr",
};

const proofCardStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.md}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const proofLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.32,
  color: colors.textMuted,
};

const proofValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: colors.textPrimary,
};

const proofCopyStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
  color: colors.textSecondary,
};

const interestBannerStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.accentPrimary}`,
  background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(37,99,235,0.16))",
  padding: `${spacing.md}px ${spacing.md}px`,
  display: "flex",
  alignItems: "flex-start",
  gap: spacing.md,
  flexWrap: "wrap",
};

const interestBannerBadgeStyle: CSSProperties = {
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.28,
  color: colors.textPrimary,
  border: `1px solid ${colors.accentPrimary}`,
  background: "rgba(255,255,255,0.08)",
};

const interestBannerTextWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  flex: 1,
  minWidth: 0,
};

const interestBannerTitleStyle: CSSProperties = {
  fontSize: 13,
  color: colors.textPrimary,
};

const interestBannerBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.55,
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

const planEmotionalHookStyle: CSSProperties = {
  borderRadius: radii.md,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: "10px 12px",
  fontSize: 12,
  lineHeight: 1.55,
  color: colors.textPrimary,
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
  transition: "transform 160ms ease, box-shadow 160ms ease, background 160ms ease",
};

const planPrimaryButtonActiveStyle: CSSProperties = {
  border: `1px solid ${colors.accentPrimary}`,
  background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(37,99,235,0.22))",
  boxShadow: shadows.card,
};

const planCtaHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.5,
  color: colors.textMuted,
};

const sectionWrapperCompactStyle: CSSProperties = {
  maxWidth: 680,
  padding: `${spacing.sm}px ${spacing.sm}px ${spacing.xl}px`,
  gap: spacing.md,
};

const decisionHeroCompactStyle: CSSProperties = {
  padding: `${spacing.md}px ${spacing.md}px`,
  gap: spacing.sm,
};

const decisionHeroTopCompactStyle: CSSProperties = {
  flexDirection: "column",
  alignItems: "stretch",
  gap: spacing.sm,
};

const decisionHeroTextCompactStyle: CSSProperties = {
  gap: 6,
};

const decisionTitleCompactStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.06,
  letterSpacing: -0.5,
  maxWidth: "16ch",
};

const decisionCopyCompactStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  maxWidth: "34ch",
};

const decisionSidePillCompactStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "7px 10px",
  fontSize: 11,
};

const decisionBulletsGridCompactStyle: CSSProperties = {
  gridTemplateColumns: "1fr",
  gap: 8,
};

const decisionBulletCardCompactStyle: CSSProperties = {
  padding: `10px 12px`,
  gap: 10,
};

const decisionBulletTextCompactStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

const planCardCompactStyle: CSSProperties = {
  padding: `${spacing.md}px ${spacing.md}px`,
  gap: spacing.sm,
};

const planHeaderRowCompactStyle: CSSProperties = {
  gridTemplateColumns: "1fr",
  gap: spacing.sm,
};

const planActionsColumnCompactStyle: CSSProperties = {
  justifyContent: "flex-start",
};

const planTitleCompactStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.1,
};

const planSubtitleCompactStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.4,
  maxWidth: "32ch",
};

const planStatusPillCompactStyle: CSSProperties = {
  alignSelf: "flex-start",
  fontSize: 10,
};

const statusSummaryGridCompactStyle: CSSProperties = {
  gridTemplateColumns: "1fr",
};

const plansSectionCompactStyle: CSSProperties = {
  padding: `${spacing.md}px ${spacing.md}px`,
  gap: spacing.sm,
};

const plansGridCompactStyle: CSSProperties = {
  marginTop: spacing.sm,
  gridTemplateColumns: "1fr",
  gap: spacing.sm,
};