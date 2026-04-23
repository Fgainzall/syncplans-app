// src/app/groups/GroupsPageClient.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import LogoutButton from "@/components/LogoutButton";

import supabase from "@/lib/supabaseClient";
import { getMyGroups, getGroupTypeLabel } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { getMyInvitations } from "@/lib/invitationsDb";
import { buildGroupsSummary, type GroupSummary } from "@/lib/groupsSummary";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { getGroupLimitState } from "@/lib/premium";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type GroupRole = "owner" | "admin" | "member";
type GroupFilter = "all" | "pair" | "family" | "shared";

type GroupWithRole = {
  id: string;
  name: string;
  type: string;
  role: GroupRole;
  members_count: number;
  is_active: boolean;
};

type ToastState =
  | null
  | {
      title: string;
      subtitle?: string;
    };

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

function groupMeta(type: string) {
  switch (type) {
    case "pair":
      return {
        label: "Pareja",
        dot: "rgba(96,165,250,0.98)",
        soft: "rgba(96,165,250,0.14)",
        border: "rgba(96,165,250,0.24)",
      };
    case "family":
      return {
        label: "Familia",
        dot: "rgba(34,197,94,0.98)",
        soft: "rgba(34,197,94,0.12)",
        border: "rgba(34,197,94,0.22)",
      };
    default:
      return {
        label: "Compartido",
        dot: "rgba(168,85,247,0.98)",
        soft: "rgba(168,85,247,0.14)",
        border: "rgba(168,85,247,0.24)",
      };
  }
}

