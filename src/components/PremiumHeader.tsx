// src/components/PremiumHeader.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  getGroupState,
  setMode,
  type UsageMode,
  type GroupState,
} from "@/lib/groups";
import NotificationsDrawer, { type NavigationMode } from "./NotificationsDrawer";

import {
  getMyProfile,
  getInitials,
  type Profile as UserProfile,
} from "@/lib/profilesDb";

import IntegrationsDrawer from "@/components/IntegrationsDrawer";
import BottomNav from "@/components/BottomNav";

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
  { key: "other", label: "Compartido", hint: "Amigos, equipos", dot: "#A855F7" },
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

  // ✅ Declarar UNA sola vez
  const groups = await getMyGroups();
  if (!groups.length) return null;

  const wantType = String(mode).toLowerCase();

  // ✅ Si ya hay active, verificamos que exista y sea del tipo correcto
  if (existing) {
    const current = groups.find((g: any) => String(g.id) === String(existing));
    const currentType = String(current?.type ?? "").toLowerCase();

    if (current && currentType === wantType) {
      return String(existing);
    }
    // si no coincide, seguimos y elegimos uno correcto
  }

  // ✅ Elegimos el primer grupo del tipo correcto (o fallback al primero)
  const match = groups.find(
    (g: any) => String(g.type ?? "").toLowerCase() === wantType
  );
  const pick = match?.id ?? groups[0]?.id ?? null;

  if (pick) {
    await setActiveGroupIdInDb(String(pick));
    // ✅ evento global para que Calendar/Summary reaccionen
    window.dispatchEvent(new Event("sp:active-group-changed"));
    return String(pick);
  }

  return null;
}

type HeaderUser = {
  name: string;
  initials: string;
};

// ✅ Normaliza el label para eliminar "Activo" del UI
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

/**
 * ✅ Hook: detecta "mobile" por ancho (solo cambia UI en pantalla chica)
 */
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

