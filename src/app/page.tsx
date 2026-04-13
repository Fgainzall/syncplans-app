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
} from "@/styles/design-tokens";
import HomeSessionRedirect from "./HomeSessionRedirect";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

  if (session) {
  redirect("/onboarding");
}
  } catch {
    // Si falla el chequeo server de sesión, igual mostramos la home.
  }

  const nextAfterAuth = encodeURIComponent("/onboarding/1");

  return (
    <main style={S.page}>
          <HomeSessionRedirect />
      <div aria-hidden style={S.backgroundGlow} />
      <div aria-hidden style={S.backgroundGrid} />

      <section style={S.shell} className="sp-shell">
        <header style={S.topBar} className="sp-topBar">
        <div style={S.brandWrap} className="sp-brandWrap">
  <BrandLogo size={28} showWordmark={false} />
  <div style={S.brandMeta} className="sp-brandMeta">
    <span style={S.brandName}>SyncPlans</span>
    <span style={S.brandEyebrow}>Coordinación compartida</span>
    <span style={S.brandSubline}>Menos fricción al compartir tu tiempo</span>
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
            <div style={S.heroIntro}>
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
            </div>

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

            <div style={S.statsRow} className="sp-statsRow">
              <StatPill
                kicker="Antes del problema"
                value="Choques visibles"
              />
              <StatPill
                kicker="Durante la decisión"
                value="Menos ambigüedad"
              />
              <StatPill
                kicker="Después del acuerdo"
                value="Todos ven lo mismo"
              />
            </div>

            <div style={S.valuePanel}>
              <div style={S.valuePanelHeader}>
                <div style={S.valuePanelEyebrow}>Por qué se siente distinto</div>
                <div style={S.valuePanelTitle}>
                  No es otro calendario compartido.
                </div>
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
          </div>

          <div style={S.previewCol}>
            <PreviewCard nextAfterAuth={nextAfterAuth} />
          </div>
        </section>
      </section>

      <style>{`
        @media (max-width: 1180px) {
          .sp-heroGrid {
            grid-template-columns: minmax(0, 1fr) minmax(300px, 390px) !important;
            gap: 22px !important;
          }
        }

        @media (max-width: 980px) {
          .sp-shell {
            padding: 20px 16px 20px !important;
            border-radius: 24px !important;
          }

          .sp-topBar {
            gap: 12px !important;
            align-items: center !important;
            margin-bottom: 18px !important;
          }

          .sp-heroGrid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }

          .sp-title {
            font-size: 40px !important;
            line-height: 1.03 !important;
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

          .sp-statsRow {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 640px) {
          .sp-topBar {
            flex-wrap: wrap !important;
          }
  .sp-brandWrap {
    align-items: flex-start !important;
    gap: 10px !important;
  }

  .sp-brandMeta {
    gap: 1px !important;
  }
          .sp-topLogin {
            width: 100% !important;
            justify-content: center !important;
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

function StatPill({
  kicker,
  value,
}: {
  kicker: string;
  value: string;
}) {
  return (
    <div style={S.statPill}>
      <div style={S.statKicker}>{kicker}</div>
      <div style={S.statValue}>{value}</div>
    </div>
  );
}

function PreviewCard({ nextAfterAuth }: { nextAfterAuth: string }) {
  return (
    <div style={S.previewCard}>
      <div style={S.previewChrome}>
        <span style={S.previewChromeDot} />
        <span style={S.previewChromeDot} />
        <span style={S.previewChromeDot} />
      </div>

      <div style={S.previewHeader}>
        <div style={S.previewHeaderLeft}>
          <span style={S.previewHeaderTitle}>Vista rápida</span>
          <span style={S.previewHeaderMeta}>Pareja · Conflictos · Claridad</span>
        </div>

        <div style={S.previewStatus}>En vivo</div>
      </div>

      <div style={S.previewSummary}>
        <div style={S.previewSummaryLabel}>Hoy</div>
        <div style={S.previewSummaryTitle}>Dos planes compiten por el mismo espacio</div>
        <div style={S.previewSummaryBody}>
          SyncPlans lo hace visible antes de que termine en mensajes cruzados.
        </div>
      </div>

      <div style={S.previewCalendar}>
        <div style={S.weekHeader}>
          {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
            <span key={`${day}-${index}`} style={S.weekDay}>
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
    padding: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  backgroundGlow: {
    position: "absolute",
    inset: 0,
    background: `
      radial-gradient(980px 580px at 12% 8%, rgba(56,189,248,0.15), transparent 60%),
      radial-gradient(860px 520px at 86% 12%, rgba(168,85,247,0.10), transparent 62%),
      radial-gradient(720px 440px at 52% 96%, rgba(34,197,94,0.07), transparent 60%)
    `,
    pointerEvents: "none",
  },

  backgroundGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(148,163,184,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.035) 1px, transparent 1px)",
    backgroundSize: "40px 40px",
    maskImage: "radial-gradient(circle at center, black 36%, transparent 88%)",
    pointerEvents: "none",
    opacity: 0.6,
  },

  shell: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: layout.maxWidthDesktop,
    borderRadius: 32,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.84) 0%, rgba(2,6,23,0.90) 100%)",
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
  minWidth: 0,
},
brandName: {
  color: "#F8FAFC",
  fontSize: 18,
  fontWeight: 900,
  lineHeight: 1,
  letterSpacing: "-0.03em",
  whiteSpace: "nowrap",
},
  brandEyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  brandSubline: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: 700,
  },

  topActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },

  topLogin: {
    height: 42,
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
    gridTemplateColumns: "minmax(0, 1.22fr) minmax(320px, 400px)",
    gap: 28,
    alignItems: "stretch",
  },

  heroCol: {
    minWidth: 0,
    display: "grid",
    gap: 20,
    alignContent: "start",
    padding: "8px 4px 6px 2px",
  },

  heroIntro: {
    display: "grid",
    gap: 18,
    paddingTop: 8,
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
    fontSize: 62,
    lineHeight: 0.95,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    maxWidth: 760,
  },

  titleAccent: {
    background:
      "linear-gradient(90deg, #E0F2FE 0%, #BAE6FD 36%, #DDD6FE 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    margin: 0,
    maxWidth: 700,
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
    fontSize: 14,
    fontWeight: 900,
    color: "#06111D",
    background:
      "linear-gradient(135deg, #67E8F9 0%, #38BDF8 45%, #A855F7 100%)",
    boxShadow: "0 16px 34px rgba(56,189,248,0.22)",
  },

  secondaryCta: {
    minHeight: 48,
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
    fontWeight: 700,
  },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  statPill: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(15,23,42,0.42)",
    padding: "14px 14px 13px",
    display: "grid",
    gap: 4,
  },

  statKicker: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  },

  statValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.35,
  },

  valuePanel: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.50) 0%, rgba(2,6,23,0.22) 100%)",
    padding: 22,
    display: "grid",
    gap: 16,
  },

  valuePanelHeader: {
    display: "grid",
    gap: 4,
  },

  valuePanelEyebrow: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  },

  valuePanelTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: 900,
    lineHeight: 1.15,
  },

  valueList: {
    display: "grid",
    gap: 12,
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

  previewCol: {
    minWidth: 0,
    display: "flex",
  },

  previewCard: {
    width: "100%",
    alignSelf: "stretch",
    borderRadius: 28,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "linear-gradient(180deg, rgba(8,15,30,0.94) 0%, rgba(2,6,23,0.98) 100%)",
    boxShadow: shadows.card,
    padding: 18,
    display: "grid",
    gap: 14,
    position: "relative",
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

  previewSummary: {
    display: "grid",
    gap: 4,
    borderRadius: 18,
    padding: "14px 14px 12px",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.08) 100%)",
    border: "1px solid rgba(148,163,184,0.14)",
  },

  previewSummaryLabel: {
    color: "#C4B5FD",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  previewSummaryTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.3,
  },

  previewSummaryBody: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.55,
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
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10) 0%, rgba(168,85,247,0.10) 100%)",
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
    marginTop: 4,
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