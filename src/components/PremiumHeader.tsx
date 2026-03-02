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
import BrandLogo from "@/components/BrandLogo";

type TabKey = UsageMode | "other";

type Tab = {
  key: TabKey;
  label: string;
  hint: string;
  dot: string;
};

const TABS: Tab[] = [
  { key: "solo", label: "Personal", hint: "Solo tú", dot: "#FBBF24" },
  { key: "pair", label: "Pareja", hint: "Tú y otra persona", dot: "#22C55E" },
  {
    key: "family",
    label: "Familia",
    hint: "Casa, hijos, responsabilidades",
    dot: "#F97316",
  },
  {
    key: "shared",
    label: "Compartido",
    hint: "Equipos, proyectos, amistades",
    dot: "#38BDF8",
  },
];

function useIsMobile() {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function update() {
      setMobile(window.innerWidth < 768);
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return mobile;
}

function getActiveTabKey(fromGroup: GroupState | null): TabKey {
  if (!fromGroup) return "solo";

  const mode = fromGroup.mode ?? "solo";
  if (mode === "solo" || mode === "pair" || mode === "family") return mode;

  // nota: nuestro "shared" puede incluir grupos mixtos
  return "shared";
}

async function applyThemeVars(mode: TabKey) {
  if (typeof document === "undefined") return;

  let primary = "#2563EB";
  let primarySoft = "rgba(37,99,235,0.16)";
  let primaryText = "#BFDBFE";

  if (mode === "pair") {
    primary = "#22C55E";
    primarySoft = "rgba(34,197,94,0.16)";
    primaryText = "#BBF7D0";
  } else if (mode === "family") {
    primary = "#F97316";
    primarySoft = "rgba(249,115,22,0.16)";
    primaryText = "#FED7AA";
  } else if (mode === "shared") {
    primary = "#38BDF8";
    primarySoft = "rgba(56,189,248,0.16)";
    primaryText = "#BAE6FD";
  }

  const root = document.documentElement;
  root.style.setProperty("--sp-accent", primary);
  root.style.setProperty("--sp-accent-soft", primarySoft);
  root.style.setProperty("--sp-accent-text", primaryText);
}

/**
 * Usa Supabase dinámicamente para evitar cargarlo en el servidor.
 * Si no hay grupo activo, intenta alinear el grupo con el modo actual.
 */
async function getActiveGroupIdFromDb(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const { default: supabase } = await import("@/lib/supabaseClient");
  const {
    getMyGroups,
    setActiveGroupIdInDb,
  }: {
    getMyGroups: () => Promise<any[]>;
    setActiveGroupIdInDb: (gid: string | null) => Promise<void>;
  } = await import("@/lib/groupsDb");

  const existing = await getActiveGroupIdFromDbRaw(supabase);
  if (existing) return existing;

  // Si no hay grupo activo, no forzamos nada todavía.
  const groups = await getMyGroups();
  if (!groups.length) return null;

  // Si el modo actual es "solo", no escogemos grupo.
  const currentMode = getGroupState().mode ?? "solo";
  if (currentMode === "solo") return null;

  // Elegimos el primer grupo del tipo actual como activo.
  const wantedType = String(currentMode).toLowerCase();

  const candidate = groups.find(
    (g: any) => String(g?.type ?? "").toLowerCase() === wantedType,
  );
  if (!candidate) return null;

  // Guardamos como grupo activo y devolvemos.
  await setActiveGroupIdInDb(String(candidate.id));
  return String(candidate.id);
}

/** Versión cruda para no llamar recursivamente a este mismo helper */
async function getActiveGroupIdFromDbRaw(supabase: any): Promise<string | null> {
  const {
    data,
    error,
  }: {
    data: { active_group_id: string | null }[] | null;
    error: any;
  } = await supabase
    .from("profiles")
    .select("active_group_id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error leyendo active_group_id:", error);
    return null;
  }

  return data?.active_group_id ?? null;
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
    const cleaned = raw.replace(/^activo\s*[:\-–]\s*/i, "");
    return cleaned || "Grupo actual";
  }

  if (/^mi\s+pareja/i.test(raw)) return "Pareja actual";
  if (/^familia/i.test(raw)) return "Familia";
  return raw;
}

