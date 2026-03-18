// src/app/onboarding/2/Onboarding2Client.tsx
"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import {
  colors,
  layout,
  radii,
  shadows,
} from "@/styles/design-tokens";

export default function Onboarding2Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/3${qsNext}`);
  }

  function handleBack() {
    router.push(`/onboarding/1${qsNext}`);
  }

  function handleSkip() {
    router.replace(nextFinal);
  }

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div aria-hidden style={S.backgroundGlow} />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar} className="ob-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 2 de 4</span>
              <span style={S.stepTitle}>La fricción cotidiana</span>
            </div>
          </div>

          <div style={S.topActions}>
            <button
              type="button"
              onClick={handleLogin}
              style={S.topGhostButton}
              className="ob-topGhost"
            >
              Ya tengo cuenta
            </button>
          </div>
        </header>

        <div style={S.heroGrid} className="ob-heroGrid">
          <section style={S.copyCard}>
            <div style={S.kicker}>
              Lo que desgasta no siempre es visible
            </div>

            <h1 style={S.title} className="ob-title">
              Muchas discusiones empiezan con algo pequeño.
              <br />
              <span style={S.titleAccent}>Una descoordinación.</span>
            </h1>

            <p style={S.lead}>
              No suele pasar por mala intención. Pasa porque cada uno maneja su
              agenda por su lado, los mensajes se pierden y la semana se arma
              entre recuerdos, suposiciones y pantallazos.
            </p>

            <div style={S.listCard}>
              <RecognitionRow
                title="No era mala voluntad"
                text="Solo había dos versiones distintas del mismo plan."
              />
              <RecognitionRow
                title="No faltó cariño"
                text="Faltó una referencia común que ambos pudieran ver."
              />
              <RecognitionRow
                title="No era un gran problema"
                text="Pero se volvió uno porque nadie detectó el choque a tiempo."
              />
            </div>

            <p style={S.supportText}>
              SyncPlans reconoce esa fricción antes de que escale. No juzga.
              Ordena.
            </p>

            <div style={S.footerActions} className="ob-footerActions">
              <div style={S.leftActionGroup}>
                <button type="button" onClick={handleBack} style={S.skipButton}>
                  Atrás
                </button>

                <button type="button" onClick={handleSkip} style={S.skipButton}>
                  Saltar
                </button>
              </div>

              <button
                type="button"
                onClick={handleNext}
                style={S.primaryButton}
                className="ob-primary"
              >
                Seguir
              </button>
            </div>
          </section>

          <aside style={S.previewCard}>
            <div style={S.previewHeader}>
              <div style={S.previewHeaderMeta}>
                <span style={S.previewEyebrow}>Antes</span>
                <span style={S.previewTitle}>Todo queda repartido</span>
              </div>

              <span style={S.previewBadge}>Común</span>
            </div>

            <div style={S.chatStack}>
              <ChatBubble
                side="left"
                text="¿Entonces quedamos para el viernes?"
              />
              <ChatBubble
                side="right"
                text="Sí, creo que sí. Te confirmo luego."
              />
              <ChatBubble
                side="left"
                text="Uy, yo entendí sábado..."
              />
              <ChatBubble
                side="right"
                text="Ya había quedado con mi familia."
              />
            </div>

            <div style={S.previewDivider} />

            <div style={S.previewSummary}>
              <div style={S.previewSummaryTitle}>
                Sin una sola referencia compartida
              </div>
              <div style={S.previewSummaryText}>
                lo que falla no es el cariño ni el interés. Falla la
                coordinación.
              </div>
            </div>
          </aside>
        </div>

        <div style={S.bottomMeta}>
          <div style={S.progressDots}>
            <Dot />
            <Dot active />
            <Dot />
            <Dot />
          </div>

          <div style={S.bottomCaption}>
            La fricción suele ser pequeña al inicio. Justamente por eso cuesta
            verla.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function RecognitionRow({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div style={S.recognitionRow}>
      <div style={S.recognitionDot} />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={S.recognitionTitle}>{title}</div>
        <div style={S.recognitionText}>{text}</div>
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  text,
}: {
  side: "left" | "right";
  text: string;
}) {
  const isRight = side === "right";

  return (
    <div
      style={{
        ...S.chatBubble,
        alignSelf: isRight ? "flex-end" : "flex-start",
        background: isRight ? "rgba(56,189,248,0.12)" : "rgba(148,163,184,0.10)",
        border: isRight
          ? "1px solid rgba(56,189,248,0.18)"
          : "1px solid rgba(148,163,184,0.16)",
      }}
    >
      {text}
    </div>
  );
}

function Dot({ active = false }: { active?: boolean }) {
  return (
    <span
      style={{
        ...S.dot,
        opacity: active ? 1 : 0.38,
        transform: active ? "scale(1)" : "scale(0.92)",
      }}
    />
  );
}

const responsiveCss = `
  @media (max-width: 980px) {
    .ob-shell {
      padding: 20px 16px 18px !important;
      border-radius: 24px !important;
    }

    .ob-topBar {
      gap: 12px !important;
      align-items: center !important;
    }

    .ob-heroGrid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .ob-title {
      font-size: 34px !important;
      line-height: 1.04 !important;
    }

    .ob-footerActions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .ob-primary,
    .ob-topGhost {
      width: 100% !important;
      justify-content: center !important;
    }
  }

  @media (max-width: 640px) {
    .ob-topBar {
      flex-wrap: wrap !important;
    }

    .ob-title {
      font-size: 30px !important;
    }
  }
