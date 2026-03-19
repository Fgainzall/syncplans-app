// src/components/BottomNav.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type BottomNavKey =
  | "summary"
  | "calendar"
  | "events"
  | "conflicts"
  | "panel"
  | "more";

type NavItem = {
  key: BottomNavKey;
  label: string;
  path?: string;
  aria: string;
};

type MoreLink = {
  label: string;
  path: string;
  description: string;
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

function MoreIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12H5.01"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12H12.01"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 12H19.01"
        stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
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
    key: "more",
    label: "Más",
    aria: "Abrir más accesos",
  },
];

const MORE_LINKS: MoreLink[] = [
  {
    label: "Grupos",
    path: "/groups",
    description: "Administra tus grupos y espacios compartidos.",
  },
  {
    label: "Miembros",
    path: "/members",
    description: "Revisa quiénes forman parte de tu espacio.",
  },
  {
    label: "Invitaciones",
    path: "/invitations",
    description: "Acepta y revisa invitaciones pendientes.",
  },
  {
    label: "Ajustes",
    path: "/settings",
    description: "Controla preferencias, notificaciones e integraciones.",
  },
  {
    label: "Planes",
    path: "/planes",
    description: "Consulta tu plan y opciones premium.",
  },
  {
    label: "Perfil",
    path: "/profile",
    description: "Edita tus datos y tu cuenta.",
  },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreRelatedPath = useMemo(() => {
    return (
      pathname.startsWith("/groups") ||
      pathname.startsWith("/members") ||
      pathname.startsWith("/invitations") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/planes") ||
      pathname.startsWith("/profile")
    );
  }, [pathname]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [moreOpen]);

  const isActive = (key: BottomNavKey) => {
    if (key === "summary") return pathname.startsWith("/summary");
    if (key === "calendar") return pathname.startsWith("/calendar");
    if (key === "events") return pathname.startsWith("/events");
    if (key === "conflicts") return pathname.startsWith("/conflicts");
    if (key === "panel") return pathname.startsWith("/panel");
    if (key === "more") return moreOpen || isMoreRelatedPath;
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
      case "more":
        return <MoreIcon active={active} />;
      default:
        return null;
    }
  };

  const handlePrimaryClick = (item: NavItem) => {
    if (item.key === "more") {
      setMoreOpen((prev) => !prev);
      return;
    }

    if (item.path) {
      setMoreOpen(false);
      router.push(item.path);
    }
  };

  const handleMoreLink = (path: string) => {
    setMoreOpen(false);
    router.push(path);
  };

  return (
    <>
      {moreOpen && (
        <div
          style={S.backdrop}
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {moreOpen && (
        <div style={S.sheet} role="dialog" aria-modal="true" aria-label="Más accesos">
          <div style={S.sheetHeader}>
            <div>
              <div style={S.sheetEyebrow}>Navegación</div>
              <div style={S.sheetTitle}>Más accesos</div>
            </div>

            <button
              type="button"
              onClick={() => setMoreOpen(false)}
              style={S.closeButton}
              aria-label="Cerrar más accesos"
            >
              ✕
            </button>
          </div>

          <div style={S.sheetList}>
            {MORE_LINKS.map((link) => {
              const active = pathname.startsWith(link.path);
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => handleMoreLink(link.path)}
                  style={{
                    ...S.moreItem,
                    ...(active ? S.moreItemActive : {}),
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <div style={S.moreItemTopRow}>
                    <span style={S.moreItemLabel}>{link.label}</span>
                    <span style={S.moreItemArrow}>›</span>
                  </div>
                  <span style={S.moreItemDescription}>{link.description}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <nav style={S.wrap} aria-label="Navegación principal">
        <div style={S.inner}>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isActive(item.key);

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handlePrimaryClick(item)}
                aria-label={item.aria}
                aria-current={active ? "page" : undefined}
                aria-expanded={item.key === "more" ? moreOpen : undefined}
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
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 78,
    background: "rgba(2,6,23,0.48)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },

  sheet: {
    position: "fixed",
    left: 12,
    right: 12,
    bottom: 96,
    zIndex: 79,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "linear-gradient(180deg, rgba(9,14,25,0.97), rgba(7,11,20,0.97))",
    boxShadow:
      "0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
    padding: 14,
  },

  sheetHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  sheetEyebrow: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(147,197,253,0.78)",
    marginBottom: 4,
  },

  sheetTitle: {
    fontSize: 18,
    fontWeight: 800,
    lineHeight: 1.1,
    color: "#F8FBFF",
  },

  closeButton: {
    appearance: "none",
    WebkitAppearance: "none",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "#F8FBFF",
    width: 34,
    height: 34,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
  },

  sheetList: {
    display: "grid",
    gap: 10,
  },

  moreItem: {
    appearance: "none",
    WebkitAppearance: "none",
    width: "100%",
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "#F8FBFF",
    borderRadius: 18,
    padding: "14px 14px 13px",
    cursor: "pointer",
    display: "grid",
    gap: 6,
  },

  moreItemActive: {
    border: "1px solid rgba(96,165,250,0.34)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.15), rgba(124,58,237,0.10))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },

  moreItemTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  moreItemLabel: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.15,
  },

  moreItemArrow: {
    fontSize: 22,
    lineHeight: 1,
    color: "rgba(255,255,255,0.62)",
  },

  moreItemDescription: {
    fontSize: 12.5,
    lineHeight: 1.35,
    color: "rgba(226,232,240,0.72)",
  },

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
  },

  inner: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: 6,
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
    padding: "8px 4px 9px",
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
    fontSize: 10,
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "0.01em",
    whiteSpace: "nowrap",
    opacity: 0.92,
  },

  labelActive: {
    opacity: 1,
  },
};