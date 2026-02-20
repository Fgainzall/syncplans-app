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

type NavItem = {
  key: BottomNavKey;
  label: string;
  icon: string;
  path: string;
  aria: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "summary",
    label: "Resumen",
    icon: "🏠",
    path: "/summary",
    aria: "Ir a Resumen",
  },
  {
    key: "calendar",
    label: "Calendario",
    icon: "🗓️",
    path: "/calendar",
    aria: "Ir a Calendario",
  },
  {
    key: "events",
    label: "Eventos",
    icon: "✨",
    path: "/events",
    aria: "Ir a Eventos",
  },
  {
    key: "conflicts",
    label: "Conflictos",
    icon: "⚡",
    path: "/conflicts/detected",
    aria: "Ir a Conflictos",
  },
  {
    key: "panel",
    label: "Panel",
    icon: "👤",
    path: "/profile",
    aria: "Ir a Panel",
  },
];

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
      <div style={S.inner}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.key);
          return (
            <button
              key={item.key}
              type="button"
              style={{ ...S.item, ...(active ? S.itemActive : {}) }}
              onClick={() => go(item.path)}
              aria-label={item.aria}
            >
              <div style={S.icon} aria-hidden="true">
                {item.icon}
              </div>
              <div style={S.label}>{item.label}</div>
            </button>
          );
        })}
      </div>
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
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
    overflow: "hidden",
  },

  inner: {
    display: "flex",
    flexWrap: "nowrap",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 2,
    WebkitOverflowScrolling: "touch",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "none" as any,
    msOverflowStyle: "none" as any,
  },

  item: {
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.90)",
    borderRadius: 14,
    padding: "9px 10px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 48,
    flex: "0 0 auto",
    minWidth: 76,
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
    whiteSpace: "nowrap",
  },
};