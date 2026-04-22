// src/app/home/page.tsx
import Link from "next/link";
import type { CSSProperties } from "react";
import BrandLogo from "@/components/BrandLogo";
import {
  colors,
  layout,
  radii,
  shadows,
} from "@/styles/design-tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NEXT_AFTER_AUTH = encodeURIComponent("/summary");

export default function MarketingHomePage() {
  return (
    <main style={S.page}>
      <div aria-hidden style={S.glowA} />
      <div aria-hidden style={S.glowB} />
      <div aria-hidden style={S.grid} />

      <section style={S.shell} className="sp-shell">
        <header style={S.topBar} className="sp-topBar">
          <div style={S.brandWrap}>
            <BrandLogo size={28} showWordmark={false} />
            <div style={S.brandMeta}>
              <span style={S.brandName}>SyncPlans</span>
              <span style={S.brandEyebrow}>Organización en pareja</span>
            </div>
          </div>

          <Link
            href={`/auth/login?next=${NEXT_AFTER_AUTH}`}
            style={S.topLogin}
            className="sp-topLogin"
          >
            Iniciar sesión
          </Link>
        </header>

        <section style={S.hero} className="sp-hero">
          <div style={S.leftCol}>
            <div style={S.badge}>
              Una sola agenda. Menos cruces. Menos discusiones.
            </div>

            <div style={S.copyBlock}>
              <h1 style={S.title} className="sp-title">
                La forma más simple de{" "}
                <span style={S.titleAccent}>organizarse en pareja</span>
              </h1>

              <p style={S.lead} className="sp-lead">
                Comparte planes, detecta choques antes del problema y mantengan
                claro qué va, qué cambió y qué toca resolver juntos.
              </p>
            </div>

            <div style={S.ctaRow} className="sp-ctaRow">
              <Link
                href={`/auth/register?next=${NEXT_AFTER_AUTH}`}
                style={S.primaryCta}
                className="sp-primaryCta"
              >
                Empezar gratis
              </Link>

              <Link
                href={`/onboarding/1?next=${NEXT_AFTER_AUTH}`}
                style={S.secondaryCta}
                className="sp-secondaryCta"
              >
                Ver cómo funciona
              </Link>
            </div>

            <div style={S.supportLine}>
              Empieza con tu pareja. Luego puedes expandir a familia o grupos,
              pero la entrada correcta empieza aquí.
            </div>

            <div style={S.proofGrid} className="sp-proofGrid">
              <ProofCard
                title="Qué sigue"
                body="Tu próximo plan en un solo lugar, sin volver al chat para confirmar."
              />
              <ProofCard
                title="Qué choca"
                body="Choques visibles antes de que se conviertan en confusión o cambios de último minuto."
              />
              <ProofCard
                title="Qué hacer ya"
                body="Crear un plan e invitar a tu pareja en minutos, sin aprender una app complicada."
              />
            </div>

            <section style={S.storyCard}>
              <div style={S.storyEyebrow}>Por qué se siente distinto</div>
              <div style={S.storyTitle}>
                No es otro calendario. Es menos fricción entre ustedes.
              </div>

              <div style={S.storyList}>
                <StoryItem
                  title="Todo en un mismo lugar"
                  body="Menos mensajes cruzados, menos memoria repartida y menos dudas sobre qué quedó."
                />
                <StoryItem
                  title="La claridad aparece antes"
                  body="SyncPlans hace visible un choque antes de guardar algo que luego complique el día."
                />
                <StoryItem
                  title="La activación importante es real"
                  body="El valor no es terminar un onboarding. Es crear el primer plan y traer a tu pareja rápido."
                />
              </div>
            </section>
          </div>

          <div style={S.rightCol}>
            <PreviewCard />
          </div>
        </section>
      </section>

      <style>{`
        @media (max-width: 1180px) {
          .sp-hero {
            grid-template-columns: minmax(0, 1fr) minmax(320px, 400px) !important;
            gap: 22px !important;
          }
        }

        @media (max-width: 980px) {
          .sp-shell {
            padding: 20px 16px 20px !important;
            border-radius: 24px !important;
          }

          .sp-hero {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }

          .sp-title {
            font-size: 40px !important;
            line-height: 1.02 !important;
          }

          .sp-lead {
            max-width: 100% !important;
            font-size: 15px !important;
          }

          .sp-ctaRow {
            flex-direction: column !important;
            align-items: stretch !important;
          }

          .sp-primaryCta,
          .sp-secondaryCta,
          .sp-topLogin {
            width: 100% !important;
            justify-content: center !important;
          }

          .sp-proofGrid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .sp-topBar {
            flex-wrap: wrap !important;
            gap: 12px !important;
          }

          .sp-title {
            font-size: 34px !important;
          }
        }

        @media (max-width: 380px) {
          .sp-title {
            font-size: 30px !important;
          }
        }
      `}</style>
    </main>
  );
}

