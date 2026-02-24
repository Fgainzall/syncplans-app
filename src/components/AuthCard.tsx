// src/components/AuthCard.tsx
"use client";

import React, { type ReactNode, type CSSProperties } from "react";
import {
  colors,
  radii,
  shadows,
  spacing,
  layout,
} from "@/styles/design-tokens";

type AuthCardMode = "login" | "register";

type AuthCardProps = {
  mode: AuthCardMode;
  onToggleMode?: () => void;
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function AuthCard({
  mode,
  onToggleMode,
  title,
  subtitle,
  children,
}: AuthCardProps) {
  const isLogin = mode === "login";

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        {/* Lado izquierdo: storytelling */}
        <section style={heroSectionStyle}>
          <div style={heroBadgeRowStyle}>
            <span style={heroBadgeStyle}>Beta privada</span>
          </div>

          <h1 style={heroTitleStyle}>El calendario que evita discusiones.</h1>
          <p style={heroSubtitleStyle}>
            SyncPlans es el árbitro neutral de tu tiempo compartido: detecta
            choques antes de que se vuelvan discusiones y mantiene una sola
            verdad para todos.
          </p>

          <div style={heroBulletsStyle}>
            <div style={heroBulletStyle}>
              <span style={heroBulletDotStyle} />
              <div>
                <div style={heroBulletTitleStyle}>Pareja y familia</div>
                <div style={heroBulletTextStyle}>
                  Comparte eventos sin perder tu agenda personal.
                </div>
              </div>
            </div>

            <div style={heroBulletStyle}>
              <span style={heroBulletDotStyle} />
              <div>
                <div style={heroBulletTitleStyle}>Conflictos a la vista</div>
                <div style={heroBulletTextStyle}>
                  Nada se borra sin que todos lo vean primero.
                </div>
              </div>
            </div>

            <div style={heroBulletStyle}>
              <span style={heroBulletDotStyle} />
              <div>
                <div style={heroBulletTitleStyle}>Decidir, no discutir</div>
                <div style={heroBulletTextStyle}>
                  Elige juntos qué mover en vez de pelear por el “yo te avisé”.
                </div>
              </div>
            </div>
          </div>

          <div style={heroFooterStyle}>
            <span style={heroFooterAccentStyle}>Hecho para parejas reales</span>
            <span style={heroFooterTextStyle}>
              Probado en familias y grupos que ya coordinan todo por WhatsApp.
            </span>
          </div>
        </section>

        {/* Lado derecho: tarjeta de login / registro */}
        <section style={cardColumnStyle}>
          <div style={cardShellStyle}>
            <div style={cardHeaderTopRowStyle}>
              <span style={cardModePillStyle}>
                {isLogin ? "Inicia sesión" : "Crea tu cuenta"}
              </span>

              {onToggleMode && (
                <button
                  type="button"
                  style={cardToggleButtonStyle}
                  onClick={onToggleMode}
                >
                  {isLogin ? "Crear cuenta" : "Ya tengo cuenta"}
                </button>
              )}
            </div>

            <div style={cardHeaderTextBlockStyle}>
              <h2 style={cardTitleStyle}>{title}</h2>
              <p style={cardSubtitleStyle}>{subtitle}</p>
            </div>

            <div style={cardDividerStyle} />

            <div style={cardBodyStyle}>{children}</div>

            <div style={cardHelperRowStyle}>
              <span style={cardHelperLabelStyle}>
                {isLogin
                  ? "¿No tienes cuenta todavía?"
                  : "¿Ya tienes una cuenta?"}
              </span>
              {onToggleMode && (
                <button
                  type="button"
                  style={cardHelperLinkStyle}
                  onClick={onToggleMode}
                >
                  {isLogin ? "Crear cuenta" : "Iniciar sesión"}
                </button>
              )}
            </div>
          </div>

          <p style={cardFootnoteStyle}>
            Al continuar aceptas recibir correos básicos de confirmación y
            recordatorios. No hacemos spam y puedes darte de baja cuando
            quieras.
          </p>
        </section>
      </div>
    </main>
  );
}

