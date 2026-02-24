// src/components/MobileScaffold.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { colors, layout, spacing } from "@/styles/design-tokens";

type Props = {
  children: React.ReactNode;
  /** Ancho máximo deseado en escritorio (en móvil siempre usamos maxWidthMobile) */
  maxWidth?: number;
  paddingDesktop?: string;
  paddingMobile?: string;
  mobileBottomSafe?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * Parsea un string tipo "22px 18px 24px" a un objeto CSS.
 */
function parsePadding(pad: string): CSSProperties {
  const parts = pad.split(" ").map((p) => p.trim());
  if (parts.length === 1) {
    return { padding: parts[0] };
  }
  if (parts.length === 2) {
    return { padding: `${parts[0]} ${parts[1]}` };
  }
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
  // 🆕: por defecto desktop es ancho dashboard, móvil se maneja aparte
  maxWidth = layout.maxWidthDesktop,
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

    // 🆕: en móvil usamos siempre maxWidthMobile; en desktop usamos maxWidth (prop)
    const effectiveMaxWidth = isMobile
      ? layout.maxWidthMobile
      : maxWidth;

    return {
      maxWidth: effectiveMaxWidth,
      width: "100%",
      margin: "0 auto",
      boxSizing: "border-box",
      ...(isMobile ? mobilePadding : desktopPadding),
    };
  }, [isMobile, maxWidth, paddingDesktop, paddingMobile]);

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

    const apply = () => {
      setIsMobile(mq.matches);
    };

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // Safari viejo
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
  }, [breakpoint]);

  return isMobile;
}