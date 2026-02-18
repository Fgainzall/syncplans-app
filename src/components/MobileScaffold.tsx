// src/components/MobileScaffold.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Props = {
  children: React.ReactNode;

  /** ancho máximo del contenedor */
  maxWidth?: number;

  /** padding desktop (ej: "22px 18px 24px") */
  paddingDesktop?: string;

  /** padding móvil (ej: "14px 12px 18px") */
  paddingMobile?: string;

  /**
   * Espacio reservado en móvil para BottomNav.
   * (altura aproximada de la barra inferior + aire)
   */
  mobileBottomSafe?: number;

  className?: string;
  style?: React.CSSProperties;

  /**
   * Si quieres forzar que el scaffold maneje el scroll (modo app).
   * Déjalo en true (default).
   */
  scroll?: boolean;
};

function useIsMobileWidth(maxWidth = 520) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(!!mq.matches);

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
  }, [maxWidth]);

  return isMobile;
}

function parsePadding(padding: string) {
  const parts = String(padding).trim().split(/\s+/);

  const top = parts[0] ?? "14px";
  const right = parts[1] ?? parts[0] ?? "12px";
  const bottom = parts[2] ?? parts[0] ?? "18px";
  const left = parts[3] ?? right;

  return { top, right, bottom, left };
}

/**
 * MobileScaffold (App Shell)
 *
 * ✅ Objetivo: "móvil = app real"
 * - 100dvh real (iPhone)
 * - 1 solo scroll (interno)
 * - safe-area top/bottom
 * - reserva espacio para BottomNav
 *
 * Desktop: mantiene tu layout premium normal.
 */
export default function MobileScaffold({
  children,
  maxWidth = 980,
  paddingDesktop = "22px 18px 24px",
  paddingMobile = "14px 12px 18px",
  mobileBottomSafe = 96,
  className,
  style,
  scroll = true,
}: Props) {
  const isMobile = useIsMobileWidth(520);

  const desktopPad = useMemo(() => parsePadding(paddingDesktop), [paddingDesktop]);
  const mobilePad = useMemo(() => parsePadding(paddingMobile), [paddingMobile]);

  // ✅ En móvil: el bottom padding SIEMPRE incluye:
  // - padding base
  // - espacio para BottomNav
  // - safe-area iOS (home bar)
  const mobilePadding = useMemo(() => {
    const safeBottom = `calc(${mobilePad.bottom} + ${mobileBottomSafe}px + env(safe-area-inset-bottom))`;
    const safeTop = `calc(${mobilePad.top} + env(safe-area-inset-top))`;
    return {
      paddingTop: safeTop,
      paddingRight: mobilePad.right,
      paddingBottom: safeBottom,
      paddingLeft: mobilePad.left,
    } as React.CSSProperties;
  }, [mobilePad, mobileBottomSafe]);

  const desktopPadding = useMemo(() => {
    return {
      paddingTop: desktopPad.top,
      paddingRight: desktopPad.right,
      paddingBottom: desktopPad.bottom,
      paddingLeft: desktopPad.left,
    } as React.CSSProperties;
  }, [desktopPad]);

  // ✅ Shell: en móvil controlamos altura + scroll interno.
  // Evita “cortes” y doble scroll raro.
  const shellStyle: React.CSSProperties = useMemo(() => {
    if (!isMobile || !scroll) {
      return {
        width: "100%",
      };
    }

    return {
      width: "100%",
      height: "100dvh",
      minHeight: "100dvh",
      overflow: "hidden", // ✅ no scroll del wrapper
    };
  }, [isMobile, scroll]);

  const scrollAreaStyle: React.CSSProperties = useMemo(() => {
    if (!isMobile || !scroll) {
      return {
        width: "100%",
      };
    }

    return {
      width: "100%",
      height: "100%",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      overscrollBehaviorY: "contain",
    };
  }, [isMobile, scroll]);

  const containerStyle: React.CSSProperties = useMemo(() => {
    const base: React.CSSProperties = {
      maxWidth,
      margin: "0 auto",
      ...(!isMobile ? desktopPadding : mobilePadding),
    };

    return base;
  }, [maxWidth, isMobile, desktopPadding, mobilePadding]);

  return (
    <div className={className} style={{ ...shellStyle, ...style }}>
      <div style={scrollAreaStyle}>
        <div style={containerStyle}>{children}</div>
      </div>
    </div>
  );
}