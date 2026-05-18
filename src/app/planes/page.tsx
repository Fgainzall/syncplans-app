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
  getPremiumContextCopy,
  normalizePremiumContextKey,
  type PlanAccessState,
  type PlanCardId,
  type PremiumContextKey,
} from "@/lib/premium";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type PlanCardConfig = {
  id: PlanCardId;
  label: string;
  tag: string;
  price: string;
  description: string;
  features: string[];
  badge?: string;
  highlight?: boolean;
};

type BenefitItem = {
  title: string;
  copy: string;
};

function buildPlanCards(): PlanCardConfig[] {
  return [
    {
      id: "free",
      label: "Free",
      tag: "Base",
      price: "Gratis",
      description: "Para probar SyncPlans con un primer espacio compartido.",
      features: [
        `Hasta ${FREE_GROUP_LIMIT} grupo cuando termine la beta.`,
        "Crear planes compartidos.",
        "Invitar miembros.",
      ],
    },
    {
      id: "premium_monthly",
      label: "Premium Beta",
      tag: "Activo ahora",
      price: "Sin cobro",
      badge: "Tu acceso actual",
      highlight: true,
      description: "Acceso completo durante la beta para medir uso real.",
      features: [
        "Grupos ilimitados durante beta.",
        "Conflictos y decisiones compartidas.",
        "Quick Capture y Smart Mobility.",
        "Integraciones y contexto avanzado.",
      ],
    },
    {
      id: "premium_yearly",
      label: "Premium Anual",
      tag: "Próximamente",
      price: "Luego",
      description: "Para usuarios que conviertan SyncPlans en hábito semanal.",
      features: [
        "Todo Premium.",
        "Mejor valor a largo plazo.",
        "Pensado para coordinación recurrente.",
      ],
    },
  ];
}

function getHeroTitle(state: PlanAccessState): string {
  if (state.isFounder) return "Founder activo";
  if (state.accessSource === "trial") return "Premium en prueba";
  if (state.hasPremiumAccess) return "Premium Beta activo";
  return "Estás en Free";
}

function getHeroCopy(state: PlanAccessState): string {
  if (state.isFounder) {
    return "Tienes acceso preferencial dentro de SyncPlans.";
  }

  if (state.accessSource === "trial") {
    return "Estás probando la capa completa antes de decidir si pagar.";
  }

  if (state.hasPremiumAccess) {
    return "Tienes acceso completo mientras validamos el producto con usuarios reales.";
  }

  return "Puedes empezar gratis y subir cuando SyncPlans ya te ahorre coordinación real.";
}

function getCurrentPlanNote(state: PlanAccessState): string {
  if (state.isFounder) return "Acceso Founder";
  if (state.accessSource === "trial") return "Prueba Premium activa";
  if (state.hasPremiumAccess) return "Todas las funciones desbloqueadas durante beta";
  return "Plan base activo";
}

function getBenefitItems(state: PlanAccessState): BenefitItem[] {
  if (state.hasPremiumAccess) {
    return [
      {
        title: "Grupos sin bloqueo",
        copy: "Crea espacios para pareja, familia u otros grupos durante beta.",
      },
      {
        title: "Conflictos visibles",
        copy: "Detecta choques y decide qué plan conservar o ajustar.",
      },
      {
        title: "Quick Capture",
        copy: "Convierte una idea rápida en un plan con menos pasos.",
      },
      {
        title: "Smart Mobility",
        copy: "Recibe contexto de ruta y hora sugerida de salida.",
      },
      {
        title: "Invitaciones y miembros",
        copy: "Coordina con otras personas desde un solo lugar.",
      },
    ];
  }

  return [
    {
      title: "Primer grupo",
      copy: "Prueba SyncPlans con una pareja, familia o grupo pequeño.",
    },
    {
      title: "Planes compartidos",
      copy: "Crea eventos y mantén una sola versión del plan.",
    },
    {
      title: "Base de coordinación",
      copy: "Valida si la app reduce ida y vuelta por chat.",
    },
  ];
}

function getPlanButtonLabel(card: PlanCardConfig, isCurrent: boolean, founderEquivalent: boolean) {
  if (isCurrent) return "Plan actual";
  if (founderEquivalent) return "Incluido en Founder";
  if (card.id === "free") return "Ir al resumen";
  if (card.id === "premium_yearly") return "Registrar interés";
  return "Registrar interés";
}