function PreviewCard() {
  return (
    <div style={S.previewCard}>
      <div style={S.previewChrome}>
        <span style={S.previewChromeDot} />
        <span style={S.previewChromeDot} />
        <span style={S.previewChromeDot} />
      </div>

      <div style={S.previewHeader}>
        <div style={S.previewHeaderText}>
          <span style={S.previewKicker}>Así se ve</span>
          <span style={S.previewTitle}>Tu home en pareja</span>
        </div>

        <div style={S.previewStatus}>Claro</div>
      </div>

      <div style={S.previewStack}>
        <div style={S.previewPrimaryBlock}>
          <div style={S.previewBlockLabel}>Próximo plan</div>
          <div style={S.previewBlockTitle}>Cena juntos · Hoy 8:00 p. m.</div>
          <div style={S.previewBlockBody}>
            Los dos ven lo mismo y no necesitan volver al chat para confirmar.
          </div>
        </div>

        <div style={S.previewMiniGrid}>
          <MiniPanel
            label="Conflicto detectado"
            title="Entreno vs cena"
            body="La app lo muestra antes de que se convierta en problema."
          />
          <MiniPanel
            label="Crear rápido"
            title="Nuevo plan"
            body="Cena, viaje, cita o reunión. Todo parte desde un solo lugar."
          />
        </div>

        <div style={S.previewInviteBlock}>
          <div style={S.previewInviteBadge}>Invitar a tu pareja</div>
          <div style={S.previewInviteTitle}>El momento importante llega rápido</div>
          <div style={S.previewInviteBody}>
            Entras, creas el primer plan y compartes la agenda en pocos minutos.
          </div>
        </div>
      </div>

      <div style={S.previewActions}>
        <Link
          href={`/auth/register?next=${NEXT_AFTER_AUTH}`}
          style={S.previewPrimary}
        >
          Empezar
        </Link>

        <Link
          href={`/auth/login?next=${NEXT_AFTER_AUTH}`}
          style={S.previewSecondary}
        >
          Ya tengo cuenta
        </Link>
      </div>

      <div style={S.previewFootnote}>
        Primero pareja. Después, si quieres, expandes.
      </div>
    </div>
  );
}

function MiniPanel({
  label,
  title,
  body,
}: {
  label: string;
  title: string;
  body: string;
}) {
  return (
    <div style={S.previewMiniCard}>
      <div style={S.previewMiniLabel}>{label}</div>
      <div style={S.previewMiniTitle}>{title}</div>
      <div style={S.previewMiniBody}>{body}</div>
    </div>
  );
}

function ProofCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={S.proofCard}>
      <div style={S.proofTitle}>{title}</div>
      <div style={S.proofBody}>{body}</div>
    </div>
  );
}

