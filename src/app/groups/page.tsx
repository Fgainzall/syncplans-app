// src/app/groups/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyGroups, getGroupTypeLabel } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { getMyInvitations } from "@/lib/invitationsDb";
import {
  buildGroupsSummary,
  type GroupSummary,
} from "@/lib/groupsSummary";

type GroupRole = "owner" | "admin" | "member";

type GroupWithRole = {
  id: string;
  name: string;
  type: string;
  role: GroupRole;
  members_count: number;
  is_active: boolean;
};

type GroupFilter = "all" | "pair" | "family" | "shared";

export default function GroupsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [filter, setFilter] = useState<GroupFilter>("all");

  const [pendingInvites, setPendingInvites] = useState(0);
  const [toast, setToast] = useState<
    | null
    | {
        title: string;
        subtitle?: string;
      }
  >(null);

  /* ============================
     Boot y carga de datos
     ============================ */
  useEffect(() => {
    let alive = true;

    (async () => {
      setBooting(true);

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      try {
        await refreshData(false);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function refreshData(withToast: boolean) {
    try {
      if (withToast) {
        setToast({
          title: "Actualizando grupos…",
          subtitle: "Cargando tus grupos y invitaciones",
        });
      }

      setLoading(true);

      const [groupsData, invitesData] = await Promise.all([
        getMyGroups(),
        getMyInvitations(), // ✅ sin argumentos
      ]);

      const rawGroups = (groupsData || []) as any[];
      const enriched: GroupWithRole[] = rawGroups.map((g) => ({
        id: String(g.id),
        name: g.name ?? "",
        type: g.type ?? "pair",
        role: (g.role as GroupRole) ?? "member",
        members_count: g.members_count ?? 0,
        is_active: !!g.is_active,
      }));

      setGroups(enriched);
      setPendingInvites(((invitesData as any[]) ?? []).length);

      if (withToast) {
        setToast({
          title: "Grupos actualizados ✅",
          subtitle: "Todo está al día.",
        });
        window.setTimeout(() => setToast(null), 2600);
      }
    } catch (e: any) {
      console.error("Error refrescando grupos", e);
      setToast({
        title: "No se pudo actualizar",
        subtitle: e?.message ?? "Inténtalo más tarde.",
      });
      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setLoading(false);
    }
  }

  /* ============================
     Cambiar grupo activo
     ============================ */
  async function handleActivateGroup(groupId: string) {
    try {
      await setActiveGroupIdInDb(groupId);

      window.dispatchEvent(new CustomEvent("sp:active-group-changed"));

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          is_active: String(g.id) === String(groupId),
        })),
      );

      setToast({
        title: "Grupo activo actualizado ✅",
        subtitle: "Tu calendario y eventos usarán este grupo.",
      });
      window.setTimeout(() => setToast(null), 2600);
    } catch (e: any) {
      console.error("Error activando grupo", e);
      setToast({
        title: "No se pudo cambiar el grupo",
        subtitle: e?.message ?? "Inténtalo más tarde.",
      });
      window.setTimeout(() => setToast(null), 2600);
    }
  }

  /* ============================
     Filtros derivados
     ============================ */
const filteredGroups = useMemo(() => {
  if (filter === "all") return groups;

  if (filter === "shared") {
    // Todo lo que no sea pareja ni familia lo tratamos como compartido
    return groups.filter(
      (g) => g.type !== "pair" && g.type !== "family",
    );
  }

  return groups.filter((g) => g.type === filter);
}, [groups, filter]);

const summary: GroupSummary = useMemo(
  () => buildGroupsSummary(groups),
  [groups],
);

  const headerSubtitle =
    summary.total === 0
      ? "Personas con las que te organizas."
      : `Tienes ${summary.total} grupo${
          summary.total === 1 ? "" : "s"
        } para coordinar tu tiempo.`;

  const invitationsLabel =
    pendingInvites === 0
      ? "Invitaciones"
      : `Invitaciones (${pendingInvites})`;

  /* ============================
     RENDER
     ============================ */
  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.stickyTop}>
          <PremiumHeader />
        </div>

        <section style={styles.card}>
          <div style={styles.loadingRow}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>
                Cargando tus grupos…
              </div>
              <div style={styles.loadingSub}>
                Preparando tus grupos e invitaciones
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <div style={styles.stickyTop}>
        <PremiumHeader />
      </div>

      <section style={styles.card} className="sp-groups-card">
        <div style={styles.headerRow}>
          <div>
            <div style={styles.kicker}>
              Personas con las que te organizas
            </div>
            <h1 style={styles.h1}>Grupos</h1>
            <p style={styles.sub}>{headerSubtitle}</p>
          </div>

          <div style={styles.topActions}>
            <button
              type="button"
              style={styles.secondary}
              onClick={() => router.push("/invitations")}
            >
              {invitationsLabel}
            </button>

            <button
              type="button"
              style={styles.primary}
              onClick={() => router.push("/groups/new")}
            >
              + Nuevo grupo
            </button>
          </div>
        </div>

        <section
          className="sp-groups-hero"
          style={styles.heroSection}
        >
          <div style={styles.heroLeft}>
            <div style={styles.heroPill}>
              <span style={styles.heroDot} />
              Personas con las que te organizas
            </div>
            <h2 style={styles.heroTitle}>
              Grupos para coordinar sin fricciones
            </h2>
            <p style={styles.heroText}>
              Cada grupo tiene su propio calendario compartido. Aquí
              decides con quién se cruzan tus planes: pareja, familia o
              grupos compartidos como amigos y equipos.
            </p>

            <div style={styles.heroTip}>
              <div style={styles.heroTipLabel}>Tip</div>
              <p style={styles.heroTipText}>
                Crea primero el grupo de <b>Pareja</b> o <b>Familia</b>.
                Después puedes sumar grupos compartidos (amigos, pádel,
                trabajo) y dejar que SyncPlans señale los choques por
                ustedes.
              </p>
            </div>
          </div>

          <div style={styles.heroSummary}>
            <div style={styles.heroSummaryTitle}>
              Resumen de tus grupos
            </div>
            <div style={styles.heroSummaryRow}>
              <span style={styles.heroSummaryDotPair} />
              <span>
                {summary.pair} de pareja
                {summary.pair === 1 ? "" : "s"}
              </span>
            </div>
            <div style={styles.heroSummaryRow}>
              <span style={styles.heroSummaryDotFamily} />
              <span>
                {summary.family} de familia
                {summary.family === 1 ? "" : "s"}
              </span>
            </div>
            <div style={styles.heroSummaryRow}>
              <span style={styles.heroSummaryDotShared} />
              <span>
                {summary.shared} compartido
                {summary.shared === 1 ? "" : "s"}
              </span>
            </div>

            <div style={styles.heroSummaryHint}>
              El grupo activo se usa para los conflictos y eventos
              compartidos.
            </div>
          </div>
        </section>

        <section style={styles.filtersRow}>
          <div style={styles.segment}>
            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(filter === "all"
                  ? styles.segmentBtnActive
                  : {}),
              }}
              onClick={() => setFilter("all")}
            >
              Todos
            </button>
            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(filter === "pair"
                  ? styles.segmentBtnActive
                  : {}),
              }}
              onClick={() => setFilter("pair")}
            >
              Pareja
            </button>
            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(filter === "family"
                  ? styles.segmentBtnActive
                  : {}),
              }}
              onClick={() => setFilter("family")}
            >
              Familia
            </button>
            <button
              type="button"
              style={{
                ...styles.segmentBtn,
                ...(filter === "shared"
                  ? styles.segmentBtnActive
                  : {}),
              }}
              onClick={() => setFilter("shared")}
            >
              Compartidos
            </button>
          </div>

          <button
            type="button"
            style={styles.refreshBtn}
            onClick={() => refreshData(true)}
          >
            Actualizar
          </button>
        </section>

        {loading ? (
          <div style={styles.loadingList}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>
                  Cargando grupos…
                </div>
                <div style={styles.loadingSub}>
                  Un momento, por favor.
                </div>
              </div>
            </div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={styles.emptyState}>
            <h2 style={styles.emptyTitle}>Aún no tienes grupos</h2>
            <p style={styles.emptySub}>
              Crea tu primer grupo de pareja, familia o compartido para
              empezar a coordinar con otros.
            </p>
            <button
              type="button"
              style={styles.primary}
              onClick={() => router.push("/groups/new")}
            >
              Crear grupo
            </button>
          </div>
        ) : (
          <div style={styles.groupList}>
            {filteredGroups.map((g) => (
              <GroupRow
                key={g.id}
                g={g}
                onActivate={handleActivateGroup}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function GroupRow({
  g,
  onActivate,
}: {
  g: GroupWithRole;
  onActivate: (id: string) => void;
}) {
  const meta = metaForGroupType(g.type);

  return (
    <div style={styles.groupRow} className="sp-groups-row">
      <div style={styles.groupLeft}>
        <div style={styles.groupAvatar}>
          <span
            style={{
              ...styles.groupAvatarDot,
              background: meta.dot,
            }}
          />
        </div>
        <div>
          <div style={styles.groupName}>{g.name || meta.label}</div>
          <div style={styles.groupMetaRow}>
            <span style={styles.groupMetaType}>
              {getGroupTypeLabel(g.type as any)}
            </span>
            <span style={styles.dotSeparator}>•</span>
            <span style={styles.groupMetaMembers}>
              {g.members_count} persona
              {g.members_count === 1 ? "" : "s"}
            </span>
            <span style={styles.dotSeparator}>•</span>
            <span style={styles.groupMetaRole}>
              {roleLabel(g.role)}
            </span>
          </div>
        </div>
      </div>

      <div style={styles.groupRight}>
        {g.is_active ? (
          <span style={styles.activeBadge}>Activo</span>
        ) : (
          <button
            type="button"
            style={styles.activateBtn}
            onClick={() => onActivate(g.id)}
          >
            Usar como activo
          </button>
        )}

        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => {
            window.location.href = `/groups/${g.id}`;
          }}
        >
          Ver detalles
        </button>
      </div>
    </div>
  );
}

/* ============================
   Helpers
   ============================ */
function roleLabel(role: GroupRole) {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Admin";
    default:
      return "Miembro";
  }
}

function metaForGroupType(type: string) {
  switch (type) {
    case "pair":
      return {
        label: "Pareja",
        dot: "rgba(248,113,113,0.98)",
      };
    case "family":
      return {
        label: "Familia",
        dot: "rgba(96,165,250,0.98)",
      };
    case "shared":
    default:
      return {
        label: "Compartido",
        dot: "rgba(129,140,248,0.98)",
      };
  }
}

/* ============================
   Styles
   ============================ */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 56px",
  },

  stickyTop: {
    position: "sticky",
    top: 0,
    zIndex: 20,
    paddingTop: 10,
    paddingBottom: 10,
    backdropFilter: "blur(16px)",
    background:
      "linear-gradient(180deg, rgba(5,8,22,0.92), rgba(5,8,22,0.78))",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },

  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 360,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.92)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
    color: "rgba(255,255,255,0.95)",
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(255,255,255,0.70)",
    fontWeight: 650,
  },

  card: {
    marginTop: 14,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,25,0.90)",
    boxShadow:
      "0 22px 70px rgba(0,0,0,0.55), 0 0 0 1px rgba(15,23,42,0.60)",
    padding: "18px 16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
  },
  kicker: {
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "rgba(148,163,184,0.95)",
    fontWeight: 800,
    marginBottom: 6,
  },
  h1: {
    margin: 0,
    fontSize: 22,
    letterSpacing: "-0.03em",
    fontWeight: 950,
  },
  sub: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(209,213,219,0.96)",
    maxWidth: 420,
  },

  topActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  heroSection: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(31,41,55,0.95)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.20), transparent 60%), radial-gradient(circle at 100% 100%, rgba(16,185,129,0.16), transparent 55%), rgba(15,23,42,0.96)",
    padding: 14,
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
  },
  heroLeft: {
    flex: 1,
    minWidth: 220,
  },
  heroPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(191,219,254,0.9)",
    background: "rgba(15,23,42,0.9)",
    fontSize: 11,
    color: "rgba(219,234,254,0.98)",
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(59,130,246,0.98)",
  },
  heroTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },
  heroText: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(226,232,240,0.96)",
  },

  heroTip: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    border: "1px dashed rgba(191,219,254,0.9)",
    background: "rgba(15,23,42,0.96)",
  },
  heroTipLabel: {
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "rgba(191,219,254,0.98)",
    marginBottom: 4,
  },
  heroTipText: {
    fontSize: 13,
    color: "rgba(226,232,240,0.96)",
  },

  heroSummary: {
    width: 220,
    borderRadius: 16,
    border: "1px solid rgba(15,23,42,0.95)",
    background: "rgba(15,23,42,0.92)",
    padding: 10,
  },
  heroSummaryTitle: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 6,
  },
  heroSummaryRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
    marginBottom: 3,
  },
  heroSummaryDotPair: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(248,113,113,0.98)",
  },
  heroSummaryDotFamily: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(96,165,250,0.98)",
  },
  heroSummaryDotShared: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(129,140,248,0.98)",
  },
  heroSummaryHint: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },

  filtersRow: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  segment: {
    display: "inline-flex",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    overflow: "hidden",
  },
  segmentBtn: {
    padding: "7px 11px",
    fontSize: 12,
    background: "transparent",
    border: "none",
    color: "rgba(209,213,219,0.9)",
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(56,189,248,0.55))",
    color: "white",
  },

  refreshBtn: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },

  groupList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  groupRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 12,
    borderRadius: 16,
    border: "1px solid rgba(31,41,55,0.95)",
    background: "rgba(15,23,42,0.96)",
    padding: 10,
  },
  groupLeft: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  groupAvatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.75)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.96)",
    flexShrink: 0,
  },
  groupAvatarDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupName: {
    fontSize: 14,
    fontWeight: 900,
  },
  groupMetaRow: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  dotSeparator: {
    opacity: 0.7,
  },
  groupMetaType: {},
  groupMetaMembers: {},
  groupMetaRole: {},

  groupRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
    minWidth: 140,
  },

  activateBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(224,242,254,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 130,
    textAlign: "center",
  },
  activeBadge: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.75)",
    background: "rgba(22,163,74,0.16)",
    color: "rgba(220,252,231,0.98)",
    fontSize: 12,
    fontWeight: 800,
  },
  linkBtn: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 130,
    textAlign: "center",
  },

  emptyState: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px dashed rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.92)",
    padding: 16,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 950,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(209,213,219,0.96)",
    marginBottom: 10,
  },

  loadingList: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(30,64,175,0.8)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.22), transparent 55%), rgba(15,23,42,0.96)",
    padding: 14,
  },
  loadingRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 20px rgba(56,189,248,0.70)",
  },
  loadingTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  loadingSub: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
  },

  primary: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.85)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    color: "white",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  secondary: {
    padding: "9px 12px",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
};