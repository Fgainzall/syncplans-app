// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function HomePage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);

  // Si hay sesión, esto NO es marketing: es app. Lo mandamos directo.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const { data } = await supabase.auth.getSession();
        const hasSession = !!data?.session;

        if (!cancelled && hasSession) {
          router.replace("/summary");
          return;
        }
      } catch {
        // si falla, mostramos landing igual
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checkingSession) return null;

  const nextAfterAuth = encodeURIComponent("/onboarding/1");

  return (
    <main style={S.page}>
      {/* Glow */}
      <div aria-hidden style={S.glow} />

      <section style={S.shell} className="sp-shell">
        {/* Top bar */}
        <div style={S.topRow} className="sp-topRow">
          <div style={S.brandPill}>
            <span style={S.brandDot} />
            SyncPlans
            <span style={S.brandHint}>· Para parejas ocupadas</span>
          </div>

          <button
            onClick={() =>
              router.push(`/auth/login?next=${nextAfterAuth}`)
            }
            style={S.topBtn}
            className="sp-topBtn"
          >
            Iniciar sesión
          </button>
        </div>

        {/* Responsive grid: 2 cols desktop / 1 col mobile */}
        <div style={S.grid} className="sp-grid">
          {/* Left: Hero */}
          <div style={S.leftCard}>
            <h1 style={S.h1} className="sp-h1">
              Compartan su tiempo{" "}
              <span style={S.h1Gradient}>sin discutir por él</span>.
            </h1>

            <p style={S.lead} className="sp-lead">
              SyncPlans detecta choques, organiza decisiones y mantiene{" "}
              <b style={{ color: "#E5E7EB" }}>
                una sola versión de la verdad
              </b>
              . Especialmente cuando tu agenda se cruza con la de tu pareja.
            </p>

            <div style={{ display: "grid", gap: 10, marginBottom: 16 }}>
              <ValueRow
                title="Detecta choques antes de que sean problema"
                subtitle="Te avisa cuando algo se cruza. Sin sorpresas."
              />
              <ValueRow
                title="Deciden con claridad, no con discusiones"
                subtitle="Conservar, reemplazar o ajustar. Todo visible."
              />
              <ValueRow
                title="Ambos ven lo mismo"
                subtitle="Menos WhatsApp. Más orden. Cero ambigüedad."
              />
            </div>

            {/* CTA */}
            <div style={S.ctaRow} className="sp-ctaRow">
              <button
                onClick={() =>
                  router.push(`/auth/register?next=${nextAfterAuth}`)
                }
                style={S.primaryCta}
                className="sp-primaryCta"
              >
                Crear cuenta
              </button>

              <button
                onClick={() =>
                  router.push(`/onboarding/1?next=${nextAfterAuth}`)
                }
                style={S.secondaryCta}
                className="sp-secondaryCta"
              >
                Ver cómo funciona
              </button>

              <div style={S.micro} className="sp-micro">
                Toma 60 segundos.
              </div>
            </div>

            <div style={S.note}>
              También sirve para{" "}
              <b style={{ color: "#CBD5E1" }}>familia</b> y{" "}
              <b style={{ color: "#CBD5E1" }}>grupos</b>. Pero primero:
              parejas ocupadas.
            </div>
          </div>

          {/* Right: Preview */}
          <PreviewCard
            onPrimary={() =>
              router.push(`/auth/register?next=${nextAfterAuth}`)
            }
            onSecondary={() =>
              router.push(`/auth/login?next=${nextAfterAuth}`)
            }
          />
        </div>

        {/* Bottom micro trust */}
        <div style={S.bottomRow}>
          <div style={S.chipsRow}>
            <Chip>✅ Choques visibles</Chip>
            <Chip>✅ Decisiones claras</Chip>
            <Chip>✅ Una sola verdad</Chip>
          </div>

          <div style={S.quote}>
            “Yo pensé que era otro día” — nunca más.
          </div>
        </div>
      </section>

      {/* CSS responsive SIN afectar desktop */}
      <style>{`
        /* Mobile first */
        @media (max-width: 860px) {
          .sp-shell {
            padding: 20px 16px !important;
            border-radius: 22px !important;
          }
          .sp-grid {
            grid-template-columns: 1fr !important;
          }
          .sp-h1 {
            font-size: 34px !important;
          }
          .sp-lead {
            font-size: 15px !important;
            max-width: 100% !important;
          }
          .sp-topRow {
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .sp-topBtn {
            height: 36px !important;
          }
          .sp-ctaRow {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .sp-primaryCta,
          .sp-secondaryCta {
            width: 100% !important;
          }
          .sp-micro {
            margin-left: 0 !important;
          }
        }

        /* Very small phones */
        @media (max-width: 380px) {
          .sp-h1 {
            font-size: 30px !important;
          }
        }
      `}</style>
    </main>
  );
}

