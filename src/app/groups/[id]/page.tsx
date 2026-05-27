// src/app/groups/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import supabase from "@/lib/supabaseClient";
import { getMyGroups, getGroupTypeLabel } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { trackEvent, trackScreenView } from "@/lib/analytics";

type GroupRole = "owner" | "admin" | "member";

type GroupRecord = {
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

type GroupPageRow = {
  id: string | number;
  name?: string | null;
  type?: string | null;
  role?: GroupRole | null;
  members_count?: number | null;
  is_active?: boolean | null;
};

type GroupMeta = {
  label: string;
  dot: string;
  soft: string;
  border: string;
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

function groupMeta(type: string): GroupMeta {
  switch (type) {
    case "pair":
      return {
        label: "Pareja",
        dot: "rgba(96,165,250,0.98)",
        soft: "rgba(96,165,250,0.13)",
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

function getMemberCopy(count: number) {
  return `${count} persona${count === 1 ? "" : "s"}`;
}

function compactGroupPurpose(type: string) {
  if (type === "pair") {
    return "Planes compartidos, invitaciones y decisiones en un solo lugar.";
  }

  if (type === "family") {
    return "Organiza planes familiares sin depender de mensajes sueltos.";
  }

  return "Coordina planes, miembros e invitaciones desde un solo espacio.";
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function SmallPill({ children, meta }: { children: React.ReactNode; meta?: GroupMeta }) {
  return (
    <span
      style={{
        ...styles.smallPill,
        borderColor: meta?.border ?? "rgba(255,255,255,0.10)",
        background: meta?.soft ?? "rgba(255,255,255,0.05)",
      }}
    >
      {meta ? <span style={{ ...styles.pillDot, background: meta.dot }} /> : null}
      {children}
    </span>
  );
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = String(params?.id ?? "");

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<GroupRecord | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    void trackScreenView({
      screen: "group_detail",
      metadata: {
        area: "groups",
        source: "group_detail",
        groupId,
      },
    });
  }, [groupId]);

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

      try {
        const groups = (await getMyGroups()) as GroupPageRow[];
        if (!alive) return;

        const found = (groups || []).find((g) => String(g.id) === groupId);

        if (!found) {
          setGroup(null);
        } else {
          setGroup({
            id: String(found.id),
            name: found.name ?? "",
            type: found.type ?? "pair",
            role: (found.role as GroupRole) ?? "member",
            members_count: Number(found.members_count ?? 0),
            is_active: Boolean(found.is_active),
          });
        }
      } catch {
        if (alive) setGroup(null);
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupId, router]);

  function pushToast(next: ToastState, timeout = 2400) {
    setToast(next);
    window.setTimeout(() => setToast(null), timeout);
  }

  async function handleActivate() {
    if (!group || group.is_active) return;

    try {
      setSaving(true);
      await setActiveGroupIdInDb(group.id);

      setGroup((prev) => (prev ? { ...prev, is_active: true } : prev));

      void trackEvent({
        event: "group_activated",
        entityId: group.id,
        metadata: {
          screen: "group_detail",
          source: "group_detail",
        },
      });

      pushToast({
        title: "Grupo activo actualizado ✅",
        subtitle: "Este grupo queda como contexto principal para tus próximos planes.",
      });
    } catch (error: unknown) {
      pushToast({
        title: "No se pudo activar",
        subtitle: error instanceof Error ? error.message : "Inténtalo nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  const meta = useMemo(() => groupMeta(group?.type ?? "pair"), [group?.type]);
  const displayName = useMemo(() => {
    if (!group) return "Grupo";
    return group.name || getGroupTypeLabel(String(group.type ?? "other"));
  }, [group]);

  const activateButtonStyle: CSSProperties = {
    ...styles.secondary,
    opacity: saving ? 0.72 : 1,
    cursor: saving ? "default" : "pointer",
  };

  if (booting) {
    return (
      <MobileScaffold maxWidth={920} style={styles.page}>
        <Section style={styles.pageStack}>
          <div style={styles.topBar}>
            <button type="button" style={styles.backLink} onClick={() => router.push("/groups")}>
              ← Grupos
            </button>
          </div>

          <Card style={styles.surfaceCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando grupo…</div>
                <div style={styles.loadingSub}>Preparando el contexto compartido</div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  if (!group) {
    return (
      <MobileScaffold maxWidth={920} style={styles.page}>
        {toast ? (
          <div style={styles.toastWrap}>
            <div style={styles.toastCard}>
              <div style={styles.toastTitle}>{toast.title}</div>
              {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
            </div>
          </div>
        ) : null}

        <Section style={styles.pageStack}>
          <div style={styles.topBar}>
            <button type="button" style={styles.backLink} onClick={() => router.push("/groups")}>
              ← Grupos
            </button>
            <SmallPill>Grupo no disponible</SmallPill>
          </div>

          <Card style={styles.surfaceCard}>
            <div style={styles.emptyState}>
              <h2 style={styles.emptyTitle}>Este grupo no está disponible</h2>
              <p style={styles.emptySub}>
                Puede que ya no exista, que no tengas acceso o que el enlace no corresponda a un grupo válido.
              </p>
              <div style={styles.inlineActions}>
                <button type="button" style={styles.primary} onClick={() => router.push("/groups")}>
                  Volver a grupos
                </button>
                <button type="button" style={styles.secondary} onClick={() => router.push("/summary")}>
                  Ir al resumen
                </button>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={920} style={styles.page}>
      {toast ? (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <Section style={styles.pageStack}>
        <div style={styles.topBar}>
          <button type="button" style={styles.backLink} onClick={() => router.push("/groups")}>
            ← Grupos
          </button>

          <div style={styles.topPills}>
            <SmallPill meta={meta}>{meta.label}</SmallPill>
            <SmallPill>{group.is_active ? "Grupo activo" : "No activo"}</SmallPill>
          </div>
        </div>

        <Card
          style={{
            ...styles.heroCard,
            borderColor: meta.border,
            background: `linear-gradient(180deg, ${meta.soft}, rgba(10,14,28,0.72))`,
          }}
        >
          <div style={styles.heroTop}>
            <div style={styles.heroCopy}>
              <div style={styles.eyebrow}>Detalle del grupo</div>
              <h1 style={styles.heroTitle}>{displayName}</h1>
              <p style={styles.heroSubtitle}>{compactGroupPurpose(group.type)}</p>
            </div>

            {!group.is_active ? (
              <button type="button" style={activateButtonStyle} onClick={handleActivate} disabled={saving}>
                {saving ? "Activando…" : "Activar grupo"}
              </button>
            ) : null}
          </div>

          <div style={styles.statsGrid}>
            <DetailStat label="Tipo" value={meta.label} />
            <DetailStat label="Miembros" value={getMemberCopy(group.members_count)} />
            <DetailStat label="Tu rol" value={roleLabel(group.role)} />
            <DetailStat label="Estado" value={group.is_active ? "Activo" : "No activo"} />
          </div>

          <div style={styles.heroActions}>
            <button
              type="button"
              style={styles.primary}
              onClick={() => router.push(`/events/new/details?type=group&groupId=${encodeURIComponent(group.id)}`)}
            >
              Crear plan
            </button>

            <button
              type="button"
              style={styles.secondary}
              onClick={() => router.push(`/groups/invite?groupId=${encodeURIComponent(group.id)}`)}
            >
              Invitar miembro
            </button>

            <button
              type="button"
              style={styles.ghostButton}
              onClick={() => router.push(`/members?groupId=${encodeURIComponent(group.id)}`)}
            >
              Ver miembros
            </button>
          </div>
        </Card>


        <div style={styles.contentGrid}>
          <Card tone="muted" style={styles.infoCard}>
            <div style={styles.infoIcon}>👥</div>
            <div style={styles.infoCopy}>
              <div style={styles.sectionTitle}>Miembros</div>
              <p style={styles.sectionBody}>{getMemberCopy(group.members_count)} con acceso a este grupo.</p>
            </div>
            <button
              type="button"
              style={styles.cardAction}
              onClick={() => router.push(`/members?groupId=${encodeURIComponent(group.id)}`)}
            >
              Ver miembros
            </button>
          </Card>

          <Card tone="muted" style={styles.infoCard}>
            <div style={styles.infoIcon}>✉️</div>
            <div style={styles.infoCopy}>
              <div style={styles.sectionTitle}>Invitaciones</div>
              <p style={styles.sectionBody}>Agrega a la persona correcta a este espacio.</p>
            </div>
            <button
              type="button"
              style={styles.cardAction}
              onClick={() => router.push(`/groups/invite?groupId=${encodeURIComponent(group.id)}`)}
            >
              Invitar
            </button>
          </Card>
        </div>

        <div style={styles.footerActions}>
          <button type="button" style={styles.footerAction} onClick={() => router.push("/calendar")}>
            <span style={styles.footerActionTitle}>Abrir calendario</span>
            <span style={styles.footerActionSub}>Ver planes y cruces.</span>
          </button>

          <button type="button" style={styles.footerAction} onClick={() => router.push("/groups")}>
            <span style={styles.footerActionTitle}>Otros grupos</span>
            <span style={styles.footerActionSub}>Cambiar de espacio.</span>
          </button>
        </div>
      </Section>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  pageStack: {
    display: "grid",
    gap: 12,
  },
  surfaceCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,14,28,0.72)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(12px)",
  },
  topBar: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  topPills: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
  },
  backLink: {
    minHeight: 34,
    padding: "0 2px",
    border: "none",
    background: "transparent",
    color: "rgba(226,232,240,0.84)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  smallPill: {
    minHeight: 30,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.91)",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1,
    whiteSpace: "nowrap",
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    flexShrink: 0,
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
  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: 16,
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
  emptyState: {
    padding: 18,
    display: "grid",
    gap: 10,
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
  inlineActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  heroCard: {
    display: "grid",
    gap: 16,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    padding: 18,
    overflow: "hidden",
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(12px)",
  },
  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  heroCopy: {
    display: "grid",
    gap: 6,
    minWidth: 0,
    flex: "1 1 320px",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    color: "rgba(125,211,252,0.84)",
  },
  heroTitle: {
    margin: 0,
    fontSize: "clamp(30px, 8vw, 46px)",
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    color: "rgba(255,255,255,0.98)",
  },
  heroSubtitle: {
    margin: 0,
    maxWidth: 640,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.80)",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
    gap: 10,
  },
  statCard: {
    minWidth: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "12px 12px",
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.90)",
  },
  statValue: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
    lineHeight: 1.2,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primary: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 15,
    border: "1px solid rgba(96,165,250,0.24)",
    background: "linear-gradient(135deg, rgba(37,99,235,0.96), rgba(59,130,246,0.90))",
    color: "white",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 28px rgba(30,64,175,0.22)",
    whiteSpace: "nowrap",
  },
  secondary: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.045)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 14,
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  ghostButton: {
    minHeight: 46,
    padding: "0 14px",
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "rgba(226,232,240,0.86)",
    fontSize: 14,
    fontWeight: 850,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  noticeCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    borderRadius: 20,
    padding: 16,
    border: "1px solid rgba(251,191,36,0.16)",
    background: "rgba(251,191,36,0.06)",
  },
  noticeCopy: {
    display: "grid",
    gap: 3,
    minWidth: 0,
    flex: "1 1 280px",
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "rgba(255,255,255,0.95)",
  },
  noticeText: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.76)",
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 12,
  },
  infoCard: {
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 12,
    alignItems: "start",
    minWidth: 0,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.045)",
    fontSize: 17,
  },
  infoCopy: {
    display: "grid",
    gap: 4,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 17,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  sectionBody: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.78)",
  },
  cardAction: {
    gridColumn: "1 / -1",
    justifySelf: "start",
    minHeight: 38,
    marginTop: 2,
    padding: "0 12px",
    borderRadius: 13,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  footerActions: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
  },
  footerAction: {
    minWidth: 0,
    textAlign: "left",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.018))",
    padding: "14px 15px",
    display: "grid",
    gap: 4,
    cursor: "pointer",
    color: "rgba(255,255,255,0.96)",
  },
  footerActionTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  footerActionSub: {
    fontSize: 12.5,
    lineHeight: 1.45,
    color: "rgba(203,213,225,0.75)",
  },
};
