// src/components/events/EventsEmptyState.tsx
"use client";

import React, { type CSSProperties } from "react";
import { useRouter } from "next/navigation";

type EventsEmptyStateProps = {
  /**
   * Acción al hacer click en "Crear evento".
   * Si no se pasa, hace push a /events/new/details?type=personal.
   */
  onCreateFirstEvent?: () => void;
};

export default function EventsEmptyState({
  onCreateFirstEvent,
}: EventsEmptyStateProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onCreateFirstEvent) {
      onCreateFirstEvent();
    } else {
      router.push("/events/new/details?type=personal");
    }
  };

  return (
    <div style={S.emptyState} className="spEvt-empty">
      <h2 style={S.emptyTitle}>No hay eventos aquí aún</h2>
      <p style={S.emptySub}>
        Empieza creando tu primer evento. Más adelante podrás verlos por fecha,
        editar y detectar conflictos.
      </p>
      <button type="button" style={S.primary} onClick={handleClick}>
        Crear evento
      </button>
    </div>
  );
}

// Estilos locales (copiados del S original de /events)
const S: Record<string, CSSProperties> = {
  emptyState: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px dashed rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.92)",
    padding: 16,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 950,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(209,213,219,0.96)",
    marginBottom: 10,
  },
  primary: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.85)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
};