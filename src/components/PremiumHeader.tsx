// src/components/PremiumHeader.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  getGroupState,
  setMode,
  type UsageMode,
  type GroupState,
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
    window.dispatchEvent(new Event("sp:active-group-changed"));
    return String(pick);
  }

  return null;
}

type HeaderUser = {
  name: string;
  initials: string;
};

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

function useIsMobileWidth(maxWidth = 520) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(!!mq.matches);

    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
  }, [maxWidth]);

  return isMobile;
}

type MobileNavVariant = "top" | "bottom" | "none";

/**
 * Compatibilidad con antiguos usos de PremiumHeader:
 * algunas pantallas le pasaban `highlightId` y `appliedToast`.
 * Los dejamos como OPCIONALES para que `<PremiumHeader />` simple
 * también sea válido.
 */
type UiToast = { deleted: number; skipped: number; appliedCount: number } | null;

type PremiumHeaderProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  mobileNav?: MobileNavVariant;
  highlightId?: string | null;
  appliedToast?: UiToast;
};

export default function PremiumHeader(props: PremiumHeaderProps) {
  const {
    title,
    subtitle,
    rightSlot,
    mobileNav: _mobileNav = "bottom", // compat, pero ya no controla nav en móvil
    // highlightId y appliedToast quedan disponibles para futuro uso,
    // pero no son obligatorios en ninguna pantalla.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    highlightId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appliedToast,
  } = props;

  const router = useRouter();
  const pathname = usePathname();

  const NAV_MODE: NavigationMode = "replace";

  const [group, setGroup] = useState<GroupState | null>(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);

  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isMobile = useIsMobileWidth(520);

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
        setHeaderUser(null);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  async function refreshBadge() {
    try {
      const { getMyNotifications } = await import("@/lib/notificationsDb");
      const n = await getMyNotifications(50);
      const unread = (n ?? []).filter(
        (x: any) => !x.read_at || x.read_at === ""
      ).length;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    refreshBadge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshBadge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openNotif, pathname]);

  const active = useMemo(
    () => TABS.find((t) => t.key === activeMode) ?? TABS[0],
    [activeMode]
  );

  const kickerLabel = useMemo(() => {
    const cleaned = normalizeGroupLabel((group as any)?.groupName ?? null);
    return cleaned ?? active.label;
  }, [group, active.label]);

  const autoTitle = useMemo(() => {
    if (pathname.startsWith("/planes")) return "Planes";
    if (pathname.startsWith("/profile")) return "Panel";
    if (pathname.startsWith("/conflicts")) return "Conflictos";
    if (pathname.startsWith("/groups")) return "Grupos";
    if (pathname.startsWith("/members")) return "Miembros";
    if (pathname.startsWith("/invitations")) return "Invitaciones";
    if (pathname.startsWith("/events")) return "Eventos";
    if (pathname.startsWith("/summary")) return "Resumen";
    if (pathname.startsWith("/calendar")) return "Calendario";
    return "Calendario";
  }, [pathname]);

  const finalTitle = title ?? autoTitle;
  const finalSubtitle =
    subtitle ?? "Organiza tu día sin conflictos de horario.";

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

    if (nextMode === "solo") {
      try {
        // podrías limpiar activeGroup en DB si quisieras
      } finally {
        window.dispatchEvent(new Event("sp:active-group-changed"));
      }
      return;
    }

    try {
      await ensureActiveGroupForMode(nextMode);
    } catch {
      window.dispatchEvent(new Event("sp:active-group-changed"));
    }
  }

  const onSyncedFromDrawer = useCallback((imported: number) => {
    window.dispatchEvent(
      new CustomEvent("sp:google-synced", { detail: { imported } })
    );
  }, []);

  // REGRA MADRE: en móvil la navegación principal es SOLO el bottom nav.
  // Así que las píldoras de navegación solo se muestran en desktop.
  const shouldShowTopNav: boolean = !isMobile;

  const closeUserMenu = () => setUserMenuOpen(false);

  return (
    <>
      <header style={S.wrap}>
        {/* ========== MOBILE LAYOUT (APP BAR) ========== */}
        {isMobile ? (
          <>
            {/* Top bar: bell · title · avatar */}
            <div style={S.mTopBar}>
              <div style={S.bellWrap}>
                <button
                  style={S.mBellBtn}
                  aria-label="Notificaciones"
                  title="Notificaciones"
                  onClick={() => setOpenNotif(true)}
                >
                  🔔
                </button>
                {unreadCount > 0 && (
                  <span style={S.badgeCount}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>

              <div style={S.mTitleBlock}>
                <div style={S.mKickerRow}>
                  <span
                    style={{ ...S.dot, background: active.dot, marginBottom: 0 }}
                  />
                  <span style={S.mKickerText}>{kickerLabel}</span>
                </div>
                <div style={S.mTitle}>{finalTitle}</div>
              </div>

              <div style={S.userChipWrap}>
                {headerUser && (
                  <button
                    type="button"
                    style={S.mUserBtn}
                    onClick={() => setUserMenuOpen((v) => !v)}
                    title="Cuenta y más opciones"
                  >
                    <div style={S.userAvatar}>{headerUser.initials}</div>
                  </button>
                )}

                {userMenuOpen && (
                  <div style={S.userMenu}>
                    <div style={S.userMenuHeader}>
                      <div style={S.userMenuAvatar}>
                        {headerUser?.initials ?? "T"}
                      </div>
                      <div style={S.userMenuName}>
                        {headerUser?.name ?? "Tú"}
                      </div>
                    </div>

                    <button
                      type="button"
                      style={S.userMenuItem}
                      onClick={() => {
                        closeUserMenu();
                        router.push("/groups");
                      }}
                    >
                      Grupos
                    </button>
                    <button
                      type="button"
                      style={S.userMenuItem}
                      onClick={() => {
                        closeUserMenu();
                        router.push("/members");
                      }}
                    >
                      Miembros
                    </button>
                    <button
                      type="button"
                      style={S.userMenuItem}
                      onClick={() => {
                        closeUserMenu();
                        router.push("/invitations");
                      }}
                    >
                      Invitaciones
                    </button>
                    <button
                      type="button"
                      style={S.userMenuItem}
                      onClick={() => {
                        closeUserMenu();
                        router.push("/settings");
                      }}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      style={S.userMenuItem}
                      onClick={() => {
                        closeUserMenu();
                        router.push("/pricing");
                      }}
                    >
                      Planes
                    </button>

                    <div style={S.userMenuDivider} />

                    <div style={S.userMenuLogout}>
                      <LogoutButton />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subtítulo debajo del app bar */}
            <p style={S.mSubtitle}>{finalSubtitle}</p>

            {/* Acciones principales en móvil: Conectar + CTA (+ Evento por defecto) */}
            <div style={S.mActionsRow}>
              <button
                type="button"
                style={S.mGhostBtn}
                onClick={() => {
                  closeUserMenu();
                  setOpenIntegrations(true);
                }}
                title="Conectar y sincronizar calendarios externos"
              >
                Conectar
              </button>

              {rightSlot ?? (
                <button
                  style={S.mPrimaryBtn}
                  onClick={onNewEvent}
                  type="button"
                >
                  + Evento
                </button>
              )}
            </div>

            {/* Tabs de modo en móvil (2x2) */}
            <div style={S.tabs}>
              <div style={S.tabsBg} />
              <div style={S.mTabsInner}>
                {TABS.map((t) => {
                  const isActive = t.key === activeMode;
                  return (
                    <button
                      key={t.key}
                      style={{
                        ...S.mTab,
                        ...(isActive ? S.tabActive : {}),
                      }}
                      onClick={() => onPickMode(t.key)}
                    >
                      <span style={{ ...S.tabDot, background: t.dot }} />
                      <span style={S.mTabText}>{t.label}</span>
                      <span style={S.mTabHint}>{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nav superior OPCIONAL en móvil: AHORA SIEMPRE DESACTIVADA (solo desktop) */}
            {shouldShowTopNav && (
              <nav style={S.nav}>
                <NavPill
                  label="Resumen"
                  active={pathname.startsWith("/summary")}
                  onClick={() => {
                    closeUserMenu();
                    router.push("/summary");
                  }}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Calendario"
                  active={pathname.startsWith("/calendar")}
                  onClick={() => {
                    closeUserMenu();
                    router.push("/calendar");
                  }}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Eventos"
                  active={pathname.startsWith("/events")}
                  onClick={() => {
                    closeUserMenu();
                    router.push("/events");
                  }}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Conflictos"
                  active={pathname.startsWith("/conflicts")}
                  onClick={() => {
                    closeUserMenu();
                    router.push("/conflicts/detected");
                  }}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Panel"
                  active={pathname.startsWith("/profile")}
                  onClick={() => {
                    closeUserMenu();
                    router.push("/profile");
                  }}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
              </nav>
            )}
          </>
        ) : (
          /* ========== DESKTOP LAYOUT (HERO COMPLETO) ========== */
          <>
            <div style={S.topRow}>
              <div style={S.left}>
                <div style={S.kicker}>
                  <span style={{ ...S.dot, background: active.dot }} />
                  <span style={S.kickerText}>{kickerLabel}</span>
                </div>

                <h1 style={S.title}>{finalTitle}</h1>
                <p style={S.subtitle}>{finalSubtitle}</p>
              </div>

              <div style={S.right}>
                <div style={S.bellWrap}>
                  <button
                    style={S.bellBtn}
                    aria-label="Notificaciones"
                    title="Notificaciones"
                    onClick={() => setOpenNotif(true)}
                  >
                    🔔
                  </button>

                  {unreadCount > 0 && (
                    <span style={S.badgeCount}>
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </div>

                <div style={S.userChipWrap}>
                  {headerUser && (
                    <button
                      type="button"
                      style={S.userChip}
                      onClick={() => setUserMenuOpen((v) => !v)}
                      title="Ver panel de cuenta"
                    >
                      <div style={S.userAvatar}>{headerUser.initials}</div>
                      <span style={S.userLabel}>{headerUser.name}</span>
                    </button>
                  )}

                  {userMenuOpen && (
                    <div style={S.userMenuDesktop}>
                      <div style={S.userMenuHeader}>
                        <div style={S.userMenuAvatar}>
                          {headerUser?.initials ?? "T"}
                        </div>
                        <div style={S.userMenuName}>
                          {headerUser?.name ?? "Tú"}
                        </div>
                      </div>

                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => {
                          closeUserMenu();
                          router.push("/groups");
                        }}
                      >
                        Grupos
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => {
                          closeUserMenu();
                          router.push("/members");
                        }}
                      >
                        Miembros
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => {
                          closeUserMenu();
                          router.push("/invitations");
                        }}
                      >
                        Invitaciones
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => {
                          closeUserMenu();
                          router.push("/settings");
                        }}
                      >
                        Settings
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => {
                          closeUserMenu();
                          router.push("/pricing");
                        }}
                      >
                        Planes
                      </button>

                      <div style={S.userMenuDivider} />

                      <div style={S.userMenuLogout}>
                        <LogoutButton />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  style={S.ghostBtn}
                  onClick={() => setOpenIntegrations(true)}
                  title="Conectar y sincronizar calendarios externos"
                >
                  Conectar
                </button>

                {rightSlot ?? (
                  <button
                    style={S.iconBtn}
                    onClick={onNewEvent}
                    type="button"
                  >
                    + Evento
                  </button>
                )}
              </div>
            </div>

            {/* Tabs de modo */}
            <div style={S.tabs}>
              <div style={S.tabsBg} />
              <div style={S.tabsInner}>
                {TABS.map((t) => {
                  const isActive = t.key === activeMode;
                  return (
                    <button
                      key={t.key}
                      style={{
                        ...S.tab,
                        ...(isActive ? S.tabActive : {}),
                      }}
                      onClick={() => onPickMode(t.key)}
                    >
                      <span style={{ ...S.tabDot, background: t.dot }} />
                      <span style={S.tabText}>{t.label}</span>
                      <span style={S.tabHint}>{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nav superior en desktop */}
            {shouldShowTopNav && (
              <nav style={S.nav}>
                <NavPill
                  label="Resumen"
                  active={pathname.startsWith("/summary")}
                  onClick={() => router.push("/summary")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Calendario"
                  active={pathname.startsWith("/calendar")}
                  onClick={() => router.push("/calendar")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Eventos"
                  active={pathname.startsWith("/events")}
                  onClick={() => router.push("/events")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Conflictos"
                  active={pathname.startsWith("/conflicts")}
                  onClick={() => router.push("/conflicts/detected")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Grupos"
                  active={pathname.startsWith("/groups")}
                  onClick={() => router.push("/groups")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Miembros"
                  active={pathname.startsWith("/members")}
                  onClick={() => router.push("/members")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Invitaciones"
                  active={pathname.startsWith("/invitations")}
                  onClick={() => router.push("/invitations")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Panel"
                  active={pathname.startsWith("/profile")}
                  onClick={() => router.push("/profile")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Settings"
                  active={pathname.startsWith("/settings")}
                  onClick={() => router.push("/settings")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
                <NavPill
                  label="Planes"
                  active={pathname.startsWith("/pricing")}
                  onClick={() => router.push("/pricing")}
                  styleOverride={S.pill}
                  styleActive={S.pillActive}
                />
              </nav>
            )}
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

function NavPill({
  label,
  active,
  onClick,
  styleOverride,
  styleActive,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  styleOverride: CSSProperties;
  styleActive: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...styleOverride, ...(active ? styleActive : {}) }}
    >
      {label}
    </button>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 400px at 10% 0%, rgba(37,99,235,0.20), transparent 55%), radial-gradient(900px 420px at 90% 0%, rgba(124,58,237,0.18), transparent 55%), rgba(2,6,23,0.65)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    position: "relative",
    overflow: "visible",
  },

  /* DESKTOP TOP ROW */
  topRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { minWidth: 0 },
  right: { display: "flex", gap: 10, alignItems: "center" },

  kicker: {
    display: "inline-flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.06)",
  },
  kickerText: { fontSize: 12, fontWeight: 800, color: "#dbeafe" },

  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#fff",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#a8b3cf",
    fontSize: 13,
    fontWeight: 650,
  },

  iconBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(37,99,235,0.95), rgba(37,99,235,0.55))",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  ghostBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  bellWrap: { position: "relative", flexShrink: 0 },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },

  badgeCount: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    borderRadius: 999,
    background: "rgba(99,102,241,0.95)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 11,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 0 0 2px rgba(2,6,23,0.85), 0 10px 25px rgba(0,0,0,0.35)",
  },

  userChipWrap: {
    position: "relative",
    display: "inline-flex",
  },

  userChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.85)",
    cursor: "pointer",
    maxWidth: 210,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
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
    color: "#E5E7EB",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* MODO TABS (DESKTOP) */
  tabs: { position: "relative", marginTop: 14 },
  tabsBg: {
    position: "absolute",
    inset: 0,
    borderRadius: 18,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tabsInner: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    padding: 10,
  },

  tab: {
    height: 52,
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
    color: "#fff",
    textAlign: "left",
  },
  tabActive: {
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  tabDot: { width: 10, height: 10, borderRadius: 999, gridRow: "1 / span 2" },
  tabText: { fontSize: 13, fontWeight: 900 },
  tabHint: {
    fontSize: 11,
    opacity: 0.75,
    fontWeight: 650,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* NAV PILLS */
  nav: {
    display: "flex",
    gap: 10,
    marginTop: 12,
    flexWrap: "wrap",
  },
  pill: {
    height: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: 12,
  },
  pillActive: {
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
  },

  /* ========== MOBILE-SPECÍFICO ========== */

  mTopBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  mBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 900,
  },
  mTitleBlock: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 2,
    minWidth: 0,
  },
  mKickerRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    maxWidth: "100%",
  },
  mKickerText: {
    fontSize: 11,
    fontWeight: 800,
    color: "#dbeafe",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  mTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: -0.4,
    color: "#fff",
  },
  mSubtitle: {
    margin: "10px 0 10px",
    fontSize: 12,
    color: "#a8b3cf",
    fontWeight: 600,
  },

  mUserBtn: {
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.85)",
    borderRadius: 999,
    padding: 4,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  mActionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mGhostBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },
  mPrimaryBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(124,58,237,0.28))",
    color: "#fff",
    fontWeight: 900,
    fontSize: 12,
    cursor: "pointer",
  },

  mTabsInner: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 8,
    padding: 8,
  },
  mTab: {
    height: 50,
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
    color: "#fff",
    textAlign: "left",
  },
  mTabText: {
    fontSize: 12,
    fontWeight: 900,
  },
  mTabHint: {
    fontSize: 10,
    opacity: 0.75,
    fontWeight: 650,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* USER MENU (MÓVIL + DESKTOP) */
  userMenu: {
    position: "absolute",
    top: "115%",
    right: 0,
    minWidth: 190,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.96)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    padding: 8,
    zIndex: 80,
  },
  userMenuDesktop: {
    position: "absolute",
    top: "115%",
    right: 0,
    minWidth: 220,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.96)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
    padding: 8,
    zIndex: 80,
  },
  userMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 8px 8px",
  },
  userMenuAvatar: {
    width: 26,
    height: 26,
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.7)",
    background: "rgba(8,47,73,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 900,
    color: "#E0F2FE",
  },
  userMenuName: {
    fontSize: 12,
    fontWeight: 800,
    color: "#E5E7EB",
  },
  userMenuItem: {
    width: "100%",
    textAlign: "left",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: 800,
    padding: "6px 9px",
    cursor: "pointer",
  },
  userMenuDivider: {
    margin: "6px 0",
    height: 1,
    background: "rgba(148,163,184,0.35)",
  },
  userMenuLogout: {
    padding: "4px 6px",
  },
};