`;

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: colors.appBackground,
    color: colors.textPrimary,
    position: "relative",
    overflow: "hidden",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  backgroundGlow: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(900px 520px at 10% 8%, rgba(56,189,248,0.12), transparent 58%),
      radial-gradient(820px 460px at 88% 12%, rgba(168,85,247,0.10), transparent 60%),
      radial-gradient(700px 420px at 54% 96%, rgba(251,191,36,0.06), transparent 60%)
    `,
    pointerEvents: "none",
  },

  shell: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: layout.maxWidthDesktop,
    borderRadius: 30,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(2,6,23,0.90) 100%)",
    boxShadow: shadows.soft,
    backdropFilter: "blur(18px)",
    padding: "24px 24px 18px",
    display: "grid",
    gap: 18,
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  brandWrap: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  brandMeta: {
    display: "grid",
    gap: 2,
  },

  stepLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  stepTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 800,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  topGhostButton: {
    minHeight: 40,
    padding: "0 16px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.28)",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(320px, 420px)",
    gap: 18,
    alignItems: "stretch",
  },

  copyCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.16)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.52) 0%, rgba(2,6,23,0.26) 100%)",
    padding: 28,
    display: "grid",
    gap: 16,
  },

  kicker: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(251,191,36,0.20)",
    background: "rgba(251,191,36,0.10)",
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: 800,
  },

  title: {
    margin: 0,
    fontSize: 44,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },

  titleAccent: {
    background:
      "linear-gradient(90deg, #FDE68A 0%, #FDBA74 46%, #F9A8D4 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    margin: 0,
    color: "#CBD5E1",
    fontSize: 16,
    lineHeight: 1.68,
    maxWidth: 650,
  },

  listCard: {
    display: "grid",
    gap: 12,
    marginTop: 2,
  },

  recognitionRow: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 0",
    borderTop: "1px solid rgba(148,163,184,0.10)",
  },

  recognitionDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    marginTop: 5,
    background: colors.accentWarning,
    boxShadow: "0 0 0 6px rgba(251,191,36,0.12)",
  },

  recognitionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  recognitionText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.55,
  },

  supportText: {
    margin: 0,
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 1.65,
    maxWidth: 620,
  },

  footerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
  },

  leftActionGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },

  skipButton: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: radii.full,
    background: "transparent",
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: 800,
    border: "none",
    cursor: "pointer",
  },

  primaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: radii.full,
    border: "none",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 46%, #A855F7 100%)",
    color: "#06111D",
    fontSize: 14,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(56,189,248,0.20)",
  },

  previewCard: {
    borderRadius: 24,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.92) 0%, rgba(2,6,23,0.98) 100%)",
    boxShadow: shadows.card,
    padding: 18,
    display: "grid",
    gap: 14,
  },

  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  previewHeaderMeta: {
    display: "grid",
    gap: 3,
  },

  previewEyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  previewTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 900,
  },

  previewBadge: {
    padding: "6px 10px",
    borderRadius: radii.full,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(148,163,184,0.10)",
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: 900,
  },

  chatStack: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  chatBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    padding: "12px 14px",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },

  previewDivider: {
    height: 1,
    background: "rgba(148,163,184,0.12)",
  },

  previewSummary: {
    display: "grid",
    gap: 6,
  },

  previewSummaryTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
  },

  previewSummaryText: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.55,
  },

  bottomMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },

  progressDots: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 46%, #A855F7 100%)",
    transition: "all 160ms ease",
  },

  bottomCaption: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
  },
};