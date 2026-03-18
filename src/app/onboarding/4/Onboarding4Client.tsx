// src/app/onboarding/4/Onboarding4Client.tsx
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

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  function handleCreateGroup() {
    router.push("/groups/new");
  }

  function handleStartSolo() {
    router.replace(nextFinal);
  }

  function handleBack() {
    router.push(`/onboarding/3${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div aria-hidden style={S.backgroundGlow} />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar} className="ob-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 4 de 4</span>
              <span style={S.stepTitle}>Activación</span>
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
              Decidir es mejor que discutir
            </div>

            <h1 style={S.title} className="ob-title">
              SyncPlans funciona mejor
              <br />
              <span style={S.titleAccent}>cuando no estás solo.</span>
            </h1>

            <p style={S.lead}>
              Puedes empezar por tu cuenta, claro. Pero el verdadero poder de
              SyncPlans aparece cuando compartes tu tiempo con alguien más y
              ambos ven lo mismo.
            </p>

            <div style={S.choiceGrid}>
              <ChoiceCard
                title="Crear grupo"
                text="Ideal si quieres coordinar con tu pareja, familia o alguien con quien compartes planes reales."
                highlight
              />
              <ChoiceCard
                title="Empezar solo"
                text="Puedes conocer la app primero y sumar a otros más adelante, cuando te haga sentido."
              />
            </div>

            <p style={S.supportText}>
              La diferencia de SyncPlans no es llenar tu pantalla de eventos. Es
              reducir fricción cuando el tiempo importa para más de una persona.
            </p>

            <div style={S.footerActions} className="ob-footerActions">
              <div style={S.leftActionGroup}>
                <button type="button" onClick={handleBack} style={S.skipButton}>
                  Atrás
                </button>
              </div>

              <div style={S.ctaStack} className="ob-ctaStack">
                <button
                  type="button"
                  onClick={handleStartSolo}
                  style={S.secondaryButton}
                  className="ob-secondary"
                >
                  Empezar solo
                </button>

                <button
                  type="button"
                  onClick={handleCreateGroup}
                  style={S.primaryButton}
                  className="ob-primary"
                >
                  Crear grupo
                </button>
              </div>
            </div>
          </section>

          <aside style={S.previewCard}>
            <div style={S.previewHeader}>
              <div style={S.previewHeaderMeta}>
                <span style={S.previewEyebrow}>Después</span>
                <span style={S.previewTitle}>Una decisión visible</span>
              </div>

              <span style={S.previewBadge}>Compartido</span>
            </div>

            <div style={S.decisionCard}>
              <div style={S.decisionHeader}>
                <div style={S.decisionTitle}>Choque detectado</div>
                <div style={S.decisionMeta}>Viernes · 20:00</div>
              </div>

              <div style={S.decisionOptions}>
                <DecisionOption
                  title="Conservar cena reservada"
                  subtitle="Prioridad compartida esta vez"
                  tone="primary"
                />
                <DecisionOption
                  title="Mover entreno"
                  subtitle="Se puede reprogramar"
                  tone="muted"
                />
                <DecisionOption
                  title="Revisar después"
                  subtitle="Nada se borra sin verlo"
                  tone="soft"
                />
              </div>
            </div>

            <div style={S.previewFoot}>
              Cuando el acuerdo queda visible, la conversación cambia.
            </div>
          </aside>
        </div>

        <div style={S.bottomMeta}>
          <div style={S.progressDots}>
            <Dot />
            <Dot />
            <Dot />
            <Dot active />
          </div>

          <div style={S.bottomCaption}>
            Ya viste el problema, la fricción y la solución. Ahora toca empezar.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function ChoiceCard({
  title,
  text,
  highlight = false,
}: {
  title: string;
  text: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...S.choiceCard,
        background: highlight
          ? "linear-gradient(180deg, rgba(56,189,248,0.12) 0%, rgba(168,85,247,0.10) 100%)"
          : "rgba(15,23,42,0.52)",
        border: highlight
          ? "1px solid rgba(56,189,248,0.20)"
          : "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <div style={S.choiceTitle}>{title}</div>
      <div style={S.choiceText}>{text}</div>
    </div>
  );
}

function DecisionOption({
  title,
  subtitle,
  tone,
}: {
  title: string;
  subtitle: string;
  tone: "primary" | "muted" | "soft";
}) {
  const toneMap =
    tone === "primary"
      ? {
          bg: "rgba(56,189,248,0.12)",
          border: "rgba(56,189,248,0.18)",
          dot: "#38BDF8",
        }
      : tone === "muted"
      ? {
          bg: "rgba(148,163,184,0.10)",
          border: "rgba(148,163,184,0.16)",
          dot: "#94A3B8",
        }
      : {
          bg: "rgba(251,191,36,0.10)",
          border: "rgba(251,191,36,0.18)",
          dot: "#FBBF24",
        };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: "12px 12px",
        background: toneMap.bg,
        border: `1px solid ${toneMap.border}`,
        display: "grid",
        gridTemplateColumns: "10px minmax(0, 1fr)",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: radii.full,
          background: toneMap.dot,
          marginTop: 4,
          boxShadow: `0 0 0 6px ${toneMap.dot}22`,
        }}
      />
      <div style={{ display: "grid", gap: 2 }}>
        <div style={S.decisionOptionTitle}>{title}</div>
        <div style={S.decisionOptionSubtitle}>{subtitle}</div>
      </div>
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

    .ob-ctaStack,
    .ob-primary,
    .ob-secondary,
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
      radial-gradient(900px 520px at 10% 8%, rgba(56,189,248,0.14), transparent 58%),
      radial-gradient(820px 460px at 88% 12%, rgba(168,85,247,0.12), transparent 60%),
      radial-gradient(700px 420px at 54% 96%, rgba(34,197,94,0.08), transparent 60%)
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
    border: "1px solid rgba(34,197,94,0.18)",
    background: "rgba(34,197,94,0.10)",
    color: "#BBF7D0",
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
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 34%, #86EFAC 100%)",
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

  choiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  choiceCard: {
    borderRadius: 18,
    padding: "14px 14px",
    display: "grid",
    gap: 8,
  },

  choiceTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  choiceText: {
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

  ctaStack: {
    display: "flex",
    alignItems: "center",
    gap: 10,
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

  secondaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.28)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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
    border: "1px solid rgba(34,197,94,0.16)",
    background: "rgba(34,197,94,0.10)",
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: 900,
  },

  decisionCard: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "grid",
    gap: 12,
  },

  decisionHeader: {
    display: "grid",
    gap: 3,
  },

  decisionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
  },

  decisionMeta: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
  },

  decisionOptions: {
    display: "grid",
    gap: 10,
  },

  decisionOptionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
  },

  decisionOptionSubtitle: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.5,
  },

  previewFoot: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 1.55,
    textAlign: "center",
    fontWeight: 700,
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