function getPlanHint(card: PlanCardConfig, isCurrent: boolean, founderEquivalent: boolean) {
  if (isCurrent) return "No tienes que hacer nada ahora.";
  if (founderEquivalent) return "Tu acceso ya cubre esta capa.";
  if (card.id === "free") return "Vuelve al producto y sigue probando.";
  return "Durante beta no se cobra desde esta pantalla.";
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
  const [entryContext, setEntryContext] = useState<PremiumContextKey | null>(null);
  const [entryContextLoaded, setEntryContextLoaded] = useState(false);
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
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setEntryContext(normalizePremiumContextKey(params.get("context")));
    setEntryContextLoaded(true);
  }, []);

  useEffect(() => {
    if (!entryContextLoaded) return;

    void trackScreenView({ screen: "planes", metadata: { area: "premium" } });
    void trackEvent({
      event: "premium_viewed",
      metadata: {
        screen: "planes",
        area: "premium",
        placement: "plans_page",
        context: entryContext ?? "direct",
      },
    });
  }, [entryContext, entryContextLoaded]);

  const cards = useMemo(() => buildPlanCards(), []);
  const planState = useMemo(() => getPlanAccessState(profile), [profile]);
  const benefits = useMemo(() => getBenefitItems(planState), [planState]);
  const entryContextCopy = useMemo(
    () => (entryContext ? getPremiumContextCopy(entryContext) : null),
    [entryContext]
  );

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
        subtitle="Tu acceso actual y qué incluye."
      />

      <div style={styles.wrapper}>
        <section style={styles.hero}>
          <div style={styles.heroHeader}>
            <div style={styles.heroCopy}>
              <div style={styles.eyebrow}>Plan actual</div>
              <h1 style={styles.h1}>
                {loading ? "Cargando tu plan..." : getHeroTitle(planState)}
              </h1>
              <p style={styles.heroText}>
                {loading ? "Leyendo tu información de cuenta." : getHeroCopy(planState)}
              </p>
            </div>

            <div style={styles.statusPill}>
              <span style={styles.statusDot} />
              {loading ? "Leyendo" : getCurrentPlanNote(planState)}
            </div>
          </div>

          <div style={styles.quickStatsGrid}>
            <div style={styles.quickStat}>
              <span style={styles.quickStatLabel}>Cobro</span>
              <strong style={styles.quickStatValue}>No activo</strong>
            </div>
            <div style={styles.quickStat}>
              <span style={styles.quickStatLabel}>Acceso</span>
              <strong style={styles.quickStatValue}>
                {planState.hasPremiumAccess ? "Completo" : "Base"}
              </strong>
            </div>
            <div style={styles.quickStat}>
              <span style={styles.quickStatLabel}>Estado</span>
              <strong style={styles.quickStatValue}>
                {planState.hasPremiumAccess ? "Beta" : "Free"}
              </strong>
            </div>
          </div>
        </section>

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>Incluye</div>
              <h2 style={styles.sectionTitle}>
                {planState.hasPremiumAccess
                  ? "Todo desbloqueado durante beta"
                  : "Lo esencial para empezar"}
              </h2>
            </div>
          </div>

          <div style={styles.benefitsGrid}>
            {(isCompact ? benefits : benefits.slice(0, 6)).map((item) => (
              <article key={item.title} style={styles.benefitCard}>
                <div style={styles.checkIcon}>✓</div>
                <div style={styles.benefitCopy}>
                  <strong style={styles.benefitTitle}>{item.title}</strong>
                  <p style={styles.benefitText}>{item.copy}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {entryContextCopy ? (
          <section style={styles.contextCard}>
            <div style={styles.contextBadge}>{entryContextCopy.label}</div>
            <h2 style={styles.contextTitle}>{entryContextCopy.title}</h2>
            <p style={styles.contextText}>{entryContextCopy.copy}</p>
          </section>
        ) : null}

        <section style={styles.sectionCard}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.eyebrow}>Comparación rápida</div>
              <h2 style={styles.sectionTitle}>Free vs Premium</h2>
            </div>
          </div>

          {interestPlanId ? (
            <div style={styles.interestBanner}>
              Interés registrado por {interestPlanId === "premium_yearly" ? "Premium Anual" : "Premium"}. Todavía no hay cobro.
            </div>
          ) : null}

          <div style={styles.cardsGrid}>
            {cards.map((card) => {
              const isCurrent =
                planState.currentPlanCardId === card.id ||
                (planState.hasPremiumAccess && card.id === "premium_monthly");
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
                  <div style={styles.cardTopRow}>
                    <span style={styles.cardTag}>{card.tag}</span>
                    {card.badge || isCurrent ? (
                      <span style={styles.cardBadge}>{isCurrent ? "Activo" : card.badge}</span>
                    ) : null}
                  </div>

                  <div style={styles.cardMain}>
                    <h3 style={styles.cardTitle}>{card.label}</h3>
                    <div style={styles.price}>{card.price}</div>
                    <p style={styles.cardDescription}>{card.description}</p>
                  </div>

                  <ul style={styles.featureList}>
                    {card.features.map((feature) => (
                      <li key={feature} style={styles.featureItem}>
                        <span style={styles.featureBullet}>✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div style={styles.cardCtaWrap}>
                    <button
                      type="button"
                      style={{
                        ...styles.ctaBtn,
                        ...(card.highlight && !isCurrent && !founderEquivalent
                          ? styles.ctaBtnActive
                          : null),
                        opacity: isCurrent || founderEquivalent ? 0.72 : 1,
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
                      {getPlanHint(card, isCurrent, founderEquivalent)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section style={styles.betaNote}>
          <strong style={styles.betaNoteTitle}>Nota beta</strong>
          <p style={styles.betaNoteBody}>
            Por ahora no hay pagos ni tarjetas. La prioridad es que usuarios reales creen grupos,
            inviten personas y prueben si SyncPlans reduce la coordinación manual.
          </p>
        </section>
      </div>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "18px 16px 40px",
    display: "grid",
    gap: 14,
  },
  hero: {
    borderRadius: 24,
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "radial-gradient(800px 260px at 0% 0%, rgba(56,189,248,0.18), transparent 56%), radial-gradient(700px 220px at 100% 0%, rgba(59,130,246,0.16), transparent 58%), rgba(15,23,42,0.96)",
    boxShadow: "0 18px 55px rgba(0,0,0,0.22)",
    padding: 18,
    display: "grid",
    gap: 14,
    overflow: "hidden",
  },
  heroHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
  },
  heroCopy: {
    display: "grid",
    gap: 7,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.11em",
    color: "rgba(125,211,252,0.92)",
  },
  h1: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    color: "rgba(255,255,255,0.98)",
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.84)",
  },
  statusPill: {
    width: "fit-content",
    maxWidth: "100%",
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    background: "rgba(34,197,94,0.95)",
    boxShadow: "0 0 18px rgba(34,197,94,0.40)",
    flexShrink: 0,
  },
  quickStatsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },
  quickStat: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.045)",
    padding: "11px 10px",
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  quickStatLabel: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.88)",
  },
  quickStatValue: {
    fontSize: 14,
    lineHeight: 1.1,
    fontWeight: 950,
    color: "rgba(255,255,255,0.96)",
    overflowWrap: "anywhere",
  },
  sectionCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.91)",
    boxShadow: "0 18px 55px rgba(0,0,0,0.18)",
    padding: 16,
    display: "grid",
    gap: 13,
    overflow: "hidden",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionTitle: {
    margin: "5px 0 0",
    fontSize: 21,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  benefitsGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 9,
  },
  benefitCard: {
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.045)",
    padding: 12,
    display: "grid",
    gridTemplateColumns: "26px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
  },
  checkIcon: {
    width: 26,
    height: 26,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.14)",
    border: "1px solid rgba(56,189,248,0.24)",
    color: "rgba(125,211,252,0.98)",
    fontWeight: 950,
    fontSize: 13,
  },
  benefitCopy: {
    display: "grid",
    gap: 3,
    minWidth: 0,
  },
  benefitTitle: {
    fontSize: 14,
    lineHeight: 1.2,
    color: "rgba(255,255,255,0.96)",
  },
  benefitText: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.84)",
  },
  contextCard: {
    borderRadius: 20,
    border: "1px solid rgba(216,180,254,0.20)",
    background: "linear-gradient(135deg, rgba(168,85,247,0.14), rgba(15,23,42,0.92))",
    padding: 15,
    display: "grid",
    gap: 7,
  },
  contextBadge: {
    width: "fit-content",
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(216,180,254,0.24)",
    background: "rgba(168,85,247,0.12)",
    fontSize: 10.5,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(250,245,255,0.94)",
  },
  contextTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  contextText: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.48,
    color: "rgba(233,213,255,0.84)",
  },
  interestBanner: {
    borderRadius: 15,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.10)",
    padding: "12px 13px",
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "rgba(226,242,255,0.92)",
    fontWeight: 800,
  },
  cardsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 10,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 11,
    minWidth: 0,
  },
  cardHighlight: {
    background: "linear-gradient(135deg, rgba(56,189,248,0.11), rgba(37,99,235,0.18))",
  },
  cardCurrent: {
    border: "1px solid rgba(56,189,248,0.38)",
    boxShadow: "0 16px 40px rgba(37,99,235,0.12)",
  },
  cardTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  cardTag: {
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 10.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.90)",
  },
  cardBadge: {
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.14)",
    fontSize: 10.5,
    fontWeight: 900,
    color: "rgba(226,242,255,0.94)",
  },
  cardMain: {
    display: "grid",
    gap: 5,
  },
  cardTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.08,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  price: {
    fontSize: 23,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    color: "rgba(255,255,255,0.98)",
  },
  cardDescription: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.84)",
  },
  featureList: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 7,
  },
  featureItem: {
    display: "grid",
    gridTemplateColumns: "17px minmax(0, 1fr)",
    gap: 7,
    alignItems: "start",
    fontSize: 12.5,
    lineHeight: 1.38,
    color: "rgba(226,232,240,0.86)",
  },
  featureBullet: {
    color: "rgba(125,211,252,0.98)",
    fontWeight: 950,
    fontSize: 12,
    lineHeight: 1.35,
  },
  cardCtaWrap: {
    display: "grid",
    gap: 7,
  },
  ctaBtn: {
    minHeight: 40,
    padding: "0 13px",
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
    fontSize: 11.5,
    lineHeight: 1.42,
    color: "rgba(148,163,184,0.88)",
  },
  betaNote: {
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 5,
  },
  betaNoteTitle: {
    fontSize: 12,
    fontWeight: 950,
    color: "rgba(255,255,255,0.94)",
  },
  betaNoteBody: {
    margin: 0,
    fontSize: 12.5,
    lineHeight: 1.48,
    color: "rgba(203,213,225,0.82)",
  },
};
