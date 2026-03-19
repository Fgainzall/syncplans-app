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
  path: string;
  aria: string;
  icon: React.ReactNode;
};

function SummaryIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 11.5L12 5l8 6.5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 10.5V18.5C6.5 19.0523 6.94772 19.5 7.5 19.5H10V14.75C10 14.3358 10.3358 14 10.75 14H13.25C13.6642 14 14 14.3358 14 14.75V19.5H16.5C17.0523 19.5 17.5 19.0523 17.5 18.5V10.5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="5"
        width="16"
        height="15"
        rx="3"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M8 3.75V7"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 3.75V7"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 9H20"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EventsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="6"
        width="15"
        height="12"
        rx="3"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M8 12H16"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 8V16"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ConflictsIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.25 3.75L6.75 13H11L10.75 20.25L17.25 11H13L13.25 3.75Z"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PanelIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4"
        y="4"
        width="7"
        height="7"
        rx="2"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <rect
        x="13"
        y="4"
        width="7"
        height="5"
        rx="2"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <rect
        x="13"
        y="11"
        width="7"
        height="9"
        rx="2"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <rect
        x="4"
        y="13"
        width="7"
        height="7"
        rx="2"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

const NAV_ITEMS: Omit<NavItem, "icon">[] = [
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
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const isPanelRelatedPath = (path: string) => {
    return (
      path.startsWith("/panel") ||
      path.startsWith("/profile") ||
      path.startsWith("/groups") ||
      path.startsWith("/members") ||
      path.startsWith("/invitations") ||
      path.startsWith("/settings") ||
      path.startsWith("/planes")
    );
  };

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname.startsWith("/calendar");
    if (key === "events") return pathname.startsWith("/events");
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "panel") return isPanelRelatedPath(pathname);
    return false;
  };

  const iconFor = (key: BottomNavKey, active: boolean) => {
    switch (key) {
      case "summary":
        return <SummaryIcon active={active} />;
      case "calendar":
        return <CalendarIcon active={active} />;
      case "events":
        return <EventsIcon active={active} />;
      case "conflicts":
        return <ConflictsIcon active={active} />;
      case "panel":
        return <PanelIcon active={active} />;
      default:
        return null;
    }
  };

  return (
    <nav style={S.wrap} aria-label="Navegación principal">
      <div style={S.inner}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.key);
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
              <div
                style={{
                  ...S.iconWrap,
                  ...(active ? S.iconWrapActive : {}),
                }}
                aria-hidden="true"
              >
                {iconFor(item.key, active)}
              </div>

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
    zIndex: 70,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,12,20,0.84)",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: 8,
    paddingBottom: "calc(8px + env(safe-area-inset-bottom))",
  },

  inner: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 8,
    alignItems: "stretch",
  },

  item: {
    appearance: "none",
    WebkitAppearance: "none",
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.025)",
    color: "rgba(255,255,255,0.76)",
    borderRadius: 16,
    minHeight: 62,
    padding: "8px 6px 9px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
    transition:
      "background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease, color 160ms ease",
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

  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: "inherit",
    background: "rgba(255,255,255,0.02)",
  },

  iconWrapActive: {
    background: "rgba(255,255,255,0.06)",
  },

  label: {
    fontSize: 10.5,
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    opacity: 0.9,
  },

  labelActive: {
    opacity: 1,
  },
};