/* ============================
   Estilos (tokens-based)
============================ */

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  display: "flex",
  alignItems: "stretch",
  justifyContent: "center",
  background: `
    radial-gradient(480px 360px at 0% 0%, rgba(56,189,248,0.22), transparent 60%),
    radial-gradient(520px 420px at 100% 0%, rgba(180,83,249,0.22), transparent 60%),
    ${colors.appBackground}
  `,
  padding: `${spacing.lg}px ${spacing.md}px`,
  boxSizing: "border-box",
};

const shellStyle: CSSProperties = {
  width: "100%",
  maxWidth: layout.maxWidthMobile * 1.4,
  margin: "0 auto",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
  gap: spacing["2xl"],
  alignItems: "stretch",
  boxSizing: "border-box",
};

const heroSectionStyle: CSSProperties = {
  position: "relative",
  padding: `${spacing.xl}px ${spacing.lg}px`,
  borderRadius: radii.xl,
  background:
    "radial-gradient(320px 260px at 0% 0%, rgba(56,189,248,0.32), transparent 65%)," +
    "radial-gradient(380px 320px at 100% 0%, rgba(180,83,249,0.30), transparent 70%)," +
    colors.surfaceRaised,
  boxShadow: shadows.card,
  border: `1px solid ${colors.borderStrong}`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const heroBadgeRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: spacing.sm,
};

const heroBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: colors.textPrimary,
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(180,83,249,0.22))",
  border: `1px solid rgba(148,163,184,0.55)`,
};

const heroTitleStyle: CSSProperties = {
  fontSize: 28,
  lineHeight: 1.12,
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color: colors.textPrimary,
  margin: 0,
};

const heroSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: spacing.sm,
  fontSize: 14,
  lineHeight: 1.6,
  color: colors.textMuted,
};

const heroBulletsStyle: CSSProperties = {
  marginTop: spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const heroBulletStyle: CSSProperties = {
  display: "flex",
  gap: spacing.sm,
  alignItems: "flex-start",
};

const heroBulletDotStyle: CSSProperties = {
  marginTop: 6,
  width: 9,
  height: 9,
  borderRadius: radii.full,
  background:
    "conic-gradient(from 180deg, #38BDF8, #A855F7, #FBBF24, #38BDF8)",
  boxShadow: "0 0 0 1px rgba(15,23,42,0.6)",
  flexShrink: 0,
};

const heroBulletTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textPrimary,
  marginBottom: 2,
};

const heroBulletTextStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const heroFooterStyle: CSSProperties = {
  marginTop: spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 11,
};

const heroFooterAccentStyle: CSSProperties = {
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: colors.accentPrimary,
  fontWeight: 700,
};

const heroFooterTextStyle: CSSProperties = {
  color: colors.textMuted,
  maxWidth: 360,
};

/* Right column: card */

const cardColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
  alignItems: "stretch",
  justifyContent: "center",
};

const cardShellStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const cardHeaderTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.sm,
};

const cardModePillStyle: CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  padding: "4px 10px",
  borderRadius: radii.full,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  color: colors.textSecondary,
};

const cardToggleButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  color: colors.accentPrimary,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

const cardHeaderTextBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const cardTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  lineHeight: 1.25,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: colors.textPrimary,
};

const cardSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const cardDividerStyle: CSSProperties = {
  height: 1,
  width: "100%",
  background:
    "linear-gradient(90deg, transparent, rgba(148,163,184,0.55), transparent)",
  opacity: 0.9,
};

const cardBodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const cardHelperRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
  marginTop: spacing.sm,
};

const cardHelperLabelStyle: CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
};

const cardHelperLinkStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: colors.accentSecondary,
};

const cardFootnoteStyle: CSSProperties = {
  fontSize: 10,
  lineHeight: 1.6,
  color: colors.textMuted,
  maxWidth: 360,
  margin: 0,
};