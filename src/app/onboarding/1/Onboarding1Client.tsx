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
      metadata: { flow: "core", step: 1, wedge: "couples" },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: {
        flow: "core",
        step: 1,
        screen: "onboarding_step_1",
        wedge: "couples",
      },
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
          wedge: "couples",
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
      metadata: { screen: "onboarding_step_1", step: 1, wedge: "couples" },
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
        wedge: "couples",
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
              <span style={S.stepTitle}>Organizarse en pareja no debería desgastar</span>
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
              <h1 style={S.title}>El problema no es tener calendario.</h1>
              <h2 style={S.titleAccent}>
                Es compartir tiempo sin una sola versión clara entre ustedes.
              </h2>
            </div>

            <p style={S.lead}>
              Cuando una relación depende de chats, memoria o supuestos, empiezan
              los cruces, los “yo entendí otra cosa” y las conversaciones
              repetidas. SyncPlans existe para bajar esa fricción.
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
                <span style={S.proofText}>Mensajes, supuestos y versiones distintas</span>
              </div>

              <div style={S.proofDivider} />

              <div style={S.proofItem}>
                <span style={S.proofLabel}>Con SyncPlans</span>
                <span style={S.proofText}>Una sola referencia compartida</span>
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
                Cruce detectado
              </div>
            </div>

            <div style={S.timeline}>
              <div style={S.timelineLine} aria-hidden />

              <div style={S.eventWrap}>
                <div style={S.timePill}>20:30</div>
                <div style={S.eventCardStrong}>
                  <div style={S.eventTopRow}>
                    <div>
                      <div style={S.eventLabel}>Cena juntos</div>
                      <div style={S.eventSub}>Plan ya conversado y esperado</div>
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
                      <div style={S.eventSub}>Otro plan entrando por otro lado</div>
                    </div>
                    <div style={S.eventStateMuted}>Sin alinear</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={S.alertCard}>
              <div style={S.alertEyebrow}>Lo que normalmente pasa</div>
              <div style={S.alertTitle}>Dos versiones de la misma noche.</div>
              <p style={S.alertBody}>
                No por mala intención. Solo porque nadie tenía una sola referencia
                clara de lo que iba primero.
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

  topGhost: {
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.56)",
    color: "rgba(241,245,249,0.96)",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
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
    maxWidth: 12.5 * 16,
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
    maxWidth: 16 * 18,
  },

  lead: {
    margin: 0,
    fontSize: 16,
    lineHeight: 1.72,
    color: "rgba(203,213,225,0.92)",
    maxWidth: 40 * 16,
  },

  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  chip: {
    padding: "9px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.58)",
    color: "rgba(241,245,249,0.94)",
    fontSize: 13,
    fontWeight: 700,
  },

  proofRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: 14,
    alignItems: "center",
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.40)",
  },

  proofItem: {
    display: "grid",
    gap: 4,
  },

  proofLabel: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.82)",
  },

  proofText: {
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  proofDivider: {
    width: 1,
    alignSelf: "stretch",
    background: "rgba(148,163,184,0.18)",
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

  timeline: {
    position: "relative",
    display: "grid",
    gap: 12,
    paddingLeft: 12,
  },

  timelineLine: {
    position: "absolute",
    left: 31,
    top: 10,
    bottom: 10,
    width: 1,
    background: "rgba(148,163,184,0.16)",
  },

  eventWrap: {
    display: "grid",
    gridTemplateColumns: "58px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
    position: "relative",
    zIndex: 1,
  },

  timePill: {
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.10)",
    color: "#CFF4FF",
    fontSize: 12,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
  },

  timePillMuted: {
    height: 34,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.58)",
    color: "rgba(203,213,225,0.88)",
    fontSize: 12,
    fontWeight: 900,
    display: "grid",
    placeItems: "center",
  },

  eventCardStrong: {
    borderRadius: 18,
    padding: "13px 14px",
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.11) 0%, rgba(168,85,247,0.08) 100%)",
  },

  eventCardMuted: {
    borderRadius: 18,
    padding: "13px 14px",
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.52)",
  },

  eventTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  eventLabel: {
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(248,250,252,0.98)",
    lineHeight: 1.35,
  },

  eventSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.86)",
    marginTop: 3,
  },

  eventStateStrong: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(16,185,129,0.14)",
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  eventStateMuted: {
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(148,163,184,0.10)",
    color: "rgba(226,232,240,0.92)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  alertCard: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 13px",
    border: "1px solid rgba(251,191,36,0.16)",
    background: "rgba(251,191,36,0.08)",
  },

  alertEyebrow: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#FCD34D",
  },

  alertTitle: {
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.3,
    color: "rgba(248,250,252,0.98)",
  },

  alertBody: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(254,240,138,0.96)",
  },

  valueCard: {
    display: "grid",
    gap: 10,
    borderRadius: 18,
    padding: "14px 14px 13px",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.44)",
  },

  valueTitle: {
    fontSize: 13,
    fontWeight: 850,
    color: "rgba(248,250,252,0.98)",
  },

  valueGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  valuePill: {
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(2,6,23,0.32)",
    color: "rgba(226,232,240,0.96)",
    fontSize: 12,
    fontWeight: 800,
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob-shell {
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .ob-grid {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 768px) {
    .ob-shell {
      padding: 14px !important;
    }
  }

  @media (max-width: 640px) {
    .ob-shell {
      border-radius: 22px !important;
    }
  }
`;