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
  type PlanAccessState,
  type PlanCardId,
} from "@/lib/premium";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type PlanCardConfig = {
  id: PlanCardId;
  label: string;
  tag: string;
  price: string;
  priceSuffix: string;
  description: string;
  idealFor: string;
  features: string[];
  emotionalHook: string;
  badge?: string;
  highlight?: boolean;
};

function buildPlanCards(): PlanCardConfig[] {
  return [
    {
      id: "free",
      label: "Free",
      tag: "Base",
      price: "US$0",
      priceSuffix: "/ beta",
      description:
        "La base completa para una pareja que quiere empezar bien: crear su espacio, invitarse, meter planes y sentir valor real antes de pagar.",
      idealFor:
        "Ideal si recién están validando el hábito y quieren comprobar si SyncPlans de verdad les baja fricción.",
      features: [
        "Crear un espacio compartido e invitar a la otra persona sin fricción artificial de entrada.",
        `Hasta ${FREE_GROUP_LIMIT} grupo incluido para empezar sin castigar el caso base de pareja.`,
        "Detección básica de conflictos para que el sistema ya empiece a avisar cuando algo choca.",
        "Home mínima, quick capture y coordinación esencial disponibles durante la beta privada.",
        "Sin tarjetas ni cobros automáticos en esta etapa.",
      ],
      emotionalHook:
        "Free debe dejarte sentir el valor. Premium no debería aparecer antes de tiempo.",
    },
    {
      id: "premium_monthly",
      label: "Premium Mensual",
      tag: "Premium",
      price: "US$X",
      priceSuffix: "/ mes",
      badge: "Recomendado",
      highlight: true,
      description:
        "Para parejas o grupos que ya sintieron valor real y ahora quieren menos desgaste, más contexto y más claridad sin comprometerse todavía a largo plazo.",
      idealFor:
        "Ideal si SyncPlans ya te ahorra fricción cada semana y quieres una capa más potente antes de decidir algo más estable.",
      features: [
        "Más de un grupo cuando tu coordinación ya no cabe en un solo espacio compartido.",
        "Más contexto dentro del sistema: respuestas, propuestas y acciones sin perseguir mensajes por fuera.",
        "Más claridad para decidir conflictos sin reconstruir la historia en chats sueltos.",
        "Más visibilidad para entender qué está pasando en el tiempo compartido.",
        "Integraciones premium para traer contexto externo al mismo lugar donde decides.",
        "Flexibilidad para validar cuánto valor real te aporta semana a semana.",
      ],
      emotionalHook:
        "La diferencia no es tener más app. Es necesitar menos esfuerzo para coordinar bien.",
    },
    {
      id: "premium_yearly",
      label: "Premium Anual",
      tag: "Premium",
      price: "US$Y",
      priceSuffix: "/ año",
      description:
        "Para parejas, familias y grupos que ya entendieron que la tranquilidad compartida vale más que resolver todo por chat y quieren consolidar ese hábito.",
      idealFor:
        "Ideal si SyncPlans ya se volvió parte de la rutina y quieres una relación valor/precio más lógica a largo plazo.",
      features: [
        "Todo lo que ya hace más potente la coordinación en Premium.",
        "Mejor relación valor/precio para quienes ya usan SyncPlans como hábito real.",
        "Pensado para coordinación sostenida, no para uso esporádico.",
        "Más contexto, más continuidad y menos necesidad de reconstruir decisiones fuera del sistema.",
      ],
      emotionalHook:
        "Cuando coordinar bien ya es parte de la rutina, la tranquilidad compartida vale más que el precio.",
    },
  ];
}

function getDecisionHeadline(state: PlanAccessState): string {
  if (state.isFounder) return "Tu acceso ya vive en una capa preferencial.";
  if (state.accessSource === "trial") {
    return "Ahora mismo ya estás sintiendo el valor completo de Premium.";
  }
  if (state.hasPremiumAccess) {
    return "Tu coordinación ya funciona con más claridad, menos fricción y mejor contexto.";
  }
  return "Free sirve para empezar bien. Premium aparece cuando coordinar con otros deja de ser prueba y ya te pide más claridad, menos fricción y mejor contexto.";
}

