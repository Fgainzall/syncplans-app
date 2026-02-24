// src/app/summary/page.tsx
import { Suspense } from "react";
import SummaryClient from "./SummaryClient";

import MobileScaffold from "@/components/MobileScaffold";
import {
  colors,
  radii,
  shadows,
  spacing,
} from "@/styles/design-tokens";

function SummaryFallback() {
  return (
    <MobileScaffold>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            borderRadius: radii.xl,
            background: colors.surfaceRaised,
            border: `1px solid ${colors.borderStrong}`,
            boxShadow: shadows.card,
            padding: `${spacing.lg}px ${spacing.lg}px`,
            display: "flex",
            flexDirection: "column",
            gap: spacing.md,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing.sm,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: radii.full,
                background:
                  "conic-gradient(from 180deg, #38BDF8, #A855F7, #FBBF24, #38BDF8)",
                boxShadow: "0 0 24px rgba(56,189,248,0.55)",
              }}
            />
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: colors.textMuted,
              }}
            >
              Preparando tu resumen
            </span>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 20,
              lineHeight: 1.3,
              fontWeight: 800,
              letterSpacing: "-0.03em",
              color: colors.textPrimary,
            }}
          >
            Cargando tu resumen…
          </h1>

          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: colors.textSecondary,
            }}
          >
            Estamos trayendo tus eventos, grupos y conflictos para mostrarte una
            vista clara de cómo viene tu semana.
          </p>

          <div
            style={{
              marginTop: spacing.md,
              display: "flex",
              flexDirection: "column",
              gap: spacing.sm,
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: 32,
                  borderRadius: radii.lg,
                  background: "rgba(15,23,42,0.9)",
                  border: `1px solid ${colors.borderSubtle}`,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, rgba(148,163,184,0.08), rgba(148,163,184,0.25), rgba(148,163,184,0.08))",
                    transform: "translateX(-40%)",
                    animation: "spSummarySkeleton 1.4s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>

          <style jsx>{`
            @keyframes spSummarySkeleton {
              0% {
                transform: translateX(-40%);
              }
              50% {
                transform: translateX(40%);
              }
              100% {
                transform: translateX(110%);
              }
            }
          `}</style>
        </div>
      </div>
    </MobileScaffold>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<SummaryFallback />}>
      <SummaryClient highlightId={null} appliedToast={null} />
    </Suspense>
  );
}