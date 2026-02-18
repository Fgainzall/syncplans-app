// src/components/BottomNav.tsx
"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

export type BottomNavKey =
  | "summary"
  | "calendar"
  | "events"
  | "conflicts"
  | "panel";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname.startsWith("/calendar");
    if (key === "events") return pathname.startsWith("/events");
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "panel") return pathname.startsWith("/profile");
    return false;
  };

  const go = (path: string) => router.push(path);

  return (
    <nav style={S.wrap} aria-label="Navegación principal">
      <button
        type="button"
        style={{ ...S.item, ...(isActive("summary") ? S.itemActive : {}) }}
        onClick={() => go("/summary")}
        aria-label="Ir a Resumen"
      >
        <div style={S.icon} aria-hidden="true">
          🏠
        </div>
        <div style={S.label}>Resumen</div>
      </button>

      <button
        type="button"
        style={{ ...S.item, ...(isActive("calendar") ? S.itemActive : {}) }}
        onClick={() => go("/calendar")}
        aria-label="Ir a Calendario"
      >
        <div style={S.icon} aria-hidden="true">
          🗓️
        </div>
        <div style={S.label}>Calendario</div>
      </button>

      <button
        type="button"
        style={{ ...S.item, ...(isActive("events") ? S.itemActive : {}) }}
        onClick={() => go("/events")}
        aria-label="Ir a Eventos"
      >
        <div style={S.icon} aria-hidden="true">
          ✨
        </div>
        <div style={S.label}>Eventos</div>
      </button>

      <button
        type="button"
        style={{ ...S.item, ...(isActive("conflicts") ? S.itemActive : {}) }}
        onClick={() => go("/conflicts/detected")}
        aria-label="Ir a Conflictos"
      >
        <div style={S.icon} aria-hidden="true">
          ⚡
        </div>
        <div style={S.label}>Conflictos</div>
      </button>

      <button
        type="button"
        style={{ ...S.item, ...(isActive("panel") ? S.itemActive : {}) }}
        onClick={() => go("/profile")}
        aria-label="Ir a Panel"
      >
        <div style={S.icon} aria-hidden="true">
          👤
        </div>
        <div style={S.label}>Panel</div>
      </button>
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 60,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.75)",
    boxShadow: "0 22px 60px rgba(0,0,0,0.55)",
    backdropFilter: "blur(16px)",
    padding: 8,

    // ✅ iPhone safe-area
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",

    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 6,
  },

  item: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.90)",
    borderRadius: 14,
    padding: "9px 6px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 48,

    // ✅ feel de app (tap)
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },

  itemActive: {
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.12), rgba(124,58,237,0.10))",
    boxShadow: "0 0 0 2px rgba(2,6,23,0.70) inset",
  },

  icon: { fontSize: 16, lineHeight: 1 },

  label: {
    fontSize: 10,
    fontWeight: 900,
    opacity: 0.92,
    letterSpacing: "0.01em",
    lineHeight: 1.1,
  },
};