// src/components/MobileScaffold.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { colors, layout, spacing } from "@/styles/design-tokens";

type Props = {
  children: React.ReactNode;
  maxWidth?: number;
  paddingDesktop?: string;
  paddingMobile?: string;
  mobileBottomSafe?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * MobileScaffold
 *
 * Shell base para todas las pantallas principales.
 * Maneja:
 * - Fondo global
 * - Safe-area iOS
 * - Espacio reservado para BottomNav
 * - Centrado + ancho máximo
 */
export default function MobileScaffold({
  children,
  maxWidth = layout.maxWidthMobile,
  paddingDesktop = "22px 18px 24px",
  paddingMobile = "14px 12px 18px",
  mobileBottomSafe = layout.mobileBottomSafe,
  className,
  style,
}: Props) {
  const isMobile = useIsMobileWidth(layout.mobileBreakpoint);

  const shellStyle = useMemo<CSSProperties>(() => {
    return {
      minHeight: "100vh",
      height: "100dvh",
      width: "100%",
      background: colors.appBackground,
      color: colors.textPrimary,
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: `calc(env(safe-area-inset-bottom) + ${mobileBottomSafe}px)`,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
      justifyContent: "flex-start",
    };
  }, [mobileBottomSafe]);

  const scrollAreaStyle = useMemo<CSSProperties>(() => {
    return {
      flex: 1,
      width: "100%",
      overflowX: "hidden",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    };
  }, []);

  const containerStyle = useMemo<CSSProperties>(() => {
    const desktopPadding = parsePadding(paddingDesktop);
    const mobilePadding = parsePadding(paddingMobile);

    return {
      maxWidth,
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
      ...(isMobile ? mobilePadding : desktopPadding),
      paddingTop:
        (isMobile
          ? mobilePadding.paddingTop
          : desktopPadding.paddingTop) ?? spacing.lg,
    };
  }, [maxWidth, isMobile, paddingDesktop, paddingMobile]);

  return (
    <div className={className} style={{ ...shellStyle, ...style }}>
      <div style={scrollAreaStyle}>
        <div style={containerStyle}>{children}</div>
      </div>
    </div>
  );
}

function useIsMobileWidth(breakpoint: number) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const apply = () => setIsMobile(mq.matches);

    apply();

    if (mq.addEventListener) {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // @ts-ignore
      mq.addListener?.(apply);
      // @ts-ignore
      return () => mq.removeListener?.(apply);
    }
  }, [breakpoint]);

  return isMobile;
}

function parsePadding(value: string): CSSProperties {
  if (!value) return {};

  const parts = value.trim().split(/\s+/);

  if (parts.length === 1) {
    return { padding: value };
  }

  if (parts.length === 2) {
    const [vertical, horizontal] = parts;
    return {
      paddingTop: vertical,
      paddingBottom: vertical,
      paddingLeft: horizontal,
      paddingRight: horizontal,
    };
  }

  if (parts.length === 3) {
    const [top, horizontal, bottom] = parts;
    return {
      paddingTop: top,
      paddingBottom: bottom,
      paddingLeft: horizontal,
      paddingRight: horizontal,
    };
  }

  if (parts.length >= 4) {
    const [top, right, bottom, left] = parts;
    return {
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    };
  }

  return {};
}