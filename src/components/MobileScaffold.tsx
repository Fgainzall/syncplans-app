// src/components/MobileScaffold.tsx
"use client";

import React, { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  /** ancho máximo del contenedor */
  maxWidth?: number;
  /** padding desktop (ej: "22px 18px 24px") */
  paddingDesktop?: string;
  /** padding móvil (ej: "14px 12px 18px") */
  paddingMobile?: string;
  /** bottom padding extra en móvil para que NO tape la bottom bar */
  mobileBottomSafe?: number;
  className?: string;
  style?: React.CSSProperties;
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

/**
 * MobileScaffold
 * - En desktop: deja tu layout premium igual
 * - En móvil: aplica padding compacto + bottom safe para la BottomNav
 */
export default function MobileScaffold({
  children,
  maxWidth = 980,
  paddingDesktop = "22px 18px 24px",
  paddingMobile = "14px 12px 18px",
  mobileBottomSafe = 96,
  className,
  style,
}: Props) {
  const isMobile = useIsMobileWidth(520);

  return (
    <div
      className={className}
      style={{
        maxWidth,
        margin: "0 auto",
        padding: isMobile ? `${paddingMobile} ${mobileBottomSafe}px` : paddingDesktop,
        ...style,
      }}
    >
      {children}
    </div>
  );
}