export default function GroupsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<GroupWithRole[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [filter, setFilter] = useState<GroupFilter>("all");
  const [toast, setToast] = useState<ToastState>(null);

  const cameFromInvite = searchParams.get("from") === "invite_accept";
  const wasAccepted = searchParams.get("accepted") === "1";

  useEffect(() => {
    void trackScreenView({
      screen: "groups",
      metadata: {
        area: "groups",
        source: "groups_hub",
      },
    });
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      await refreshData(false);

      if (!alive) return;
      setBooting(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  function pushToast(next: ToastState, timeout = 2600) {
    setToast(next);
    window.setTimeout(() => setToast(null), timeout);
  }

  async function refreshData(withToast: boolean) {
    try {
      setLoading(true);

      const [groupsData, invitesData, profileRow] = await Promise.all([
        getMyGroups(),
        getMyInvitations().catch(() => []),
        getMyProfile().catch(() => null),
      ]);

      const mapped: GroupWithRole[] = ((groupsData as any[]) || []).map((g) => ({
        id: String(g.id),
        name: g.name ?? "",
        type: g.type ?? "pair",
        role: (g.role as GroupRole) ?? "member",
        members_count: Number(g.members_count ?? 0),
        is_active: Boolean(g.is_active),
      }));

      setGroups(mapped);
      setPendingInvites(Array.isArray(invitesData) ? invitesData.length : 0);
      setProfile(profileRow ?? null);

      if (withToast) {
        pushToast({
          title: "Grupos actualizados ✅",
          subtitle: "Todo está al día.",
        });
      }
    } catch (error: any) {
      pushToast({
        title: "No se pudo actualizar",
        subtitle: error?.message ?? "Inténtalo nuevamente.",
      });
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

      void trackEvent({
        event: "group_activated",
        entityId: groupId,
        metadata: {
          screen: "groups",
          source: "groups_list",
        },
      });

      pushToast({
        title: "Grupo activo actualizado ✅",
        subtitle: "Tu calendario y tus próximos planes usarán este contexto.",
      });
    } catch (error: any) {
      pushToast({
        title: "No se pudo cambiar el grupo",
        subtitle: error?.message ?? "Inténtalo más tarde.",
      });
    }
  }

  const summary: GroupSummary = useMemo(() => buildGroupsSummary(groups), [groups]);

  const filteredGroups = useMemo(() => {
    if (filter === "all") return groups;
    if (filter === "shared") {
      return groups.filter((g) => g.type !== "pair" && g.type !== "family");
    }
    return groups.filter((g) => g.type === filter);
  }, [filter, groups]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.is_active) ?? groups[0] ?? null,
    [groups]
  );

  const groupLimitState = useMemo(
    () => getGroupLimitState(profile, groups.length),
    [profile, groups.length]
  );
  const reachedGroupLimit = groupLimitState.reached;

  const headerSubtitle =
    summary.total === 0
      ? "Aquí vivirán los espacios desde donde compartes coordinación real."
      : `Tienes ${summary.total} grupo${summary.total === 1 ? "" : "s"} para coordinar mejor tu tiempo compartido.`;

  const activeMomentumText = useMemo(() => {
    if (!activeGroup) {
      return "Tu primer grupo debería ser Pareja. Es la puerta más clara para activar el valor real de SyncPlans.";
    }

    return `${activeGroup.name || getGroupTypeLabel(activeGroup.type as any)} es hoy tu mejor punto para entrar al mismo contexto, crear planes y dejar de coordinar desde fuera.`;
  }, [activeGroup]);

  const primaryCtaLabel = reachedGroupLimit ? "Ver planes" : "+ Nuevo grupo";
  const primaryCtaAction = () => {
    if (reachedGroupLimit) {
      void trackEvent({
        event: "premium_cta_clicked",
        metadata: {
          screen: "groups",
          source: "groups_primary_cta",
          target: "/planes",
        },
      });
      router.push("/planes");
      return;
    }

    router.push("/groups/new");
  };

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Grupos"
            subtitle="Preparando tus espacios compartidos…"
          />

          <Card style={styles.surfaceCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando tus grupos…</div>
                <div style={styles.loadingSub}>Preparando tu contexto compartido</div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={1120} style={styles.page}>
      {toast ? (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <Section>
        <div style={styles.topRow}>
          <PremiumHeader
            title="Grupos"
            subtitle="Elige el contexto donde realmente te organizas con otras personas."
          />
          <div style={styles.topUtilities}>
            <LogoutButton />
          </div>
        </div>

        <Card style={styles.surfaceCard}>
          <Section style={styles.stack}>
            {cameFromInvite && wasAccepted ? (
              <Card tone="muted" style={styles.joinedBanner}>
                <div style={styles.joinedBadge}>Ya estás dentro</div>
                <h2 style={styles.joinedTitle}>Ya entraste al mismo espacio compartido</h2>
                <p style={styles.joinedText}>
                  Desde aquí todos parten de la misma base. Ese es el valor real del grupo:
                  menos mensajes cruzados, más contexto compartido y una ruta más corta hacia la acción.
                </p>
                <div style={styles.inlineActions}>
                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() => router.push("/calendar")}
                  >
                    Ver calendario
                  </button>
                  <button
                    type="button"
                    style={styles.secondary}
                    onClick={() =>
                      activeGroup
                        ? router.push(
                            `/events/new/details?type=group&groupId=${encodeURIComponent(
                              String(activeGroup.id)
                            )}`
                          )
                        : router.push("/groups/new")
                    }
                  >
                    Crear plan compartido
                  </button>
                </div>
              </Card>
            ) : null}

            <div style={styles.headerRow}>
              <div style={styles.headerCopy}>
                <div style={styles.kicker}>Personas con las que te organizas</div>
                <h1 style={styles.h1}>Tus grupos</h1>
                <p style={styles.sub}>{headerSubtitle}</p>
              </div>

              <div style={styles.inlineActions}>
                <button
                  type="button"
                  style={styles.secondary}
                  onClick={() => router.push("/invitations")}
                >
                  {pendingInvites === 0 ? "Invitaciones" : `Invitaciones (${pendingInvites})`}
                </button>

                <button type="button" style={styles.primary} onClick={primaryCtaAction}>
                  {primaryCtaLabel}
                </button>
              </div>
            </div>

            <Card tone="muted" style={styles.heroCard}>
              <div style={styles.heroLeft}>
                <div style={styles.heroPill}>
                  <span style={styles.heroDot} />
                  Espacios compartidos
                </div>

                <h2 style={styles.heroTitle}>Grupos para coordinar sin fricciones</h2>

                <p style={styles.heroText}>
                  Un grupo no es una carpeta. Es el espacio desde donde SyncPlans coordina con
                  otras personas. Aquí se concentra el contexto compartido que luego termina en
                  calendario, eventos, invitaciones y decisiones más claras.
                </p>

                <div style={styles.tipCard}>
                  <div style={styles.tipLabel}>Tip</div>
                  <p style={styles.tipText}>
                    Empieza con el grupo de <b>Pareja</b>. Es la entrada más clara para activar
                    rápido el producto y empezar a coordinar desde un solo lugar.
                  </p>
                </div>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.statsGrid}>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Total</div>
                    <div style={styles.statValue}>{summary.total}</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Pareja</div>
                    <div style={styles.statValue}>{summary.pair}</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Familia</div>
                    <div style={styles.statValue}>{summary.family}</div>
                  </div>
                  <div style={styles.statCard}>
                    <div style={styles.statLabel}>Compartidos</div>
                    <div style={styles.statValue}>{summary.shared}</div>
                  </div>
                </div>

                <div style={styles.momentumCard}>
                  <div style={styles.momentumLabel}>Grupo con más momentum</div>
                  <div style={styles.momentumBody}>{activeMomentumText}</div>
                </div>
              </div>
            </Card>

            <div style={styles.controlsRow}>
              <div style={styles.segment}>
                {[
                  ["all", "Todos"],
                  ["pair", "Pareja"],
                  ["family", "Familia"],
                  ["shared", "Compartidos"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    style={{
                      ...styles.segmentBtn,
                      ...(filter === key ? styles.segmentBtnActive : null),
                    }}
                    onClick={() => setFilter(key as GroupFilter)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button type="button" style={styles.refreshBtn} onClick={() => refreshData(true)}>
                {loading ? "Actualizando…" : "Actualizar"}
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
              <Card tone="muted" style={styles.emptyCard}>
                <h2 style={styles.emptyTitle}>Todavía no hay grupos aquí</h2>
                <p style={styles.emptySub}>
                  Este es el primer paso del loop compartido: crea el espacio, genera el
                  primer plan y deja que SyncPlans convierta ese grupo en coordinación real
                  lo más rápido posible.
                </p>
                <div style={styles.emptyHint}>
                  Ruta sugerida: <b>crear grupo</b> → <b>crear plan compartido</b> → <b>invitar o compartir</b>.
                </div>
                <div style={styles.inlineActions}>
                  <button type="button" style={styles.primary} onClick={primaryCtaAction}>
                    {primaryCtaLabel}
                  </button>
                  <button
                    type="button"
                    style={styles.secondary}
                    onClick={() => router.push("/summary")}
                  >
                    Volver al resumen
                  </button>
                </div>
              </Card>
            ) : (
              <div style={styles.list}>
                {filteredGroups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
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

function GroupCard({
  group,
  onActivate,
}: {
  group: GroupWithRole;
  onActivate: (id: string) => void;
}) {
  const router = useRouter();
  const meta = groupMeta(group.type);

  return (
    <Card tone="muted" style={styles.groupCard}>
      <div style={styles.groupLeft}>
        <div
          style={{
            ...styles.groupIcon,
            background: meta.soft,
            borderColor: meta.border,
          }}
        >
          <span style={{ ...styles.groupIconDot, background: meta.dot }} />
        </div>

        <div style={styles.groupCopy}>
          <div style={styles.groupName}>{group.name || meta.label}</div>
          <div style={styles.groupMeta}>
            <span>{getGroupTypeLabel(group.type as any)}</span>
            <span style={styles.metaSep}>•</span>
            <span>
              {group.members_count} persona{group.members_count === 1 ? "" : "s"}
            </span>
            <span style={styles.metaSep}>•</span>
            <span>{roleLabel(group.role)}</span>
          </div>
          <div style={styles.groupHint}>
            {group.is_active
              ? "Este es tu contexto activo ahora."
              : "Actívalo para que calendario, eventos y quick capture usen este contexto."}
          </div>
        </div>
      </div>

      <div style={styles.groupActions}>
        {group.is_active ? (
          <span style={styles.activeBadge}>Activo</span>
        ) : (
          <button
            type="button"
            style={styles.activateBtn}
            onClick={() => onActivate(group.id)}
          >
            Usar como activo
          </button>
        )}

        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => router.push(`/groups/${group.id}`)}
        >
          Detalles
        </button>
      </div>
    </Card>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  topUtilities: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  surfaceCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,14,28,0.72)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(12px)",
  },
  stack: {
    display: "grid",
    gap: 14,
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
    color: "rgba(255,255,255,0.72)",
    fontWeight: 650,
  },
  joinedBanner: {
    borderRadius: 20,
    border: "1px solid rgba(34,197,94,0.20)",
    background: "rgba(20,83,45,0.18)",
    padding: 16,
    display: "grid",
    gap: 8,
  },
  joinedBadge: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(34,197,94,0.14)",
    color: "rgba(220,252,231,0.94)",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  joinedTitle: {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  joinedText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: "rgba(220,252,231,0.84)",
    maxWidth: 780,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  headerCopy: {
    display: "grid",
    gap: 6,
    minWidth: 0,
    flex: "1 1 420px",
  },
  kicker: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  h1: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  sub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(203,213,225,0.80)",
    maxWidth: 760,
  },
  inlineActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  heroCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(280px, 0.92fr)",
    gap: 14,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.06), rgba(124,58,237,0.05) 38%, rgba(255,255,255,0.025) 100%)",
    padding: 16,
  },
  heroLeft: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  heroPill: {
    width: "fit-content",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.18)",
    background: "rgba(59,130,246,0.12)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(219,234,254,0.94)",
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(96,165,250,0.98)",
  },
  heroTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
    maxWidth: 620,
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 700,
  },
  tipCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
    maxWidth: 700,
  },
  tipLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  tipText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.82)",
  },
  heroRight: {
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  statCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.80)",
  },
  statValue: {
    fontSize: 22,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  momentumCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  momentumLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.80)",
  },
  momentumBody: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.82)",
  },
  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  segment: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  segmentBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  segmentBtnActive: {
    border: "1px solid rgba(96,165,250,0.24)",
    background: "rgba(59,130,246,0.14)",
    color: "rgba(219,234,254,0.96)",
  },
  refreshBtn: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  stateCard: {
    borderRadius: 20,
    padding: 16,
  },
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 0 8px rgba(56,189,248,0.10)",
    flexShrink: 0,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  loadingSub: {
    fontSize: 12,
    marginTop: 2,
    color: "rgba(203,213,225,0.72)",
  },
  emptyCard: {
    borderRadius: 20,
    padding: 18,
    display: "grid",
    gap: 8,
  },
  emptyTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  emptySub: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 720,
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(148,163,184,0.88)",
  },
  list: {
    display: "grid",
    gap: 10,
  },
  groupCard: {
    borderRadius: 18,
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  groupLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
    flex: "1 1 360px",
  },
  groupIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
  },
  groupIconDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },
  groupCopy: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  groupName: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(255,255,255,0.98)",
  },
  groupMeta: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    alignItems: "center",
    fontSize: 12,
    color: "rgba(203,213,225,0.80)",
    fontWeight: 800,
  },
  metaSep: {
    opacity: 0.35,
  },
  groupHint: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(148,163,184,0.88)",
  },
  groupActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  activeBadge: {
    minHeight: 34,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.22)",
    background: "rgba(34,197,94,0.14)",
    color: "rgba(220,252,231,0.94)",
    fontSize: 12,
    fontWeight: 900,
  },
  activateBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.24)",
    background: "rgba(59,130,246,0.14)",
    color: "rgba(219,234,254,0.96)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  linkBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  primary: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.24)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.96), rgba(59,130,246,0.90))",
    color: "white",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(30,64,175,0.22)",
  },
  secondary: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
};