function getDecisionCopy(state: PlanAccessState): string {
  if (state.isFounder) {
    return "Founder no necesita presión comercial. Necesita reconocer que entraste antes y conservas una posición especial dentro de la capa premium.";
  }
  if (state.accessSource === "trial") {
    return "La decisión no es pagar por más funciones. Es no volver al modo improvisado después de haber probado más claridad, menos fricción y mejor contexto compartido.";
  }
  if (state.hasPremiumAccess) {
    return "Cuando Premium está activo, el valor no se nota en una lista. Se nota en menos desgaste, menos mensajes sueltos y mejores decisiones compartidas.";
  }
  return "El problema no es guardar eventos. El problema es alinear personas, contexto y decisiones sin perseguir chats ni versiones distintas de la realidad.";
}

function getWhyPayBullets(state: PlanAccessState): string[] {
  if (state.isFounder) {
    return [
      "Founder reconoce tu entrada temprana y tu confianza inicial.",
      "Tu acceso ya vive dentro de una capa preferencial, sin presión extra.",
      "Tu lugar debería sentirse especial, no genérico.",
    ];
  }

  if (state.accessSource === "trial") {
    return [
      "Ya viste la diferencia entre registrar cosas y coordinarlas bien.",
      "Premium reduce fricción justo donde más se siente: decisiones, contexto e integración.",
      "Volver atrás se nota cuando todos dejan de ver la misma verdad compartida.",
    ];
  }

  if (state.hasPremiumAccess) {
    return [
      "Una buena coordinación no se mide en funciones, sino en fricción evitada.",
      "Mantener claridad compartida vale más que corregir malentendidos después.",
      "El valor real está en la tranquilidad operativa, no en la decoración visual.",
    ];
  }

  return [
    "Free debe dejar vivir bien a una pareja en el caso base antes de pedir pago.",
    "Premium tiene sentido cuando ya no quieres coordinar desde chats, memoria y buena suerte.",
    "La diferencia real es más contexto dentro del sistema y menos desgaste fuera de él.",
  ];
}

