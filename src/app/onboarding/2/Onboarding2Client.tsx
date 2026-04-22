// src/app/onboarding/2/Onboarding2Client.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";

const FRICTIONS = [
  {
    title: "Cada uno maneja una versión distinta",
    body: "Uno cree que ya quedó cerrado. El otro piensa que todavía estaba por definirse.",
  },
  {
    title: "El chat reemplaza a la referencia real",
    body: "Los planes viven entre mensajes, audios y memoria. Por eso después nadie sabe qué quedó finalmente.",
  },
  {
    title: "El problema aparece tarde",
    body: "Cuando el cruce se ve recién al final, ya no se siente como organización. Se siente como fricción.",
  },
] as const;

export default function Onboarding2Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_2",
      metadata: { flow: "core", step: 2, wedge: "couples" },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: {
        flow: "core",
        step: 2,
        screen: "onboarding_step_2",
        wedge: "couples",
      },
    });
  }, []);

  function handleBack() {
    void trackEvent({
      event: "onboarding_step_back_clicked",
      metadata: {
        from_step: 2,
        to_step: 1,
        screen: "onboarding_step_2",
        wedge: "couples",
      },
    });

    router.push(`/onboarding/1${qsNext}`);
  }

  function handleContinue() {
    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: {
        from_step: 2,
        to_step: 3,
        screen: "onboarding_step_2",
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

      <section style={S.shell} className="ob2-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <BrandLogo variant="mark" size={30} />
            </div>

            <div style={S.brandMeta}>
              <span style={S.step}>Paso 2 de 4</span>
              <span style={S.stepTitle}>El problema no es el calendario</span>
            </div>
          </div>
        </header>

        <div style={S.heroGrid} className="ob2-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>La fricción real está en otro lado</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>El problema es la coordinación del día a día.</h1>
              <h2 style={S.titleAccent}>
                No falta agenda. Falta una sola referencia clara entre ustedes.
              </h2>
            </div>

            <p style={S.lead}>
              Cuando cada uno organiza su tiempo por separado, los planes no
              necesariamente están mal hechos. El problema es que viven en
              lugares distintos, llegan en momentos distintos y se entienden de
              forma distinta.
            </p>

            <div style={S.frictionList}>
              {FRICTIONS.map((item) => (
                <div key={item.title} style={S.frictionCard}>
                  <div style={S.frictionDot} />
                  <div style={S.frictionContent}>
                    <div style={S.frictionTitle}>{item.title}</div>
                    <div style={S.frictionBody}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.actions}>
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <button type="button" onClick={handleContinue} style={S.primaryButton}>
                Ver la solución
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualHeader}>
              <div style={S.visualHeaderMeta}>
                <span style={S.visualTag}>Lo que suele pasar</span>
                <span style={S.visualMini}>Dos personas, dos versiones</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Desalineado
              </div>
            </div>

            <div style={S.chatStack}>
              <div style={S.chatBubbleLeft}>
                ¿Sí quedamos para hoy o era mañana?
              </div>

              <div style={S.chatBubbleRight}>
                Yo entendí que era mañana después del trabajo.
              </div>

              <div style={S.chatBubbleLeftMuted}>
                Pensé que ya estaba confirmado...
              </div>
            </div>

            <div style={S.comparisonCard}>
              <div style={S.compareCol}>
                <div style={S.compareLabel}>Sin una referencia común</div>
                <div style={S.compareTitle}>Cada uno interpreta su versión</div>
                <div style={S.compareBody}>
                  El plan existe, pero no vive en un lugar confiable para ambos.
                </div>
              </div>

              <div style={S.compareDivider} />

              <div style={S.compareCol}>
                <div style={S.compareLabel}>El resultado</div>
                <div style={S.compareTitle}>Cruces, dudas y mensajes repetidos</div>
                <div style={S.compareBody}>
                  No por mala intención, sino porque nadie estaba mirando lo mismo.
                </div>
              </div>
            </div>

            <div style={S.footerNote}>
              Coordinarse no debería depender de memoria, supuestos o revisar
              conversaciones viejas.
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
    fontSize: 46,
    lineHeight: 0.98,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    color: "#F8FAFC",
    maxWidth: "13ch",
  },

  titleAccent: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
    letterSpacing: "-0.03em",
    fontWeight: 850,
    background:
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 42%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
    maxWidth: "18ch",
  },

  lead: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.72,
    color: "rgba(203,213,225,0.92)",
    maxWidth: "41ch",
  },

  frictionList: {
    display: "grid",
    gap: 12,
  },

  frictionCard: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.40)",
  },

  frictionDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    background: "#FBBF24",
    boxShadow: "0 0 0 6px rgba(251,191,36,0.12)",
  },

  frictionContent: {
    display: "grid",
    gap: 4,
  },

  frictionTitle: {
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(248,250,252,0.98)",
    lineHeight: 1.35,
  },

  frictionBody: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.88)",
  },

  actions: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
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
    border: "1px solid rgba(251,191,36,0.18)",
    background: "rgba(251,191,36,0.10)",
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: 800,
  },

  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#FBBF24",
    boxShadow: "0 0 0 4px rgba(251,191,36,0.14)",
  },

  chatStack: {
    display: "grid",
    gap: 10,
  },

  chatBubbleLeft: {
    width: "fit-content",
    maxWidth: "88%",
    padding: "12px 14px",
    borderRadius: "18px 18px 18px 6px",
    background: "rgba(15,23,42,0.62)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },

  chatBubbleRight: {
    width: "fit-content",
    maxWidth: "88%",
    justifySelf: "end",
    padding: "12px 14px",
    borderRadius: "18px 18px 6px 18px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.12) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "rgba(248,250,252,0.98)",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },

  chatBubbleLeftMuted: {
    width: "fit-content",
    maxWidth: "88%",
    padding: "12px 14px",
    borderRadius: "18px 18px 18px 6px",
    background: "rgba(15,23,42,0.40)",
    border: "1px solid rgba(148,163,184,0.10)",
    color: "rgba(203,213,225,0.92)",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
  },

  comparisonCard: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 14,
    alignItems: "stretch",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.44)",
  },

  compareCol: {
    display: "grid",
    gap: 4,
  },

  compareLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.78)",
  },

  compareTitle: {
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  compareBody: {
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.88)",
  },

  compareDivider: {
    width: 1,
    background: "rgba(148,163,184,0.18)",
  },

  footerNote: {
    fontSize: 12,
    lineHeight: 1.6,
    color: "rgba(148,163,184,0.88)",
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob2-shell {
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .ob2-grid {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 768px) {
    .ob2-shell {
      padding: 14px !important;
    }
  }

  @media (max-width: 640px) {
    .ob2-shell {
      border-radius: 22px !important;
    }
  }
`;