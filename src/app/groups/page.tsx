"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

import { getMyGroups, getGroupTypeLabel } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { getMyInvitations } from "@/lib/invitationsDb";
import {
  buildGroupsSummary,
  type GroupSummary,
} from "@/lib/groupsSummary";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { getGroupLimitState } from "@/lib/premium";

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

type UiToast =
  | null
  | {
      title: string;
      subtitle?: string;
    };

export default function GroupsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(true);

  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [filter, setFilter] = useState<GroupFilter>("all");

  const [pendingInvites, setPendingInvites] = useState(0);
  const [toast, setToast] = useState<UiToast>(null);

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
          subtitle: "Cargando tus grupos e invitaciones",
        });
      }

      setLoading(true);

      const [groupsData, invitesData, profileRow] = await Promise.all([
        getMyGroups(),
        getMyInvitations(),
        getMyProfile().catch(() => null),
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
      setProfile(profileRow ?? null);

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

  async function handleActivateGroup(groupId: string) {
    try {
      await setActiveGroupIdInDb(groupId);

      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          is_active: String(g.id) === String(groupId),
        }))
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

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;

    if (filter === "shared") {
      return groups.filter((g) => g.type !== "pair" && g.type !== "family");
    }

    return groups.filter((g) => g.type === filter);
  }, [groups, filter]);

  const summary: GroupSummary = useMemo(
    () => buildGroupsSummary(groups),
    [groups]
  );

  const groupLimitState = useMemo(
    () => getGroupLimitState(profile, groups.length),
    [profile, groups.length]
  );
  const reachedGroupLimit = groupLimitState.reached;

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

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Grupos"
            subtitle="Crea la estructura desde la que SyncPlans deja de depender solo de ti."
          />

          <Card style={styles.surfaceCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando tus grupos…</div>
                <div style={styles.loadingSub}>
                  Preparando tus grupos e invitaciones
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={1120} style={styles.page}>
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

      <Section>
        <PremiumHeader
          title="Grupos"
          subtitle="Crea los espacios donde la coordinación se comparte de verdad y deja de vivir solo en tu cabeza."
        />

        <Card style={styles.surfaceCard}>
          <Section style={styles.contentStack}>
            <div style={styles.headerRow}>
              <div style={styles.headerCopy}>
                <div style={styles.kicker}>Personas con las que te organizas</div>
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
                  style={{ ...styles.primary, opacity: reachedGroupLimit ? 0.92 : 1 }}
                  onClick={() =>
                    reachedGroupLimit ? router.push("/planes") : router.push("/groups/new")
                  }
                >
                  {reachedGroupLimit ? "Ver planes" : "+ Nuevo grupo"}
                </button>
              </div>
            </div>

            <Card tone="muted" style={styles.heroSection}>
              <div style={styles.heroLeft}>
                <div style={styles.heroPill}>
                  <span style={styles.heroDot} />
                  Personas con las que te organizas
                </div>

                <h2 style={styles.heroTitle}>
                  Grupos para coordinar sin fricciones
                </h2>

                <p style={styles.heroText}>
                  Cada grupo abre un espacio real para coordinar con otras personas. Aquí decides quién entra al sistema: pareja, familia o grupos compartidos como amigos, deporte o equipos.
                </p>

                <div style={styles.heroTip}>
                  <div style={styles.heroTipLabel}>Tip</div>
                  <p style={styles.heroTipText}>
                    Crea primero el grupo de <b>Pareja</b> o <b>Familia</b>. Después suma a la otra persona: ahí es cuando SyncPlans deja de ser una estructura bonita y empieza a coordinar tiempo real.
                  </p>
                </div>
              </div>

              <Card tone="strong" style={styles.heroSummary}>
                <div style={styles.heroSummaryTitle}>Resumen de tus grupos</div>

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
                  El grupo activo es la base desde la que se crean planes, se comparan agendas y se detectan choques.
                </div>
              </Card>
            </Card>


            {reachedGroupLimit ? (
              <Card tone="muted" style={styles.limitBanner}>
                <div style={styles.limitBannerTop}>
                  <div>
                    <div style={styles.limitBannerBadge}>Free</div>
                    <div style={styles.limitBannerTitle}>
                      Ya usaste tu grupo incluido en Free.
                    </div>
                  </div>

                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() => router.push("/planes")}
                  >
                    Ver planes
                  </button>
                </div>

                <p style={styles.limitBannerCopy}>
                  Tu base ya está creada. Premium abre más espacios compartidos
                  cuando necesitas coordinar más de {groupLimitState.limit} grupo
                  sin salirte del mismo sistema.
                </p>
              </Card>
            ) : null}

            <div style={styles.filtersRow}>
              <div style={styles.segment}>
                <button
                  type="button"
                  style={{
                    ...styles.segmentBtn,
                    ...(filter === "all" ? styles.segmentBtnActive : {}),
                  }}
                  onClick={() => setFilter("all")}
                >
                  Todos
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.segmentBtn,
                    ...(filter === "pair" ? styles.segmentBtnActive : {}),
                  }}
                  onClick={() => setFilter("pair")}
                >
                  Pareja
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.segmentBtn,
                    ...(filter === "family" ? styles.segmentBtnActive : {}),
                  }}
                  onClick={() => setFilter("family")}
                >
                  Familia
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.segmentBtn,
                    ...(filter === "shared" ? styles.segmentBtnActive : {}),
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
            </div>

            {loading ? (
              <Card tone="muted" style={styles.stateCard}>
                <div style={styles.loadingRow}>
                  <div style={styles.loadingDot} />
                  <div>
                    <div style={styles.loadingTitle}>Cargando grupos…</div>
                    <div style={styles.loadingSub}>Un momento, por favor.</div>
                  </div>
                </div>
              </Card>
            ) : filteredGroups.length === 0 ? (
              <Card tone="muted" style={styles.emptyState}>
                <h2 style={styles.emptyTitle}>Aún no tienes espacios compartidos</h2>
                <p style={styles.emptySub}>
                  Crea tu primer grupo de pareja, familia o compartido para
                  sacar la coordinación del chat y empezar a moverla dentro de SyncPlans.
                </p>
                <div style={styles.emptyActions}>
                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() =>
                      reachedGroupLimit ? router.push("/planes") : router.push("/groups/new")
                    }
                  >
                    {reachedGroupLimit ? "Ver planes" : "Crear primer grupo"}
                  </button>
                </div>
              </Card>
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
          </Section>
        </Card>
      </Section>
    </MobileScaffold>
  );
}

