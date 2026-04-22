// src/components/AuthCard.tsx
"use client";

import React, { type ReactNode } from "react";
import {
  colors,
  radii,
  shadows,
  spacing,
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
    <main
      data-auth-screen="true"
      className="sp-auth-page"
      style={{
        ["--sp-auth-bg" as string]: colors.appBackground,
        ["--sp-auth-surface" as string]: colors.surfaceRaised,
        ["--sp-auth-surface-low" as string]: colors.surfaceLow,
        ["--sp-auth-border" as string]: colors.borderStrong,
        ["--sp-auth-border-subtle" as string]: colors.borderSubtle,
        ["--sp-auth-text" as string]: colors.textPrimary,
        ["--sp-auth-text-secondary" as string]: colors.textSecondary,
        ["--sp-auth-text-muted" as string]: colors.textMuted,
        ["--sp-auth-accent" as string]: colors.accentPrimary,
        ["--sp-auth-accent-2" as string]: colors.accentSecondary,
        ["--sp-auth-radius-xl" as string]: `${radii.xl}px`,
        ["--sp-auth-radius-full" as string]: `${radii.full}px`,
        ["--sp-auth-shadow" as string]: shadows.card,
        ["--sp-space-xs" as string]: `${spacing.xs}px`,
        ["--sp-space-sm" as string]: `${spacing.sm}px`,
        ["--sp-space-md" as string]: `${spacing.md}px`,
        ["--sp-space-lg" as string]: `${spacing.lg}px`,
        ["--sp-space-xl" as string]: `${spacing.xl}px`,
        ["--sp-space-2xl" as string]: `${spacing["2xl"]}px`,
      }}
    >
      <div className="sp-auth-shell">
        <section className="sp-auth-hero">
          <div className="sp-auth-hero-badge-row">
            <span className="sp-auth-hero-badge">SyncPlans</span>
          </div>

          <div className="sp-auth-hero-copy">
            <h1 className="sp-auth-hero-title">
              Menos fricción. Más claridad entre ustedes.
            </h1>

            <p className="sp-auth-hero-subtitle">
              Una sola agenda para organizarse en pareja sin cruces,
              olvidos ni mensajes cruzados.
            </p>
          </div>

          <div className="sp-auth-hero-bullets">
            <div className="sp-auth-hero-bullet">
              <span className="sp-auth-hero-dot" />
              <div>
                <div className="sp-auth-hero-bullet-title">
                  Lo próximo se ve claro
                </div>
                <div className="sp-auth-hero-bullet-text">
                  Tus planes compartidos viven en un solo lugar y no dependen
                  de volver al chat para confirmar qué quedó.
                </div>
              </div>
            </div>

            <div className="sp-auth-hero-bullet">
              <span className="sp-auth-hero-dot" />
              <div>
                <div className="sp-auth-hero-bullet-title">
                  Los choques aparecen antes
                </div>
                <div className="sp-auth-hero-bullet-text">
                  Cuando algo se pisa, SyncPlans lo hace visible antes de que
                  termine en confusión o cambio de último minuto.
                </div>
              </div>
            </div>

            <div className="sp-auth-hero-bullet">
              <span className="sp-auth-hero-dot" />
              <div>
                <div className="sp-auth-hero-bullet-title">
                  El valor llega rápido
                </div>
                <div className="sp-auth-hero-bullet-text">
                  Entrar, crear el primer plan e invitar a tu pareja debería
                  tomar minutos, no una curva de aprendizaje.
                </div>
              </div>
            </div>
          </div>

          <div className="sp-auth-hero-footer">
            Diseñado para parejas que quieren menos ruido y una sola versión
            clara de su tiempo compartido.
          </div>
        </section>

        <section className="sp-auth-card-column">
          <div className="sp-auth-card">
            <div className="sp-auth-card-top">
              <span className="sp-auth-card-pill">
                {isLogin ? "Iniciar sesión" : "Crear cuenta"}
              </span>

              {onToggleMode && (
                <button
                  type="button"
                  className="sp-auth-card-top-link"
                  onClick={onToggleMode}
                >
                  {isLogin ? "Crear cuenta" : "Ya tengo cuenta"}
                </button>
              )}
            </div>

            <div className="sp-auth-card-header">
              <h2 className="sp-auth-card-title">{title}</h2>
              <p className="sp-auth-card-subtitle">{subtitle}</p>
            </div>

            <div className="sp-auth-card-divider" />

            <div className="sp-auth-card-body">{children}</div>

            <div className="sp-auth-card-helper">
              <span className="sp-auth-card-helper-label">
                {isLogin
                  ? "¿Todavía no tienes cuenta?"
                  : "¿Ya tienes una cuenta?"}
              </span>

              {onToggleMode && (
                <button
                  type="button"
                  className="sp-auth-card-helper-link"
                  onClick={onToggleMode}
                >
                  {isLogin ? "Crear cuenta" : "Iniciar sesión"}
                </button>
              )}
            </div>
          </div>

          <p className="sp-auth-footnote">
            Usamos tu correo para acceso, confirmaciones y recordatorios
            importantes. Nada de spam.
          </p>
        </section>
      </div>

      <style jsx>{`
        .sp-auth-page {
          min-height: 100dvh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          padding:
            max(24px, env(safe-area-inset-top))
            16px
            max(24px, calc(env(safe-area-inset-bottom) + 12px))
            16px;
          background:
            radial-gradient(
              480px 320px at 0% 0%,
              rgba(56, 189, 248, 0.22),
              transparent 60%
            ),
            radial-gradient(
              540px 360px at 100% 0%,
              rgba(168, 85, 247, 0.2),
              transparent 62%
            ),
            var(--sp-auth-bg);
        }

        .sp-auth-shell {
          width: 100%;
          max-width: 1160px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
          align-items: stretch;
        }

        .sp-auth-hero {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px 18px 8px;
        }

        .sp-auth-hero-badge-row {
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .sp-auth-hero-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: var(--sp-auth-radius-full);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--sp-auth-text);
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: linear-gradient(
            135deg,
            rgba(56, 189, 248, 0.16),
            rgba(168, 85, 247, 0.2)
          );
        }

        .sp-auth-hero-copy {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .sp-auth-hero-title {
          margin: 0;
          font-size: 28px;
          line-height: 1.08;
          letter-spacing: -0.04em;
          font-weight: 800;
          color: var(--sp-auth-text);
          max-width: 12ch;
        }

        .sp-auth-hero-subtitle {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: var(--sp-auth-text-secondary);
          max-width: 34ch;
        }

        .sp-auth-hero-bullets,
        .sp-auth-hero-footer {
          display: none;
        }

        .sp-auth-card-column {
          display: flex;
          flex-direction: column;
          gap: 10px;
          justify-content: center;
        }

        .sp-auth-card {
          border-radius: var(--sp-auth-radius-xl);
          background: var(--sp-auth-surface);
          border: 1px solid var(--sp-auth-border);
          box-shadow: var(--sp-auth-shadow);
          padding: 20px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
          max-width: 100%;
        }

        .sp-auth-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sp-auth-card-pill {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: var(--sp-auth-radius-full);
          background: var(--sp-auth-surface-low);
          border: 1px solid var(--sp-auth-border-subtle);
          color: var(--sp-auth-text-secondary);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          font-weight: 700;
        }

        .sp-auth-card-top-link,
        .sp-auth-card-helper-link {
          border: none;
          background: transparent;
          cursor: pointer;
          padding: 0;
        }

        .sp-auth-card-top-link {
          color: var(--sp-auth-accent);
          font-size: 12px;
          font-weight: 600;
        }

        .sp-auth-card-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sp-auth-card-title {
          margin: 0;
          font-size: 24px;
          line-height: 1.12;
          letter-spacing: -0.03em;
          color: var(--sp-auth-text);
          font-weight: 800;
        }

        .sp-auth-card-subtitle {
          margin: 0;
          font-size: 14px;
          line-height: 1.55;
          color: var(--sp-auth-text-secondary);
          max-width: 34ch;
        }

        .sp-auth-card-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(148, 163, 184, 0.55),
            transparent
          );
        }

        .sp-auth-card-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .sp-auth-card-helper {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .sp-auth-card-helper-label {
          font-size: 12px;
          color: var(--sp-auth-text-muted);
        }

        .sp-auth-card-helper-link {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--sp-auth-accent-2);
        }

        .sp-auth-footnote {
          margin: 0;
          padding: 0 4px;
          font-size: 11px;
          line-height: 1.55;
          color: var(--sp-auth-text-muted);
          text-align: center;
        }

        @media (min-width: 768px) {
          .sp-auth-page {
            padding:
              max(32px, env(safe-area-inset-top))
              24px
              max(32px, calc(env(safe-area-inset-bottom) + 12px))
              24px;
          }

          .sp-auth-card {
            padding: 24px 22px 18px;
          }
        }

        @media (min-width: 1024px) {
          .sp-auth-shell {
            grid-template-columns: minmax(0, 1.04fr) minmax(420px, 0.96fr);
            gap: 32px;
          }

          .sp-auth-hero {
            min-height: 680px;
            border-radius: var(--sp-auth-radius-xl);
            border: 1px solid var(--sp-auth-border);
            box-shadow: var(--sp-auth-shadow);
            background:
              radial-gradient(
                320px 240px at 0% 0%,
                rgba(56, 189, 248, 0.28),
                transparent 65%
              ),
              radial-gradient(
                380px 280px at 100% 0%,
                rgba(168, 85, 247, 0.26),
                transparent 70%
              ),
              var(--sp-auth-surface);
            padding: 34px 32px;
            justify-content: center;
            gap: 20px;
          }

          .sp-auth-hero-title {
            font-size: 44px;
            max-width: 10ch;
          }

          .sp-auth-hero-subtitle {
            font-size: 16px;
            max-width: 36ch;
          }

          .sp-auth-hero-bullets {
            margin-top: 8px;
            display: flex;
            flex-direction: column;
            gap: 16px;
          }

          .sp-auth-hero-bullet {
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }

          .sp-auth-hero-dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            margin-top: 7px;
            flex-shrink: 0;
            background: conic-gradient(
              from 180deg,
              #38bdf8,
              #a855f7,
              #fbbf24,
              #38bdf8
            );
            box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.65);
          }

          .sp-auth-hero-bullet-title {
            margin: 0 0 2px 0;
            color: var(--sp-auth-text);
            font-size: 14px;
            font-weight: 700;
          }

          .sp-auth-hero-bullet-text {
            color: var(--sp-auth-text-secondary);
            font-size: 13px;
            line-height: 1.55;
          }

          .sp-auth-hero-footer {
            display: block;
            margin-top: auto;
            color: var(--sp-auth-text-muted);
            font-size: 12px;
            line-height: 1.6;
            max-width: 34ch;
          }

          .sp-auth-card-column {
            justify-content: center;
          }

          .sp-auth-card {
            max-width: 480px;
            margin-left: auto;
            padding: 28px 26px 20px;
            gap: 20px;
          }

          .sp-auth-card-title {
            font-size: 28px;
          }

          .sp-auth-footnote {
            max-width: 480px;
            margin-left: auto;
            text-align: left;
            padding: 0 6px;
          }
        }
      `}</style>
    </main>
  );
}