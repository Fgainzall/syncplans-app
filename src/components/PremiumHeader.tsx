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
import IntegrationsDrawer from "@/components/IntegrationsDrawer";
import LogoutButton from "@/components/LogoutButton";
import {
  getInitials,
  getMyProfile,
  type Profile as UserProfile,
} from "@/lib/profilesDb";
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
} from "@/styles/design-tokens";

type TabKey = UsageMode | "other";

type Tab = {
  key: TabKey;
  label: string;
  hint: string;
  dot: string;
};

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

const NAV_MODE: NavigationMode = "replace";

const TABS: Tab[] = [
  { key: "solo", label: "Personal", hint: "Solo tú", dot: "#FBBF24" },
  { key: "pair", label: "Pareja", hint: "2 personas", dot: "#F87171" },
  { key: "family", label: "Familia", hint: "Varios", dot: "#60A5FA" },
  {
    key: "other",
    label: "Compartido",
    hint: "Amigos, equipos",
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

  let active: string;
  if (mode === "solo") active = "var(--sp-personal)";
  else if (mode === "pair") active = "var(--sp-pair)";
  else if (mode === "family") active = "var(--sp-family)";
  else active = "var(--sp-other)";

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
    if (current && currentType === wantType) {
      return String(existing);
    }
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

function useIsMobileWidth(maxWidth = layout.mobileBreakpoint) {
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

    // @ts-ignore legacy support
    mq.addListener(apply);
    return () => {
      // @ts-ignore legacy support
      mq.removeListener(apply);
    };
  }, [maxWidth]);

  return isMobile;
}

function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  onOutside: () => void
) {
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onOutside();
    }

    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

function getAutoTitle(pathname: string) {
  if (pathname.startsWith("/panel")) return "Panel";
  if (pathname.startsWith("/planes")) return "Planes";
  if (pathname.startsWith("/profile")) return "Perfil";
  if (pathname.startsWith("/conflicts")) return "Conflictos";
  if (pathname.startsWith("/groups")) return "Grupos";
  if (pathname.startsWith("/members")) return "Miembros";
  if (pathname.startsWith("/invitations")) return "Invitaciones";
  if (pathname.startsWith("/events")) return "Eventos";
  if (pathname.startsWith("/summary")) return "Resumen";
  if (pathname.startsWith("/calendar")) return "Calendario";
  if (pathname.startsWith("/settings")) return "Ajustes";
  return "Calendario";
}

function getAutoSubtitle(pathname: string) {
  if (pathname.startsWith("/groups")) {
    return "Organiza tus grupos y mantén clara la estructura compartida.";
  }
  if (pathname.startsWith("/invitations")) {
    return "Gestiona invitaciones pendientes y accesos al espacio compartido.";
  }
  if (pathname.startsWith("/events")) {
    return "Revisa y ordena tus eventos sin perder contexto.";
  }
  if (pathname.startsWith("/summary")) {
    return "La vista operativa de lo que viene en tu tiempo compartido.";
  }
  if (pathname.startsWith("/calendar")) {
    return "Visualiza tu tiempo con claridad y detecta choques rápido.";
  }
  if (pathname.startsWith("/conflicts")) {
    return "Decide conflictos antes de que se conviertan en fricción.";
  }
  if (pathname.startsWith("/panel")) {
    return "Administra la estructura que sostiene la coordinación.";
  }
  if (pathname.startsWith("/settings")) {
    return "Ajusta la experiencia, permisos e integraciones de tu espacio.";
  }
  if (pathname.startsWith("/planes")) {
    return "Compara planes y desbloquea funciones premium.";
  }
  return "Organiza tu día sin conflictos de horario.";
}

