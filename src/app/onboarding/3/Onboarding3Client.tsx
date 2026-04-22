// src/app/onboarding/3/Onboarding3Client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";

type CtaState = "idle" | "loading";

const STEPS = [
  {
    title: "Detecta el choque",
    body: "Antes de que explote en un chat o en una llamada de último minuto.",
  },
  {
    title: "Explica el contexto",
    body: "Qué se cruza, a quién afecta y por qué importa decidirlo ahora.",
  },
  {
    title: "Ordena la decisión",
    body: "Mantener, mover o revisar con una base compartida, no desde supuestos.",
  },
] as const;

const DECISIONS = [
  { label: "Conservar cena familiar", tone: "strong" as const },
  { label: "Mover pádel a otro horario", tone: "muted" as const },
  { label: "Mantener ambos y decidir luego", tone: "ghost" as const },
] as const;

export default function Onboarding3Client() {
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
      screen: "onboarding_step_3",
      metadata: { flow: "core", step: 3 },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: { flow: "core", step: 3, screen: "onboarding_step_3" },
    });
  }, []);

  async function handleSkip() {
    if (skipState === "loading") return;

    setSkipState("loading");

    try {
      void trackEvent({
        event: "onboarding_skipped",
        metadata: {
          screen: "onboarding_step_3",
          step: 3,
          destination: nextFinal,
        },
      });

      await markMyOnboardingCompleted();
      router.replace(nextFinal);
    } catch {
      setSkipState("idle");
    }
  }

  function handleBack() {
    void trackEvent({
      event: "onboarding_step_back",
      metadata: { from_step: 3, to_step: 2, screen: "onboarding_step_3" },
    });

    router.push(`/onboarding/2${qsNext}`);
  }

  function handleContinue() {
    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: { from_step: 3, to_step: 4, screen: "onboarding_step_3" },
    });

    router.push(`/onboarding/4${qsNext}`);
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
              <span style={S.step}>Paso 3 de 4</span>
              <span style={S.stepTitle}>Resolver antes de discutir</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            style={S.topGhost}
            disabled={skipState === "loading"}
          >
            {skipState === "loading" ? "Entrando..." : "Saltar"}
          </button>
        </header>

        <div style={S.heroGrid} className="ob-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Mejor decidir juntos que reaccionar tarde</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>
                SyncPlans detecta conflictos temprano y guía una decisión
                compartida.
              </h1>
              <p style={S.lead}>
                Cuando el choque aparece antes, baja la tensión del último
                minuto y cada persona entiende mejor el impacto real de cada
                opción.
              </p>
            </div>

            <div style={S.steps}>
              {STEPS.map((item, index) => (
                <div key={item.title} style={S.stepCard}>
                  <span style={S.stepNum}>{index + 1}</span>
                  <div style={S.stepContent}>
                    <strong style={S.stepStrong}>{item.title}</strong>
                    <span style={S.stepBody}>{item.body}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.actions}>
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <button type="button" onClick={handleContinue} style={S.primaryButton}>
                Ver cómo se activa
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTop}>
              <div style={S.visualTopMeta}>
                <span style={S.visualTag}>Ejemplo real</span>
                <span style={S.visualMini}>Mismo horario · dos planes</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Conflicto detectado
              </div>
            </div>

            <div style={S.conflictCard}>
              <div style={S.conflictEyebrow}>Choque detectado</div>
              <div style={S.conflictTitle}>Cena familiar 20:30 · Pádel 20:00</div>
              <p style={S.conflictBody}>
                El sistema no solo muestra el cruce. También ayuda a ordenar qué
                decisión tiene más sentido según el contexto compartido.
              </p>
            </div>

            <div style={S.optionsStack}>
              {DECISIONS.map((item) => (
                <div
                  key={item.label}
                  style={
                    item.tone === "strong"
                      ? S.optionStrong
                      : item.tone === "muted"
                        ? S.optionMuted
                        : S.optionGhost
                  }
                >
                  {item.label}
                </div>
              ))}
            </div>

            <div style={S.footerNote}>
              No es solo ver agenda. Es resolver en conjunto con menos tensión y
              con una base clara para decidir.
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
    bottom: 0,
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
    gap: 18,
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
    gap: 12,
  },

  title: {
    margin: 0,
    fontSize: 48,
    lineHeight: 0.97,
    letterSpacing: "-0.05em",
    fontWeight: 900,
  },

  lead: {
    margin: 0,
    fontSize: 17,
    lineHeight: 1.72,
    color: "#CBD5E1",
    maxWidth: 620,
  },

  steps: {
    display: "grid",
    gap: 12,
  },

  stepCard: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0,1fr)",
    gap: 14,
    alignItems: "start",
    padding: "16px 16px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  stepNum: {
    width: 44,
    height: 44,
    borderRadius: 15,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 16,
    fontWeight: 900,
  },

  stepContent: {
    display: "grid",
    gap: 6,
  },

  stepStrong: {
    fontSize: 15,
    lineHeight: 1.3,
    color: "#F8FAFC",
  },

  stepBody: {
    fontSize: 14,
    lineHeight: 1.62,
    color: "#CBD5E1",
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

  visualTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  visualTopMeta: {
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

  conflictCard: {
    borderRadius: 22,
    padding: 18,
    background:
      "linear-gradient(180deg, rgba(43,17,26,0.72), rgba(15,23,42,0.86))",
    border: "1px solid rgba(251,113,133,0.2)",
    display: "grid",
    gap: 8,
    boxShadow: "0 18px 40px rgba(2,6,23,0.22)",
  },

  conflictEyebrow: {
    fontSize: 11,
    color: "#FDA4AF",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
  },

  conflictTitle: {
    fontSize: 22,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    color: "#FFE4E6",
  },

  conflictBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.68,
    color: "#FBCFE8",
  },

  optionsStack: {
    display: "grid",
    gap: 10,
  },

  optionStrong: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.18)",
    color: "#DCFCE7",
    fontSize: 14,
    fontWeight: 800,
  },

  optionMuted: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(56,189,248,0.08)",
    border: "1px solid rgba(56,189,248,0.14)",
    color: "#BAE6FD",
    fontSize: 14,
    fontWeight: 800,
  },

  optionGhost: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: 700,
  },

  footerNote: {
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 1.65,
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