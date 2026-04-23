// src/app/groups/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams, useRouter } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import LogoutButton from "@/components/LogoutButton";
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
        const groups = (await getMyGroups()) as any[];
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
        subtitle: "Este contexto ya está listo para calendario, eventos y captura rápida.",
      });
    } catch (error: any) {
      pushToast({
        title: "No se pudo activar",
        subtitle: error?.message ?? "Inténtalo nuevamente.",
      });
    } finally {
      setSaving(false);
    }
  }

  const meta = useMemo(() => groupMeta(group?.type ?? "pair"), [group?.type]);

  const heroTitle = useMemo(() => {
    if (!group) return "Grupo no encontrado";
    if (group.type === "pair") return "Aquí empieza la coordinación entre ustedes";
    if (group.type === "family") return "Aquí vive la coordinación familiar";
    return "Aquí vive la coordinación compartida";
  }, [group]);

  const heroText = useMemo(() => {
    if (!group) {
      return "No pudimos encontrar este grupo dentro de tus espacios actuales.";
    }

    if (group.type === "pair") {
      return "Este grupo debería convertirse en el centro de la agenda compartida: menos mensajes cruzados, menos supuestos y una sola referencia clara entre ustedes.";
    }

    if (group.type === "family") {
      return "Este grupo sirve para ordenar mejor el tiempo familiar desde un solo contexto, sin depender de memoria o conversaciones separadas.";
    }

    return "Este grupo sirve para coordinar con otras personas desde un solo lugar, con menos ruido y más claridad operativa.";
  }, [group]);

  if (booting) {
    return (
      <MobileScaffold maxWidth={1120} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Grupo"
            subtitle="Preparando este espacio compartido…"
          />
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
              title="Grupo"
              subtitle="No pudimos abrir este espacio"
            />
            <LogoutButton />
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
            title={group.name || getGroupTypeLabel(group.type as any)}
            subtitle="Detalle del grupo y siguiente mejor paso dentro de este contexto."
          />
          <div style={styles.inlineActions}>
            <button type="button" style={styles.secondary} onClick={() => router.push("/groups")}>
              Volver a grupos
            </button>
            <LogoutButton />
          </div>
        </div>

        <Card style={styles.surfaceCard}>
          <Section style={styles.stack}>
            <Card
              tone="muted"
              style={{
                ...styles.heroCard,
                borderColor: meta.border,
                background: `linear-gradient(180deg, ${meta.soft}, rgba(255,255,255,0.03))`,
              }}
            >
              <div style={styles.heroLeft}>
                <div style={styles.heroPill}>
                  <span style={{ ...styles.heroDot, background: meta.dot }} />
                  {meta.label}
                </div>

                <h1 style={styles.heroTitle}>{heroTitle}</h1>
                <p style={styles.heroText}>{heroText}</p>

                <div style={styles.metaRow}>
                  <span style={styles.metaPill}>{roleLabel(group.role)}</span>
                  <span style={styles.metaPillSoft}>
                    {group.members_count} persona{group.members_count === 1 ? "" : "s"}
                  </span>
                  {group.is_active ? (
                    <span style={styles.activeBadge}>Contexto activo</span>
                  ) : null}
                </div>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.nextStepCard}>
                  <div style={styles.nextStepLabel}>Siguiente mejor paso</div>
                  <div style={styles.nextStepTitle}>
                    {group.type === "pair"
                      ? "Crear el próximo plan entre ustedes"
                      : "Crear el próximo plan en este grupo"}
                  </div>
                  <div style={styles.nextStepText}>
                    El grupo cobra valor real cuando dejas de verlo como estructura y lo conviertes en agenda compartida.
                  </div>
                </div>

                <div style={styles.inlineActions}>
                  {!group.is_active ? (
                    <button
                      type="button"
                      style={styles.secondary}
                      onClick={handleActivate}
                      disabled={saving}
                    >
                      {saving ? "Activando…" : "Usar como activo"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    style={styles.primary}
                    onClick={() =>
                      router.push(
                        `/events/new/details?type=group&groupId=${encodeURIComponent(group.id)}`
                      )
                    }
                  >
                    Crear plan
                  </button>
                </div>
              </div>
            </Card>

            <div style={styles.grid}>
              <Card tone="muted" style={styles.infoCard}>
                <div style={styles.sectionEyebrow}>Este grupo hoy</div>
                <div style={styles.sectionTitle}>Qué representa</div>
                <p style={styles.sectionBody}>
                  {group.type === "pair"
                    ? "Un solo espacio para que ambos partan de la misma referencia. Menos fricción, menos supuestos y más claridad compartida."
                    : group.type === "family"
                      ? "Un punto común para ordenar decisiones, horarios y próximos planes familiares."
                      : "Un lugar operativo para que un grupo comparta contexto, calendario y próximos pasos sin perder claridad."}
                </p>
              </Card>

              <Card tone="muted" style={styles.infoCard}>
                <div style={styles.sectionEyebrow}>Qué deberías hacer ahora</div>
                <div style={styles.sectionTitle}>Ruta sugerida</div>
                <div style={styles.routeList}>
                  <div style={styles.routeItem}>1. Activar este grupo si aún no está activo</div>
                  <div style={styles.routeItem}>2. Crear el siguiente plan compartido</div>
                  <div style={styles.routeItem}>3. Volver aquí cuando necesites ordenar el contexto</div>
                </div>
              </Card>
            </div>

            <div style={styles.actionGrid}>
              <button
                type="button"
                style={styles.actionCard}
                onClick={() =>
                  router.push(
                    `/events/new/details?type=group&groupId=${encodeURIComponent(group.id)}`
                  )
                }
              >
                <div style={styles.actionTitle}>Crear plan</div>
                <div style={styles.actionSub}>
                  Lleva una idea a evento sin salir de este contexto.
                </div>
              </button>

              <button
                type="button"
                style={styles.actionCard}
                onClick={() => router.push("/calendar")}
              >
                <div style={styles.actionTitle}>Abrir calendario</div>
                <div style={styles.actionSub}>
                  Ver cómo este grupo se mezcla con el resto de tu agenda.
                </div>
              </button>

              <button
                type="button"
                style={styles.actionCard}
                onClick={() => router.push("/groups")}
              >
                <div style={styles.actionTitle}>Ver otros grupos</div>
                <div style={styles.actionSub}>
                  Cambiar de contexto o revisar otro espacio compartido.
                </div>
              </button>
            </div>
          </Section>
        </Card>
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
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
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
  inlineActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
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
  heroCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.06fr) minmax(280px, 0.94fr)",
    gap: 14,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
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
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
    maxWidth: 720,
  },
  heroText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 720,
  },
  metaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  metaPill: {
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(255,255,255,0.94)",
  },
  metaPillSoft: {
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(226,232,240,0.78)",
  },
  activeBadge: {
    minHeight: 32,
    display: "inline-flex",
    alignItems: "center",
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.22)",
    background: "rgba(34,197,94,0.14)",
    color: "rgba(220,252,231,0.94)",
    fontSize: 12,
    fontWeight: 900,
  },
  heroRight: {
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  nextStepCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px 14px",
    display: "grid",
    gap: 5,
  },
  nextStepLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  nextStepTitle: {
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
  },
  nextStepText: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.80)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  infoCard: {
    borderRadius: 20,
    padding: 16,
    display: "grid",
    gap: 8,
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  sectionBody: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
  },
  routeList: {
    display: "grid",
    gap: 8,
  },
  routeItem: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.82)",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },
  actionCard: {
    textAlign: "left",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
    padding: "16px 16px",
    display: "grid",
    gap: 8,
    cursor: "pointer",
    color: "rgba(255,255,255,0.96)",
    boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.25,
  },
  actionSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.78)",
  },
}