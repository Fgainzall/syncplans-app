"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getGroupState,
  setMode,
  type GroupState,
  type UsageMode,
} from "@/lib/groups";
import NotificationsDrawer, {
  type NavigationMode,
} from "./NotificationsDrawer";
import {
  getMyProfile,
  getInitials,
  type Profile as UserProfile,
} from "@/lib/profilesDb";
import IntegrationsDrawer from "@/components/IntegrationsDrawer";
import LogoutButton from "@/components/LogoutButton";

type TabKey = UsageMode | "other";
type MobileNavVariant = "top" | "bottom" | "none";

type UiToast = {
  deleted: number;
  skipped: number;
  appliedCount: number;
} | null;

type PremiumHeaderProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  mobileNav?: MobileNavVariant;
  highlightId?: string | null;
  appliedToast?: UiToast;
};

type HeaderUser = {
  name: string;
  initials: string;
};

type Tab = {
  key: TabKey;
  label: string;
  hint: string;
  dot: string;
};

const TABS: Tab[] = [
  { key: "solo", label: "Personal", hint: "Solo tú", dot: "#FBBF24" },
  { key: "pair", label: "Pareja", hint: "2 personas", dot: "#F87171" },
  { key: "family", label: "Familia", hint: "Varios", dot: "#60A5FA" },
  {
    key: "other",
    label: "Compartido",
    hint: "Amigos o equipos",
    dot: "#A855F7",
  },
];

function applyThemeVars(mode: UsageMode | "other") {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--sp-personal", "#FBBF24");
  root.style.setProperty("--sp-pair", "#F87171");
  root.style.setProperty("--sp-family", "#60A5FA");
  root.style.setProperty("--sp-other", "#A855F7");

  let active = "var(--sp-personal)";
  if (mode === "pair") active = "var(--sp-pair)";
  else if (mode === "family") active = "var(--sp-family)";
  else if (mode === "other") active = "var(--sp-other)";

  root.style.setProperty("--sp-active", active);
}

async function ensureActiveGroupForMode(
  mode: UsageMode | "other"
): Promise<string | null> {
  if (mode === "solo") return null;

  const { getActiveGroupIdFromDb, setActiveGroupIdInDb } = await import(
    "@/lib/activeGroup"
  );
  const { getMyGroups } = await import("@/lib/groupsDb");

  const existing = await getActiveGroupIdFromDb().catch(() => null);
  const groups = await getMyGroups();

  if (!groups.length) return null;

  const wantType = String(mode).toLowerCase();

  if (existing) {
    const current = groups.find((g: any) => String(g.id) === String(existing));
    const currentType = String(current?.type ?? "").toLowerCase();
    if (current && currentType === wantType) return String(existing);
  }

  const match = groups.find(
    (g: any) => String(g.type ?? "").toLowerCase() === wantType
  );
  const pick = match?.id ?? groups[0]?.id ?? null;

  if (pick) {
    await setActiveGroupIdInDb(String(pick));
    return String(pick);
  }

  return null;
}

function normalizeGroupLabel(input?: string | null) {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  if (/^activo$/i.test(raw)) return "Grupo actual";

  if (/^activo\s*[:\-–]\s*/i.test(raw)) {
    const cleaned = raw.replace(/^activo\s*[:\-–]\s*/i, "").trim();
    return cleaned || "Grupo actual";
  }

  return raw;
}

function useIsMobileWidth(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(!!mq.matches);

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    // @ts-ignore
    mq.addListener(apply);
    return () => {
      // @ts-ignore
      mq.removeListener(apply);
    };
  }, [maxWidth]);

  return isMobile;
}

function BellIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 18H9M18 16V11C18 7.686 15.314 5 12 5C8.686 5 6 7.686 6 11V16L4.75 17.25C4.435 17.565 4.658 18.1 5.104 18.1H18.896C19.342 18.1 19.565 17.565 19.25 17.25L18 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 20C13.384 20.598 12.738 21 12 21C11.262 21 10.616 20.598 10.27 20"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LinkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 14L14 10M8.5 16.5L6.879 18.121C5.707 19.293 3.807 19.293 2.636 18.121C1.464 16.95 1.464 15.05 2.636 13.879L6.879 9.636C8.05 8.464 9.95 8.464 11.121 9.636M15.5 7.5L17.121 5.879C18.293 4.707 20.193 4.707 21.364 5.879C22.536 7.05 22.536 8.95 21.364 10.121L17.121 14.364C15.95 15.536 14.05 15.536 12.879 14.364"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NavPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...S.navPill,
        ...(active ? S.navPillActive : {}),
      }}
    >
      {label}
    </button>
  );
}

