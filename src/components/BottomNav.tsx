"use client";

import React, { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type BottomNavKey = "summary" | "calendar" | "capture" | "conflicts" | "groups";

type NavItem = {
  key: BottomNavKey;
  label: string;
  path: string;
  aria: string;
};

function SummaryIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function CreatePlanIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4.25"
        y="4.25"
        width="15.5"
        height="15.5"
        rx="5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.88)"}
        strokeWidth="1.8"
      />
      <path
        d="M12 8.25V15.75"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.88)"}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M8.25 12H15.75"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.88)"}
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ConflictsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function GroupsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M16.5 10a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M3.75 18.25C4.55 15.95 6.2 14.75 8 14.75c1.8 0 3.45 1.2 4.25 3.5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M13.5 18.25C14.05 16.55 15.25 15.5 16.75 15.25"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { key: "summary", label: "Inicio", path: "/summary", aria: "Ir a Inicio" },
  { key: "calendar", label: "Calendario", path: "/calendar", aria: "Ir a Calendario" },
  { key: "capture", label: "Crear plan", path: "/capture", aria: "Crear plan" },
  { key: "conflicts", label: "Conflictos", path: "/conflicts/detected", aria: "Ir a Conflictos" },
  { key: "groups", label: "Grupos", path: "/groups", aria: "Ir a Grupos" },
];

function shouldHideBottomNav(pathname: string) {
  return (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/auth")
  );
}

function iconFor(key: BottomNavKey, active: boolean) {
  switch (key) {
    case "summary":
      return <SummaryIcon active={active} />;
    case "calendar":
      return <CalendarIcon active={active} />;
    case "capture":
      return <CreatePlanIcon active={active} />;
    case "conflicts":
      return <ConflictsIcon active={active} />;
    case "groups":
      return <GroupsIcon active={active} />;
    default:
      return null;
  }
}

function BottomNav() {
  const pathname = usePathname();

  if (shouldHideBottomNav(pathname)) return null;

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname.startsWith("/calendar");
    if (key === "capture") {
      return pathname.startsWith("/capture") || pathname.startsWith("/events/new");
    }
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "groups") return pathname.startsWith("/groups");
    return false;
  };

  return (
    <nav style={S.outer} aria-label="Navegación principal">
      <div style={S.wrap}>
        <div style={S.track}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.key);
            const isPrimary = item.key === "capture";

            return (
              <Link
                key={item.key}
                href={item.path}
                scroll={false}
                aria-label={item.aria}
                aria-current={active ? "page" : undefined}
                style={{
                  ...S.item,
                  ...(isPrimary ? S.itemPrimary : {}),
                  ...(active ? S.itemActive : {}),
                  ...(isPrimary && active ? S.itemPrimaryActive : {}),
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    ...S.iconWrap,
                    ...(isPrimary ? S.iconWrapPrimary : {}),
                    ...(active ? S.iconWrapActive : {}),
                    ...(isPrimary && active ? S.iconWrapPrimaryActive : {}),
                  }}
                >
                  {iconFor(item.key, active)}
                </div>

                <span
                  style={{
                    ...S.label,
                    ...(isPrimary ? S.labelPrimary : {}),
                    ...(active ? S.labelActive : {}),
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

const S: Record<string, React.CSSProperties> = {
  outer: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 90,
    pointerEvents: "none",
    paddingLeft: "max(8px, env(safe-area-inset-left, 0px))",
    paddingRight: "max(8px, env(safe-area-inset-right, 0px))",
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + var(--sp-bottom-nav-offset, 8px))",
    boxSizing: "border-box",
  },

  wrap: {
    pointerEvents: "auto",
    width: "min(calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)), 430px)",
    maxWidth: "100%",
    margin: "0 auto",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,12,20,0.92)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: 4,
    overflow: "hidden",
  },

  track: {
    width: "100%",
    minWidth: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    alignItems: "stretch",
    gap: 4,
  },

  item: {
    minWidth: 0,
    minHeight: 54,
    padding: "6px 2px 7px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.025)",
    color: "rgba(255,255,255,0.76)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    cursor: "pointer",
    transition: "background 140ms ease, border-color 140ms ease, transform 120ms ease, box-shadow 140ms ease, color 140ms ease",
  },

  itemPrimary: {
    border: "1px solid rgba(125,211,252,0.20)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(168,85,247,0.18))",
  },

  itemActive: {
    color: "#F8FBFF",
    border: "1px solid rgba(96,165,250,0.20)",
    background: "rgba(59,130,246,0.11)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
    transform: "translateY(-0.5px)",
  },

  itemPrimaryActive: {
    border: "1px solid rgba(125,211,252,0.34)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(168,85,247,0.25))",
  },

  iconWrap: {
    width: 25,
    height: 25,
    borderRadius: 9,
    display: "grid",
    placeItems: "center",
    color: "inherit",
    background: "rgba(255,255,255,0.03)",
    flexShrink: 0,
  },

  iconWrapPrimary: {
    width: 27,
    height: 27,
    borderRadius: 10,
    background: "rgba(255,255,255,0.08)",
  },

  iconWrapActive: {
    background: "rgba(255,255,255,0.06)",
  },

  iconWrapPrimaryActive: {
    background: "rgba(255,255,255,0.12)",
  },

  label: {
    width: "100%",
    minWidth: 0,
    maxWidth: "100%",
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: "clamp(8px, 2.15vw, 9.5px)",
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: 0,
    textAlign: "center",
    whiteSpace: "nowrap",
    opacity: 0.9,
  },

  labelPrimary: {
    fontWeight: 920,
  },

  labelActive: {
    opacity: 1,
  },
};

export default memo(BottomNav);