export default function PremiumHeader({
  title,
  subtitle,
  rightSlot,
  mobileNav = "bottom", // ✅ CAMBIO CLAVE: en móvil la navegación principal es la barra inferior
}: {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  mobileNav?: MobileNavVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const NAV_MODE: NavigationMode = "replace";

  const [group, setGroup] = useState<GroupState | null>(null);
  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [headerUser, setHeaderUser] = useState<HeaderUser | null>(null);

  // ✅ Drawer Conectar
  const [openIntegrations, setOpenIntegrations] = useState(false);

  // ✅ Detecta móvil (solo por ancho)
  const isMobile = useIsMobileWidth(520);

  // Estado de grupos / modo activo
  useEffect(() => {
    const g = getGroupState();
    setGroup(g);
    applyThemeVars((g.mode as TabKey) ?? "solo");
  }, []);

  const activeMode: TabKey = (group?.mode as TabKey) ?? "solo";

  useEffect(() => {
    applyThemeVars(activeMode);
  }, [activeMode]);

  // Perfil para chip de usuario
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

  // Badge de notificaciones
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
    if (pathname.startsWith("/pricing")) return "Planes";
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

  // ✅ Copy más pro (si quieres lo dejamos como antes)
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

  // Theme
  applyThemeVars(nextMode);

  if (nextMode === "solo") {
    // Personal: no hay activeGroup
    try {
      // opcional: podrías limpiar active en DB si quieres, pero no es necesario
    } finally {
      window.dispatchEvent(new Event("sp:active-group-changed"));
    }
    return;
  }

  try {
    await ensureActiveGroupForMode(nextMode);
  } catch {
    // no bloquear UI
    window.dispatchEvent(new Event("sp:active-group-changed"));
  }
}

  const onSyncedFromDrawer = useCallback((imported: number) => {
    window.dispatchEvent(
      new CustomEvent("sp:google-synced", { detail: { imported } })
    );
  }, []);

  // ✅ Overrides SOLO en móvil
  const M = useMemo(() => {
    if (!isMobile) return null;

    return {
      wrap: { padding: 14, borderRadius: 20 } as React.CSSProperties,

      topRow: {
        flexDirection: "column",
        alignItems: "stretch",
        gap: 10,
      } as React.CSSProperties,

      right: {
        width: "100%",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
      } as React.CSSProperties,

      title: { fontSize: 22 } as React.CSSProperties,
      subtitle: { fontSize: 12 } as React.CSSProperties,

      bellBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
      } as React.CSSProperties,
      ghostBtn: {
        height: 38,
        padding: "0 12px",
        borderRadius: 12,
        fontSize: 12,
      } as React.CSSProperties,
      iconBtn: {
        height: 38,
        padding: "0 12px",
        borderRadius: 12,
        fontSize: 12,
      } as React.CSSProperties,

      userChip: {
        maxWidth: 70,
        padding: 0,
        justifyContent: "center",
      } as React.CSSProperties,
      userLabel: { display: "none" } as React.CSSProperties,

      tabsInner: {
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
        padding: 8,
      } as React.CSSProperties,

      tab: { height: 50, padding: "10px 10px" } as React.CSSProperties,
      tabText: { fontSize: 12 } as React.CSSProperties,
      tabHint: { fontSize: 10 } as React.CSSProperties,
    };
  }, [isMobile]);

  function ms<T extends React.CSSProperties>(
    base: T,
    mobile?: React.CSSProperties | null
  ) {
    return mobile ? ({ ...base, ...mobile } as T) : base;
  }

  /**
   * ✅ REGLA: en móvil NO mostramos el nav superior por defecto.
   * - mobileNav = "bottom" (default): solo bottom tabs
   * - mobileNav = "top": permite nav superior (solo si lo necesitas en una pantalla puntual)
   * - mobileNav = "none": sin nav
   */
  const shouldShowTopNav = !isMobile && true ? true : isMobile && mobileNav === "top";
  const shouldShowBottomNav = isMobile && mobileNav === "bottom";

  return (
    <>
      <header style={ms(S.wrap, M?.wrap)}>
        <div style={ms(S.topRow, M?.topRow)}>
          <div style={S.left}>
            <div style={S.kicker}>
              <span style={{ ...S.dot, background: active.dot }} />
              <span style={S.kickerText}>{kickerLabel}</span>
            </div>

            <h1 style={ms(S.title, M?.title)}>{finalTitle}</h1>
            <p style={ms(S.subtitle, M?.subtitle)}>{finalSubtitle}</p>
          </div>

          <div style={ms(S.right, M?.right)}>
            <div style={S.bellWrap}>
              <button
                style={ms(S.bellBtn, M?.bellBtn)}
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

            {headerUser && (
              <button
                type="button"
                style={ms(S.userChip, M?.userChip)}
                onClick={() => router.push("/profile")}
                title="Ver panel de cuenta"
              >
                <div style={S.userAvatar}>{headerUser.initials}</div>
                <span style={ms(S.userLabel, M?.userLabel)}>
                  {headerUser.name}
                </span>
              </button>
            )}

            <button
              type="button"
              style={ms(S.ghostBtn, M?.ghostBtn)}
              onClick={() => setOpenIntegrations(true)}
              title="Conectar y sincronizar calendarios externos"
            >
              Conectar
            </button>

            {rightSlot ?? (
              <button style={ms(S.iconBtn, M?.iconBtn)} onClick={onNewEvent}>
                + Evento
              </button>
            )}
          </div>
        </div>

        {/* Tabs de modo */}
        <div style={S.tabs}>
          <div style={S.tabsBg} />
          <div style={ms(S.tabsInner, M?.tabsInner)}>
            {TABS.map((t) => {
              const isActive = t.key === activeMode;
              return (
                <button
                  key={t.key}
                  style={{
                    ...ms(S.tab, M?.tab),
                    ...(isActive ? S.tabActive : {}),
                  }}
                  onClick={() => onPickMode(t.key)}
                >
                  <span style={{ ...S.tabDot, background: t.dot }} />
                  <span style={ms(S.tabText, M?.tabText)}>{t.label}</span>
                  <span style={ms(S.tabHint, M?.tabHint)}>{t.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ✅ NAV SUPERIOR (solo desktop o móvil si lo fuerzas con mobileNav="top") */}
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
      </header>

      {/* ✅ BOTTOM NAV (móvil) */}
      {shouldShowBottomNav && <BottomNav />}

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
  styleOverride: React.CSSProperties;
  styleActive: React.CSSProperties;
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

const S: Record<string, React.CSSProperties> = {
  wrap: {
    borderRadius: 22,
    padding: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 400px at 10% 0%, rgba(37,99,235,0.20), transparent 55%), radial-gradient(900px 420px at 90% 0%, rgba(124,58,237,0.18), transparent 55%), rgba(2,6,23,0.65)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
  },

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

  bellWrap: { position: "relative" },
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
};