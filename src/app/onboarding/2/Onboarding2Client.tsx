// src/app/onboarding/2/Onboarding2Client.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import { markMyOnboardingCompleted } from "@/lib/profilesDb";

type CtaState = "idle" | "loading";

const BENEFITS = [
  {
    title: "Hace visible lo crítico primero",
    body: "Qué está confirmado, qué choca y qué falta decidir, sin perderte entre mensajes.",
  },
  {
    title: "Reduce ida y vuelta innecesaria",
    body: "Menos “¿al final qué quedó?” y menos contexto disperso entre chats, memoria y suposiciones.",
  },
  {
    title: "Mejora decisiones en conjunto",
    body: "Todos parten de la misma información antes de elegir, mover o confirmar algo.",
  },
] as const;

export default function Onboarding2Client() {
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
      screen: "onboarding_step_2",
      metadata: { flow: "core", step: 2 },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: { flow: "core", step: 2, screen: "onboarding_step_2" },
    });
  }, []);

  async function handleSkip() {
    if (skipState === "loading") return;

    setSkipState("loading");

    try {
      void trackEvent({
        event: "onboarding_skipped",
        metadata: {
          screen: "onboarding_step_2",
          step: 2,
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
      metadata: { from_step: 2, to_step: 1, screen: "onboarding_step_2" },
    });

    router.push(`/onboarding/1${qsNext}`);
  }

  function handleContinue() {
    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: { from_step: 2, to_step: 3, screen: "onboarding_step_2" },
    });

    router.push(`/onboarding/3${qsNext}`);
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
              <span style={S.step}>Paso 2 de 4</span>
              <span style={S.stepTitle}>Menos fricción diaria</span>
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
            <div style={S.kicker}>Una referencia común para decidir mejor</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>
                SyncPlans convierte coordinación difusa en acuerdos claros.
              </h1>
              <p style={S.lead}>
                No es “otro calendario bonito”. Es una capa de coordinación que
                baja la fricción de mensajes, supuestos y cambios de último
                minuto cuando el tiempo ya es compartido.
              </p>
            </div>

            <div style={S.points}>
              {BENEFITS.map((item) => (
                <div key={item.title} style={S.point}>
                  <span style={S.pointIcon}>✦</span>
                  <div style={S.pointContent}>
                    <strong style={S.pointStrong}>{item.title}</strong>
                    <span style={S.pointBody}>{item.body}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.actions}>
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <button type="button" onClick={handleContinue} style={S.primaryButton}>
                Ver conflictos resueltos
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualTop}>
              <div style={S.visualTopMeta}>
                <span style={S.visualTag}>Lo que cambia en la práctica</span>
                <span style={S.visualMini}>Antes vs con SyncPlans</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Más claridad
              </div>
            </div>

            <div style={S.compareWrap}>
              <div style={S.compareCardMuted}>
                <div style={S.compareEyebrow}>Antes</div>
                <div style={S.compareHeadline}>
                  Cada uno interpreta algo distinto
                </div>
                <div style={S.compareBody}>
                  Chats, memoria y supuestos mezclados terminan generando ruido,
                  desgaste y versiones distintas del mismo plan.
                </div>
              </div>

              <div style={S.compareDivider} aria-hidden />

              <div style={S.compareCardStrong}>
                <div style={S.compareEyebrowStrong}>Con SyncPlans</div>
                <div style={S.compareHeadlineStrong}>
                  Todos parten de la misma referencia
                </div>
                <div style={S.compareBodyStrong}>
                  Menos fricción, menos conflictos evitables y decisiones más
                  rápidas porque lo importante se entiende primero.
                </div>
              </div>
            </div>

            <div style={S.insightCard}>
              <div style={S.insightTitle}>Cuando todos ven lo mismo</div>
              <p style={S.insightBody}>
                coordinar deja de sentirse como perseguir mensajes y empieza a
                sentirse como decidir con contexto.
              </p>
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
    bottom: 60,
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

  points: {
    display: "grid",
    gap: 12,
  },

  point: {
    display: "grid",
    gridTemplateColumns: "40px minmax(0,1fr)",
    gap: 14,
    alignItems: "start",
    padding: "16px 16px",
    borderRadius: 20,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.18)",
    color: "#BAE6FD",
    fontSize: 18,
    fontWeight: 900,
  },

  pointContent: {
    display: "grid",
    gap: 6,
  },

  pointStrong: {
    fontSize: 15,
    lineHeight: 1.3,
    color: "#F8FAFC",
  },

  pointBody: {
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
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.18)",
    color: "#DCFCE7",
    fontSize: 12,
    fontWeight: 800,
  },

  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22C55E",
    boxShadow: "0 0 0 6px rgba(34,197,94,0.12)",
  },

  compareWrap: {
    display: "grid",
    gap: 14,
  },

  compareCardMuted: {
    borderRadius: 22,
    padding: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(148,163,184,0.14)",
    display: "grid",
    gap: 8,
  },

  compareCardStrong: {
    borderRadius: 22,
    padding: 18,
    background:
      "linear-gradient(180deg, rgba(8,47,73,0.72), rgba(15,23,42,0.86))",
    border: "1px solid rgba(56,189,248,0.18)",
    display: "grid",
    gap: 8,
    boxShadow: "0 18px 40px rgba(2,6,23,0.22)",
  },

  compareDivider: {
    height: 1,
    background:
      "linear-gradient(90deg, rgba(148,163,184,0), rgba(148,163,184,0.2), rgba(148,163,184,0))",
  },

  compareEyebrow: {
    fontSize: 11,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
  },

  compareEyebrowStrong: {
    fontSize: 11,
    color: "#BAE6FD",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontWeight: 800,
  },

  compareHeadline: {
    fontSize: 22,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    color: "#F8FAFC",
  },

  compareHeadlineStrong: {
    fontSize: 22,
    lineHeight: 1.02,
    letterSpacing: "-0.04em",
    fontWeight: 900,
    color: "#E0F2FE",
  },

  compareBody: {
    fontSize: 14,
    lineHeight: 1.68,
    color: "#CBD5E1",
  },

  compareBodyStrong: {
    fontSize: 14,
    lineHeight: 1.68,
    color: "#CFFAFE",
  },

  insightCard: {
    borderRadius: 20,
    padding: 18,
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "grid",
    gap: 8,
  },

  insightTitle: {
    fontSize: 15,
    fontWeight: 800,
    color: "#F8FAFC",
  },

  insightBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#CBD5E1",
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