function GroupRow({
  g,
  onActivate,
}: {
  g: GroupWithRole;
  onActivate: (id: string) => void;
}) {
  const router = useRouter();
  const meta = metaForGroupType(g.type);

  return (
    <Card tone="muted" style={styles.groupRow}>
      <div style={styles.groupLeft}>
        <div style={styles.groupAvatar}>
          <span
            style={{
              ...styles.groupAvatarDot,
              background: meta.dot,
            }}
          />
        </div>

        <div style={styles.groupCopy}>
          <div style={styles.groupName}>{g.name || meta.label}</div>
          <div style={styles.groupMetaRow}>
            <span style={styles.groupMetaType}>
              {getGroupTypeLabel(g.type as any)}
            </span>
            <span style={styles.dotSeparator}>•</span>
            <span style={styles.groupMetaMembers}>
              {g.members_count} persona{g.members_count === 1 ? "" : "s"}
            </span>
            <span style={styles.dotSeparator}>•</span>
            <span style={styles.groupMetaRole}>{roleLabel(g.role)}</span>
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
          onClick={() => router.push(`/groups/${g.id}`)}
        >
          Ver detalles
        </button>
      </div>
    </Card>
  );
}

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

const styles: Record<string, React.CSSProperties> = {
  page: {
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
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

  surfaceCard: {
    gap: 0,
  },

  contentStack: {
    marginBottom: 0,
  },

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    flexWrap: "wrap",
    width: "100%",
  },
  headerCopy: {
    minWidth: 0,
    flex: "1 1 320px",
    width: "100%",
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
    maxWidth: 460,
    width: "100%",
    lineHeight: 1.65,
    overflowWrap: "break-word",
  },

  topActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    width: "100%",
  },

  heroSection: {
    marginTop: 4,
    display: "flex",
    gap: 18,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  heroLeft: {
    flex: 1,
    minWidth: 240,
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
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.65,
    color: "rgba(226,232,240,0.96)",
  },
  heroTip: {
    marginTop: 12,
    padding: 12,
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
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.96)",
  },

  heroSummary: {
    width: "100%",
    maxWidth: 240,
    alignSelf: "stretch",
  },
  heroSummaryTitle: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 8,
  },
  heroSummaryRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
    marginBottom: 6,
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
    marginTop: 8,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(148,163,184,0.96)",
  },


  limitBanner: {
    display: "grid",
    gap: 12,
    border: "1px solid rgba(56,189,248,0.20)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.10), rgba(37,99,235,0.08))",
  },
  limitBannerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  limitBannerBadge: {
    alignSelf: "flex-start",
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(56,189,248,0.12)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  limitBannerTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  limitBannerCopy: {
    margin: 0,
    color: "rgba(226,232,240,0.84)",
    lineHeight: 1.6,
    fontSize: 14,
  },
  filtersRow: {
    marginTop: 2,
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
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  segmentBtn: {
    padding: "8px 12px",
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
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
  },

  stateCard: {
    marginTop: 2,
  },

  groupList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  groupRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 12,
    padding: 14,
    flexWrap: "wrap",
    width: "100%",
  },
  groupLeft: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    flex: "1 1 280px",
    minWidth: 0,
  },
  groupCopy: {
    minWidth: 0,
    flex: 1,
  },
  groupAvatar: {
    width: 36,
    height: 36,
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
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: 0,
  },
  groupMetaRow: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    display: "flex",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
    minWidth: 0,
  },
  dotSeparator: {
    opacity: 0.7,
  },
  groupMetaType: {},
  groupMetaMembers: {},
  groupMetaRole: {},

  groupRight: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
    flex: "1 1 100%",
    minWidth: 0,
    width: "100%",
  },

  activateBtn: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(224,242,254,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 0,
    maxWidth: "100%",
    flex: "1 1 160px",
    textAlign: "center",
  },
  activeBadge: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.75)",
    background: "rgba(22,163,74,0.16)",
    color: "rgba(220,252,231,0.98)",
    fontSize: 12,
    fontWeight: 800,
    minWidth: 0,
    maxWidth: "100%",
    flex: "1 1 160px",
    textAlign: "center",
  },
  linkBtn: {
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "rgba(226,232,240,0.98)",
    fontSize: 12,
    cursor: "pointer",
    fontWeight: 800,
    minWidth: 0,
    maxWidth: "100%",
    flex: "1 1 160px",
    textAlign: "center",
  },

  emptyState: {
    textAlign: "center",
  },
  emptyTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
  },
  emptySub: {
    marginTop: 6,
    marginBottom: 0,
    fontSize: 13,
    lineHeight: 1.65,
    color: "rgba(209,213,219,0.96)",
  },
  emptyActions: {
    marginTop: 12,
    display: "flex",
    justifyContent: "center",
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
    flex: "1 1 180px",
    minWidth: 0,
    textAlign: "center",
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
    flex: "1 1 180px",
    minWidth: 0,
    textAlign: "center",
  },
};