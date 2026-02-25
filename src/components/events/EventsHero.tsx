// src/components/events/EventsHero.tsx
"use client";

import React, { type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import AppHero from "@/components/AppHero";
import { colors, radii, spacing } from "@/styles/design-tokens";

type EventsHeroProps = {
  /**
   * Texto que aparece debajo del título "Eventos".
   * En /events viene de headerSubtitle.
   */
  subtitle: string;
  /**
   * Si es true (por defecto), muestra el botón "+ Evento" a la derecha.
   * Lo usaremos en el render normal.
   * En el estado "booting" lo desactivamos.
   */
  showCreateButton?: boolean;
};

export default function EventsHero({
  subtitle,
  showCreateButton = true,
}: EventsHeroProps) {
  const router = useRouter();

  const handleCreateClick = () => {
    router.push("/events/new/details?type=personal");
  };

  const rightSlot = showCreateButton ? (
    <button
      type="button"
      style={primaryButtonStyle}
      onClick={handleCreateClick}
    >
      + Evento
    </button>
  ) : undefined;

  return (
    <div style={wrapperStyle}>
      <AppHero
        title="Eventos"
        subtitle={subtitle}
        mobileNav="bottom"
        rightSlot={rightSlot}
      />
    </div>
  );
}

// ===== Estilos internos del héroe =====

const wrapperStyle: CSSProperties = {
  marginBottom: spacing.sm,
};

const primaryButtonStyle: CSSProperties = {
  padding: "9px 12px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.accentPrimary}`,
  background: colors.accentPrimary,
  color: "#0B0F19",
  cursor: "pointer",
  fontWeight: 900,
  fontSize: 13,
};