function ValueRow(props: { title: string; subtitle: string }) {
  return (
    <div style={S.valueRow}>
      <span style={S.valueDot} />
      <div>
        <div style={S.valueTitle}>{props.title}</div>
        <div style={S.valueSub}>{props.subtitle}</div>
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span style={S.chip}>{children}</span>;
}

function PreviewCard(props: {
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const days = useMemo(() => ["L", "M", "M", "J", "V", "S", "D"], []);

  return (
    <div style={S.previewCard}>
      <div style={S.previewTop}>
        <span style={{ fontWeight: 900 }}>Vista rápida</span>
        <span style={{ color: "#94A3B8", fontWeight: 800 }}>
          Pareja · Conflictos
        </span>
      </div>

      <div style={S.weekGrid}>
        {days.map((d, i) => (
          <div key={i} style={S.dayCell}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
        <QuickEvent
          title="Cena con Ara"
          time="20:00"
          dot="#F87171"
          bg="rgba(248,113,113,0.12)"
          border="rgba(248,113,113,0.22)"
        />
        <QuickEvent
          title="Entreno"
          time="19:00"
          dot="#FACC15"
          bg="rgba(250,204,21,0.12)"
          border="rgba(250,204,21,0.20)"
        />
        <div style={S.conflictCard}>
          ✨{" "}
          <b style={{ color: "#E5E7EB" }}>
            SyncPlans detectó un choque
          </b>{" "}
          y te pidió decidir antes de guardar.
        </div>
      </div>

      <div style={S.previewButtons}>
        <button
          onClick={props.onPrimary}
          style={S.previewPrimary}
        >
          Empezar
        </button>

        <button
          onClick={props.onSecondary}
          style={S.previewSecondary}
        >
          Ya tengo cuenta
        </button>
      </div>

      <div style={S.previewFooter}>Entra solo. Invita después.</div>
    </div>
  );
}

function QuickEvent(props: {
  title: string;
  time: string;
  dot: string;
  bg: string;
  border: string;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background: props.bg,
        border: `1px solid ${props.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: 999,
            background: props.dot,
            boxShadow: `0 0 0 6px ${props.dot}22`,
          }}
        />
        <div
          style={{
            fontWeight: 900,
            fontSize: 13,
            color: "#E5E7EB",
          }}
        >
          {props.title}
        </div>
      </div>

      <div style={S.timePill}>{props.time}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 18% 12%, rgba(56,189,248,0.18), transparent 40%), radial-gradient(circle at 82% 18%, rgba(34,197,94,0.12), transparent 44%), radial-gradient(circle at 55% 92%, rgba(124,58,237,0.12), transparent 50%), linear-gradient(180deg, #020617 0%, #000 120%)",
    color: "#F9FAFB",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    overflow: "hidden",
    position: "relative",
  },

  glow: {
    position: "absolute",
    inset: -120,
    background:
      "radial-gradient(circle at 28% 28%, rgba(56,189,248,0.16), transparent 56%), radial-gradient(circle at 72% 30%, rgba(34,197,94,0.12), transparent 58%), radial-gradient(circle at 58% 86%, rgba(124,58,237,0.10), transparent 62%)",
    filter: "blur(18px)",
    opacity: 0.95,
    zIndex: 0,
  },

  shell: {
    width: "100%",
    maxWidth: 980,
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.26)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.88))",
    boxShadow: "0 30px 80px rgba(15,23,42,0.75)",
    backdropFilter: "blur(14px)",
    padding: "28px 22px",
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },

  brandPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.28)",
    background: "rgba(2,6,23,0.45)",
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: 800,
  },

  brandDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#22C55E",
    boxShadow: "0 0 0 6px rgba(34,197,94,0.14)",
  },

  brandHint: {
    color: "#94A3B8",
    fontWeight: 700,
  },

  topBtn: {
    height: 34,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(2,6,23,0.25)",
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 18,
    alignItems: "stretch",
  },

  leftCard: {
    borderRadius: 22,
    padding: "18px 16px",
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.20)",
  },

  h1: {
    fontSize: 42,
    lineHeight: 1.05,
    letterSpacing: "-0.03em",
    marginBottom: 12,
  },

  h1Gradient: {
    background: "linear-gradient(90deg, #38BDF8, #22C55E)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  },

  lead: {
    fontSize: 16,
    lineHeight: 1.7,
    color: "#A3AAB7",
    marginBottom: 16,
    maxWidth: 520,
  },

  valueRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.22)",
  },

  valueDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#38BDF8",
    boxShadow: "0 0 0 6px rgba(56,189,248,0.12)",
    marginTop: 6,
    flex: "0 0 auto",
  },

  valueTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "#E5E7EB",
  },

  valueSub: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "#9CA3AF",
  },

  ctaRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  primaryCta: {
    height: 46,
    padding: "0 18px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #2563EB, #22C55E)",
    color: "#F9FAFB",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 18px 40px rgba(37,99,235,0.30)",
    letterSpacing: "0.01em",
  },

  secondaryCta: {
    height: 46,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(2,6,23,0.30)",
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: 850,
    cursor: "pointer",
  },

  micro: {
    display: "flex",
    alignItems: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
    marginLeft: 4,
  },

  note: {
    marginTop: 12,
    color: "#94A3B8",
    fontSize: 12,
    lineHeight: 1.5,
  },

  bottomRow: {
    marginTop: 16,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid rgba(148,163,184,0.12)",
    paddingTop: 14,
    color: "#9CA3AF",
    fontSize: 12,
  },

  chipsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  chip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(2,6,23,0.25)",
    color: "#CBD5E1",
    fontWeight: 800,
  },

  quote: {
    color: "#94A3B8",
    fontWeight: 700,
  },

  previewCard: {
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background:
      "linear-gradient(180deg, rgba(11,18,32,0.92), rgba(2,6,23,0.72))",
  },

  previewTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#CBD5E1",
    fontSize: 12,
    marginBottom: 10,
  },

  weekGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
    marginBottom: 12,
  },

  dayCell: {
    height: 34,
    borderRadius: 12,
    background: "rgba(2,6,23,0.30)",
    border: "1px solid rgba(148,163,184,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 900,
  },

  conflictCard: {
    borderRadius: 16,
    padding: 12,
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.18)",
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 1.45,
  },

  previewButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  previewPrimary: {
    flex: "1 1 160px",
    height: 44,
    padding: "0 14px",
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #2563EB, #22C55E)",
    color: "#F9FAFB",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 18px 36px rgba(37,99,235,0.22)",
  },

  previewSecondary: {
    flex: "1 1 160px",
    height: 44,
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(2,6,23,0.30)",
    color: "#E5E7EB",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },

  previewFooter: {
    marginTop: 10,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: 700,
  },

  timePill: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(2,6,23,0.45)",
    border: "1px solid rgba(148,163,184,0.18)",
    whiteSpace: "nowrap",
  },
};