// src/components/AppHero.tsx
"use client";

import React from "react";
import PremiumHeader from "./PremiumHeader";

/**
 * AppHero
 *
 * Capa fina encima de PremiumHeader para usarlo como
 * "panel azul" estándar en todas las pantallas.
 *
 * Regla:
 * - Mismo layout en todas las vistas (campana, usuario, Conectar, CTA).
 * - Cambian solo título, subtítulo y CTA contextual.
 */
export type AppHeroProps = {
  /** Título principal del panel (por defecto, se infiere por ruta) */
  title?: string;
  /** Subtítulo bajo el título (por defecto: "Organiza tu día sin conflictos de horario.") */
  subtitle?: string;
  /**
   * Slot opcional para reemplazar el botón principal.
   * Ej: un botón "Salir" en Resumen.
   *
   * Si no pasas nada, el header muestra "+ Evento" como CTA principal.
   */
  rightSlot?: React.ReactNode;
  /**
   * Control de navegación superior en móvil:
   * - "bottom" (default): solo tabs inferiores
   * - "top": muestra nav superior también en móvil
   * - "none": sin nav (por si quieres una pantalla ultra-limpia)
   */
  mobileNav?: "top" | "bottom" | "none";
};

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