function getOutcomeCards(state: PlanAccessState) {
  if (state.isFounder) {
    return [
      {
        label: "Posición",
        value: "Founder",
        copy: "Entraste antes y tu acceso ya vive en una capa preferencial.",
      },
      {
        label: "Valor",
        value: "Estable",
        copy: "Tu lugar no depende de un upsell agresivo ni de presión comercial.",
      },
      {
        label: "Lectura",
        value: "Reconocimiento",
        copy: "Founder debe sentirse especial porque llegaste cuando todavía todo se estaba construyendo.",
      },
    ];
  }

  if (state.accessSource === "trial" || state.hasPremiumAccess) {
    return [
      {
        label: "Menos ruido",
        value: "Más contexto",
        copy: "Más respuestas, más visibilidad y menos ida y vuelta fuera del sistema.",
      },
      {
        label: "Decisión",
        value: "Más rápida",
        copy: "Resolver deja de depender de reconstruir chats y versiones cruzadas.",
      },
      {
        label: "Sensación",
        value: "Más control",
        copy: "La coordinación se vuelve más clara, más compartida y menos frágil.",
      },
    ];
  }

  return [
    {
      label: "Base",
      value: "Pareja completa",
      copy: "Free debería dejar crear, invitar y coordinar lo esencial sin matar activación.",
    },
    {
      label: "Premium",
      value: "Más claridad",
      copy: "Cuando ya coordinas con otros, aparece una capa más potente de contexto y control.",
    },
    {
      label: "Resultado",
      value: "Menos fricción",
      copy: "La diferencia no es más app. Es menos desgaste cada semana.",
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

function getPlanButtonLabel(card: PlanCardConfig, isCurrent: boolean, founderEquivalent: boolean) {
  if (isCurrent) return "Ya tienes este acceso";
  if (founderEquivalent) return "Tu acceso ya cubre esta capa";
  if (card.id === "free") return "Seguir con Free";
  return "Quiero este plan";
}

function getPlanHint(
  card: PlanCardConfig,
  state: PlanAccessState,
  isCurrent: boolean,
  founderEquivalent: boolean
) {
  if (isCurrent) {
    return "Ya estás en esta capa. Aquí la clave es medir si el valor que sientes coincide con lo que promete tu plan.";
  }
  if (founderEquivalent) {
    return "Founder ya vive en una capa preferencial. Aquí no necesitas hacer upgrade, sino entender el valor que ya conservas.";
  }
  if (card.id === "free") {
    return "Free te deja empezar bien. Subir solo tiene sentido cuando la coordinación ya te pide más claridad y menos desgaste.";
  }
  if (state.accessSource === "trial") {
    return "Todavía estás probando Premium. Este click sirve para leer intención real dentro de la beta, no para cobrarte ahora.";
  }
  return "Durante la beta privada no se cobra ni se activa desde aquí. Este paso nos sirve para medir intención real de upgrade.";
}

function useIsCompactWidth(maxWidth = 760) {
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

export default function PlanesPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
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
        if (active) setLoading(false);
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
  const outcomeCards = useMemo(() => getOutcomeCards(planState), [planState]);

  async function handlePlanClick(
    card: PlanCardConfig,
    isCurrent: boolean,
    founderEquivalent: boolean
  ) {
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
  }

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Planes"
        subtitle={
          isCompact
            ? "Tu acceso actual arriba. La diferencia real abajo."
            : "Premium debería aparecer cuando SyncPlans ya te evita desgaste real: más claridad compartida, menos fricción y mejor contexto para coordinar con otros."
        }
      />

      <div style={styles.wrapper}>
        <section style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={styles.heroCopy}>
              <div style={styles.eyebrow}>Monetización alineada al valor</div>
              <h1 style={styles.h1}>
                {loading ? "Cargando tu acceso..." : getDecisionHeadline(planState)}
              </h1>
              <p style={styles.heroText}>
                {loading ? "Leyendo tu información de cuenta..." : getDecisionCopy(planState)}
              </p>
            </div>

            <div style={styles.statusPill}>
              {loading ? "Leyendo..." : planState.statusLabel}
            </div>
          </div>

          <div style={styles.bulletGrid}>
            {(isCompact ? whyPayBullets.slice(0, 2) : whyPayBullets).map((item) => (
              <div key={item} style={styles.bulletCard}>
                <span style={styles.bulletDot} />
                <span style={styles.bulletText}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section style={styles.planStateCard}>
          <div style={styles.planStateHeader}>
            <div style={styles.planStateCopy}>
              <div style={styles.planTag}>
                {loading ? "Cargando plan..." : planState.planTag}
              </div>
              <h2 style={styles.planStateTitle}>
                {loading ? " " : planState.planLabel}
              </h2>
              <p style={styles.planStateSub}>
                {loading ? "Leyendo tu información..." : getCurrentPlanNote(planState)}
              </p>
            </div>

            <div style={styles.planStateBadge}>
              {loading
                ? "Leyendo..."
                : planState.hasPremiumAccess
                  ? "Capa premium activa"
                  : "Base Free activa"}
            </div>
          </div>

          <div style={styles.outcomesGrid}>
            {(isCompact ? outcomeCards.slice(0, 2) : outcomeCards).map((item) => (
              <article key={item.label} style={styles.outcomeCard}>
                <span style={styles.outcomeLabel}>{item.label}</span>
                <strong style={styles.outcomeValue}>{item.value}</strong>
                <p style={styles.outcomeCopy}>{item.copy}</p>
              </article>
            ))}
          </div>

          <div style={styles.betaNote}>
            <p style={styles.betaNoteTitle}>Beta privada</p>
            <p style={styles.betaNoteBody}>
              Todavía no estamos cobrando ni activando desde esta pantalla.
              Aquí estamos alineando el upgrade con momentos reales del producto:
              más contexto, más claridad y menos desgaste al coordinar.
            </p>
          </div>
        </section>

        <section style={styles.proofStrip}>
          <article style={styles.proofCard}>
            <span style={styles.proofLabel}>El caso base</span>
            <strong style={styles.proofValue}>Pareja completa en Free</strong>
            <p style={styles.proofCopy}>
              Free debe dejar crear el espacio, invitar a la otra persona y coordinar lo esencial sin matar activación.
            </p>
          </article>

          <article style={styles.proofCard}>
            <span style={styles.proofLabel}>La señal correcta</span>
            <strong style={styles.proofValue}>Menos desgaste</strong>
            <p style={styles.proofCopy}>
              Premium tiene sentido cuando ya no quieres volver al chat como fuente principal de verdad.
            </p>
          </article>

          <article style={styles.proofCard}>
            <span style={styles.proofLabel}>El cambio real</span>
            <strong style={styles.proofValue}>Más contexto</strong>
            <p style={styles.proofCopy}>
              La capa premium debería sentirse como más claridad compartida, no solo como más funciones.
            </p>
          </article>
        </section>

        <section style={styles.plansSection}>
          <header style={styles.plansHeader}>
            <div>
              <h3 style={styles.plansTitle}>Planes de SyncPlans</h3>
              <p style={styles.plansSub}>
                La diferencia real entre planes no es “tener más funciones”.
                Es cuánto contexto compartido, cuánta visibilidad y cuánta fricción quieres sacar de la coordinación cuando ya no te organizas solo.
              </p>
            </div>
          </header>

          {interestPlanId ? (
            <div style={styles.interestBanner}>
              <div style={styles.interestBadge}>Interés registrado</div>
              <div style={styles.interestCopy}>
                <strong style={styles.interestTitle}>
                  Gracias. Ya registramos intención real por{" "}
                  {interestPlanId === "premium_yearly"
                    ? "Premium Anual"
                    : "Premium Mensual"}{" "}
                  dentro de esta beta.
                </strong>
                <p style={styles.interestBody}>
                  Todavía no estamos cobrando ni activando desde esta pantalla.
                  Este click sí nos sirve para medir intención real justo después
                  de que el producto ya empezó a demostrar valor.
                </p>
              </div>
            </div>
          ) : null}

          <div style={styles.cardsGrid}>
            {cards.map((card) => {
              const isCurrent = planState.currentPlanCardId === card.id;
              const founderEquivalent = planState.isFounder && card.id !== "free";

              return (
                <article
                  key={card.id}
                  style={{
                    ...styles.card,
                    ...(card.highlight ? styles.cardHighlight : null),
                    ...(isCurrent ? styles.cardCurrent : null),
                  }}
                >
                  <div style={styles.cardTop}>
                    <div style={styles.cardCopy}>
                      <div style={styles.cardTagRow}>
                        <span style={styles.cardTag}>{card.tag}</span>
                        {card.badge ? (
                          <span style={styles.cardBadge}>{card.badge}</span>
                        ) : null}
                      </div>

                      <h4 style={styles.cardTitle}>{card.label}</h4>
                      <p style={styles.cardDescription}>
                        {isCompact ? card.idealFor : card.description}
                      </p>
                    </div>

                    <div style={styles.priceBlock}>
                      <div style={styles.priceRow}>
                        <span style={styles.price}>{card.price}</span>
                        <span style={styles.priceSuffix}>{card.priceSuffix}</span>
                      </div>

                      {isCurrent ? (
                        <span style={styles.currentChip}>Tu plan actual</span>
                      ) : founderEquivalent ? (
                        <span style={styles.currentChip}>
                          Tu acceso Founder se parece a esta capa
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {!isCompact ? <p style={styles.idealFor}>{card.idealFor}</p> : null}
                  {!isCompact ? <div style={styles.hook}>{card.emotionalHook}</div> : null}

                  <ul style={styles.featureList}>
                    {(isCompact ? card.features.slice(0, 3) : card.features).map(
                      (feature) => (
                        <li key={feature} style={styles.featureItem}>
                          <span style={styles.featureBullet} />
                          <span style={styles.featureText}>{feature}</span>
                        </li>
                      )
                    )}
                  </ul>

                  <div style={styles.cardCtaWrap}>
                    <button
                      type="button"
                      style={{
                        ...styles.ctaBtn,
                        ...(card.id !== "free" && !isCurrent && !founderEquivalent
                          ? styles.ctaBtnActive
                          : null),
                        opacity: isCurrent || founderEquivalent ? 0.74 : 1,
                        cursor: isCurrent || founderEquivalent ? "default" : "pointer",
                      }}
                      disabled={isCurrent || founderEquivalent}
                      onClick={() => {
                        void handlePlanClick(card, isCurrent, founderEquivalent);
                      }}
                    >
                      {getPlanButtonLabel(card, isCurrent, founderEquivalent)}
                    </button>

                    <p style={styles.cardHint}>
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

const styles: Record<string, CSSProperties> = {
  wrapper: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "20px 16px 40px",
    display: "grid",
    gap: 16,
  },
  hero: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 280px at 0% 0%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(700px 220px at 100% 0%, rgba(168,85,247,0.12), transparent 60%), rgba(15,23,42,0.96)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    padding: "18px",
    display: "grid",
    gap: 14,
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  heroCopy: {
    display: "grid",
    gap: 8,
    flex: "1 1 420px",
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.92)",
  },
  h1: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.06,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.84)",
  },
  statusPill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.95)",
    whiteSpace: "nowrap",
  },
  bulletGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  bulletCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 14px",
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    marginTop: 6,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.92)",
  },
  planStateCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.90)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.18)",
    padding: "18px",
    display: "grid",
    gap: 14,
  },
  planStateHeader: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 14,
    alignItems: "start",
  },
  planStateCopy: {
    display: "grid",
    gap: 8,
    minWidth: 0,
  },
  planTag: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.30)",
    background: "rgba(56,189,248,0.10)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(226,242,255,0.92)",
  },
  planStateTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.12,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  planStateSub: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.82)",
    maxWidth: 520,
  },
  planStateBadge: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
  },
  outcomesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  outcomeCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 14px",
    display: "grid",
    gap: 4,
  },
  outcomeLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.82)",
  },
  outcomeValue: {
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  outcomeCopy: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.82)",
  },
  betaNote: {
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    padding: "12px 14px",
    display: "grid",
    gap: 4,
  },
  betaNoteTitle: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(226,232,240,0.92)",
  },
  betaNoteBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.82)",
  },
  proofStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  proofCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(15,23,42,0.84)",
    padding: "14px",
    display: "grid",
    gap: 5,
  },
  proofLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.82)",
  },
  proofValue: {
    fontSize: 18,
    lineHeight: 1.12,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  proofCopy: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.82)",
  },
  plansSection: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.90)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.18)",
    padding: "18px",
    display: "grid",
    gap: 14,
  },
  plansHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  plansTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  plansSub: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.82)",
    maxWidth: 640,
  },
  interestBanner: {
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(37,99,235,0.16))",
    padding: "14px",
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  interestBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.95)",
    border: "1px solid rgba(56,189,248,0.30)",
    background: "rgba(255,255,255,0.08)",
  },
  interestCopy: {
    display: "grid",
    gap: 4,
    flex: "1 1 320px",
    minWidth: 0,
  },
  interestTitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.96)",
  },
  interestBody: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.84)",
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },
  card: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: "16px",
    display: "grid",
    gap: 12,
    boxShadow: "0 14px 34px rgba(0,0,0,0.16)",
  },
  cardHighlight: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(37,99,235,0.20))",
  },
  cardCurrent: {
    border: "1px solid rgba(56,189,248,0.36)",
  },
  cardTop: {
    display: "grid",
    gap: 12,
  },
  cardCopy: {
    display: "grid",
    gap: 8,
  },
  cardTagRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardTag: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.92)",
  },
  cardBadge: {
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.14)",
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(226,242,255,0.94)",
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  cardDescription: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.84)",
  },
  priceBlock: {
    display: "grid",
    gap: 6,
  },
  priceRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 6,
    flexWrap: "wrap",
  },
  price: {
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  priceSuffix: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(203,213,225,0.78)",
  },
  currentChip: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 11,
    fontWeight: 850,
    color: "rgba(255,255,255,0.92)",
  },
  idealFor: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.84)",
  },
  hook: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(191,219,254,0.92)",
    fontWeight: 800,
  },
  featureList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 10,
  },
  featureItem: {
    display: "grid",
    gridTemplateColumns: "10px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
  },
  featureBullet: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    marginTop: 7,
  },
  featureText: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.86)",
  },
  cardCtaWrap: {
    display: "grid",
    gap: 8,
  },
  ctaBtn: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    fontWeight: 900,
  },
  ctaBtnActive: {
    border: "1px solid rgba(56,189,248,0.28)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(37,99,235,0.22))",
  },
  cardHint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(148,163,184,0.88)",
  },
};