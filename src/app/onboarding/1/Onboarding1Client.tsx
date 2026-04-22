// src/app/onboarding/1/Onboarding1Client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";

type CtaState = "idle" | "loading";

const QUOTES = [
  "Pensé que era otro día",
  "No vi ese mensaje",
  "Yo ya tenía otro plan",
] as const;

export default function Onboarding1Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const [skipState, setSkipState] = useState<CtaState>("idle");

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_1",
      metadata: { flow: "core", step: 1 },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: { flow: "core", step: 1, screen: "onboarding_step_1" },
    });
  }, []);

  async function handleSkip() {
    if (skipState === "loading") return;

    setSkipState("loading");

    try {
      void trackEvent({
        event: "onboarding_skipped",
        metadata: {
          screen: "onboarding_step_1",
          step: 1,
          destination: nextFinal,
        },
      });

      await markMyOnboardingCompleted();
      router.replace(nextFinal);
    } catch {
      setSkipState("idle");
    }
  }

  function handleLogin() {
    void trackEvent({
      event: "onboarding_login_clicked",
      metadata: { screen: "onboarding_step_1", step: 1 },
    });

    router.push(`/auth/login${qsNext}`);
  }

  function handleContinue() {
    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: {
        from_step: 1,
        to_step: 2,
        screen: "onboarding_step_1",
      },
    });

    router.push(`/onboarding/2${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div style={S.ambientTop} aria-hidden />
      <div style={S.ambientLeft} aria-hidden />
      <div style={S.ambientRight} aria-hidden />
      <div style={S.gridGlow} aria-hidden />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <BrandLogo variant="mark" size={30} />
            </div>

            <div style={S.brandMeta}>
              <span style={S.step}>Paso 1 de 4</span>
              <span style={S.stepTitle}>Coordinar no debería desgastar</span>
            </div>
          </div>

          <button type="button" onClick={handleLogin} style={S.topGhost}>
            Ya tengo cuenta
          </button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>La diferencia se entiende en segundos</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>El problema no es agendar.</h1>
              <h2 style={S.titleAccent}>
                Es compartir tiempo sin una sola versión clara.
              </h2>
            </div>

            <p style={S.lead}>
              SyncPlans no viene a reemplazar tu calendario. Viene a reducir
              cruces, supuestos y conversaciones repetidas cuando el plan ya no
              depende de una sola persona.
            </p>

            <div style={S.chips}>
              {QUOTES.map((quote) => (
                <span key={quote} style={S.chip}>
                  “{quote}”
                </span>
              ))}
            </div>

            <div style={S.proofRow}>
              <div style={S.proofItem}>
                <span style={S.proofLabel}>Antes</span>
                <span style={S.proofText}>Chats, supuestos y confusión</span>
              </div>

              <div style={S.proofDivider} />

              <div style={S.proofItem}>
                <span style={S.proofLabel}>Con SyncPlans</span>
                <span style={S.proofText}>Una sola verdad compartida</span>
              </div>
            </div>

            <div style={S.actions}>
              <button
                type="button"
                onClick={handleSkip}
                style={S.secondaryButton}
                disabled={skipState === "loading"}
              >
                {skipState === "loading" ? "Entrando..." : "Saltar"}
              </button>

              <button
                type="button"
                onClick={handleContinue}
                style={S.primaryButton}
              >
                Ver por qué funciona
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualHeader}>
              <div style={S.visualHeaderMeta}>
                <span style={S.visualTag}>Situación real</span>
                <span style={S.visualMini}>Viernes por la noche</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Conflicto detectado
              </div>
            </div>

            <div style={S.timeline}>
              <div style={S.timelineLine} aria-hidden />

              <div style={S.eventWrap}>
                <div style={S.timePill}>20:30</div>
                <div style={S.eventCardStrong}>
                  <div style={S.eventTopRow}>
                    <div>
                      <div style={S.eventLabel}>Cena reservada</div>
                      <div style={S.eventSub}>Plan confirmado contigo</div>
                    </div>
                    <div style={S.eventStateStrong}>Confirmado</div>
                  </div>
                </div>
              </div>

              <div style={S.eventWrap}>
                <div style={S.timePillMuted}>21:00</div>
                <div style={S.eventCardMuted}>
                  <div style={S.eventTopRow}>
                    <div>
                      <div style={S.eventLabel}>Salida con amigos</div>
                      <div style={S.eventSub}>Plan asumido por otro lado</div>
                    </div>
                    <div style={S.eventStateMuted}>Sin alinear</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={S.alertCard}>
              <div style={S.alertEyebrow}>Lo que normalmente pasa</div>
              <div style={S.alertTitle}>
                Dos versiones de la misma noche.
              </div>
              <p style={S.alertBody}>
                Ahí nacen los roces innecesarios: no por mala intención, sino
                por falta de una referencia compartida.
              </p>
            </div>

            <div style={S.valueCard}>
              <div style={S.valueTitle}>Lo que cambia con SyncPlans</div>
              <div style={S.valueGrid}>
                <div style={S.valuePill}>Menos supuestos</div>
                <div style={S.valuePill}>Menos cruces</div>
                <div style={S.valuePill}>Más claridad</div>
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
    width: 320,
    height: 320,
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    filter: "blur(86px)",
    pointerEvents: "none",
  },

  ambientRight: {
    position: "absolute",
    right: -120,
    top: 0,
    width: 340,
    height: 340,
    borderRadius: 999,
    background: "rgba(168,85,247,0.14)",
    filter: "blur(92px)",
    pointerEvents: "none",
  },

  gridGlow: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
    backgroundSize: "34px 34px",
    maskImage:
      "linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.08), transparent)",
    pointerEvents: "none",
  },

  shell: {
    position: "relative",
    zIndex: 1,
    maxWidth: 1160,
    margin: "0 auto",
    borderRadius: 32,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(6,11,24,0.82), rgba(8,13,28,0.72))",
    backdropFilter: "blur(22px)",
    boxShadow:
      "0 30px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    padding: 22,
    display: "grid",
    gap: 20,
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  logoWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.15), rgba(59,130,246,0.08))",
    border: "1px solid rgba(125,211,252,0.18)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
  },

  brandMeta: {
    display: "grid",
    gap: 3,
  },

  step: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: "0.14em",
    color: "#94A3B8",
    fontWeight: 800,
  },

  stepTitle: {
    fontSize: 14,
    color: "#E2E8F0",
    fontWeight: 700,
  },

  topGhost: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#E2E8F0",
    fontWeight: 700,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0,1.05fr) minmax(360px,0.95fr)",
    gap: 20,
    alignItems: "stretch",
  },

  copyCard: {
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.9), rgba(15,23,42,0.68))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    padding: 28,
    display: "grid",
    gap: 16,
    alignContent: "center",
  },

  kicker: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.11)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  titleBlock: {
    display: "grid",
    gap: 8,
  },

  title: {
    margin: 0,
    fontSize: 50,
    lineHeight: 0.96,
    letterSpacing: "-0.055em",
    fontWeight: 900,
  },

  titleAccent: {
    margin: 0,
    fontSize: 31,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    color: "#C4B5FD",
    fontWeight: 800,
  },

  lead: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.72,
    color: "#CBD5E1",
    maxWidth: 620,
  },

  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  chip: {
    display: "inline-flex",
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.14)",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: 600,
  },

  proofRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 14,
    padding: "16px 18px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  proofItem: {
    display: "grid",
    gap: 6,
  },

  proofLabel: {
    fontSize: 12,
    color: "#7DD3FC",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    fontWeight: 800,
  },

  proofText: {
    fontSize: 15,
    color: "#E2E8F0",
    fontWeight: 700,
  },

  proofDivider: {
    width: 1,
    height: 34,
    background: "rgba(148,163,184,0.16)",
  },

  actions: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    paddingTop: 6,
  },

  secondaryButton: {
    minHeight: 50,
    padding: "0 18px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "transparent",
    color: "#E2E8F0",
    fontWeight: 800,
    cursor: "pointer",
  },

  primaryButton: {
    minHeight: 50,
    padding: "0 22px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #38BDF8 0%, #818CF8 100%)",
    color: "#04111D",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 16px 40px rgba(56,189,248,0.24)",
  },

  visualCard: {
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.08), rgba(15,23,42,0.86))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    padding: 22,
    display: "grid",
    gap: 16,
    alignContent: "start",
  },

  visualHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  visualHeaderMeta: {
    display: "grid",
    gap: 8,
  },

  visualTag: {
    display: "inline-flex",
    width: "fit-content",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(148,163,184,0.12)",
    fontSize: 12,
    fontWeight: 800,
    color: "#E2E8F0",
  },

  visualMini: {
    fontSize: 12,
    color: "#94A3B8",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 700,
  },

  signalBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "9px 12px",
    borderRadius: 999,
    background: "rgba(251,113,133,0.12)",
    border: "1px solid rgba(251,113,133,0.2)",
    color: "#FECDD3",
    fontSize: 12,
    fontWeight: 800,
  },

  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#FB7185",
    boxShadow: "0 0 0 6px rgba(251,113,133,0.14)",
  },

  timeline: {
    position: "relative",
    display: "grid",
    gap: 14,
    paddingLeft: 18,
  },

  timelineLine: {
    position: "absolute",
    left: 8,
    top: 10,
    bottom: 10,
    width: 2,
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.45), rgba(148,163,184,0.12))",
  },

  eventWrap: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "78px minmax(0,1fr)",
    gap: 12,
    alignItems: "stretch",
  },

  timePill: {
    alignSelf: "start",
    justifySelf: "start",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 14,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },

  timePillMuted: {
    alignSelf: "start",
    justifySelf: "start",
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: 800,
    letterSpacing: "-0.02em",
  },

  eventCardStrong: {
    borderRadius: 20,
    background: "rgba(5,10,25,0.8)",
    border: "1px solid rgba(56,189,248,0.18)",
    padding: "16px 16px",
    boxShadow: "0 18px 40px rgba(2,6,23,0.24)",
  },

  eventCardMuted: {
    borderRadius: 20,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.14)",
    padding: "16px 16px",
  },

  eventTopRow: {
    display: "flex",
    alignItems: "start",
    justifyContent: "space-between",
    gap: 12,
  },

  eventLabel: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.1,
  },

  eventSub: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 6,
    lineHeight: 1.45,
  },

  eventStateStrong: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.12)",
    color: "#BBF7D0",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  eventStateMuted: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "rgba(251,191,36,0.12)",
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  alertCard: {
    borderRadius: 20,
    padding: 18,
    background: "rgba(244,63,94,0.1)",
    border: "1px solid rgba(251,113,133,0.2)",
    display: "grid",
    gap: 8,
  },

  alertEyebrow: {
    fontSize: 11,
    color: "#FDA4AF",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
  },

  alertTitle: {
    fontSize: 18,
    fontWeight: 900,
    color: "#FFE4E6",
    lineHeight: 1.1,
  },

  alertBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#FBCFE8",
  },

  valueCard: {
    borderRadius: 20,
    padding: 16,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "grid",
    gap: 12,
  },

  valueTitle: {
    fontSize: 14,
    fontWeight: 800,
    color: "#E2E8F0",
  },

  valueGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  valuePill: {
    display: "inline-flex",
    padding: "10px 12px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.14)",
    color: "#BAE6FD",
    fontSize: 13,
    fontWeight: 800,
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .ob-shell {
      padding: 16px;
      gap: 16px;
      border-radius: 24px;
    }
  }
`;