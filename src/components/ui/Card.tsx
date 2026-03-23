"use client";

import type { CSSProperties, ReactNode } from "react";
import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

type CardTone = "default" | "muted" | "strong";

type CardProps = {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  padding?: number | string;
  tone?: CardTone;
};

function getBackgroundByTone(tone: CardTone) {
  if (tone === "muted") return "rgba(15,23,42,0.72)";
  if (tone === "strong") return "rgba(15,23,42,0.98)";
  return colors.surfaceRaised;
}

export default function Card({
  children,
  style,
  className,
  padding = spacing.lg,
  tone = "default",
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        borderRadius: radii.xl,
        border: `1px solid ${colors.borderSubtle}`,
        background: getBackgroundByTone(tone),
        boxShadow: shadows.card,
        padding,
        boxSizing: "border-box",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}