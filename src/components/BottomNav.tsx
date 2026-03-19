// src/components/BottomNav.tsx
"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";

type BottomNavKey =
  | "summary"
  | "calendar"
  | "events"
  | "conflicts"
  | "panel"
  | "groups"
  | "members"
  | "invitations"
  | "settings"
  | "planes";

type NavItem = {
  key: BottomNavKey;
  label: string;
  path: string;
  aria: string;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: "summary",
    label: "Resumen",
    path: "/summary",
    aria: "Ir a Resumen",
  },
  {
    key: "calendar",
    label: "Calendario",
    path: "/calendar",
    aria: "Ir a Calendario",
  },
  {
    key: "events",
    label: "Eventos",
    path: "/events",
    aria: "Ir a Eventos",
  },
  {
    key: "conflicts",
    label: "Conflictos",
    path: "/conflicts/detected",
    aria: "Ir a Conflictos",
  },
  {
    key: "panel",
    label: "Panel",
    path: "/panel",
    aria: "Ir a Panel",
  },
  {
    key: "groups",
    label: "Grupos",
    path: "/groups",
    aria: "Ir a Grupos",
  },
  {
    key: "members",
    label: "Miembros",
    path: "/members",
    aria: "Ir a Miembros",
  },
  {
    key: "invitations",
    label: "Invitaciones",
    path: "/invitations",
    aria: "Ir a Invitaciones",
  },
  {
    key: "settings",
    label: "Ajustes",
    path: "/settings",
    aria: "Ir a Ajustes",
  },
  {
    key: "planes",
    label: "Planes",
    path: "/planes",
    aria: "Ir a Planes",
  },
];

function isActivePath(pathname: string, item: NavItem) {
  if (item.key === "summary") return pathname.startsWith("/summary");
  if (item.key === "calendar") return pathname.startsWith("/calendar");
  if (item.key === "events") return pathname.startsWith("/events");
  if (item.key === "conflicts") return pathname.startsWith("/conflicts");
  if (item.key === "panel") return pathname.startsWith("/panel");
  if (item.key === "groups") return pathname.startsWith("/groups");
  if (item.key === "members") return pathname.startsWith("/members");
  if (item.key === "invitations") return pathname.startsWith("/invitations");
  if (item.key === "settings") return pathname.startsWith("/settings");
  if (item.key === "planes") return pathname.startsWith("/planes");
  return false;
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav style={S.wrap} aria-label="Navegación principal">
      <div style={S.scroll}>
        {NAV_ITEMS.map((item) => {
          const active = isActivePath(pathname, item);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.path)}
              aria-label={item.aria}
              aria-current={active ? "page" : undefined}
              style={{
                ...S.item,
                ...(active ? S.itemActive : {}),
              }}
            >
              <span
                style={{
                  ...S.label,
                  ...(active ? S.labelActive : {}),
                }}
              >
                {item.label}
              </span>
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
    zIndex: 80,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,12,20,0.84)",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: 8,
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
    overflow: "hidden",
  },

  scroll: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    paddingBottom: 2,
  },

  item: {
    appearance: "none",
    WebkitAppearance: "none",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.78)",
    borderRadius: 14,
    minHeight: 44,
    padding: "0 14px",
    cursor: "pointer",
    flex: "0 0 auto",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
    WebkitTapHighlightColor: "transparent",
    transition:
      "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, color 160ms ease, transform 160ms ease",
  },

  itemActive: {
    color: "#F8FBFF",
    border: "1px solid rgba(96,165,250,0.34)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.16), rgba(124,58,237,0.12))",
    boxShadow:
      "0 10px 24px rgba(15,23,42,0.28), inset 0 1px 0 rgba(255,255,255,0.06)",
    transform: "translateY(-1px)",
  },

  label: {
    fontSize: 12,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "0.01em",
    opacity: 0.94,
  },

  labelActive: {
    opacity: 1,
  },
};