// src/components/MobileScaffold.tsx
"use client";

import React, { memo, type CSSProperties } from "react";
import { colors, layout } from "@/styles/design-tokens";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
  paddingDesktop?: string;
  paddingMobile?: string;
  mobileBottomSafe?: number;
  className?: string;
  style?: CSSProperties;
};

function parsePadding(pad: string): CSSProperties {
  const parts = pad.split(" ").map((p) => p.trim());
  if (parts.length === 1) return { padding: parts[0] };
  if (parts.length === 2) return { padding: `${parts[0]} ${parts[1]}` };
  if (parts.length === 3) {
    return {
      paddingTop: parts[0],
      paddingLeft: parts[1],
      paddingRight: parts[1],
      paddingBottom: parts[2],
    };
  }
  if (parts.length >= 4) {
    return {
      paddingTop: parts[0],
      paddingRight: parts[1],
      paddingBottom: parts[2],
      paddingLeft: parts[3],
    };
  }
  return {};
}

function MobileScaffold({
  children,
  maxWidth = layout.maxWidthDesktop,
  paddingDesktop = "22px 18px 24px",
  paddingMobile = "14px 12px 18px",
  mobileBottomSafe = layout.mobileBottomSafe,
  className,
  style,
}: Props) {
  const desktopPadding = parsePadding(paddingDesktop);

  const shellStyle: CSSProperties = {
    minHeight: "100dvh",
    width: "100%",
    background: colors.appBackground,
    color: colors.textPrimary,
    paddingTop: "env(safe-area-inset-top)",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
  };

  const scrollAreaStyle: CSSProperties = {
    flex: 1,
    width: "100%",
    overflowX: "hidden",
    overflowY: "visible",
    WebkitOverflowScrolling: "touch",
  };

  const containerStyle: CSSProperties = {
    maxWidth: `min(100%, ${maxWidth}px)`,
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
    ...desktopPadding,
    paddingBottom: `max(var(--sp-bottom-safe, 0px), calc(env(safe-area-inset-bottom) + ${mobileBottomSafe}px))`,
  };

  return (
    <div className={className} style={{ ...shellStyle, ...style }}>
      <div style={scrollAreaStyle}>
        <div style={containerStyle} className="sp-mobile-scaffold-container">
          {children}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: ${layout.mobileBreakpoint}px) {
          .sp-mobile-scaffold-container {
            max-width: min(100%, ${layout.maxWidthMobile}px);
            padding-top: 14px;
            padding-left: 12px;
            padding-right: 12px;
            padding-bottom: 18px;
          }
        }
      `}</style>
    </div>
  );
}

export default memo(MobileScaffold);