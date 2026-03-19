// src/app/onboarding/1/Onboarding1Client.tsx
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

export default function Onboarding1Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/2${qsNext}`);
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
      <div aria-hidden style={S.backgroundGrid} />

      <section style={S.shell} className="ob-shell">
        <header style={S.topBar} className="ob-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 1 de 4</span>
              <span style={S.stepTitle}>El problema real</span>
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
              Coordinar el tiempo no debería sentirse pesado
            </div>

            <div style={S.titleBlock}>
              <h1 style={S.title} className="ob-title">
                El problema no es el calendario.
                <br />
                <span style={S.titleAccent}>Es la coordinación.</span>
              </h1>

              <p style={S.lead}>
                Entre trabajo, pareja, familia, amigos y tiempo para ti, es normal
                que las agendas se crucen. Lo que no debería ser normal es que
                organizar algo termine en tensión, confusión o reproches.
              </p>
            </div>

            <div style={S.quoteSection}>
              <div style={S.quoteSectionLabel}>Frases que aparecen demasiado seguido</div>

              <div style={S.quoteStack}>
                <QuotePill text="“Pensé que era otro día.”" />
                <QuotePill text="“No vi ese mensaje.”" />
                <QuotePill text="“Yo ya tenía algo ese sábado.”" />
              </div>
            </div>

            <p style={S.supportText}>
              SyncPlans existe para algo muy simple: que hablar del tiempo
              compartido se sienta más como decidir juntos y menos como discutir.
            </p>

            <div style={S.footerActions} className="ob-footerActions">
              <button type="button" onClick={handleSkip} style={S.skipButton}>
                Saltar
              </button>

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
                <span style={S.previewEyebrow}>Escena cotidiana</span>
                <span style={S.previewTitle}>La semana se cruza sola</span>
              </div>

              <span style={S.previewBadge}>Real</span>
            </div>

            <div style={S.previewScene}>
              <div style={S.dayColumn}>
                <div style={S.dayRow}>
                  <span style={S.dayLabel}>Vie</span>
                  <span style={S.dayMeta}>Dos planes se pisan</span>
                </div>

                <div style={S.eventCardNeutral}>
                  <div style={S.eventTitleRow}>
                    <span style={S.eventDotBlue} />
                    <span style={S.eventTitle}>Cena reservada</span>
                  </div>
                  <span style={S.eventTime}>20:30</span>
                </div>

                <div style={S.eventCardMuted}>
                  <div style={S.eventTitleRow}>
                    <span style={S.eventDotMuted} />
                    <span style={S.eventTitle}>Partido con amigos</span>
                  </div>
                  <span style={S.eventTime}>21:00</span>
                </div>
              </div>

              <div style={S.conflictNotice}>
                <div style={S.conflictIcon}>✦</div>
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={S.conflictTitle}>Dos planes, mismo horario</div>
                  <div style={S.conflictBody}>
                    Cuando nadie ve el cruce a tiempo, el problema deja de ser la
                    agenda y empieza a ser la fricción.
                  </div>
                </div>
              </div>
            </div>

            <div style={S.previewFoot}>
              SyncPlans empieza poniendo claridad donde normalmente aparece
              confusión.
            </div>
          </aside>
        </div>

        <div style={S.bottomMeta}>
          <div style={S.progressDots}>
            <Dot active />
            <Dot />
            <Dot />
            <Dot />
          </div>

          <div style={S.bottomCaption}>
            Primero entendemos el problema. Luego te mostramos cómo lo resuelve.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function QuotePill({ text }: { text: string }) {
  return <div style={S.quotePill}>{text}</div>;
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
  @media (max-width: 1100px) {
    .ob-heroGrid {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 380px) !important;
      gap: 18px !important;
    }
  }

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
      radial-gradient(920px 540px at 10% 8%, rgba(56,189,248,0.14), transparent 58%),
      radial-gradient(820px 470px at 88% 12%, rgba(168,85,247,0.11), transparent 60%),
      radial-gradient(700px 430px at 54% 96%, rgba(34,197,94,0.06), transparent 60%)
    `,
    pointerEvents: "none",
  },

  backgroundGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)",
    backgroundSize: "42px 42px",
    maskImage: "radial-gradient(circle at center, black 34%, transparent 88%)",
    pointerEvents: "none",
    opacity: 0.7,
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
    gridTemplateColumns: "minmax(0, 1.14fr) minmax(320px, 400px)",
    gap: 20,
    alignItems: "stretch",
  },

  copyCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.16)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.50) 0%, rgba(2,6,23,0.24) 100%)",
    padding: 30,
    display: "grid",
    gap: 20,
  },

  kicker: {
    display: "inline-flex",
    width: "fit-content",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(56,189,248,0.20)",
    background: "rgba(56,189,248,0.10)",
    color: "#CFF4FF",
    fontSize: 12,
    fontWeight: 800,
  },

  titleBlock: {
    display: "grid",
    gap: 14,
  },

  title: {
    margin: 0,
    fontSize: 46,
    lineHeight: 0.98,
    fontWeight: 900,
    letterSpacing: "-0.035em",
    maxWidth: 700,
  },

  titleAccent: {
    background:
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 34%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    margin: 0,
    color: "#CBD5E1",
    fontSize: 16,
    lineHeight: 1.72,
    maxWidth: 660,
  },

  quoteSection: {
    display: "grid",
    gap: 12,
  },

  quoteSectionLabel: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  quoteStack: {
    display: "grid",
    gap: 10,
  },

  quotePill: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.04)",
    padding: "14px 16px",
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.4,
  },

  supportText: {
    margin: 0,
    color: "#94A3B8",
    fontSize: 14,
    lineHeight: 1.68,
    maxWidth: 620,
  },

  footerActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
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
    minHeight: 48,
    padding: "0 20px",
    borderRadius: radii.full,
    border: "none",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 50%, #A855F7 100%)",
    color: "#06111D",
    fontSize: 14,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 16px 32px rgba(56,189,248,0.22)",
    cursor: "pointer",
  },

  previewCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.90) 0%, rgba(2,6,23,0.96) 100%)",
    boxShadow: shadows.card,
    padding: 18,
    display: "grid",
    gap: 14,
    alignContent: "start",
  },

  previewHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  previewHeaderMeta: {
    display: "grid",
    gap: 3,
  },

  previewEyebrow: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  previewTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.3,
  },

  previewBadge: {
    padding: "6px 10px",
    borderRadius: radii.full,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(148,163,184,0.10)",
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  previewScene: {
    display: "grid",
    gap: 12,
  },

  dayColumn: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.50)",
  },

  dayRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  dayLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.02em",
  },

  dayMeta: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
  },

  eventCardNeutral: {
    borderRadius: 16,
    padding: "12px 12px",
    background: "rgba(56,189,248,0.10)",
    border: "1px solid rgba(56,189,248,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  eventCardMuted: {
    borderRadius: 16,
    padding: "12px 12px",
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  eventTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  eventDotBlue: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    background: "#38BDF8",
    boxShadow: "0 0 0 6px rgba(56,189,248,0.18)",
    flexShrink: 0,
  },

  eventDotMuted: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    background: "#94A3B8",
    boxShadow: "0 0 0 6px rgba(148,163,184,0.16)",
    flexShrink: 0,
  },

  eventTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  eventTime: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: radii.full,
    background: "rgba(2,6,23,0.36)",
    border: "1px solid rgba(148,163,184,0.14)",
    whiteSpace: "nowrap",
  },

  conflictNotice: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 12,
    borderRadius: 16,
    padding: "14px 13px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  conflictIcon: {
    color: "#C4B5FD",
    fontSize: 13,
    fontWeight: 900,
    marginTop: 2,
  },

  conflictTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  conflictBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.55,
  },

  previewFoot: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 1.6,
  },

  bottomMeta: {
    display: "grid",
    justifyItems: "center",
    gap: 8,
    paddingTop: 4,
  },

  progressDots: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 50%, #A855F7 100%)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.06)",
    transition: "all 180ms ease",
  },

  bottomCaption: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.5,
  },
};