// src/app/onboarding/4/Onboarding4Client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";
import { trackEvent, trackScreenView } from "@/lib/analytics";

const OPTIONS = [
  {
    title: "Crear mi espacio en pareja",
    body: "La mejor forma de empezar. Crea el espacio compartido, invita a tu pareja y coordinen desde una sola agenda clara.",
    cta: "Crear espacio en pareja",
    target: "/groups/new?type=pair",
    featured: true,
  },
  {
    title: "Empezar solo por ahora",
    body: "Puedes familiarizarte con SyncPlans primero y traer a tu pareja después, cuando quieras.",
    cta: "Entrar solo",
    target: "/summary",
    featured: false,
  },
] as const;

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_4",
      metadata: { flow: "core", step: 4, wedge: "couples" },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: {
        flow: "core",
        step: 4,
        screen: "onboarding_step_4",
        wedge: "couples",
      },
    });
  }, []);

  async function finishAndGo(target: string, kind: "pair" | "solo") {
    if (loadingTarget) return;
    setLoadingTarget(target);

    try {
      await markMyOnboardingCompleted();

      void trackEvent({
        event: "onboarding_completed",
        metadata: {
          screen: "onboarding_step_4",
          wedge: "couples",
          choice: kind,
          target,
        },
      });

      router.replace(target);
    } catch {
      setLoadingTarget(null);
    }
  }

  function handleBack() {
    void trackEvent({
      event: "onboarding_step_back_clicked",
      metadata: {
        from_step: 4,
        to_step: 3,
        screen: "onboarding_step_4",
        wedge: "couples",
      },
    });

    router.push(`/onboarding/3${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div style={S.ambientTop} aria-hidden />
      <div style={S.ambientLeft} aria-hidden />
      <div style={S.ambientRight} aria-hidden />
      <div style={S.gridGlow} aria-hidden />

      <section style={S.shell} className="ob4-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <BrandLogo variant="mark" size={30} />
            </div>

            <div style={S.brandMeta}>
              <span style={S.step}>Paso 4 de 4</span>
              <span style={S.stepTitle}>La claridad empieza cuando decides entrar</span>
            </div>
          </div>
        </header>

        <div style={S.heroGrid} className="ob4-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Ahora sí, empieza</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>SyncPlans funciona mejor cuando la coordinación deja de depender del chat.</h1>
              <h2 style={S.titleAccent}>
                La mejor activación no es mirar pantallas. Es crear el primer espacio y empezar a usarlo.
              </h2>
            </div>

            <p style={S.lead}>
              Ya viste el problema y ya viste la lógica de la solución. Ahora toca
              entrar de verdad. Puedes empezar con tu pareja desde el primer minuto,
              o entrar solo y traerla después.
            </p>

            <div style={S.choiceStack}>
              {OPTIONS.map((option) => {
                const isLoading = loadingTarget === option.target;

                return (
                  <div
                    key={option.title}
                    style={{
                      ...S.choiceCard,
                      ...(option.featured ? S.choiceCardFeatured : null),
                    }}
                  >
                    {option.featured && <div style={S.choiceBadge}>Recomendado</div>}

                    <div style={S.choiceHeader}>
                      <div style={S.choiceTitle}>{option.title}</div>
                      <div style={S.choiceBody}>{option.body}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        finishAndGo(option.target, option.featured ? "pair" : "solo")
                      }
                      style={option.featured ? S.primaryButton : S.secondaryButton}
                      disabled={Boolean(loadingTarget)}
                    >
                      {isLoading ? "Entrando..." : option.cta}
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={S.actions}>
              <button type="button" onClick={handleBack} style={S.ghostButton}>
                Atrás
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualHeader}>
              <div style={S.visualHeaderMeta}>
                <span style={S.visualTag}>El momento importante</span>
                <span style={S.visualMini}>Activación en pocos minutos</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Listo para empezar
              </div>
            </div>

            <div style={S.stepsCard}>
              <div style={S.stepsTitle}>Tu camino ideal</div>

              <div style={S.stepList}>
                <div style={S.stepItem}>
                  <div style={S.stepBubble}>1</div>
                  <div style={S.stepText}>
                    <div style={S.stepItemTitle}>Crear espacio</div>
                    <div style={S.stepItemBody}>
                      Empiezas con una sola agenda compartida.
                    </div>
                  </div>
                </div>

                <div style={S.stepItem}>
                  <div style={S.stepBubble}>2</div>
                  <div style={S.stepText}>
                    <div style={S.stepItemTitle}>Invitar a tu pareja</div>
                    <div style={S.stepItemBody}>
                      La coordinación ya no depende de memoria o mensajes sueltos.
                    </div>
                  </div>
                </div>

                <div style={S.stepItem}>
                  <div style={S.stepBubble}>3</div>
                  <div style={S.stepText}>
                    <div style={S.stepItemTitle}>Crear el primer plan</div>
                    <div style={S.stepItemBody}>
                      Ahí aparece el valor real: claridad, contexto y menos fricción.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={S.summaryCard}>
              <div style={S.summaryTitle}>Lo importante no es terminar el onboarding.</div>
              <div style={S.summaryBody}>
                Lo importante es llegar rápido a tu primer momento de coordinación real.
              </div>
            </div>
          </aside>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    position: "relative",
    overflowX: "hidden",
    background:
      "radial-gradient(circle at top, rgba(15,23,42,0.94) 0%, #040816 42%, #030712 100%)",
    color: "#F8FAFC",
    padding: "20px 16px 28px",
  },

  ambientTop: {
    position: "absolute",
    inset: "0 0 auto 0",
    height: 220,
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.08) 0%, rgba(56,189,248,0) 100%)",
    pointerEvents: "none",
  },

  ambientLeft: {
    position: "absolute",
    left: -120,
    top: 120,
    width: 280,
    height: 280,
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(56,189,248,0.14), transparent 68%)",
    filter: "blur(8px)",
    pointerEvents: "none",
  },

  ambientRight: {
    position: "absolute",
    right: -120,
    top: 180,
    width: 300,
    height: 300,
    borderRadius: "999px",
    background: "radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)",
    filter: "blur(10px)",
    pointerEvents: "none",
  },

  gridGlow: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
    backgroundSize: "36px 36px",
    maskImage: "radial-gradient(circle at center, black 30%, transparent 86%)",
    opacity: 0.55,
    pointerEvents: "none",
  },

  shell: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: 18,
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.86) 0%, rgba(2,6,23,0.92) 100%)",
    boxShadow: "0 18px 50px rgba(2,6,23,0.42)",
    backdropFilter: "blur(16px)",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  logoWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.72)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },

  brandMeta: {
    display: "grid",
    gap: 2,
    minWidth: 0,
  },

  step: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.88)",
  },

  stepTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "rgba(248,250,252,0.98)",
    lineHeight: 1.3,
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    gap: 18,
    alignItems: "stretch",
  },

  copyCard: {
    display: "grid",
    gap: 18,
    alignContent: "start",
    padding: 22,
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.52) 0%, rgba(2,6,23,0.18) 100%)",
  },

  kicker: {
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.20)",
    background: "rgba(56,189,248,0.10)",
    color: "#CFF4FF",
    fontSize: 12,
    fontWeight: 800,
  },

  titleBlock: {
    display: "grid",
    gap: 8,
  },

  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 0.98,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    color: "#F8FAFC",
    maxWidth: "14ch",
  },

  titleAccent: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    fontWeight: 850,
    background:
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 42%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
    maxWidth: "20ch",
  },

  lead: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.72,
    color: "rgba(203,213,225,0.92)",
    maxWidth: "41ch",
  },

  choiceStack: {
    display: "grid",
    gap: 12,
  },

  choiceCard: {
    display: "grid",
    gap: 14,
    padding: "16px 16px",
    borderRadius: 20,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.40)",
  },

  choiceCardFeatured: {
    border: "1px solid rgba(56,189,248,0.20)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.08) 100%)",
  },

  choiceBadge: {
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.12)",
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  choiceHeader: {
    display: "grid",
    gap: 4,
  },

  choiceTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  choiceBody: {
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(203,213,225,0.88)",
  },

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  primaryButton: {
    minHeight: 48,
    padding: "0 20px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.24)",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 48%, #A855F7 100%)",
    color: "#06111D",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(56,189,248,0.22)",
  },

  secondaryButton: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.42)",
    color: "rgba(226,232,240,0.96)",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
  },

  ghostButton: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "transparent",
    color: "rgba(203,213,225,0.90)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },

  visualCard: {
    display: "grid",
    gap: 14,
    alignContent: "start",
    padding: 18,
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.95) 0%, rgba(2,6,23,0.98) 100%)",
    boxShadow: "0 16px 42px rgba(2,6,23,0.32)",
  },

  visualHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },

  visualHeaderMeta: {
    display: "grid",
    gap: 3,
  },

  visualTag: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.78)",
  },

  visualMini: {
    fontSize: 13,
    fontWeight: 700,
    color: "rgba(248,250,252,0.95)",
  },

  signalBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.18)",
    background: "rgba(34,197,94,0.10)",
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: 800,
  },

  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22C55E",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.14)",
  },

  stepsCard: {
    display: "grid",
    gap: 12,
    borderRadius: 18,
    padding: "14px 14px 13px",
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.11) 0%, rgba(168,85,247,0.08) 100%)",
  },

  stepsTitle: {
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  stepList: {
    display: "grid",
    gap: 12,
  },

  stepItem: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
  },

  stepBubble: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(2,6,23,0.34)",
    border: "1px solid rgba(148,163,184,0.16)",
    color: "#E0F2FE",
    fontSize: 13,
    fontWeight: 900,
  },

  stepText: {
    display: "grid",
    gap: 3,
  },

  stepItemTitle: {
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  stepItemBody: {
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.88)",
  },

  summaryCard: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 13px",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.44)",
  },

  summaryTitle: {
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  summaryBody: {
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.88)",
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob4-shell {
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .ob4-grid {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 768px) {
    .ob4-shell {
      padding: 14px !important;
    }
  }

  @media (max-width: 640px) {
    .ob4-shell {
      border-radius: 22px !important;
    }
  }
`;