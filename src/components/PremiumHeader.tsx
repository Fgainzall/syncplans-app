"use client";

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getGroupState, setMode, UsageMode, GroupState } from "@/lib/groups";
import { getMyNotifications } from "@/lib/notificationsDb";
import NotificationsDrawer, { NavigationMode } from "./NotificationsDrawer";

// ✅ DB active group
import { getActiveGroupIdFromDb, setActiveGroupIdInDb } from "@/lib/activeGroup";

// ✅ DB groups (source of truth)
import { getMyGroups } from "@/lib/groupsDb";

type Tab = {
  key: UsageMode;
  label: string;
  hint: string;
  dot: string;
};

const TABS: Tab[] = [
  { key: "solo", label: "Personal", hint: "Solo tú", dot: "#FBBF24" },
  { key: "pair", label: "Pareja", hint: "2 personas", dot: "#F87171" },
  { key: "family", label: "Familia", hint: "Varios", dot: "#60A5FA" },
];

function applyThemeVars(mode: UsageMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--sp-personal", "#FBBF24");
  root.style.setProperty("--sp-pair", "#F87171");
  root.style.setProperty("--sp-family", "#60A5FA");

  const active =
    mode === "solo"
      ? "var(--sp-personal)"
      : mode === "pair"
      ? "var(--sp-pair)"
      : "var(--sp-family)";

  root.style.setProperty("--sp-active", active);
}

/**
 * ✅ Heurística segura:
 * - si ya hay activeGroupId guardado, úsalo
 * - si no hay, elige el primer grupo cuyo type coincida con el modo (pair/family)
 * - si tampoco hay, usa el primer grupo disponible
 */
async function ensureActiveGroupForMode(mode: UsageMode): Promise<string | null> {
  if (mode === "solo") {
    // En modo personal, no necesitamos active group.
    // OJO: no lo borramos automáticamente (para no molestar), pero podrías hacerlo si quieres.
    return null;
  }

  // 1) si ya existe en DB/LS, úsalo
  const existing = await getActiveGroupIdFromDb();
  if (existing) return existing;

  // 2) si no existe, intenta setear uno que coincida con el modo
  const groups = await getMyGroups();
  if (!groups.length) return null;

  const match = groups.find((g: any) => String(g.type) === mode);
  const pick = match?.id ?? groups[0].id ?? null;

  if (pick) {
    await setActiveGroupIdInDb(pick);
    return pick;
  }

  return null;
}

export default function PremiumHeader({
  title = "Calendario",
  subtitle = "Organiza tu día sin choques de horario",
  rightSlot,
}: {
  title?: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const NAV_MODE: NavigationMode = "replace"; // push | replace

  const [group, setGroup] = useState<GroupState | null>(null);

  const [openNotif, setOpenNotif] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const g = getGroupState();
    setGroup(g);
    applyThemeVars(g.mode ?? "solo");
  }, []);

  const activeMode: UsageMode = group?.mode ?? "solo";

  useEffect(() => {
    applyThemeVars(activeMode);
  }, [activeMode]);

  async function refreshBadge() {
    try {
      const n = await getMyNotifications(50);
      const unread = n.filter((x) => !x.read_at).length;
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

  // ✅ FIX REAL: el CTA crea evento acorde al modo + asegura activeGroupId
  async function onNewEvent() {
    try {
      // personal
      if (activeMode === "solo") {
        router.push("/events/new/details?type=personal");
        return;
      }

      // group mode => asegura activeGroupId
      const gid = await ensureActiveGroupForMode(activeMode);

      if (!gid) {
        // si no hay grupos, llévalo a crear
        router.push("/groups/new");
        return;
      }

      router.push(`/events/new/details?type=group&groupId=${encodeURIComponent(gid)}`);
    } catch {
      router.push("/events/new/details?type=personal");
    }
  }

  // ✅ FIX REAL: al cambiar a pair/family, setea un activeGroupId si faltaba
  async function onPickMode(nextMode: UsageMode) {
    const next = setMode(nextMode);
    setGroup(next);

    if (nextMode !== "solo") {
      try {
        await ensureActiveGroupForMode(nextMode);
      } catch {
        // no bloquees UI
      }
    }
  }

  return (
    <>
      <header style={S.wrap}>
        <div style={S.topRow}>
          <div style={S.left}>
            <div style={S.kicker}>
              <span style={{ ...S.dot, background: active.dot }} />
              <span style={S.kickerText}>{group?.groupName ?? active.label}</span>
            </div>

            <h1 style={S.title}>{title}</h1>
            <p style={S.subtitle}>{subtitle}</p>
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
                <span style={S.badgeCount}>{unreadCount > 99 ? "99+" : unreadCount}</span>
              )}
            </div>

            {rightSlot ?? (
              <button style={S.iconBtn} onClick={onNewEvent}>
                + Evento
              </button>
            )}
          </div>
        </div>

        <div style={S.tabs}>
          <div style={S.tabsBg} />
          <div style={S.tabsInner}>
            {TABS.map((t) => {
              const isActive = t.key === activeMode;
              return (
                <button
                  key={t.key}
                  style={{ ...S.tab, ...(isActive ? S.tabActive : {}) }}
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

        <nav style={S.nav}>
          <NavPill
            label="Calendario"
            active={pathname === "/calendar"}
            onClick={() => router.push("/calendar")}
          />
          <NavPill
            label="Eventos"
            active={pathname.startsWith("/events")}
            onClick={() => router.push("/events")}
          />
          <NavPill
            label="Conflictos"
            active={pathname.startsWith("/conflicts")}
            onClick={() => router.push("/conflicts/detected")}
          />
          <NavPill
            label="Grupos"
            active={pathname.startsWith("/groups")}
            onClick={() => router.push("/groups")}
          />
          <NavPill
            label="Panel"
            active={pathname.startsWith("/profile")}
            onClick={() => router.push("/profile")}
          />
        </nav>
      </header>

      <NotificationsDrawer
        open={openNotif}
        onClose={() => setOpenNotif(false)}
        navigationMode={NAV_MODE}
        onUnreadChange={(n) => setUnreadCount(n)}
      />
    </>
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
    <button onClick={onClick} style={{ ...S.pill, ...(active ? S.pillActive : {}) }}>
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
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  left: { minWidth: 0 },
  right: { display: "flex", gap: 10, alignItems: "center" },

  kicker: { display: "inline-flex", gap: 10, alignItems: "center", marginBottom: 10 },
  dot: { width: 10, height: 10, borderRadius: 999, boxShadow: "0 0 0 4px rgba(255,255,255,0.06)" },
  kickerText: { fontSize: 12, fontWeight: 800, color: "#dbeafe" },

  title: { margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: "#fff" },
  subtitle: { margin: "6px 0 0", color: "#a8b3cf", fontSize: 13, fontWeight: 650 },

  iconBtn: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "linear-gradient(180deg, rgba(37,99,235,0.95), rgba(37,99,235,0.55))",
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
    boxShadow: "0 0 0 2px rgba(2,6,23,0.85), 0 10px 25px rgba(0,0,0,0.35)",
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
    gridTemplateColumns: "1fr 1fr 1fr",
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
  tabActive: { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)" },
  tabDot: { width: 10, height: 10, borderRadius: 999, gridRow: "1 / span 2" },
  tabText: { fontSize: 13, fontWeight: 900 },
  tabHint: { fontSize: 11, opacity: 0.75, fontWeight: 650 },

  nav: { display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" },
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
  pillActive: { border: "1px solid rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.08)" },
};
