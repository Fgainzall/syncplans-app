// src/app/onboarding/3/Onboarding3Client.tsx
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

export default function Onboarding3Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleNext() {
    router.push(`/onboarding/4${qsNext}`);
  }

  function handleBack() {
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

      <section style={S.shell} className="ob3-shell">
        <header style={S.topBar} className="ob3-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 3 de 4</span>
              <span style={S.stepTitle}>La propuesta de valor</span>
            </div>
          </div>

          <div style={S.topActions}>
            <button
              type="button"
              onClick={handleLogin}
              style={S.topGhostButton}
              className="ob3-topGhost"
            >
              Ya tengo cuenta
            </button>
          </div>
        </header>

        <div style={S.heroGrid} className="ob3-heroGrid">
          <section style={S.copyCard}>
            <div style={S.kicker}>
              Una sola referencia compartida
            </div>

            <div style={S.titleBlock}>
              <h1 style={S.title} className="ob3-title">
                SyncPlans pone
                <br />
                <span style={S.titleAccent}>una sola verdad en el centro.</span>
              </h1>

              <p style={S.lead}>
                En vez de depender de memoria, chats sueltos o versiones parciales
                de la semana, SyncPlans aterriza el tiempo compartido en un lugar
                visible, entendible y fácil de decidir entre todos.
              </p>
            </div>

            <div style={S.valueList}>
              <ValueCard
                title="Detecta choques antes de que escalen"
                text="No esperas a que el problema explote. Ves cuándo dos planes compiten por el mismo espacio y lo haces visible a tiempo."
              />
              <ValueCard
                title="Te deja comparar antes de decidir"
                text="No se trata de borrar a ciegas. Puedes ver qué compite, entender el contexto y tomar una decisión con más claridad."
              />
              <ValueCard
                title="Todos operan sobre la misma semana"
                text="Pareja, familia o grupo: menos versiones distintas en la cabeza y más claridad compartida sobre qué quedó realmente."
              />
            </div>

            <p style={S.supportText}>
              Por eso SyncPlans no se siente como otro calendario más. Se siente
              como una capa de orden sobre la coordinación compartida.
            </p>

            <div style={S.footerActions} className="ob3-footerActions">
              <div style={S.leftActionGroup}>
                <button type="button" onClick={handleBack} style={S.secondaryButton}>
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
                className="ob3-primary"
              >
                Seguir
              </button>
            </div>
          </section>

          <aside style={S.previewCard}>
            <div style={S.previewHeader}>
              <div style={S.previewHeaderMeta}>
                <span style={S.previewEyebrow}>Cómo se ve en producto</span>
                <span style={S.previewTitle}>Todo aterriza en un mismo lugar</span>
              </div>

              <span style={S.previewBadge}>Claro</span>
            </div>

            <div style={S.previewBoard}>
              <div style={S.boardSection}>
                <div style={S.boardSectionTitle}>Semana compartida</div>

                <div style={S.boardRows}>
                  <BoardRow day="Mié" title="Cena familiar" tone="blue" />
                  <BoardRow day="Vie" title="Entreno" tone="muted" />
                  <BoardRow day="Vie" title="Reserva en restaurante" tone="pink" />
                </div>
              </div>

              <div style={S.boardSection}>
                <div style={S.boardSectionTitle}>Cuando aparece un cruce</div>

                <div style={S.compareCard}>
                  <div style={S.compareHeader}>
                    <span style={S.compareHeaderLabel}>Conflicto detectado</span>
                    <span style={S.compareHeaderMeta}>Mismo rango horario</span>
                  </div>

                  <div style={S.compareStack}>
                    <CompareOption
                      dotStyle={S.compareDotBlue}
                      title="Entreno"
                      subtitle="19:00 · Personal"
                    />

                    <div style={S.compareVs}>vs</div>

                    <CompareOption
                      dotStyle={S.compareDotPink}
                      title="Cena reservada"
                      subtitle="20:00 · Compartido"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={S.previewFoot}>
              SyncPlans no reemplaza la conversación. Le da una base clara para
              que decidir pese menos.
            </div>
          </aside>
        </div>

        <div style={S.bottomMeta}>
          <div style={S.progressDots}>
            <Dot />
            <Dot />
            <Dot active />
            <Dot />
          </div>

          <div style={S.bottomCaption}>
            La promesa no es “más funciones”. Es menos ambigüedad al coordinar.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function ValueCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <div style={S.valueCard}>
      <div style={S.valueCardTitle}>{title}</div>
      <div style={S.valueCardText}>{text}</div>
    </div>
  );
}