function modeKickerLabel(mode: TabKey, groupName?: string | null) {
  if (mode === "solo") return "Modo personal · Solo tú";

  const base = mode === "pair" ? "Modo pareja" : mode === "family" ? "Modo familia" : "Modo compartido";
  const normalized = normalizeGroupLabel(groupName);

  if (!normalized) {
    if (mode === "pair") return "Modo pareja · invita a tu persona";
    if (mode === "family") return "Modo familia · trae a todos a la mesa";
    return "Modo compartido · suma proyectos y equipos";
  }

  return `${base} · ${normalized}`;
}

function autoTitleFromPath(path: string): string {
  if (path.startsWith("/calendar")) return "Tu calendario compartido";
  if (path.startsWith("/summary")) return "Resumen de tu semana";
  if (path.startsWith("/events")) return "Eventos y compromisos";
  if (path.startsWith("/conflicts")) return "Conflictos detectados";
  if (path.startsWith("/panel")) return "Panel de tu cuenta";
  if (path.startsWith("/groups")) return "Grupos y personas";
  if (path.startsWith("/members")) return "Miembros y roles";
  if (path.startsWith("/settings")) return "Ajustes de SyncPlans";
  if (path.startsWith("/pricing")) return "Planes y precios";
  if (path.startsWith("/integrations")) return "Integraciones";
  return "Tu tiempo compartido, claro";
}

type PremiumHeaderProps = {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  mobileNav?: "bottom" | "none";
  highlightId?: string | null;
  appliedToast?: string | null;
};

