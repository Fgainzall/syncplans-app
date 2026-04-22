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
import { getGroupState, type GroupState, type UsageMode } from "@/lib/groups";
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
  hasPremiumAccess,
} from "@/lib/premium";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import {
  colors,
  layout,
  radii,
  shadows,
  spacing,
} from "@/styles/design-tokens";

type TabKey = UsageMode | "other";

type ModeMeta = {
  label: string;
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
  sticky?: boolean;
  hideUpgradeCta?: boolean;
};

type HeaderUser = {
  name: string;
  initials: string;
};

type HeaderConflictSummary = {
  count: number;
  latestEventId: string | null;
};

const NAV_MODE: NavigationMode = "replace";

const MODE_META: Record<TabKey, ModeMeta> = {
  solo: { label: "Personal", dot: "#FBBF24" },
  pair: { label: "Pareja", dot: "#F87171" },
  family: { label: "Familia", dot: "#60A5FA" },
  other: { label: "Compartido", dot: "#A855F7" },
};

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

  const match = groups.find((g: any) => String(g.type ?? "").toLowerCase() === wantType);
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

function getConflictChipLabel(count: number) {
  return `Tienes ${count} conflicto${count === 1 ? "" : "s"}`;
}


function getUpgradeCtaLabel(pathname: string) {
  if (pathname.startsWith("/conflicts")) return "Ver Premium";
  if (pathname.startsWith("/calendar")) return "Mejorar";
  if (pathname.startsWith("/groups")) return "Ver Premium";
  if (pathname.startsWith("/panel")) return "Mejorar";
  return "Ver Premium";
}

function getUpgradeIntentLabel(pathname: string) {
  if (pathname.startsWith("/conflicts")) return "Conflictos";
  if (pathname.startsWith("/calendar")) return "Más contexto";
  if (pathname.startsWith("/groups")) return "Coordinación";
  if (pathname.startsWith("/panel")) return "Más control";
  if (pathname.startsWith("/invitations")) return "Invitaciones";
  return "Premium";
}
function useIsMobileWidth(maxWidth = layout.mobileBreakpoint) {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
  });

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
    return "Lo importante de tu tiempo compartido.";
  }
  if (pathname.startsWith("/calendar")) {
    return "Visualiza tu tiempo y detecta choques.";
  }
  if (pathname.startsWith("/conflicts")) {
    return "Decide conflictos antes de que se conviertan en fricción.";
  }
  if (pathname.startsWith("/panel")) {
    return "Administra tu coordinación compartida.";
  }
  if (pathname.startsWith("/settings")) {
    return "Ajusta integraciones, permisos y cuenta.";
  }
  if (pathname.startsWith("/planes")) {
    return "Compara planes y desbloquea más.";
  }
  return "Organiza tu día sin conflictos de horario.";
}

function getUpgradeMessage(pathname: string) {
  if (pathname.startsWith("/groups")) {
    return "Más claridad cuando tu coordinación compartida crece.";
  }
  if (pathname.startsWith("/invitations")) {
    return "Más contexto cuando nuevas personas entran a coordinar.";
  }
  if (pathname.startsWith("/calendar")) {
    return "Más contexto para anticipar choques antes de reaccionar.";
  }
  if (pathname.startsWith("/panel")) {
    return "Más visibilidad para sostener la coordinación sin fricción.";
  }
  return "Menos fricción y más claridad para coordinar mejor.";
}