function CompareOption({
  dotStyle,
  title,
  subtitle,
}: {
  dotStyle: React.CSSProperties;
  title: string;
  subtitle: string;
}) {
  return (
    <div style={S.compareOption}>
      <span style={dotStyle} />
      <div style={S.compareMeta}>
        <div style={S.compareTitle}>{title}</div>
        <div style={S.compareTime}>{subtitle}</div>
      </div>
    </div>
  );
}

function BoardRow({
  day,
  title,
  tone,
}: {
  day: string;
  title: string;
  tone: "blue" | "muted" | "pink";
}) {
  const toneStyles =
    tone === "blue"
      ? {
          dot: "#38BDF8",
          bg: "rgba(56,189,248,0.10)",
          border: "rgba(56,189,248,0.16)",
        }
      : tone === "pink"
      ? {
          dot: "#F472B6",
          bg: "rgba(244,114,182,0.10)",
          border: "rgba(244,114,182,0.16)",
        }
      : {
          dot: "#94A3B8",
          bg: "rgba(148,163,184,0.10)",
          border: "rgba(148,163,184,0.16)",
        };

  return (
    <div
      style={{
        borderRadius: 14,
        padding: "10px 12px",
        background: toneStyles.bg,
        border: `1px solid ${toneStyles.border}`,
        display: "grid",
        gridTemplateColumns: "36px minmax(0, 1fr)",
        gap: 10,
        alignItems: "center",
      }}
    >
      <span style={S.boardDay}>{day}</span>
      <div style={S.boardTitleRow}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: radii.full,
            background: toneStyles.dot,
            boxShadow: `0 0 0 6px ${toneStyles.dot}22`,
            flexShrink: 0,
          }}
        />
        <span style={S.boardTitle}>{title}</span>
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
  @media (max-width: 1100px) {
    .ob3-heroGrid {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 388px) !important;
      gap: 18px !important;
    }
  }

  @media (max-width: 980px) {
    .ob3-shell {
      padding: 20px 16px 18px !important;
      border-radius: 24px !important;
    }

    .ob3-topBar {
      gap: 12px !important;
      align-items: center !important;
    }

    .ob3-heroGrid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .ob3-title {
      font-size: 34px !important;
      line-height: 1.04 !important;
    }

    .ob3-footerActions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .ob3-primary,
    .ob3-topGhost {
      width: 100% !important;
      justify-content: center !important;
    }
  }

  @media (max-width: 640px) {
    .ob3-topBar {
      flex-wrap: wrap !important;
    }

    .ob3-title {
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
      radial-gradient(820px 460px at 88% 12%, rgba(168,85,247,0.11), transparent 60%),
      radial-gradient(700px 420px at 54% 96%, rgba(244,114,182,0.06), transparent 60%)
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
    gridTemplateColumns: "minmax(0, 1.12fr) minmax(320px, 408px)",
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
    maxWidth: 720,
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

  valueList: {
    display: "grid",
    gap: 12,
  },

  valueCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.04)",
    padding: "15px 16px",
    display: "grid",
    gap: 6,
  },

  valueCardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  valueCardText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.6,
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

  secondaryButton: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.26)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 800,
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

  previewBoard: {
    display: "grid",
    gap: 12,
  },

  boardSection: {
    display: "grid",
    gap: 10,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.50)",
  },

  boardSectionTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  boardRows: {
    display: "grid",
    gap: 10,
  },

  boardDay: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.02em",
  },

  boardTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  boardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  compareCard: {
    borderRadius: 16,
    padding: 12,
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
    display: "grid",
    gap: 12,
  },

  compareHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  compareHeaderLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },

  compareHeaderMeta: {
    color: "#CBD5E1",
    fontSize: 11,
    fontWeight: 800,
  },

  compareStack: {
    display: "grid",
    gap: 10,
  },

  compareOption: {
    display: "grid",
    gridTemplateColumns: "10px minmax(0, 1fr)",
    gap: 10,
    alignItems: "flex-start",
    borderRadius: 14,
    padding: "12px 12px",
    background: "rgba(2,6,23,0.28)",
    border: "1px solid rgba(148,163,184,0.14)",
  },

  compareDotBlue: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    background: "#38BDF8",
    marginTop: 4,
    boxShadow: "0 0 0 6px rgba(56,189,248,0.18)",
  },

  compareDotPink: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    background: "#F472B6",
    marginTop: 4,
    boxShadow: "0 0 0 6px rgba(244,114,182,0.18)",
  },

  compareMeta: {
    display: "grid",
    gap: 3,
  },

  compareTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  compareTime: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.45,
  },

  compareVs: {
    justifySelf: "center",
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
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