export default function PremiumHeader(props: PremiumHeaderProps) {
  const {
    title,
    subtitle,
    rightSlot,
    mobileNav: _mobileNav = "bottom",
    // highlightId y appliedToast quedan por si los quieres reutilizar luego
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    highlightId,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    appliedToast,
  } = props;

  const router = useRouter();
  const pathname = usePathname();
  const NAV_MODE: NavigationMode = "replace";

  const [group, setGroup] = useState<GroupState | null>(getGroupState());
  const [openNotif, setOpenNotif] = useState(false);
  const [openIntegrations, setOpenIntegrations] = useState(false);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isMobile = useIsMobile();

  const [mobileNav] = useState<"bottom" | "none">(_mobileNav);

  const activeMode: TabKey = getActiveTabKey(group);
  const activeTab = TABS.find((t) => t.key === activeMode) ?? TABS[0];
  const kickerLabel = modeKickerLabel(activeMode, group?.activeGroupName ?? group?.activeGroupLabel);

  const autoTitle = autoTitleFromPath(pathname || "/summary");
  const finalTitle = title ?? autoTitle;
  const finalSubtitle =
    subtitle ?? "Organiza tu día sin conflictos de horario.";

  async function onNewEvent() {
    try {
      if (activeMode === "solo") {
        router.push("/events/new/details?type=personal");
        return;
      }

      const gid = await getActiveGroupIdFromDb();
      if (!gid) {
        router.push("/groups");
        return;
      }

      router.push(
        `/events/new/details?type=group&groupId=${encodeURIComponent(gid)}`,
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
        // si quisieras, aquí podrías limpiar active_group_id
        const { default: supabase } = await import("@/lib/supabaseClient");
        await supabase
          .from("profiles")
          .update({ active_group_id: null })
          .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
      } catch (err) {
        console.error("No se pudo limpiar active_group_id:", err);
      }
      return;
    }

    try {
      const { default: supabase } = await import("@/lib/supabaseClient");
      const { getMyGroups, setActiveGroupIdInDb } = await import(
        "@/lib/groupsDb"
      );

      const groups = await getMyGroups();
      const wantType = String(nextMode).toLowerCase();

      const currentActive = await getActiveGroupIdFromDbRaw(supabase);
      if (currentActive) {
        const existing = groups.find(
          (g: any) => String(g.id) === String(currentActive),
        );
        const existingType = String(existing?.type ?? "").toLowerCase();
        if (existing && existingType === wantType) {
          await setActiveGroupIdInDb(String(currentActive));
          setGroup((prev) =>
            prev
              ? { ...prev, activeGroupId: String(currentActive) }
              : {
                  mode: nextMode as UsageMode,
                  activeGroupId: String(currentActive),
                  activeGroupLabel: existing.name ?? null,
                  activeGroupName: existing.name ?? null,
                },
          );
          return;
        }
      }

      const fallback = groups.find(
        (g: any) => String(g?.type ?? "").toLowerCase() === wantType,
      );
      if (fallback) {
        await setActiveGroupIdInDb(String(fallback.id));
        setGroup((prev) =>
          prev
            ? {
                ...prev,
                activeGroupId: String(fallback.id),
                activeGroupLabel: fallback.name ?? null,
                activeGroupName: fallback.name ?? null,
              }
            : {
                mode: nextMode as UsageMode,
                activeGroupId: String(fallback.id),
                activeGroupLabel: fallback.name ?? null,
                activeGroupName: fallback.name ?? null,
              },
        );
      }
    } catch (err) {
      console.error("No se pudo alinear active_group_id:", err);
    }
  }

  function onClickMode(nextMode: TabKey) {
    if (nextMode === activeMode) return;
    onPickMode(nextMode);
  }

  function onNav(to: string) {
    setUserMenuOpen(false);
    if (NAV_MODE === "replace") {
      router.replace(to);
    } else {
      router.push(to);
    }
  }

  const isSummary = pathname.startsWith("/summary");
  const isCalendar = pathname.startsWith("/calendar");
  const isEvents = pathname.startsWith("/events");
  const isConflicts = pathname.startsWith("/conflicts");
  const isPanel = pathname.startsWith("/panel");

  // Sync de estado con getGroupState
  useEffect(() => {
    let alive = true;

    function handleUpdate(next: GroupState) {
      if (!alive) return;
      setGroup(next);
    }

    // Suscribimos a cambios globales de grupo, si existen (opcional).
    const unsub = typeof window !== "undefined"
      ? (window as any).__syncPlansGroupObserver?.subscribe?.(handleUpdate)
      : null;

    // Primera carga
    setGroup(getGroupState());

    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, []);

  // Cargar usuario para avatar y menú
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const profile: UserProfile | null = await getMyProfile();
        if (!alive) return;

        if (profile) {
          const initials = getInitials(profile);
          const name =
            profile.first_name && profile.last_name
              ? `${profile.first_name} ${profile.last_name}`
              : profile.first_name || profile.last_name || "Tú";

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
        (x: any) => !x.read_at || x.read_at === "",
      ).length;
      setUnreadCount(unread);
    } catch {
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    refreshBadge();
  }, []);

  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);
  const toggleUserMenu = useCallback(
    () => setUserMenuOpen((v) => !v),
    [],
  );

  return (
    <>
      <header style={S.wrap}>
        {/* ========== MOBILE ========== */}
        {isMobile ? (
          <>
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
                        router.push("/panel");
                      }}
                    >
                      Panel
                    </button>
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
                        router.push("/settings");
                      }}
                    >
                      Ajustes
                    </button>
                    <div style={S.userMenuDivider} />
                    <div style={S.userMenuLogout}>
                      <LogoutButton />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p style={S.mSubtitle}>{finalSubtitle}</p>

            {/* Tabs modo / scope */}
            <div style={S.mTabsRow}>
              {TABS.map((tab) => {
                const active = tab.key === activeMode;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    style={{
                      ...S.mTab,
                      opacity: active ? 1 : 0.5,
                      borderColor: active ? "rgba(255,255,255,0.40)" : "transparent",
                      background: active
                        ? "rgba(15,23,42,0.85)"
                        : "rgba(15,23,42,0.65)",
                    }}
                    onClick={() => onClickMode(tab.key)}
                  >
                    <span
                      style={{
                        ...S.mTabDot,
                        background: tab.dot,
                        opacity: active ? 1 : 0.7,
                      }}
                    />
                    <span style={S.mTabLabel}>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Acciones principales */}
            <div style={S.mActionsRow}>
              <button
                type="button"
                style={S.iconBtn}
                onClick={onNewEvent}
              >
                + Nuevo evento
              </button>

              <button
                type="button"
                style={S.ghostBtn}
                onClick={() => setOpenIntegrations(true)}
              >
                Integraciones
              </button>
            </div>
          </>
        ) : (
          /* ========== DESKTOP ========== */
          <>
            <div style={S.topRow}>
              <div style={S.left}>
                <div style={S.brandRow}>
                  <BrandLogo variant="full" size={24} />
                </div>
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

                {/* Selector de modo */}
                <div style={S.tabsRow}>
                  {TABS.map((tab) => {
                    const active = tab.key === activeMode;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        style={{
                          ...S.tabBtn,
                          opacity: active ? 1 : 0.55,
                          borderColor: active
                            ? "rgba(255,255,255,0.50)"
                            : "transparent",
                          background: active
                            ? "rgba(15,23,42,0.9)"
                            : "rgba(15,23,42,0.5)",
                        }}
                        onClick={() => onClickMode(tab.key)}
                      >
                        <span
                          style={{
                            ...S.tabDot,
                            background: tab.dot,
                            opacity: active ? 1 : 0.8,
                          }}
                        />
                        <span style={S.tabLabel}>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* CTA principal + integraciones */}
                <button
                  type="button"
                  style={S.iconBtn}
                  onClick={onNewEvent}
                >
                  + Nuevo evento
                </button>
                <button
                  type="button"
                  style={S.ghostBtn}
                  onClick={() => setOpenIntegrations(true)}
                >
                  Integraciones
                </button>

                {/* Avatar + menú */}
                <div style={S.userArea}>
                  {headerUser && (
                    <button
                      type="button"
                      style={S.userChip}
                      onClick={toggleUserMenu}
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
                        onClick={() => onNav("/panel")}
                      >
                        Panel
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => onNav("/groups")}
                      >
                        Grupos
                      </button>
                      <button
                        type="button"
                        style={S.userMenuItem}
                        onClick={() => onNav("/settings")}
                      >
                        Ajustes
                      </button>
                      <div style={S.userMenuDivider} />
                      <div style={S.userMenuLogout}>
                        <LogoutButton />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navegación inferior solo para móvil */}
        {isMobile && mobileNav === "bottom" && (
          <nav style={S.bottomNav}>
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
                router.push("/conflicts");
              }}
              styleOverride={S.pill}
              styleActive={S.pillActive}
            />
            <NavPill
              label="Panel"
              active={pathname.startsWith("/panel")}
              onClick={() => {
                closeUserMenu();
                router.push("/panel");
              }}
              styleOverride={S.pill}
              styleActive={S.pillActive}
            />
          </nav>
        )}
      </header>

      <NotificationsDrawer
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        onNavigate={onNav}
      />

      <IntegrationsDrawer
        open={openIntegrations}
        onClose={() => setOpenIntegrations(false)}
      />
    </>
  );
}

type NavPillProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  styleOverride?: CSSProperties;
  styleActive?: CSSProperties;
};

function NavPill(props: NavPillProps) {
  const { label, active, onClick, styleOverride, styleActive } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...S.navPill,
        ...(styleOverride ?? {}),
        ...(active ? S.navPillActive : {}),
        ...(active && styleActive ? styleActive : {}),
      }}
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
      "radial-gradient(900px 400px at 10% 0%, rgba(37,99,235,0.24), transparent 60%), radial-gradient(700px 380px at 100% 0%, rgba(124,58,237,0.18), transparent 55%), rgba(2,6,23,0.65)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    position: "relative",
    overflow: "visible",
  },
  /* desktop */
  topRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { minWidth: 0 },
  brandRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
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
    background: "#22C55E",
    boxShadow: "0 0 0 4px rgba(34,197,94,0.35)",
  },
  kickerText: {
    fontSize: 12,
    fontWeight: 800,
    color: "#dbeafe",
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: -0.5,
    color: "#fff",
  },
  subtitle: {
    margin: "6px 0 0",
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.88)",
    maxWidth: 520,
  },
  tabsRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: 4,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.85)",
  },
  tabBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 11px",
    borderRadius: 999,
    border: "1px solid transparent",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "#22C55E",
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: 700,
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
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.85)",
    color: "#e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
  },
  userArea: {
    position: "relative",
  },
  userChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.95)",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 30% 20%, #f9fafb, #0f172a 55%, #1d4ed8 100%)",
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userLabel: {
    fontSize: 13,
    fontWeight: 600,
    maxWidth: 120,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userMenuDesktop: {
    position: "absolute",
    top: "110%",
    right: 0,
    minWidth: 220,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.65)",
    background: "rgba(15,23,42,0.98)",
    boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
    padding: 10,
    zIndex: 40,
  },
  userMenuHeader: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "4px 6px 8px",
  },
  userMenuAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background:
      "radial-gradient(circle at 30% 20%, #f9fafb, #0f172a 58%, #7c3aed 100%)",
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userMenuName: {
    fontSize: 14,
    fontWeight: 600,
    color: "#e5e7eb",
  },
  userMenuItem: {
    width: "100%",
    textAlign: "left",
    padding: "6px 8px",
    borderRadius: 10,
    border: "none",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 13,
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
  /* mobile */
  mTopBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  mTitleBlock: {
    flex: 1,
    padding: "0 10px",
    minWidth: 0,
  },
  mKickerRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  mKickerText: {
    fontSize: 11,
    fontWeight: 700,
    color: "#bfdbfe",
  },
  mTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#f9fafb",
  },
  mSubtitle: {
    margin: "4px 0 10px",
    fontSize: 13,
    color: "rgba(226,232,240,0.9)",
  },
  mTabsRow: {
    display: "flex",
    gap: 6,
    overflowX: "auto",
    paddingBottom: 4,
    marginBottom: 8,
  },
  mTab: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid transparent",
    background: "rgba(15,23,42,0.75)",
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  mTabDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  mTabLabel: {
    fontSize: 12,
    fontWeight: 700,
  },
  mActionsRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  mBellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  mUserBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mTabs: {},
  bellWrap: { position: "relative", flexShrink: 0 },
  badgeCount: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    padding: "0 4px",
    borderRadius: 999,
    background: "#ef4444",
    color: "#f9fafb",
    fontSize: 11,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  userChipWrap: {
    position: "relative",
  },
  userMenu: {
    position: "absolute",
    top: "110%",
    right: 0,
    minWidth: 220,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.65)",
    background: "rgba(15,23,42,0.98)",
    boxShadow: "0 25px 70px rgba(0,0,0,0.7)",
    padding: 10,
    zIndex: 40,
  },
  bottomNav: {
    marginTop: 16,
    display: "flex",
    gap: 6,
    padding: 4,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.9)",
  },
  navPill: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: 999,
    border: "none",
    background: "transparent",
    color: "#e5e7eb",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  navPillActive: {
    background: "rgba(15,23,42,0.95)",
    color: "#f9fafb",
  },
  pill: {
    fontSize: 12,
    fontWeight: 700,
    color: "#E5E7EB",
  },
  pillActive: {
    fontSize: 12,
    fontWeight: 800,
    color: "#F9FAFB",
    background: "rgba(15,23,42,0.95)",
  },
};