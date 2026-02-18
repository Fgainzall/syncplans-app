// src/components/BottomNav.tsx
"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

export type BottomNavKey = "summary" | "calendar" | "events" | "conflicts" | "panel";

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname === "/calendar";
    if (key === "events") return pathname.startsWith("/events");
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "panel") return pathname.startsWith("/profile");
    return false;
  };

  return (
    <div style={S.wrap}>
      <button
        style={{ ...S.item, ...(isActive("summary") ? S.itemActive : {}) }}
        onClick={() => router.push("/summary")}
      >
        <div style={S.icon}>🏠</div>
        <div style={S.label}>Resumen</div>
      </button>

      <button
        style={{ ...S.item, ...(isActive("calendar") ? S.itemActive : {}) }}
        onClick={() => router.push("/calendar")}
      >
        <div style={S.icon}>🗓️</div>
        <div style={S.label}>Calendario</div>
      </button>

      <button
        style={{ ...S.item, ...(isActive("events") ? S.itemActive : {}) }}
        onClick={() => router.push("/events")}
      >
        <div style={S.icon}>✨</div>
        <div style={S.label}>Eventos</div>
      </button>

      <button
        style={{ ...S.item, ...(isActive("conflicts") ? S.itemActive : {}) }}
        onClick={() => router.push("/conflicts/detected")}
      >
        <div style={S.icon}>⚡</div>
        <div style={S.label}>Choques</div>
      </button>

      <button
        style={{ ...S.item, ...(isActive("panel") ? S.itemActive : {}) }}
        onClick={() => router.push("/profile")}
      >
        <div style={S.icon}>👤</div>
        <div style={S.label}>Panel</div>
      </button>
    </div>
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
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 6,
  },
  item: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.90)",
    borderRadius: 14,
    padding: "8px 6px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 46,
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
    opacity: 0.9,
    letterSpacing: "0.01em",
  },
};