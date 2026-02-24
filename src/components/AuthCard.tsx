// src/components/AuthCard.tsx
"use client";

import React, { type ReactNode, type CSSProperties } from "react";

type AuthCardMode = "login" | "register";

type AuthCardProps = {
  mode: AuthCardMode;
  onToggleMode?: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
};

const page: CSSProperties = {
  minHeight: "100vh",
  background:
    "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.35), transparent 55%)," +
    "radial-gradient(1200px 700px at 90% 10%, rgba(124,58,237,0.18), transparent 60%)," +
    "#050816",
  color: "rgba(248,250,252,0.96)",
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
};

const shell: CSSProperties = {
  width: "100%",
  maxWidth: 1120,
  margin: "0 auto",
};

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 18,
};

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.94)",
  fontSize: 11,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(148,163,184,0.96)",
  fontWeight: 700,
};

const badgeDot: CSSProperties = {
  width: 7,
  height: 7,
  borderRadius: 999,
  background:
    "radial-gradient(circle at 50% 0%, rgba(52,211,153,1), rgba(22,163,74,1))",
  boxShadow: "0 0 0 4px rgba(34,197,94,0.22)",
};

const linkTop: CSSProperties = {
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.55)",
  background: "rgba(15,23,42,0.92)",
  padding: "6px 12px",
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(226,232,240,0.96)",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
};

const card: CSSProperties = {
  borderRadius: 26,
  border: "1px solid rgba(148,163,184,0.5)",
  background:
    "radial-gradient(1100px 600px at 0% 0%, rgba(56,189,248,0.32), transparent 60%)," +
    "radial-gradient(900px 520px at 100% 0%, rgba(129,140,248,0.28), transparent 60%)," +
    "rgba(15,23,42,0.96)",
  padding: "26px 26px 22px",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.25fr) minmax(0, 1fr)",
  gap: 22,
  boxShadow: "0 26px 70px rgba(0,0,0,0.55)",
};

const heroCol: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const heroTitle: CSSProperties = {
  fontSize: 26,
  letterSpacing: "-0.03em",
  fontWeight: 700,
};

const heroLead: CSSProperties = {
  fontSize: 14,
  color: "rgba(226,232,240,0.92)",
  lineHeight: 1.6,
  maxWidth: 520,
};

const heroList: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  marginTop: 4,
};

const pill: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(148,163,184,0.6)",
  background: "rgba(15,23,42,0.92)",
  padding: "10px 11px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
};

const pillRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
};

const pillSub: CSSProperties = {
  fontSize: 11,
  color: "rgba(148,163,184,0.96)",
};

const pillDotBase: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
};

const formCol: CSSProperties = {
  borderRadius: 20,
  border: "1px solid rgba(148,163,184,0.55)",
  background:
    "radial-gradient(480px 360px at 0% 0%, rgba(56,189,248,0.28), transparent 60%)," +
    "rgba(15,23,42,0.96)",
  padding: "18px 18px 16px",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const h2: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
};

const sub: CSSProperties = {
  fontSize: 12,
  color: "rgba(148,163,184,0.96)",
  lineHeight: 1.5,
};

const formBody: CSSProperties = {
  marginTop: 6,
};

export default function AuthCard({
  mode,
  onToggleMode,
  title,
  subtitle,
  children,
}: AuthCardProps) {
  const isLogin = mode === "login";

  const linkLabel = isLogin ? "Crear cuenta nueva" : "Iniciar sesión";
  const linkPrefix = isLogin ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?";

  return (
    <main style={page} className="spAuth-page">
      <div style={shell} className="spAuth-shell">
        {/* TOP BAR */}
        <div style={topRow} className="spAuth-topRow">
          <div style={badge}>
            <span style={badgeDot} />
            <span>SyncPlans · Beta privada</span>
          </div>

          {onToggleMode && (
            <button type="button" style={linkTop} onClick={onToggleMode}>
              <span
                style={{
                  opacity: 0.7,
                  fontWeight: 500,
                }}
              >
                {linkPrefix}
              </span>
              <span>·</span>
              <span>{linkLabel}</span>
            </button>
          )}
        </div>

        {/* MAIN CARD */}
        <section style={card} className="spAuth-card">
          {/* LEFT: STORY */}
          <article style={heroCol}>
            <h1 style={heroTitle}>
              Coordinar horarios no debería generar discusiones innecesarias.
            </h1>

            <p style={heroLead}>
              SyncPlans es el calendario que se mete en medio de los malentendidos
              de tiempo: detecta choques entre tus planes, te muestra una sola
              verdad compartida y te ayuda a decidir qué se queda, qué se mueve
              y qué se ajusta después.
            </p>

            <div style={heroList}>
              <div style={pill}>
                <div style={pillRow}>
                  <span>Personal</span>
                  <span
                    style={{
                      ...pillDotBase,
                      background: "rgba(251,191,36,0.95)",
                    }}
                  />
                </div>
                <div style={pillSub}>Tu agenda clara, sin ruido ni caos.</div>
              </div>

              <div style={pill}>
                <div style={pillRow}>
                  <span>Pareja</span>
                  <span
                    style={{
                      ...pillDotBase,
                      background: "rgba(248,113,113,0.95)",
                    }}
                  />
                </div>
                <div style={pillSub}>
                  Que “pensé que era otro día” deje de ser un clásico.
                </div>
              </div>

              <div style={pill}>
                <div style={pillRow}>
                  <span>Familia & grupos</span>
                  <span
                    style={{
                      ...pillDotBase,
                      background: "rgba(56,189,248,0.95)",
                    }}
                  />
                </div>
                <div style={pillSub}>
                  Todos ven lo mismo, nadie borra nada sin que el resto lo vea.
                </div>
              </div>
            </div>
          </article>

          {/* RIGHT: FORM SLOT */}
          <article style={formCol}>
            <header>
              <h2 style={h2}>{title}</h2>
              <p style={sub}>{subtitle}</p>
            </header>

            <div style={formBody}>{children}</div>
          </article>
        </section>

        {/* Responsive tweaks sin tocar desktop */}
        <style>{`
          @media (max-width: 960px) {
            .spAuth-shell {
              padding: 18px 10px 32px !important;
            }
            .spAuth-card {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 640px) {
            .spAuth-page {
              padding: 18px 10px !important;
            }
            .spAuth-shell {
              padding: 14px 8px 26px !important;
            }
          }
        `}</style>
      </div>
    </main>
  );
}