export default function PremiumHeader({
  title,
  subtitle,
  rightSlot,
  mobileNav: _mobileNav = "bottom",
}: PremiumHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobileWidth();

  const [group, setGroup] = useState<GroupState | null>(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(userMenuRef, () => setUserMenuOpen(false));

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

        if (!profile) {
          setHeaderUser({ name: "Tú", initials: "T" });
          return;
        }

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
      const notifications = await getMyNotifications(50);
      const unread = (notifications ?? []).filter(
        (x: any) => !x.read_at || x.read_at === ""
      ).length;
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
  }, [openNotif, pathname, refreshBadge]);

  const activeTab = useMemo(
    () => TABS.find((t) => t.key === activeMode) ?? TABS[0],
    [activeMode]
  );

  const kickerLabel = useMemo(() => {
    const cleaned = normalizeGroupLabel((group as any)?.groupName ?? null);
    return cleaned ?? activeTab.label;
  }, [group, activeTab.label]);

  const finalTitle = title ?? getAutoTitle(pathname);
  const finalSubtitle = subtitle ?? getAutoSubtitle(pathname);

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

  const navItems = [
    { label: "Resumen", path: "/summary", active: pathname.startsWith("/summary") },
    { label: "Calendario", path: "/calendar", active: pathname.startsWith("/calendar") },
    { label: "Eventos", path: "/events", active: pathname.startsWith("/events") },
    {
      label: "Conflictos",
      path: "/conflicts/detected",
      active: pathname.startsWith("/conflicts"),
    },
    { label: "Panel", path: "/panel", active: pathname.startsWith("/panel") },
    { label: "Grupos", path: "/groups", active: pathname.startsWith("/groups") },
    { label: "Miembros", path: "/members", active: pathname.startsWith("/members") },
    {
      label: "Invitaciones",
      path: "/invitations",
      active: pathname.startsWith("/invitations"),
    },
    { label: "Ajustes", path: "/settings", active: pathname.startsWith("/settings") },
    { label: "Planes", path: "/planes", active: pathname.startsWith("/planes") },
  ];

  return (
    <>
      <header style={isMobile ? styles.mobileWrap : styles.desktopWrap}>
        <div style={styles.backgroundGlow} />

        {isMobile ? (
          <>
            <div style={styles.mobileTopRow}>
              <div style={styles.mobileLeftCluster}>
                <button
                  type="button"
                  aria-label="Notificaciones"
                  title="Notificaciones"
                  onClick={() => setOpenNotif(true)}
                  style={styles.iconButton}
                >
                  🔔
                  {unreadCount > 0 && (
                    <span style={styles.badgeCount}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              <div style={styles.mobileCenterBlock}>
                <div style={styles.kickerRowCenter}>
                  <span style={{ ...styles.dot, background: activeTab.dot }} />
                  <span style={styles.kickerTextMobile}>{kickerLabel}</span>
                </div>
                <h1 style={styles.mobileTitle}>{finalTitle}</h1>
              </div>

              <div ref={userMenuRef} style={styles.userMenuAnchor}>
                <button
                  type="button"
                  style={styles.mobileUserButton}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title="Cuenta"
                >
                  <div style={styles.userAvatar}>{headerUser?.initials ?? "T"}</div>
                </button>

                {userMenuOpen && (
                  <div style={styles.mobileMenu}>
                    <div style={styles.menuHeader}>
                      <div style={styles.menuAvatar}>
                        {headerUser?.initials ?? "T"}
                      </div>
                      <div style={styles.menuName}>{headerUser?.name ?? "Tú"}</div>
                    </div>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/groups");
                      }}
                    >
                      Grupos
                    </button>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/members");
                      }}
                    >
                      Miembros
                    </button>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/invitations");
                      }}
                    >
                      Invitaciones
                    </button>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/settings");
                      }}
                    >
                      Ajustes
                    </button>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/planes");
                      }}
                    >
                      Planes
                    </button>

                    <div style={styles.menuDivider} />
                    <div style={styles.logoutWrap}>
                      <LogoutButton />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p style={styles.mobileSubtitle}>{finalSubtitle}</p>

            <div style={styles.mobileActionsRow}>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => {
                  setUserMenuOpen(false);
                  setOpenIntegrations(true);
                }}
                title="Conectar y sincronizar calendarios externos"
              >
                Conectar
              </button>

              {rightSlot ?? (
                <button type="button" style={styles.primaryButton} onClick={onNewEvent}>
                  + Evento
                </button>
              )}
            </div>

            <div style={styles.tabsWrap}>
              <div style={styles.tabsGridMobile}>
                {TABS.map((tab) => {
                  const isActive = tab.key === activeMode;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onPickMode(tab.key)}
                      style={{
                        ...styles.modeTabMobile,
                        ...(isActive ? styles.modeTabActive : {}),
                      }}
                    >
                      <span style={{ ...styles.tabDot, background: tab.dot }} />
                      <span style={styles.modeTabLabel}>{tab.label}</span>
                      <span style={styles.modeTabHint}>{tab.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={styles.desktopTopRow}>
              <div style={styles.desktopTitleBlock}>
                <div style={styles.kickerRow}>
                  <span style={{ ...styles.dot, background: activeTab.dot }} />
                  <span style={styles.kickerText}>{kickerLabel}</span>
                </div>

                <h1 style={styles.desktopTitle}>{finalTitle}</h1>
                <p style={styles.desktopSubtitle}>{finalSubtitle}</p>
              </div>

              <div style={styles.desktopActions}>
                <button
                  type="button"
                  aria-label="Notificaciones"
                  title="Notificaciones"
                  onClick={() => setOpenNotif(true)}
                  style={styles.iconButton}
                >
                  🔔
                  {unreadCount > 0 && (
                    <span style={styles.badgeCount}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>

                <div ref={userMenuRef} style={styles.userMenuAnchor}>
                  <button
                    type="button"
                    style={styles.userChip}
                    onClick={() => setUserMenuOpen((v) => !v)}
                    title="Cuenta y opciones"
                  >
                    <div style={styles.userAvatar}>{headerUser?.initials ?? "T"}</div>
                    <span style={styles.userLabel}>{headerUser?.name ?? "Tú"}</span>
                  </button>

                  {userMenuOpen && (
                    <div style={styles.desktopMenu}>
                      <div style={styles.menuHeader}>
                        <div style={styles.menuAvatar}>
                          {headerUser?.initials ?? "T"}
                        </div>
                        <div style={styles.menuName}>{headerUser?.name ?? "Tú"}</div>
                      </div>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/groups");
                        }}
                      >
                        Grupos
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/members");
                        }}
                      >
                        Miembros
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/invitations");
                        }}
                      >
                        Invitaciones
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/settings");
                        }}
                      >
                        Ajustes
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/planes");
                        }}
                      >
                        Planes
                      </button>

                      <div style={styles.menuDivider} />
                      <div style={styles.logoutWrap}>
                        <LogoutButton />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  style={styles.secondaryButton}
                  onClick={() => setOpenIntegrations(true)}
                  title="Conectar y sincronizar calendarios externos"
                >
                  Conectar
                </button>

                {rightSlot ?? (
                  <button type="button" style={styles.primaryButton} onClick={onNewEvent}>
                    + Evento
                  </button>
                )}
              </div>
            </div>

            <div style={styles.tabsWrap}>
              <div style={styles.tabsGridDesktop}>
                {TABS.map((tab) => {
                  const isActive = tab.key === activeMode;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => onPickMode(tab.key)}
                      style={{
                        ...styles.modeTabDesktop,
                        ...(isActive ? styles.modeTabActive : {}),
                      }}
                    >
                      <span style={{ ...styles.tabDot, background: tab.dot }} />
                      <span style={styles.modeTabLabel}>{tab.label}</span>
                      <span style={styles.modeTabHint}>{tab.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <nav style={styles.topNav}>
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.path)}
                  style={{
                    ...styles.navPill,
                    ...(item.active ? styles.navPillActive : {}),
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </>
        )}
      </header>

      <NotificationsDrawer
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        navigationMode={NAV_MODE}
        onUnreadChange={(n) => setUnreadCount(n)}
      />

      <IntegrationsDrawer
        open={openIntegrations}
        onClose={() => setOpenIntegrations(false)}
        onSynced={onSyncedFromDrawer}
      />
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  desktopWrap: {
    position: "sticky",
    top: 10,
    zIndex: 20,
    overflow: "visible",
    borderRadius: radii.xl,
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.88))",
    border: `1px solid ${colors.borderSubtle}`,
    boxShadow: shadows.card,
    backdropFilter: "blur(16px)",
    marginBottom: spacing.xl,
  },
  mobileWrap: {
    position: "sticky",
    top: 8,
    zIndex: 20,
    overflow: "visible",
    borderRadius: 20,
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.90))",
    border: `1px solid ${colors.borderSubtle}`,
    boxShadow: shadows.card,
    backdropFilter: "blur(16px)",
    marginBottom: spacing.lg,
  },
  backgroundGlow: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background:
      "radial-gradient(700px 260px at 10% -10%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(700px 260px at 90% -10%, rgba(168,85,247,0.15), transparent 55%)",
    pointerEvents: "none",
  },

  desktopTopRow: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
  },
  desktopTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  desktopActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },

  mobileTopRow: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "40px 1fr 40px",
    alignItems: "center",
    gap: 10,
  },
  mobileLeftCluster: {
    display: "flex",
    justifyContent: "flex-start",
  },
  mobileCenterBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 0,
    gap: 4,
  },

  kickerRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  kickerRowCenter: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    maxWidth: "100%",
  },
  kickerText: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#D6E8FF",
    letterSpacing: 0.2,
  },
  kickerTextMobile: {
    margin: 0,
    fontSize: 11,
    fontWeight: 800,
    color: "#D6E8FF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.06)",
    flexShrink: 0,
  },

  desktopTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: -0.7,
    color: colors.textPrimary,
  },
  desktopSubtitle: {
    margin: "8px 0 0",
    maxWidth: 720,
    fontSize: 14,
    lineHeight: 1.5,
    color: colors.textSecondary,
    fontWeight: 600,
  },

  mobileTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    textAlign: "center",
  },
  mobileSubtitle: {
    position: "relative",
    zIndex: 1,
    margin: "12px 0 0",
    fontSize: 12,
    lineHeight: 1.5,
    color: colors.textSecondary,
    fontWeight: 600,
  },

  iconButton: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    cursor: "pointer",
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeCount: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: radii.full,
    background: "rgba(99,102,241,0.96)",
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 0 0 2px rgba(15,23,42,0.95), 0 10px 25px rgba(0,0,0,0.35)",
  },

  secondaryButton: {
    height: 42,
    padding: "0 16px",
    borderRadius: 12,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    height: 42,
    padding: "0 18px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.26), rgba(168,85,247,0.24))",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  mobileActionsRow: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },

  tabsWrap: {
    position: "relative",
    zIndex: 1,
    marginTop: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: `1px solid ${colors.borderSubtle}`,
    padding: 8,
  },
  tabsGridDesktop: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  tabsGridMobile: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
  },
  modeTabDesktop: {
    minHeight: 54,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.55)",
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gridTemplateRows: "1fr 1fr",
    alignItems: "center",
    gap: "0 10px",
    padding: "10px 12px",
    cursor: "pointer",
    color: colors.textPrimary,
    textAlign: "left",
  },
  modeTabMobile: {
    minHeight: 50,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.55)",
    display: "grid",
    gridTemplateColumns: "14px 1fr",
    gridTemplateRows: "1fr 1fr",
    alignItems: "center",
    gap: "0 8px",
    padding: "8px 10px",
    cursor: "pointer",
    color: colors.textPrimary,
    textAlign: "left",
  },
  modeTabActive: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  tabDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    gridRow: "1 / span 2",
  },
  modeTabLabel: {
    fontSize: 13,
    fontWeight: 900,
    color: colors.textPrimary,
  },
  modeTabHint: {
    fontSize: 11,
    fontWeight: 650,
    color: colors.textSecondary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  topNav: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  navPill: {
    height: 34,
    padding: "0 12px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  navPillActive: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
  },

  userMenuAnchor: {
    position: "relative",
    display: "inline-flex",
  },
  userChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    maxWidth: 220,
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(15,23,42,0.84)",
    cursor: "pointer",
  },
  mobileUserButton: {
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(15,23,42,0.84)",
    borderRadius: radii.full,
    padding: 4,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    border: "1px solid rgba(56,189,248,0.7)",
    background: "rgba(8,47,73,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    color: "#E0F2FE",
  },
  userLabel: {
    fontSize: 12,
    fontWeight: 750,
    color: colors.textPrimary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  desktopMenu: {
    position: "absolute",
    top: "115%",
    right: 0,
    minWidth: 220,
    borderRadius: 16,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(15,23,42,0.97)",
    boxShadow: shadows.soft,
    padding: 8,
    zIndex: 80,
  },
  mobileMenu: {
    position: "absolute",
    top: "115%",
    right: 0,
    minWidth: 190,
    borderRadius: 16,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(15,23,42,0.97)",
    boxShadow: shadows.soft,
    padding: 8,
    zIndex: 80,
  },
  menuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px 8px",
  },
  menuAvatar: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    border: "1px solid rgba(56,189,248,0.7)",
    background: "rgba(8,47,73,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    color: "#E0F2FE",
  },
  menuName: {
    fontSize: 12,
    fontWeight: 800,
    color: colors.textPrimary,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 10px",
    cursor: "pointer",
  },
  menuDivider: {
    margin: "6px 0",
    height: 1,
    background: colors.borderSubtle,
  },
  logoutWrap: {
    padding: "4px 6px",
  },
};