export default function PremiumHeader({
  title,
  subtitle,
  rightSlot,
  mobileNav: _mobileNav = "bottom",
}: PremiumHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const NAV_MODE: NavigationMode = "replace";

  const [group, setGroup] = useState<GroupState | null>(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isMobile = useIsMobileWidth(768);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const g = getGroupState();
    setGroup(g);
    applyThemeVars((g.mode as TabKey) ?? "solo");
  }, []);

  const activeMode: TabKey = (group?.mode as TabKey) ?? "solo";

  useEffect(() => {
    applyThemeVars(activeMode);
  }, [activeMode]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const profile: UserProfile | null = await getMyProfile();
        if (!alive) return;

        if (profile) {
          const display = (
            profile.display_name ??
            `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
          ).trim();

          const name = display || "Tú";
          const initials = getInitials({
            first_name: profile.first_name,
            last_name: profile.last_name,
            display_name: profile.display_name,
          });

          setHeaderUser({ name, initials });
        } else {
          setHeaderUser({ name: "Tú", initials: "T" });
        }
      } catch {
        if (!alive) return;
        setHeaderUser({ name: "Tú", initials: "T" });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const { getMyNotifications } = await import("@/lib/notificationsDb");
      const list = await getMyNotifications(50);
      const unread = (list ?? []).filter((x: any) => !x.read_at).length;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge, openNotif, pathname]);

  useEffect(() => {
    if (!userMenuOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [userMenuOpen]);

  const activeTab = useMemo(
    () => TABS.find((t) => t.key === activeMode) ?? TABS[0],
    [activeMode]
  );

  const kickerLabel = useMemo(() => {
    const cleaned = normalizeGroupLabel((group as any)?.groupName ?? null);
    return cleaned ?? activeTab.label;
  }, [group, activeTab.label]);

  const autoTitle = useMemo(() => {
    if (pathname.startsWith("/panel")) return "Panel";
    if (pathname.startsWith("/planes")) return "Planes";
    if (pathname.startsWith("/profile")) return "Cuenta";
    if (pathname.startsWith("/conflicts")) return "Conflictos";
    if (pathname.startsWith("/groups")) return "Grupos";
    if (pathname.startsWith("/members")) return "Miembros";
    if (pathname.startsWith("/invitations")) return "Invitaciones";
    if (pathname.startsWith("/events")) return "Eventos";
    if (pathname.startsWith("/summary")) return "Resumen";
    if (pathname.startsWith("/calendar")) return "Calendario";
    if (pathname.startsWith("/settings")) return "Ajustes";
    return "Calendario";
  }, [pathname]);

  const finalTitle = title ?? autoTitle;
  const finalSubtitle =
    subtitle ?? "Organiza tu tiempo con una sola versión de la verdad.";

  async function onNewEvent() {
    try {
      if (activeMode === "solo") {
        router.push("/events/new/details?type=personal");
        return;
      }

      const gid = await ensureActiveGroupForMode(activeMode);
      if (!gid) {
        router.push("/groups/new");
        return;
      }

      router.push(
        `/events/new/details?type=group&groupId=${encodeURIComponent(gid)}`
      );
    } catch {
      router.push("/events/new/details?type=personal");
    }
  }

  async function onPickMode(nextMode: TabKey) {
    const next = setMode(nextMode as UsageMode);
    setGroup(next);
    applyThemeVars(nextMode);

    if (nextMode === "solo") return;

    try {
      await ensureActiveGroupForMode(nextMode);
    } catch {
      // noop
    }
  }

  const onSyncedFromDrawer = useCallback((imported: number) => {
    window.dispatchEvent(
      new CustomEvent("sp:google-synced", {
        detail: { imported },
      })
    );
  }, []);

  const desktopNav = [
    { label: "Resumen", href: "/summary", active: pathname.startsWith("/summary") },
    { label: "Calendario", href: "/calendar", active: pathname.startsWith("/calendar") },
    { label: "Eventos", href: "/events", active: pathname.startsWith("/events") },
    {
      label: "Conflictos",
      href: "/conflicts/detected",
      active: pathname.startsWith("/conflicts"),
    },
    { label: "Panel", href: "/panel", active: pathname.startsWith("/panel") },
  ];

  const userMenuItems = [
    { label: "Grupos", href: "/groups" },
    { label: "Miembros", href: "/members" },
    { label: "Invitaciones", href: "/invitations" },
    { label: "Ajustes", href: "/settings" },
    { label: "Planes", href: "/planes" },
  ];

  const defaultPrimaryAction = (
    <button type="button" style={S.primaryAction} onClick={onNewEvent}>
      <PlusIcon size={16} />
      <span>Nuevo evento</span>
    </button>
  );

  return (
    <>
      <header style={S.wrap}>
        <div style={S.chrome}>
          <div style={S.topRow}>
            <div style={S.identityBlock}>
              <div style={S.kickerRow}>
                <span style={{ ...S.dot, background: activeTab.dot }} />
                <span style={S.kickerText}>{kickerLabel}</span>
              </div>

              <div style={S.titleBlock}>
                <h1 style={S.title}>{finalTitle}</h1>
                <p style={S.subtitle}>{finalSubtitle}</p>
              </div>
            </div>

            <div style={S.actionsCluster}>
              <button
                type="button"
                style={S.ghostAction}
                onClick={() => setOpenIntegrations(true)}
                title="Conectar calendarios externos"
              >
                <LinkIcon size={16} />
                <span>{isMobile ? "Conectar" : "Conectar calendario"}</span>
              </button>

              {rightSlot ?? defaultPrimaryAction}

              <div style={S.notifWrap}>
                <button
                  type="button"
                  style={S.iconButton}
                  aria-label="Notificaciones"
                  title="Notificaciones"
                  onClick={() => setOpenNotif(true)}
                >
                  <BellIcon />
                </button>

                {unreadCount > 0 ? (
                  <span style={S.badgeCount}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </div>

              <div ref={menuRef} style={S.userWrap}>
                <button
                  type="button"
                  style={isMobile ? S.mobileUserChip : S.userChip}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title="Cuenta y accesos"
                >
                  <div style={S.userAvatar}>{headerUser?.initials ?? "T"}</div>
                  {!isMobile ? (
                    <>
                      <span style={S.userLabel}>{headerUser?.name ?? "Tú"}</span>
                      <ChevronRightIcon size={14} />
                    </>
                  ) : null}
                </button>

                {userMenuOpen ? (
                  <div style={isMobile ? S.userMenuMobile : S.userMenuDesktop}>
                    <div style={S.userMenuHeader}>
                      <div style={S.userMenuAvatar}>
                        {headerUser?.initials ?? "T"}
                      </div>
                      <div>
                        <div style={S.userMenuName}>{headerUser?.name ?? "Tú"}</div>
                        <div style={S.userMenuHint}>Cuenta y accesos secundarios</div>
                      </div>
                    </div>

                    <div style={S.userMenuBody}>
                      {userMenuItems.map((item) => (
                        <button
                          key={item.href}
                          type="button"
                          style={S.userMenuItem}
                          onClick={() => {
                            setUserMenuOpen(false);
                            router.push(item.href);
                          }}
                        >
                          <span>{item.label}</span>
                          <ChevronRightIcon size={14} />
                        </button>
                      ))}

                      <div style={S.userMenuDivider} />

                      <div style={S.userMenuLogout}>
                        <LogoutButton />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div style={S.tabsWrap}>
            <div style={S.tabsInner}>
              {TABS.map((tab) => {
                const isActive = tab.key === activeMode;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    style={{
                      ...S.tabButton,
                      ...(isActive ? S.tabButtonActive : {}),
                    }}
                    onClick={() => onPickMode(tab.key)}
                  >
                    <span style={{ ...S.tabDot, background: tab.dot }} />
                    <span style={S.tabTextBlock}>
                      <span style={S.tabLabel}>{tab.label}</span>
                      <span style={S.tabHint}>{tab.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

             {!isMobile ? (
            <>
              <nav style={S.navRow}>
                {desktopNav.map((item) => (
                  <NavPill
                    key={item.href}
                    label={item.label}
                    active={item.active}
                    onClick={() => router.push(item.href)}
                  />
                ))}
              </nav>

              <div style={S.secondaryRow}>
                {userMenuItems.map((item) => {
                  const active = pathname.startsWith(item.href);

                  return (
                    <button
                      key={item.href}
                      type="button"
                      style={{
                        ...S.secondaryPill,
                        ...(active ? S.secondaryPillActive : {}),
                      }}
                      onClick={() => router.push(item.href)}
                    >
                      {item.label}
                    </button>
                  );
                })}

                <button
                  type="button"
                  style={{
                    ...S.secondaryPill,
                    ...(pathname.startsWith("/profile")
                      ? S.secondaryPillActive
                      : {}),
                  }}
                  onClick={() => router.push("/profile")}
                >
                  Cuenta
                </button>
              </div>
            </>
          ) : null} 
        </div>
      </header>

      <NotificationsDrawer
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        navigationMode={NAV_MODE}
        onUnreadChange={(count) => setUnreadCount(count)}
      />

      <IntegrationsDrawer
        open={openIntegrations}
        onClose={() => setOpenIntegrations(false)}
        onSynced={onSyncedFromDrawer}
      />
    </>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    position: "relative",
    zIndex: 10,
    marginBottom: 14,
  },
  secondaryRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },

  secondaryPill: {
    height: 32,
    padding: "0 12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.025)",
    color: "rgba(148,163,184,0.92)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },

  secondaryPillActive: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.07)",
    color: "#F8FAFC",
  },
  chrome: {
    borderRadius: 26,
    padding: "14px 14px 12px",
    background:
      "linear-gradient(180deg, rgba(10,16,30,0.96), rgba(9,14,27,0.92))",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow:
      "0 22px 60px rgba(2,6,23,0.42), inset 0 1px 0 rgba(255,255,255,0.05)",
    backdropFilter: "blur(18px)",
  },

  topRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  identityBlock: {
    minWidth: 0,
    flex: "1 1 360px",
  },

  kickerRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    marginBottom: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.06)",
    flexShrink: 0,
  },

  kickerText: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(226,232,240,0.92)",
    letterSpacing: 0.2,
  },

  titleBlock: {
    minWidth: 0,
  },

  title: {
    margin: 0,
    fontSize: "clamp(26px, 3.3vw, 40px)",
    lineHeight: 1.05,
    fontWeight: 950,
    color: "#F8FAFC",
    letterSpacing: -0.8,
  },

  subtitle: {
    margin: "8px 0 0",
    maxWidth: 720,
    fontSize: "clamp(13px, 1.5vw, 15px)",
    lineHeight: 1.55,
    color: "rgba(191,219,254,0.82)",
  },

  actionsCluster: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    flex: "0 0 auto",
  },

  ghostAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 44,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(241,245,249,0.96)",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
  },

  primaryAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    height: 44,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(168,85,247,0.18))",
    color: "#F8FAFC",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(56,189,248,0.16)",
  },

  notifWrap: {
    position: "relative",
    display: "inline-flex",
  },

  iconButton: {
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.05)",
    color: "#F8FAFC",
    cursor: "pointer",
  },

  badgeCount: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    padding: "0 5px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "#FB7185",
    color: "#FFF",
    fontSize: 10,
    fontWeight: 900,
    border: "2px solid rgba(15,23,42,0.92)",
    boxSizing: "border-box",
  },

  userWrap: {
    position: "relative",
  },

  userChip: {
    height: 44,
    padding: "0 10px 0 8px",
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.05)",
    color: "#F8FAFC",
    cursor: "pointer",
  },

  mobileUserChip: {
    width: 44,
    height: 44,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.05)",
    color: "#F8FAFC",
    cursor: "pointer",
  },

  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(168,85,247,0.28))",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#F8FAFC",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.3,
    flexShrink: 0,
  },

  userLabel: {
    fontSize: 13,
    fontWeight: 800,
    maxWidth: 132,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  userMenuDesktop: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    width: 280,
    borderRadius: 18,
    background: "rgba(8,13,24,0.98)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 26px 70px rgba(2,6,23,0.52)",
    overflow: "hidden",
    zIndex: 30,
  },

  userMenuMobile: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    width: "min(320px, calc(100vw - 24px))",
    borderRadius: 18,
    background: "rgba(8,13,24,0.98)",
    border: "1px solid rgba(148,163,184,0.18)",
    boxShadow: "0 26px 70px rgba(2,6,23,0.52)",
    overflow: "hidden",
    zIndex: 30,
  },

  userMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderBottom: "1px solid rgba(148,163,184,0.12)",
    background: "rgba(255,255,255,0.03)",
  },

  userMenuAvatar: {
    width: 36,
    height: 36,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(168,85,247,0.28))",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#F8FAFC",
    fontSize: 13,
    fontWeight: 900,
  },

  userMenuName: {
    fontSize: 14,
    fontWeight: 900,
    color: "#F8FAFC",
  },

  userMenuHint: {
    marginTop: 3,
    fontSize: 12,
    color: "rgba(148,163,184,0.86)",
  },

  userMenuBody: {
    padding: 10,
  },

  userMenuItem: {
    width: "100%",
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "0 12px",
    borderRadius: 12,
    border: "none",
    background: "transparent",
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },

  userMenuDivider: {
    height: 1,
    background: "rgba(148,163,184,0.14)",
    margin: "10px 2px",
  },

  userMenuLogout: {
    padding: "2px 2px 4px",
  },

  tabsWrap: {
    marginTop: 14,
  },

  tabsInner: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
  },

  tabButton: {
    minHeight: 54,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(255,255,255,0.035)",
    color: "rgba(226,232,240,0.84)",
    cursor: "pointer",
    textAlign: "left",
    minWidth: 0,
  },

  tabButtonActive: {
    border: "1px solid rgba(255,255,255,0.18)",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    color: "#F8FAFC",
  },

  tabDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },

  tabTextBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },

  tabLabel: {
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.1,
  },

  tabHint: {
    fontSize: 11,
    color: "rgba(148,163,184,0.86)",
    lineHeight: 1.2,
  },

  navRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 14,
    paddingTop: 14,
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },

  navPill: {
    height: 36,
    padding: "0 14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.82)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },

  navPillActive: {
    border: "1px solid rgba(255,255,255,0.22)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(168,85,247,0.12))",
    color: "#F8FAFC",
  },
};