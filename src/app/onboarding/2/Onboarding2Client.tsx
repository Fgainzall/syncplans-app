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

  return (
    <main style={S.page}>
      <div aria-hidden style={S.backgroundGlow} />
      <div aria-hidden style={S.backgroundGrid} />

      <section style={S.shell} className="ob2-shell">
        <header style={S.topBar} className="ob2-topBar">
          <div style={S.brandWrap}>
            <BrandLogo variant="mark" size={30} />
            <div style={S.brandMeta}>
              <span style={S.stepLabel}>Paso 2 de 4</span>
              <span style={S.stepTitle}>La fricción cotidiana</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            style={S.topGhostButton}
            className="ob2-topGhost"
          >
            Saltar
          </button>
        </header>

        <div style={S.heroGrid} className="ob2-heroGrid">
          <section style={S.copyCard}>
            <div style={S.kicker}>
              La mayoría de los problemas no empiezan por mala intención
            </div>

            <div style={S.titleBlock}>
              <h1 style={S.title} className="ob2-title">
                Empiezan porque cada uno
                <br />
                <span style={S.titleAccent}>ve una versión distinta.</span>
              </h1>

              <p style={S.lead}>
                Uno cree que ya estaba hablado. El otro piensa que todavía no
                estaba cerrado. A veces nadie se equivocó del todo: simplemente
                faltó una referencia común para ver lo mismo al mismo tiempo.
              </p>
            </div>

            <div style={S.sceneList}>
              <SceneCard
                title="Mensajes que no alcanzan"
                body="Un chat ayuda, pero se pierde entre otras conversaciones y deja demasiado espacio para interpretar."
              />
              <SceneCard
                title="Acuerdos que no quedaron visibles"
                body="Algo se habló, pero no quedó claro si era fijo, tentativo o si dependía de otra cosa."
              />
              <SceneCard
                title="Choques que aparecen tarde"
                body="Cuando el cruce se ve demasiado tarde, ya no se siente como organización: se siente como problema."
              />
            </div>

            <p style={S.supportText}>
              SyncPlans no reemplaza la conversación. La ordena, la vuelve más
              visible y reduce la fricción que aparece cuando cada uno opera con
              una agenda distinta en la cabeza.
            </p>

            <div style={S.footerActions} className="ob2-footerActions">
              <button type="button" onClick={handleBack} style={S.secondaryButton}>
                Atrás
              </button>

              <button
                type="button"
                onClick={handleNext}
                style={S.primaryButton}
                className="ob2-primary"
              >
                Seguir
              </button>
            </div>
          </section>

          <aside style={S.previewCard}>
            <div style={S.previewHeader}>
              <div style={S.previewHeaderMeta}>
                <span style={S.previewEyebrow}>Escena frecuente</span>
                <span style={S.previewTitle}>Todos creen tener razón</span>
              </div>

              <span style={S.previewBadge}>Cotidiano</span>
            </div>

            <div style={S.threadCard}>
              <MessageBubble
                side="left"
                name="Ara"
                text="¿Entonces mañana sí quedamos con tus primos?"
              />
              <MessageBubble
                side="right"
                name="Tú"
                text="Pensé que era la otra semana."
              />
              <MessageBubble
                side="left"
                name="Ara"
                text="Yo lo había entendido como confirmado."
              />
            </div>

            <div style={S.insightCard}>
              <div style={S.insightIcon}>✦</div>
              <div style={{ display: "grid", gap: 4 }}>
                <div style={S.insightTitle}>No siempre falta intención.</div>
                <div style={S.insightBody}>
                  Muchas veces falta claridad compartida: una sola referencia
                  visible para no depender de memoria, suposiciones o mensajes
                  sueltos.
                </div>
              </div>
            </div>

            <div style={S.previewFoot}>
              Cuando ambos miran cosas distintas, coordinar consume más energía
              de la necesaria.
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
            Del problema general pasamos a la fricción concreta del día a día.
          </div>
        </div>
      </section>

      <style>{responsiveCss}</style>
    </main>
  );
}

function SceneCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={S.sceneCard}>
      <div style={S.sceneTitle}>{title}</div>
      <div style={S.sceneBody}>{body}</div>
    </div>
  );
}

function MessageBubble({
  side,
  name,
  text,
}: {
  side: "left" | "right";
  name: string;
  text: string;
}) {
  const isRight = side === "right";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isRight ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          ...S.messageBubble,
          ...(isRight ? S.messageBubbleRight : S.messageBubbleLeft),
        }}
      >
        <div style={S.messageName}>{name}</div>
        <div style={S.messageText}>{text}</div>
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
    .ob2-heroGrid {
      grid-template-columns: minmax(0, 1fr) minmax(300px, 380px) !important;
      gap: 18px !important;
    }
  }

  @media (max-width: 980px) {
    .ob2-shell {
      padding: 20px 16px 18px !important;
      border-radius: 24px !important;
    }

    .ob2-topBar {
      gap: 12px !important;
      align-items: center !important;
    }

    .ob2-heroGrid {
      grid-template-columns: 1fr !important;
      gap: 16px !important;
    }

    .ob2-title {
      font-size: 34px !important;
      line-height: 1.04 !important;
    }

    .ob2-footerActions {
      flex-direction: column !important;
      align-items: stretch !important;
    }

    .ob2-primary,
    .ob2-topGhost {
      width: 100% !important;
      justify-content: center !important;
    }
  }

  @media (max-width: 640px) {
    .ob2-topBar {
      flex-wrap: wrap !important;
    }

    .ob2-title {
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

  sceneList: {
    display: "grid",
    gap: 12,
  },

  sceneCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.04)",
    padding: "15px 16px",
    display: "grid",
    gap: 6,
  },

  sceneTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  sceneBody: {
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

  threadCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(15,23,42,0.50)",
    padding: 14,
    display: "grid",
    gap: 10,
  },

  messageBubble: {
    maxWidth: "86%",
    borderRadius: 16,
    padding: "11px 12px 10px",
    display: "grid",
    gap: 4,
  },

  messageBubbleLeft: {
    background: "rgba(148,163,184,0.10)",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  messageBubbleRight: {
    background: "rgba(56,189,248,0.10)",
    border: "1px solid rgba(56,189,248,0.16)",
  },

  messageName: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },

  messageText: {
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  insightCard: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 12,
    borderRadius: 16,
    padding: "14px 13px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(148,163,184,0.16)",
  },

  insightIcon: {
    color: "#C4B5FD",
    fontSize: 13,
    fontWeight: 900,
    marginTop: 2,
  },

  insightTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  insightBody: {
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