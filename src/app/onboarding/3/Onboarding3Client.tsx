// src/app/onboarding/3/Onboarding3Client.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { trackEvent, trackScreenView } from "@/lib/analytics";

const PRINCIPLES = [
  {
    title: "Todos ven la misma versión",
    body: "Qué sigue, qué cambió y qué quedó realmente ya no depende de memoria, chats o suposiciones.",
  },
  {
    title: "Los choques aparecen antes",
    body: "Si dos planes compiten por el mismo espacio, SyncPlans lo hace visible antes de que escale.",
  },
  {
    title: "La claridad llega sin esfuerzo extra",
    body: "No te pide complicarte más. Solo te da una referencia común para coordinar mejor.",
  },
] as const;

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextFinal = useMemo(() => {
    const nextRaw = sp.get("next");
    return nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  }, [sp]);

  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  useEffect(() => {
    void trackScreenView({
      screen: "onboarding_step_3",
      metadata: { flow: "core", step: 3, wedge: "couples" },
    });

    void trackEvent({
      event: "onboarding_step_viewed",
      metadata: {
        flow: "core",
        step: 3,
        screen: "onboarding_step_3",
        wedge: "couples",
      },
    });
  }, []);

  function handleBack() {
    void trackEvent({
      event: "onboarding_step_back_clicked",
      metadata: {
        from_step: 3,
        to_step: 2,
        screen: "onboarding_step_3",
        wedge: "couples",
      },
    });

    router.push(`/onboarding/2${qsNext}`);
  }

  function handleContinue() {
    void trackEvent({
      event: "onboarding_step_advanced",
      metadata: {
        from_step: 3,
        to_step: 4,
        screen: "onboarding_step_3",
        wedge: "couples",
      },
    });

    router.push(`/onboarding/4${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div style={S.ambientTop} aria-hidden />
      <div style={S.ambientLeft} aria-hidden />
      <div style={S.ambientRight} aria-hidden />
      <div style={S.gridGlow} aria-hidden />

      <section style={S.shell} className="ob3-shell">
        <header style={S.topBar}>
          <div style={S.brandRow}>
            <div style={S.logoWrap}>
              <BrandLogo variant="mark" size={30} />
            </div>

            <div style={S.brandMeta}>
              <span style={S.step}>Paso 3 de 4</span>
              <span style={S.stepTitle}>La solución empieza con una sola verdad</span>
            </div>
          </div>
        </header>

        <div style={S.heroGrid} className="ob3-grid">
          <section style={S.copyCard}>
            <div style={S.kicker}>Lo que cambia con SyncPlans</div>

            <div style={S.titleBlock}>
              <h1 style={S.title}>SyncPlans pone una sola referencia compartida entre ustedes.</h1>
              <h2 style={S.titleAccent}>
                No para complicar más, sino para bajar la fricción del día a día.
              </h2>
            </div>

            <p style={S.lead}>
              No reemplaza sus vidas ni intenta controlar su tiempo. Organiza lo
              compartido para que ambos sepan qué sigue, qué cambió y qué
              necesita decisión, sin depender de memoria o de conversaciones viejas.
            </p>

            <div style={S.principles}>
              {PRINCIPLES.map((item) => (
                <div key={item.title} style={S.principleCard}>
                  <div style={S.principleDot} />
                  <div style={S.principleContent}>
                    <div style={S.principleTitle}>{item.title}</div>
                    <div style={S.principleBody}>{item.body}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={S.actions}>
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <button type="button" onClick={handleContinue} style={S.primaryButton}>
                Ver cómo ayuda a decidir
              </button>
            </div>
          </section>

          <aside style={S.visualCard}>
            <div style={S.visualHeader}>
              <div style={S.visualHeaderMeta}>
                <span style={S.visualTag}>Cómo se ve en la práctica</span>
                <span style={S.visualMini}>Menos ruido, más claridad</span>
              </div>

              <div style={S.signalBadge}>
                <span style={S.signalDot} />
                Todo visible
              </div>
            </div>

            <div style={S.previewPrimary}>
              <div style={S.previewLabel}>Próximo plan</div>
              <div style={S.previewTitle}>Cena juntos · Hoy 8:00 p. m.</div>
              <p style={S.previewBody}>
                Los dos ven el mismo plan en el mismo lugar, sin tener que volver
                a revisar chats para confirmar qué quedó.
              </p>
            </div>

            <div style={S.previewGrid}>
              <div style={S.previewMini}>
                <div style={S.previewMiniLabel}>Qué cambió</div>
                <div style={S.previewMiniTitle}>Horario actualizado</div>
                <div style={S.previewMiniBody}>
                  La nueva hora queda clara para ambos al mismo tiempo.
                </div>
              </div>

              <div style={S.previewMini}>
                <div style={S.previewMiniLabel}>Qué choca</div>
                <div style={S.previewMiniTitle}>Conflicto detectado</div>
                <div style={S.previewMiniBody}>
                  Si algo se pisa, aparece antes de convertirse en problema.
                </div>
              </div>
            </div>

            <div style={S.footerCard}>
              <div style={S.footerTitle}>La clave no es “más calendario”.</div>
              <div style={S.footerBody}>
                La clave es que ambos compartan la misma versión de la realidad.
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

  principles: {
    display: "grid",
    gap: 12,
  },

  principleCard: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.40)",
  },

  principleDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginTop: 5,
    background: "#38BDF8",
    boxShadow: "0 0 0 6px rgba(56,189,248,0.12)",
  },

  principleContent: {
    display: "grid",
    gap: 4,
  },

  principleTitle: {
    fontSize: 14,
    fontWeight: 850,
    color: "rgba(248,250,252,0.98)",
    lineHeight: 1.35,
  },

  principleBody: {
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

  previewPrimary: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 12px",
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.11) 0%, rgba(168,85,247,0.08) 100%)",
  },

  previewLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#C4B5FD",
  },

  previewTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.3,
    color: "rgba(248,250,252,0.98)",
  },

  previewBody: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.92)",
  },

  previewGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  previewMini: {
    display: "grid",
    gap: 4,
    borderRadius: 16,
    padding: "12px 12px",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.50)",
  },

  previewMiniLabel: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.78)",
  },

  previewMiniTitle: {
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  previewMiniBody: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(203,213,225,0.88)",
  },

  footerCard: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 13px",
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.44)",
  },

  footerTitle: {
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(248,250,252,0.98)",
  },

  footerBody: {
    fontSize: 12,
    lineHeight: 1.58,
    color: "rgba(203,213,225,0.88)",
  },
};

const responsiveCss = `
  @media (max-width: 980px) {
    .ob3-shell {
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .ob3-grid {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
  }

  @media (max-width: 768px) {
    .ob3-shell {
      padding: 14px !important;
    }
  }

  @media (max-width: 640px) {
    .ob3-shell {
      border-radius: 22px !important;
    }
  }
`;