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

const ONBOARDING_KEY = "syncplans_onboarded_v1";

function completeOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {}
}

export default function Onboarding4Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextRaw = sp.get("next");
  const nextFinal = nextRaw && nextRaw.startsWith("/") ? nextRaw : "/summary";
  const qsNext = `?next=${encodeURIComponent(nextFinal)}`;

  function handleBack() {
    router.push(`/onboarding/3${qsNext}`);
  }

  function handleStartSolo() {
    completeOnboarding();
    router.replace(nextFinal);
  }

  function handleCreateGroup() {
    completeOnboarding();
    router.replace("/groups/new");
  }

  function handleLogin() {
    router.push(`/auth/login${qsNext}`);
  }

  return (
    <main style={S.page}>
      <div aria-hidden style={S.backgroundGlow} />
      <div aria-hidden style={S.backgroundGrid} />

      <section style={S.shell} className="ob4-shell">
        <header style={S.topBar} className="ob4-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 4 de 4</span>
              <span style={S.stepTitle}>Empezar</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogin}
            style={S.topGhostButton}
            className="ob4-topGhost"
          >
            Ya tengo cuenta
          </button>
        </header>

        <div style={S.heroGrid} className="ob4-heroGrid">
          <section style={S.copyCard}>
            <div style={S.kicker}>
              Listo para empezar
            </div>

            <div style={S.titleBlock}>
              <h1 style={S.title} className="ob4-title">
                SyncPlans funciona mejor
                <br />
                <span style={S.titleAccent}>cuando no estás solo.</span>
              </h1>

              <p style={S.lead}>
                Puedes empezar por tu cuenta y ordenar tu semana desde hoy.
                Pero donde realmente se nota la diferencia es cuando compartes
                tiempo con alguien más y ambos ven lo mismo.
              </p>
            </div>

            <div style={S.choiceList}>
              <ChoiceCard
                title="Crear grupo"
                body="La mejor forma de probar SyncPlans: compartir agenda, detectar choques y coordinar con claridad desde el inicio."
                tone="primary"
              />
              <ChoiceCard
                title="Empezar solo"
                body="También puedes entrar primero por tu cuenta y luego invitar a alguien cuando quieras."
                tone="secondary"
              />
            </div>

            <div style={S.footerActions} className="ob4-footerActions">
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <div style={S.ctaStack} className="ob4-ctaStack">
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  style={S.primaryButton}
                  className="ob4-primary"
                >
                  Crear grupo
                </button>

                <button
                  type="button"
                  onClick={handleStartSolo}
                  style={S.tertiaryButton}
                  className="ob4-tertiary"
                >
                  Empezar solo
                </button>
              </div>
            </div>
          </section>

          <aside style={S.previewCard}>
            <div style={S.previewHeader}>
              <div style={S.previewHeaderMeta}>
                <span style={S.previewEyebrow}>Lo que ganas desde el inicio</span>
                <span style={S.previewTitle}>Una semana más clara para todos</span>
              </div>

              <span style={S.previewBadge}>Activación</span>
            </div>

            <div style={S.previewStack}>
              <PreviewBlock
                title="Grupo compartido"
                body="Una sola vista para entender qué está confirmado, qué se cruza y qué falta decidir."
              />
              <PreviewBlock
                title="Conflictos visibles"
                body="Los choques no se descubren tarde ni por accidente: se hacen visibles cuando todavía se pueden resolver bien."
              />
              <PreviewBlock
                title="Menos ambigüedad"
                body="Menos dependencia de memoria, menos mensajes cruzados y menos versiones distintas de la misma semana."
              />
            </div>

            <div style={S.highlightCard}>
              <div style={S.highlightIcon}>✦</div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={S.highlightTitle}>
                  Empieza simple.
                </div>
                <div style={S.highlightBody}>
                  Entra, crea tu espacio y deja que la coordinación se sienta más
                  liviana desde el principio.
                </div>
              </div>
            </div>

            <div style={S.previewFoot}>
              No necesitas cambiar tu vida para probarlo. Solo empezar con una
              mejor referencia compartida.
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
            Entendiste el problema, viste la solución y ya puedes empezar.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function ChoiceCard({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "primary" | "secondary";
}) {
  const toneStyles =
    tone === "primary"
      ? {
          background: "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
          border: "1px solid rgba(56,189,248,0.18)",
        }
      : {
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(148,163,184,0.14)",
        };

  return (
    <div
      style={{
        ...S.choiceCard,
        background: toneStyles.background,
        border: toneStyles.border,
      }}
    >
      <div style={S.choiceTitle}>{title}</div>
      <div style={S.choiceBody}>{body}</div>
    </div>
  );
}

function PreviewBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={S.previewBlock}>
      <div style={S.previewBlockTitle}>{title}</div>
      <div style={S.previewBlockBody}>{body}</div>
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
    .ob4-heroGrid {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 388px) !important;
      gap: 18px !important;
    }
  }

  @media (max-width: 980px) {
    .ob4-shell {
      padding: 20px 16px 18px !important;
      border-radius: 24px !important;
    }

    .ob4-topBar {
      gap: 12px !important;
      align-items: center !important;
    }

    .ob4-heroGrid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .ob4-title {
      font-size: 34px !important;
      line-height: 1.04 !important;
    }

    .ob4-footerActions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .ob4-ctaStack {
      width: 100% !important;
    }

    .ob4-primary,
    .ob4-tertiary,
    .ob4-topGhost {
      width: 100% !important;
      justify-content: center !important;
    }
  }

  @media (max-width: 640px) {
    .ob4-topBar {
      flex-wrap: wrap !important;
    }

    .ob4-title {
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
      radial-gradient(700px 420px at 54% 96%, rgba(34,197,94,0.06), transparent 60%)
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

  choiceList: {
    display: "grid",
    gap: 12,
  },

  choiceCard: {
    borderRadius: 18,
    padding: "15px 16px",
    display: "grid",
    gap: 6,
  },

  choiceTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  choiceBody: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.6,
  },

  footerActions: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },

  ctaStack: {
    display: "grid",
    gap: 10,
    minWidth: 240,
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

  tertiaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.26)",
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
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

  previewStack: {
    display: "grid",
    gap: 10,
  },

  previewBlock: {
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.50)",
    padding: "14px 14px",
    display: "grid",
    gap: 5,
  },

  previewBlockTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  previewBlockBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.55,
  },

  highlightCard: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 12,
    borderRadius: 16,
    padding: "14px 13px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  highlightIcon: {
    color: "#C4B5FD",
    fontSize: 13,
    fontWeight: 900,
    marginTop: 2,
  },

  highlightTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  highlightBody: {
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