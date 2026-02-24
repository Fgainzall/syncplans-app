"use client";

// src/app/summary/page.tsx

import React, { Suspense } from "react";
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
          minHeight: "100vh",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
          background:
            "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 540,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: spacing.lg,
          }}
        >
          {/* Header skeleton */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 120,
                height: 10,
                borderRadius: 999,
                background: "rgba(148,163,184,0.35)",
              }}
            />
            <div
              style={{
                width: 220,
                height: 18,
                borderRadius: 999,
                background: "rgba(248,250,252,0.80)",
              }}
            />
            <div
              style={{
                width: 260,
                height: 12,
                borderRadius: 999,
                background: "rgba(148,163,184,0.45)",
              }}
            />
          </div>

          {/* Card skeleton */}
          <div
            style={{
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
                justifyContent: "space-between",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 180,
                    height: 14,
                    borderRadius: 999,
                    background: "rgba(248,250,252,0.90)",
                  }}
                />
                <div
                  style={{
                    width: 220,
                    height: 11,
                    borderRadius: 999,
                    background: "rgba(148,163,184,0.55)",
                  }}
                />
              </div>

              <div
                style={{
                  width: 90,
                  height: 28,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.85)",
                  border: `1px solid ${colors.borderSubtle}`,
                }}
              />
            </div>

            <div
              style={{
                marginTop: spacing.sm,
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: spacing.sm,
              }}
            >
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    borderRadius: radii.lg,
                    padding: `${spacing.sm}px ${spacing.sm}px`,
                    border: `1px solid ${colors.borderSubtle}`,
                    background: colors.surfaceLow,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 70,
                      height: 11,
                      borderRadius: 999,
                      background: "rgba(248,250,252,0.90)",
                    }}
                  />
                  <div
                    style={{
                      width: 40,
                      height: 18,
                      borderRadius: 999,
                      background: "rgba(56,189,248,0.85)",
                    }}
                  />
                  <div
                    style={{
                      width: "100%",
                      height: 10,
                      borderRadius: 999,
                      background: "rgba(148,163,184,0.45)",
                    }}
                  />
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: spacing.md,
                borderRadius: radii.lg,
                border: `1px dashed ${colors.borderSubtle}`,
                padding: `${spacing.sm}px ${spacing.md}px`,
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(56,189,248,0.95)",
                }}
              />
              <div
                style={{
                  flex: 1,
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(148,163,184,0.45)",
                }}
              />
            </div>
          </div>
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