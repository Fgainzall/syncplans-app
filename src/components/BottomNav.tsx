"use client";

import React, { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

function EventsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function PanelIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

function MembersIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle
        cx="12"
        cy="8"
        r="3"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M6 18.25C7 15.8 9.1 14.5 12 14.5c2.9 0 5 1.3 6 3.75"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InvitationsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="4"
        y="6"
        width="16"
        height="12"
        rx="2.5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M5.5 8L12 13l6.5-5"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
      <path
        d="M19 12a7.2 7.2 0 0 0-.08-1l1.45-1.13-1.4-2.42-1.74.42a7.5 7.5 0 0 0-1.72-1l-.28-1.77h-2.8l-.28 1.77c-.6.22-1.18.55-1.72 1l-1.74-.42-1.4 2.42L5.08 11c-.05.33-.08.66-.08 1s.03.67.08 1l-1.45 1.13 1.4 2.42 1.74-.42c.54.45 1.12.78 1.72 1l.28 1.77h2.8l.28-1.77c.6-.22 1.18-.55 1.72-1l1.74.42 1.4-2.42L18.92 13c.05-.33.08-.66.08-1Z"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlansIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 6.5h10"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 12h10"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 17.5h6"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="1.8"
      />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { key: "summary", label: "Resumen", path: "/summary", aria: "Ir a Resumen" },
  { key: "calendar", label: "Calendario", path: "/calendar", aria: "Ir a Calendario" },
  { key: "events", label: "Eventos", path: "/events", aria: "Ir a Eventos" },
  { key: "conflicts", label: "Conflictos", path: "/conflicts/detected", aria: "Ir a Conflictos" },
  { key: "panel", label: "Panel", path: "/panel", aria: "Ir a Panel" },
  { key: "groups", label: "Grupos", path: "/groups", aria: "Ir a Grupos" },
  { key: "members", label: "Miembros", path: "/members", aria: "Ir a Miembros" },
  { key: "invitations", label: "Invitaciones", path: "/invitations", aria: "Ir a Invitaciones" },
  { key: "settings", label: "Ajustes", path: "/settings", aria: "Ir a Ajustes" },
  { key: "planes", label: "Planes", path: "/planes", aria: "Ir a Planes" },
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
    case "events":
      return <EventsIcon active={active} />;
    case "conflicts":
      return <ConflictsIcon active={active} />;
    case "panel":
      return <PanelIcon active={active} />;
    case "groups":
      return <GroupsIcon active={active} />;
    case "members":
      return <MembersIcon active={active} />;
    case "invitations":
      return <InvitationsIcon active={active} />;
    case "settings":
      return <SettingsIcon active={active} />;
    case "planes":
      return <PlansIcon active={active} />;
    default:
      return null;
  }
}

function BottomNav() {
  const pathname = usePathname();

  if (shouldHideBottomNav(pathname)) return null;

  const isPanelRelatedPath = (path: string) => path.startsWith("/panel");

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname.startsWith("/calendar");
    if (key === "events") return pathname.startsWith("/events");
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "panel") return pathname.startsWith("/panel");
    if (key === "groups") return pathname.startsWith("/groups");
    if (key === "members") return pathname.startsWith("/members");
    if (key === "invitations") return pathname.startsWith("/invitations");
    if (key === "settings") return pathname.startsWith("/settings");
    if (key === "planes") return pathname.startsWith("/planes");
    return false;
  };

  return (
    <nav style={S.outer} aria-label="NavegaciĂłn principal">
      <div style={S.wrap}>
        <div style={S.viewport}>
          <div style={S.track}>
            {NAV_ITEMS.map((item) => {
              const active =
                item.key === "panel"
                  ? isPanelRelatedPath(pathname)
                  : isActive(item.key);

              return (
                <Link
                  key={item.key}
                  href={item.path}
                  scroll={false}
                  aria-label={item.aria}
                  aria-current={active ? "page" : undefined}
                  style={{
                    ...S.item,
                    ...(active ? S.itemActive : {}),
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      ...S.iconWrap,
                      ...(active ? S.iconWrapActive : {}),
                    }}
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
                </Link>
              );
            })}
          </div>
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
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom:
      "calc(env(safe-area-inset-bottom, 0px) + var(--sp-bottom-nav-offset, 12px))",
    boxSizing: "border-box",
  },

  wrap: {
    pointerEvents: "auto",
    width: "min(100%, 560px)",
    margin: "0 auto",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(8,12,20,0.88)",
    boxShadow:
      "0 20px 50px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    padding: 4,
  },

  viewport: {
    width: "100%",
    overflowX: "auto",
    overflowY: "hidden",
    WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    touchAction: "pan-x",
    overscrollBehaviorX: "contain",
    overscrollBehaviorY: "none",
  },

  track: {
    display: "inline-flex",
    alignItems: "stretch",
    gap: 8,
    minWidth: "max-content",
    paddingBottom: 2,
  },

  item: {
    minWidth: 74,
    minHeight: 58,
    padding: "8px 8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.025)",
    color: "rgba(255,255,255,0.76)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    flex: "0 0 auto",
    cursor: "pointer",
    transition:
      "background 140ms ease, border-color 140ms ease, transform 120ms ease, box-shadow 140ms ease, color 140ms ease",
  },

  itemActive: {
    color: "#F8FBFF",
    border: "1px solid rgba(96,165,250,0.18)",
    background: "rgba(59,130,246,0.10)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    transform: "translateY(-0.5px)",
  },

  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    display: "grid",
    placeItems: "center",
    color: "inherit",
    background: "rgba(255,255,255,0.03)",
    flexShrink: 0,
  },

  iconWrapActive: {
    background: "rgba(255,255,255,0.06)",
  },

  label: {
    fontSize: 9,
    lineHeight: 1,
    fontWeight: 800,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    opacity: 0.9,
  },

  labelActive: {
    opacity: 1,
  },
};

export default memo(BottomNav);