// src/app/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import { supabaseServer } from "@/lib/supabaseServer";
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
} from "@/styles/design-tokens";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      redirect("/summary");
    }
  } catch {
    // Si falla el chequeo server de sesión, igual mostramos la home.
  }

  const nextAfterAuth = encodeURIComponent("/onboarding/1");

  return (
    <main style={S.page}>
      <div aria-hidden style={S.backgroundGlow} />

      <section style={S.shell} className="sp-shell">
        <header style={S.topBar} className="sp-topBar">
          <div style={S.brandWrap}>
            <BrandLogo size={30} />
            <div style={S.brandMeta}>
              <span style={S.brandEyebrow}>Coordinación compartida</span>
            </div>
          </div>

          <div style={S.topActions}>
            <Link
              href={`/auth/login?next=${nextAfterAuth}`}
              style={S.topLogin}
              className="sp-topLogin"
            >
              Iniciar sesión
            </Link>
          </div>
        </header>

        <section style={S.heroGrid} className="sp-heroGrid">
          <div style={S.heroCol}>
            <div style={S.badge}>
              Menos choques. Menos confusión. Más claridad.
            </div>

            <h1 style={S.title} className="sp-title">
              El calendario que ayuda a{" "}
              <span style={S.titleAccent}>coordinar de verdad</span>.
            </h1>

            <p style={S.lead} className="sp-lead">
              SyncPlans detecta cruces de agenda, ordena decisiones y mantiene
              una sola versión de la verdad cuando compartes tu tiempo con tu
              pareja, tu familia o tu grupo.
            </p>

            <div style={S.ctaRow} className="sp-ctaRow">
              <Link
                href={`/auth/register?next=${nextAfterAuth}`}
                style={S.primaryCta}
                className="sp-primaryCta"
              >
                Crear cuenta
              </Link>

              <Link
                href={`/onboarding/1?next=${nextAfterAuth}`}
                style={S.secondaryCta}
                className="sp-secondaryCta"
              >
                Ver cómo funciona
              </Link>
            </div>

            <div style={S.microLine}>
              Ideal para parejas ocupadas. También sirve para familia y grupos.
            </div>

            <div style={S.valueList}>
              <ValueItem
                title="Detecta conflictos antes de que escalen"
                body="Visualiza choques entre eventos antes de guardar o confirmar."
              />
              <ValueItem
                title="Todos ven lo mismo"
                body="Menos mensajes cruzados y menos ambigüedad sobre qué quedó."
              />
              <ValueItem
                title="Decidir pesa menos que discutir"
                body="Conservar, mover o revisar después con una lógica compartida."
              />
            </div>
          </div>

          <div style={S.previewCol}>
            <PreviewCard nextAfterAuth={nextAfterAuth} />
          </div>
        </section>

        <section style={S.trustRow} className="sp-trustRow">
          <TrustPill>Choques visibles</TrustPill>
          <TrustPill>Decisiones claras</TrustPill>
          <TrustPill>Una sola verdad</TrustPill>
        </section>
      </section>

      <style>{`
        @media (max-width: 980px) {
          .sp-shell {
            padding: 20px 16px 18px !important;
            border-radius: 24px !important;
          }

          .sp-topBar {
            gap: 12px !important;
            align-items: center !important;
          }

          .sp-heroGrid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }

          .sp-title {
            font-size: 38px !important;
            line-height: 1.04 !important;
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
          .sp-secondaryCta {
            width: 100% !important;
            justify-content: center !important;
          }

          .sp-trustRow {
            justify-content: flex-start !important;
          }
        }

        @media (max-width: 640px) {
          .sp-topBar {
            flex-wrap: wrap !important;
          }

          .sp-topLogin {
            width: 100% !important;
            justify-content: center !important;
          }

          .sp-title {
            font-size: 33px !important;
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

function ValueItem({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div style={S.valueItem}>
      <div style={S.valueDot} />
      <div style={{ display: "grid", gap: 4 }}>
        <div style={S.valueTitle}>{title}</div>
        <div style={S.valueBody}>{body}</div>
      </div>
    </div>
  );
}

function TrustPill({ children }: { children: React.ReactNode }) {
  return <span style={S.trustPill}>{children}</span>;
}

function PreviewCard({ nextAfterAuth }: { nextAfterAuth: string }) {
  return (
    <div style={S.previewCard}>
      <div style={S.previewHeader}>
        <div style={S.previewHeaderLeft}>
          <span style={S.previewHeaderTitle}>Vista rápida</span>
          <span style={S.previewHeaderMeta}>Pareja · Conflictos</span>
        </div>

        <div style={S.previewStatus}>En vivo</div>
      </div>

      <div style={S.previewCalendar}>
        <div style={S.weekHeader}>
          {["L", "M", "M", "J", "V", "S", "D"].map((day) => (
            <span key={day} style={S.weekDay}>
              {day}
            </span>
          ))}
        </div>

        <div style={S.eventsStack}>
          <MiniEvent
            title="Cena con Ara"
            time="20:00"
            tone="danger"
          />
          <MiniEvent
            title="Entreno"
            time="19:00"
            tone="warning"
          />
          <div style={S.conflictBox}>
            <div style={S.conflictIcon}>✦</div>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={S.conflictTitle}>SyncPlans detectó un choque</div>
              <div style={S.conflictBody}>
                Antes de guardar, te ayuda a decidir qué hacer con claridad.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.previewActions}>
        <Link
          href={`/auth/register?next=${nextAfterAuth}`}
          style={S.previewPrimary}
        >
          Empezar
        </Link>

        <Link
          href={`/auth/login?next=${nextAfterAuth}`}
          style={S.previewSecondary}
        >
          Ya tengo cuenta
        </Link>
      </div>

      <div style={S.previewFootnote}>Empieza solo. Invita después.</div>
    </div>
  );
}

function MiniEvent({
  title,
  time,
  tone,
}: {
  title: string;
  time: string;
  tone: "danger" | "warning";
}) {
  const toneMap = {
    danger: {
      dot: "#FB7185",
      bg: "rgba(251, 113, 133, 0.12)",
      border: "rgba(251, 113, 133, 0.22)",
    },
    warning: {
      dot: "#FBBF24",
      bg: "rgba(251, 191, 36, 0.12)",
      border: "rgba(251, 191, 36, 0.22)",
    },
  } as const;

  const currentTone = toneMap[tone];

  return (
    <div
      style={{
        borderRadius: 16,
        padding: "12px 12px",
        background: currentTone.bg,
        border: `1px solid ${currentTone.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={S.eventLeft}>
        <span
          style={{
            ...S.eventDot,
            background: currentTone.dot,
            boxShadow: `0 0 0 6px ${currentTone.dot}22`,
          }}
        />
        <span style={S.eventTitle}>{title}</span>
      </div>

      <span style={S.timePill}>{time}</span>
    </div>
  );
}

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
      radial-gradient(900px 520px at 14% 8%, rgba(56,189,248,0.16), transparent 60%),
      radial-gradient(840px 500px at 86% 14%, rgba(168,85,247,0.10), transparent 60%),
      radial-gradient(700px 420px at 54% 92%, rgba(34,197,94,0.08), transparent 60%)
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
    background: "linear-gradient(180deg, rgba(15,23,42,0.82) 0%, rgba(2,6,23,0.88) 100%)",
    boxShadow: shadows.soft,
    backdropFilter: "blur(18px)",
    padding: "24px 24px 20px",
  },

  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
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

  brandEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  topLogin: {
    height: 40,
    padding: "0 16px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.34)",
    color: colors.textPrimary,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 800,
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.15fr) minmax(320px, 430px)",
    gap: 22,
    alignItems: "stretch",
  },

  heroCol: {
    borderRadius: 24,
    border: `1px solid rgba(148, 163, 184, 0.16)`,
    background: "linear-gradient(180deg, rgba(15,23,42,0.52) 0%, rgba(2,6,23,0.28) 100%)",
    padding: 28,
    display: "grid",
    gap: 16,
  },

  previewCol: {
    minWidth: 0,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    maxWidth: "100%",
    padding: "8px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(56, 189, 248, 0.22)",
    background: "rgba(56,189,248,0.10)",
    color: "#CFF4FF",
    fontSize: 12,
    fontWeight: 800,
  },

  title: {
    margin: 0,
    fontSize: 54,
    lineHeight: 0.98,
    fontWeight: 900,
    letterSpacing: "-0.03em",
    maxWidth: 760,
  },

  titleAccent: {
    background: "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 36%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    margin: 0,
    maxWidth: 670,
    color: "#CBD5E1",
    fontSize: 17,
    lineHeight: 1.65,
  },

  ctaRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 6,
  },

  primaryCta: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 900,
    color: "#06111D",
    background: "linear-gradient(135deg, #67E8F9 0%, #38BDF8 45%, #A855F7 100%)",
    boxShadow: "0 16px 34px rgba(56,189,248,0.20)",
  },

  secondaryCta: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: radii.full,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    fontSize: 14,
    fontWeight: 800,
    color: colors.textPrimary,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(2,6,23,0.22)",
  },

  microLine: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 600,
  },

  valueList: {
    display: "grid",
    gap: 12,
    marginTop: 6,
  },

  valueItem: {
    display: "grid",
    gridTemplateColumns: "14px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 0",
    borderTop: "1px solid rgba(148,163,184,0.10)",
  },

  valueDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    marginTop: 5,
    background: colors.accentPrimary,
    boxShadow: "0 0 0 6px rgba(56,189,248,0.12)",
  },

  valueTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  valueBody: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 1.55,
  },

  previewCard: {
    height: "100%",
    borderRadius: 24,
    border: `1px solid ${colors.borderSubtle}`,
    background: "linear-gradient(180deg, rgba(8,15,30,0.92) 0%, rgba(2,6,23,0.98) 100%)",
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

  previewHeaderLeft: {
    display: "grid",
    gap: 3,
  },

  previewHeaderTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 900,
  },

  previewHeaderMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 700,
  },

  previewStatus: {
    padding: "6px 10px",
    borderRadius: radii.full,
    background: "rgba(34,197,94,0.10)",
    border: "1px solid rgba(34,197,94,0.16)",
    color: "#BBF7D0",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  previewCalendar: {
    display: "grid",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.12)",
  },

  weekHeader: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
  },

  weekDay: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    textAlign: "center",
  },

  eventsStack: {
    display: "grid",
    gap: 10,
  },

  eventLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  eventDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    flexShrink: 0,
  },

  eventTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  timePill: {
    padding: "6px 10px",
    borderRadius: radii.full,
    background: "rgba(2,6,23,0.5)",
    border: "1px solid rgba(148,163,184,0.16)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  conflictBox: {
    display: "grid",
    gridTemplateColumns: "16px minmax(0, 1fr)",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 16,
    padding: "13px 12px",
    background: "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
    border: "1px solid rgba(148,163,184,0.18)",
  },

  conflictIcon: {
    color: "#C4B5FD",
    fontSize: 13,
    fontWeight: 900,
    marginTop: 1,
  },

  conflictTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
  },

  conflictBody: {
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
    background: "linear-gradient(135deg, #67E8F9 0%, #38BDF8 50%, #A855F7 100%)",
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

  trustRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
    paddingTop: 2,
  },

  trustPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: radii.full,
    background: "rgba(15,23,42,0.52)",
    border: "1px solid rgba(148,163,184,0.12)",
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: 800,
  },
};