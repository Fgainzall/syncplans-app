// src/components/AppHero.tsx
"use client";

import React, { type ReactNode } from "react";
import PremiumHeader from "./PremiumHeader";

type MobileNavVariant = "top" | "bottom" | "none";

type AppHeroProps = {
  title: string;
  subtitle: string;
  rightSlot?: ReactNode;
  /**
   * Variante de navegación móvil para PremiumHeader:
   * - "top": chips arriba
   * - "bottom": chips abajo (por defecto)
   * - "none": sin nav interna
   */
  mobileNav?: MobileNavVariant;
};

/**
 * AppHero
 *
 * Capa fina encima de PremiumHeader para usarlo como
 * “hero estándar” en todas las pantallas.
 *
 * - Mantiene mismo layout base (campana, usuario, Conectar, CTA).
 * - Cada pantalla cambia solo título, subtítulo y rightSlot.
 */
export default function AppHero({
  title,
  subtitle,
  rightSlot,
  mobileNav = "bottom",
}: AppHeroProps) {
  return (
    <PremiumHeader
      title={title}
      subtitle={subtitle}
      rightSlot={rightSlot}
      mobileNav={mobileNav}
    />
  );
}