export default function PremiumHeader({
  title,
  subtitle,
  rightSlot,
  mobileNav: _mobileNav = "bottom",
  sticky = true,
  hideUpgradeCta = false,
}: PremiumHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobileWidth();
  const [headerReady, setHeaderReady] = useState(false);

  const [group, setGroup] = useState<GroupState | null>(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [conflictSummary, setConflictSummary] = useState<HeaderConflictSummary>({
    count: 0,
    latestEventId: null,
  });
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(userMenuRef, () => setUserMenuOpen(false));

  const syncGroupState = useCallback(() => {
    const g = getGroupState();
    setGroup(g);
    applyThemeVars((g.mode as TabKey) ?? "solo");
  }, []);

  useEffect(() => {
    syncGroupState();

    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "syncplans.groupState.v3") {
        syncGroupState();
      }
    };

    const onModeChanged = () => syncGroupState();

    window.addEventListener("storage", onStorage);
    window.addEventListener("sp:mode-changed", onModeChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sp:mode-changed", onModeChanged);
    };
  }, [syncGroupState]);

  const activeMode: TabKey = (group?.mode as TabKey) ?? "solo";

  useEffect(() => {
    applyThemeVars(activeMode);
  }, [activeMode]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setHeaderReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const fetchedProfile: UserProfile | null = await getMyProfile();
        if (!alive) return;

        setProfile(fetchedProfile ?? null);

        if (!fetchedProfile) {
          setHeaderUser({ name: "Tú", initials: "T" });
          return;
        }

        const display = (
          fetchedProfile.display_name ??
          `${fetchedProfile.first_name ?? ""} ${fetchedProfile.last_name ?? ""}`
        ).trim();

        const name = display || "Tú";
        const initials = getInitials({
          first_name: fetchedProfile.first_name,
          last_name: fetchedProfile.last_name,
          display_name: fetchedProfile.display_name,
        });

        setHeaderUser({ name, initials });
      } catch {
        if (!alive) return;
        setHeaderUser({ name: "Tú", initials: "T" });
        setProfile(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const refreshBadge = useCallback(async () => {
    try {
      const {
        getMyNotifications,
        getUnreadConflictNotificationsSummary,
      } = await import("@/lib/notificationsDb");

      const [notifications, nextConflictSummary] = await Promise.all([
        getMyNotifications(50),
        getUnreadConflictNotificationsSummary().catch(() => ({
          count: 0,
          latestEventId: null,
        })),
      ]);

      const unread = (notifications ?? []).filter(
        (x: any) => !x.read_at || x.read_at === ""
      ).length;

      setUnreadCount(unread);
      setConflictSummary({
        count: Number(nextConflictSummary?.count ?? 0),
        latestEventId: nextConflictSummary?.latestEventId
          ? String(nextConflictSummary.latestEventId)
          : null,
      });
    } catch {
      setUnreadCount(0);
      setConflictSummary({ count: 0, latestEventId: null });
    }
  }, []);

  useEffect(() => {
    refreshBadge();
  }, [refreshBadge]);

  useEffect(() => {
    refreshBadge();
  }, [openNotif, pathname, refreshBadge]);

  const activeTab = useMemo<ModeMeta>(() => {
    return MODE_META[activeMode] ?? MODE_META.solo;
  }, [activeMode]);

  const groupDisplayName = useMemo(() => {
    const cleaned = normalizeGroupLabel((group as any)?.groupName ?? null);
    if (!cleaned) return null;
    if (cleaned === activeTab.label) return null;
    return cleaned;
  }, [group, activeTab.label]);

  const hasHeaderConflicts = headerReady && conflictSummary.count > 0;

  const openConflictCenter = useCallback(() => {
    setUserMenuOpen(false);

    if (conflictSummary.latestEventId) {
      router.push(
        `/conflicts/detected?eventId=${encodeURIComponent(
          conflictSummary.latestEventId
        )}`,
        { scroll: false }
      );
      return;
    }

    router.push("/conflicts/detected", { scroll: false });
  }, [conflictSummary.latestEventId, router]);

  const finalTitle = title ?? getAutoTitle(pathname);
  const finalSubtitle = subtitle ?? getAutoSubtitle(pathname);

  const hasPremium = useMemo(() => hasPremiumAccess(profile), [profile]);
  const upgradeMessage = useMemo(() => getUpgradeMessage(pathname), [pathname]);
  const upgradeCtaLabel = useMemo(() => getUpgradeCtaLabel(pathname), [pathname]);
  const upgradeIntentLabel = useMemo(() => getUpgradeIntentLabel(pathname), [pathname]);
  const shouldShowHeaderUpgrade = useMemo(() => {
    if (!headerReady) return false;
    if (hasPremium) return false;
    if (pathname.startsWith("/planes")) return false;
    if (pathname.startsWith("/auth")) return false;
    if (hideUpgradeCta) return false;
    return true;
  }, [hasPremium, headerReady, pathname, hideUpgradeCta]);


  useEffect(() => {
    if (!shouldShowHeaderUpgrade) return;

    trackEventOnce({
      onceKey: `premium_header_view:${pathname}:${isMobile ? "mobile" : "desktop"}`,
      scope: "session",
      event: "premium_viewed",
      metadata: {
        source: "premium_header",
        pathname,
        device: isMobile ? "mobile" : "desktop",
        context: activeMode,
      },
    });
  }, [activeMode, isMobile, pathname, shouldShowHeaderUpgrade]);

  const openPremiumFromHeader = useCallback((surface: "mobile" | "desktop") => {
    trackEvent({
      event: "premium_cta_clicked",
      metadata: {
        source: `premium_header_${surface}`,
        pathname,
        context: activeMode,
      },
    });
    router.push("/planes", { scroll: false });
  }, [activeMode, pathname, router]);

  async function onNewEvent() {
    try {
      if (activeMode === "solo") {
        router.push("/events/new/details?type=personal", { scroll: false });
        return;
      }

      const gid = await ensureActiveGroupForMode(activeMode);
      if (!gid) {
        router.push("/groups/new", { scroll: false });
        return;
      }

      router.push(
        `/events/new/details?type=group&groupId=${encodeURIComponent(gid)}` ,
        { scroll: false }
      );
    } catch {
      router.push("/events/new/details?type=personal", { scroll: false });
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
    {
      label: "Resumen",
      path: "/summary",
      active: pathname.startsWith("/summary"),
    },
    {
      label: "Calendario",
      path: "/calendar",
      active: pathname.startsWith("/calendar"),
    },
    {
      label: "Eventos",
      path: "/events",
      active: pathname.startsWith("/events"),
    },
    {
      label: "Conflictos",
      path: "/conflicts/detected",
      active: pathname.startsWith("/conflicts"),
    },
    { label: "Panel", path: "/panel", active: pathname.startsWith("/panel") },
    {
      label: "Grupos",
      path: "/groups",
      active: pathname.startsWith("/groups"),
    },
    {
      label: "Miembros",
      path: "/members",
      active: pathname.startsWith("/members"),
    },
    {
      label: "Invitaciones",
      path: "/invitations",
      active: pathname.startsWith("/invitations"),
    },
  ];

  return (
    <>
      <header style={isMobile ? { ...styles.mobileWrap, position: sticky ? "sticky" : "relative" } : { ...styles.desktopWrap, position: sticky ? "sticky" : "relative" } }>
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
                <div style={styles.contextKickerMobile}>Activo</div>

                <div style={styles.contextPillMobile}>
                  <span style={{ ...styles.dot, background: activeTab.dot }} />
                  <span style={styles.contextPillText}>{activeTab.label}</span>
                </div>

                {groupDisplayName ? (
                  <div style={styles.contextSubtleMobile}>{groupDisplayName}</div>
                ) : null}

                <h1 style={styles.mobileTitle}>{finalTitle}</h1>
              </div>

              <div ref={userMenuRef} style={styles.userMenuAnchor}>
                <button
                  type="button"
                  style={styles.mobileUserButton}
                  onClick={() => setUserMenuOpen((v) => !v)}
                  title="Cuenta"
                >
                  <div style={styles.userAvatar}>
                    {headerUser?.initials ?? "T"}
                  </div>
                </button>

                {userMenuOpen && (
                  <div style={styles.mobileMenu}>
                    <div style={styles.menuHeader}>
                      <div style={styles.menuAvatar}>
                        {headerUser?.initials ?? "T"}
                      </div>
                      <div style={styles.menuName}>
                        {headerUser?.name ?? "Tú"}
                      </div>
                    </div>
                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/profile", { scroll: false });
                      }}
                    >
                      Profile
                    </button>


                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/settings", { scroll: false });
                      }}
                    >
                      Ajustes
                    </button>

                    <button
                      type="button"
                      style={styles.menuItem}
                      onClick={() => {
                        setUserMenuOpen(false);
                        router.push("/planes", { scroll: false });
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

            {hasHeaderConflicts ? (
              <button
                type="button"
                onClick={openConflictCenter}
                style={styles.mobileConflictChip}
              >
                <span style={styles.conflictIndicatorDot} />
                {getConflictChipLabel(conflictSummary.count)}
              </button>
            ) : null}

            {shouldShowHeaderUpgrade ? (
              <div style={styles.mobileUpgradeBar}>
                <div style={styles.mobileUpgradeCopy}>
                  <span style={styles.upgradeMiniBadge}>
                    {upgradeIntentLabel}
                  </span>
                  <span>{upgradeMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => openPremiumFromHeader("mobile")}
                  style={styles.mobileUpgradeButton}
                >
                  {upgradeCtaLabel}
                </button>
              </div>
            ) : null}

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
                <button
                  type="button"
                  style={styles.primaryButton}
                  onClick={onNewEvent}
                >
                  + Evento
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div style={styles.desktopTopRow}>
              <div style={styles.desktopTitleBlock}>
                <div style={styles.contextKickerDesktop}>Contexto activo</div>

                <div style={styles.desktopContextRow}>
                  <div style={styles.contextPillDesktop}>
                    <span style={{ ...styles.dot, background: activeTab.dot }} />
                    <span style={styles.contextPillText}>{activeTab.label}</span>
                  </div>

                  {groupDisplayName ? (
                    <span style={styles.contextMetaDesktop}>
                      · {groupDisplayName}
                    </span>
                  ) : null}

                  {hasHeaderConflicts ? (
                    <button
                      type="button"
                      onClick={openConflictCenter}
                      style={styles.desktopConflictChip}
                    >
                      <span style={styles.conflictIndicatorDot} />
                      {getConflictChipLabel(conflictSummary.count)}
                    </button>
                  ) : null}

                  {shouldShowHeaderUpgrade ? (
                    <button
                      type="button"
                      onClick={() => openPremiumFromHeader("desktop")}
                      style={styles.desktopUpgradeChip}
                    >
                      <span style={styles.upgradeMiniBadgeDesktop}>
                        {upgradeIntentLabel}
                      </span>
                      {upgradeMessage}
                    </button>
                  ) : null}
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
                    <div style={styles.userAvatar}>
                      {headerUser?.initials ?? "T"}
                    </div>
                    <span style={styles.userLabel}>
                      {headerUser?.name ?? "Tú"}
                    </span>
                  </button>

                  {userMenuOpen && (
                    <div style={styles.desktopMenu}>
                      <div style={styles.menuHeader}>
                        <div style={styles.menuAvatar}>
                          {headerUser?.initials ?? "T"}
                        </div>
                        <div style={styles.menuName}>
                          {headerUser?.name ?? "Tú"}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/profile", { scroll: false });
                        }}
                      >
                        Profile
                      </button>


                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/settings", { scroll: false });
                        }}
                      >
                        Ajustes
                      </button>

                      <button
                        type="button"
                        style={styles.menuItem}
                        onClick={() => {
                          setUserMenuOpen(false);
                          router.push("/planes", { scroll: false });
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
                  <button
                    type="button"
                    style={styles.primaryButton}
                    onClick={onNewEvent}
                  >
                    + Evento
                  </button>
                )}
              </div>
            </div>

            <nav style={styles.topNav}>
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.path, { scroll: false })}
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
    minHeight: 196,
  },
  mobileWrap: {
    position: "sticky",
    top: 8,
    zIndex: 20,
    overflow: "visible",
    borderRadius: 18,
    padding: 12,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.90))",
    border: `1px solid ${colors.borderSubtle}`,
    boxShadow: shadows.card,
    backdropFilter: "blur(16px)",
    marginBottom: spacing.md,
    minHeight: 156,
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
    gap: 8,
    flexShrink: 0,
  },

  mobileTopRow: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "36px 1fr 36px",
    alignItems: "start",
    gap: 8,
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

  contextKickerDesktop: {
    margin: 0,
    fontSize: 10,
    fontWeight: 900,
    color: colors.textSecondary,
    letterSpacing: 0.72,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  contextKickerMobile: {
    margin: 0,
    fontSize: 9,
    fontWeight: 900,
    color: colors.textSecondary,
    letterSpacing: 0.68,
    textTransform: "uppercase",
  },
  desktopContextRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  contextPillDesktop: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.055)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  contextPillMobile: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 9px",
    borderRadius: radii.full,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    maxWidth: "100%",
  },
  contextPillText: {
    fontSize: 10,
    fontWeight: 900,
    color: colors.textPrimary,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contextMetaDesktop: {
    fontSize: 12,
    fontWeight: 700,
    color: colors.textMuted,
  },
  desktopConflictChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.42)",
    color: "#FEE2E2",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  mobileConflictChip: {
    position: "relative",
    zIndex: 1,
    marginTop: 8,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    padding: "7px 11px",
    borderRadius: radii.full,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(127,29,29,0.42)",
    color: "#FEE2E2",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  conflictIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(248,113,113,0.98)",
    boxShadow: "0 0 0 4px rgba(248,113,113,0.12)",
    flexShrink: 0,
  },
  contextSubtleMobile: {
    fontSize: 10,
    fontWeight: 700,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: "100%",
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
    margin: "2px 0 0",
    fontSize: 17,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: -0.4,
    color: colors.textPrimary,
    textAlign: "center",
  },
  mobileSubtitle: {
    position: "relative",
    zIndex: 1,
    margin: "8px 0 0",
    fontSize: 11,
    lineHeight: 1.35,
    color: colors.textSecondary,
    fontWeight: 600,
  },

  mobileUpgradeBar: {
    position: "relative",
    zIndex: 1,
    marginTop: 8,
    display: "grid",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(168,85,247,0.08))",
  },
  mobileUpgradeCopy: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    fontSize: 11,
    lineHeight: 1.35,
    color: colors.textPrimary,
    fontWeight: 700,
  },
  mobileUpgradeButton: {
    height: 34,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    justifySelf: "start",
  },
  desktopUpgradeChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: radii.full,
    border: "1px solid rgba(56,189,248,0.18)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(168,85,247,0.08))",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  upgradeMiniBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    height: 22,
    padding: "0 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  upgradeMiniBadgeDesktop: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    height: 20,
    padding: "0 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  iconButton: {
    position: "relative",
    width: 36,
    height: 36,
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
    minWidth: 18,
    height: 18,
    padding: "0 6px",
    borderRadius: radii.full,
    background: "rgba(99,102,241,0.96)",
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 0 0 2px rgba(15,23,42,0.95), 0 10px 25px rgba(0,0,0,0.35)",
  },

  secondaryButton: {
    height: 38,
    padding: "0 14px",
    borderRadius: 12,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  primaryButton: {
    height: 38,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.26), rgba(168,85,247,0.24))",
    color: colors.textPrimary,
    fontSize: 12,
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
  marginTop: 8,
},

  topNav: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
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
  zIndex: 9998,
  isolation: "isolate",
},
  userChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 9px",
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
    fontSize: 10,
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
  background: "#071126",
  boxShadow: "0 24px 60px rgba(0,0,0,0.62)",
  padding: 8,
  zIndex: 9999,
  opacity: 1,
  isolation: "isolate",
  overflow: "hidden",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  pointerEvents: "auto",
},
mobileMenu: {
  position: "absolute",
  top: "115%",
  right: 0,
  minWidth: 190,
  borderRadius: 16,
  border: `1px solid ${colors.borderSubtle}`,
  background: "#071126",
  boxShadow: "0 24px 60px rgba(0,0,0,0.62)",
  padding: 8,
  zIndex: 9999,
  opacity: 1,
  isolation: "isolate",
  overflow: "hidden",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  pointerEvents: "auto",
},
  menuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
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
    fontSize: 10,
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