function StoryItem({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={S.storyItem}>
      <div style={S.storyDot} />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={S.storyItemTitle}>{title}</div>
        <div style={S.storyItemBody}>{body}</div>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: colors.appBackground,
    color: colors.textPrimary,
    position: "relative",
    overflow: "hidden",
    padding: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  glowA: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(900px 520px at 12% 10%, rgba(56,189,248,0.16), transparent 62%)",
    pointerEvents: "none",
  },

  glowB: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(760px 460px at 88% 14%, rgba(168,85,247,0.12), transparent 64%)",
    pointerEvents: "none",
  },

  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    maskImage: "radial-gradient(circle at center, black 34%, transparent 86%)",
    opacity: 0.6,
    pointerEvents: "none",
  },

  shell: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: layout.maxWidthDesktop,
    borderRadius: 32,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.86) 0%, rgba(2,6,23,0.92) 100%)",
    boxShadow: shadows.soft,
    backdropFilter: "blur(18px)",
    padding: "28px 28px 24px",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 28,
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

  brandName: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
  },

  brandEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  topLogin: {
    minHeight: 42,
    padding: "0 16px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.32)",
    color: colors.textPrimary,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.14fr) minmax(320px, 395px)",
    gap: 28,
    alignItems: "stretch",
  },

  leftCol: {
    minWidth: 0,
    display: "grid",
    gap: 18,
    alignContent: "start",
    padding: "8px 4px 6px 2px",
  },

  rightCol: {
    minWidth: 0,
    display: "flex",
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(56,189,248,0.10)",
    color: "#CFF4FF",
    fontSize: 12,
    fontWeight: 800,
  },

  copyBlock: {
    display: "grid",
    gap: 16,
  },

  title: {
    margin: 0,
    fontSize: 62,
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    maxWidth: 760,
  },

  titleAccent: {
    background:
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 40%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    margin: 0,
    maxWidth: 680,
    color: "#CBD5E1",
    fontSize: 18,
    lineHeight: 1.72,
  },

  ctaRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 2,
  },

  primaryCta: {
    minHeight: 48,
    padding: "0 20px",
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 900,
    color: "#06111D",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 48%, #A855F7 100%)",
    boxShadow: "0 16px 34px rgba(56,189,248,0.22)",
  },

  secondaryCta: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 800,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.22)",
  },

  supportLine: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 700,
  },

  proofGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  proofCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.42)",
    padding: "14px 14px 13px",
    display: "grid",
    gap: 6,
  },

  proofTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.3,
  },

  proofBody: {
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 1.5,
  },

  storyCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.50) 0%, rgba(2,6,23,0.22) 100%)",
    padding: 22,
    display: "grid",
    gap: 16,
  },

  storyEyebrow: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  storyTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.12,
  },

  storyList: {
    display: "grid",
    gap: 12,
  },

  storyItem: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 0",
    borderTop: "1px solid rgba(148,163,184,0.10)",
  },

  storyDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    marginTop: 5,
    background: colors.accentPrimary,
    boxShadow: "0 0 0 6px rgba(56,189,248,0.12)",
  },

  storyItemTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  storyItemBody: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.55,
  },

  previewCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 28,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.95) 0%, rgba(2,6,23,0.99) 100%)",
    boxShadow: shadows.card,
    padding: 18,
    display: "grid",
    gap: 14,
    overflow: "hidden",
  },

  previewChrome: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    opacity: 0.9,
  },

  previewChromeDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
    background: "rgba(148,163,184,0.45)",
    display: "inline-block",
  },

  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  previewHeaderText: {
    display: "grid",
    gap: 3,
  },

  previewKicker: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  previewTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 900,
  },

  previewStatus: {
    padding: "6px 10px",
    borderRadius: radii.full,
    background: "rgba(56,189,248,0.10)",
    border: "1px solid rgba(56,189,248,0.16)",
    color: "#BAE6FD",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  previewStack: {
    display: "grid",
    gap: 10,
  },

  previewPrimaryBlock: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 12px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.08) 100%)",
    border: "1px solid rgba(148,163,184,0.14)",
  },

  previewBlockLabel: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  previewBlockTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.3,
  },

  previewBlockBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.55,
  },

  previewMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },

  previewMiniCard: {
    display: "grid",
    gap: 4,
    borderRadius: 16,
    padding: "12px 12px",
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  previewMiniLabel: {
    color: "#94A3B8",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  previewMiniTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  previewMiniBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.45,
  },

  previewInviteBlock: {
    display: "grid",
    gap: 5,
    borderRadius: 18,
    padding: "14px 14px 13px",
    background:
      "linear-gradient(180deg, rgba(34,197,94,0.09) 0%, rgba(56,189,248,0.08) 100%)",
    border: "1px solid rgba(148,163,184,0.14)",
  },

  previewInviteBadge: {
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  previewInviteTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
  },

  previewInviteBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.5,
  },

  previewActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 2,
  },

  previewPrimary: {
    flex: "1 1 150px",
    minHeight: 42,
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 900,
    color: "#06111D",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 50%, #A855F7 100%)",
  },

  previewSecondary: {
    flex: "1 1 150px",
    minHeight: 42,
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 850,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.24)",
  },

  previewFootnote: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
  },
};