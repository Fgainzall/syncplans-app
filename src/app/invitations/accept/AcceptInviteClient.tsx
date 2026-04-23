// src/app/invitations/accept/AcceptInviteClient.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import LogoutButton from "@/components/LogoutButton";

import supabase from "@/lib/supabaseClient";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { createConflictNotificationForGroup } from "@/lib/notificationsDb";
import {
  acceptInvitation,
  declineInvitation,
  getInvitationById,
  type GroupInvitation,
} from "@/lib/invitationsDb";
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { hasPremiumAccess } from "@/lib/premium";
import { trackEvent, trackEventOnce, trackScreenView } from "@/lib/analytics";

type BusyState = "accept" | "decline" | null;
type ToastState = null | { title: string; subtitle?: string };

function isUuid(x: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    x
  );
}

function labelType(t?: string | null) {
  const s = String(t ?? "").toLowerCase();
  if (s === "pair" || s === "couple") return "Pareja";
  if (s === "family") return "Familia";
  if (s === "solo" || s === "personal") return "Personal";
  if (s === "other" || s === "shared") return "Compartido";
  return t ? String(t) : "Grupo";
}

function labelRole(role?: string | null) {
  const s = String(role ?? "member").toLowerCase();
  if (s === "owner") return "Owner";
  if (s === "admin") return "Admin";
  return "Miembro";
}

function groupMeta(type?: string | null) {
  const s = String(type ?? "").toLowerCase();
  if (s === "pair" || s === "couple") {
    return {
      label: "Pareja",
      dot: "rgba(96,165,250,0.98)",
      soft: "rgba(96,165,250,0.14)",
      border: "rgba(96,165,250,0.24)",
    };
  }
  if (s === "family") {
    return {
      label: "Familia",
      dot: "rgba(34,197,94,0.98)",
      soft: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.22)",
    };
  }
  return {
    label: "Compartido",
    dot: "rgba(168,85,247,0.98)",
    soft: "rgba(168,85,247,0.14)",
    border: "rgba(168,85,247,0.24)",
  };
}

function getValueBullets(inv: GroupInvitation | null) {
  const type = String(inv?.group_type ?? "").toLowerCase();

  if (type === "pair" || type === "couple") {
    return [
      "Ambos ven el mismo contexto y dejan de coordinar desde mensajes sueltos.",
      "Los planes compartidos dejan de depender de interpretaciones distintas.",
      "Si algo ya choca con tu agenda, SyncPlans te lo muestra apenas entras.",
    ];
  }

  if (type === "family") {
    return [
      "Todos parten de la misma versión de lo que ya quedó acordado.",
      "Las agendas nuevas no se suman a ciegas: entran con contexto.",
      "Si hay cruces importantes, el sistema te lleva directo a revisarlos.",
    ];
  }

  return [
    "Entras al mismo espacio que ya están usando los demás.",
    "Los próximos planes dejan de quedar repartidos entre mensajes, memoria y supuestos.",
    "Si tu llegada genera un choque real, SyncPlans lo hace visible desde el inicio.",
  ];
}

function getFlowSteps(pending: boolean) {
  return pending
    ? [
        "Aceptar la invitación",
        "Entrar al mismo contexto compartido",
        "Ver si ya hay algo importante por revisar",
        "Crear o ver el primer plan juntos",
      ]
    : [
        "La invitación ya fue respondida",
        "Entrar al contexto compartido",
        "Continuar desde calendario o grupo",
      ];
}

function getHeroTitle(inv: GroupInvitation | null, pending: boolean) {
  const groupName = String(inv?.group_name ?? "").trim();

  if (!inv) return "Entra al mismo espacio que el resto";
  if (!pending) {
    return groupName
      ? `Ya tienes acceso a ${groupName}`
      : "Esta invitación ya fue respondida";
  }

  return groupName
    ? `Entra a ${groupName} y compartan la misma agenda`
    : "Acepta y entra al mismo espacio compartido";
}

function StatusPill({ status }: { status: string | null | undefined }) {
  const s = String(status ?? "").toLowerCase();
  const meta =
    s === "pending"
      ? {
          label: "Pendiente",
          bg: "rgba(251,191,36,0.14)",
          bd: "rgba(251,191,36,0.28)",
          dot: "rgba(251,191,36,0.95)",
        }
      : s === "accepted"
        ? {
            label: "Aceptada",
            bg: "rgba(34,197,94,0.14)",
            bd: "rgba(34,197,94,0.28)",
            dot: "rgba(34,197,94,0.95)",
          }
        : s === "declined"
          ? {
              label: "Rechazada",
              bg: "rgba(248,113,113,0.14)",
              bd: "rgba(248,113,113,0.28)",
              dot: "rgba(248,113,113,0.95)",
            }
          : {
              label: status || "Estado",
              bg: "rgba(255,255,255,0.08)",
              bd: "rgba(255,255,255,0.12)",
              dot: "rgba(255,255,255,0.7)",
            };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${meta.bd}`,
        background: meta.bg,
        fontSize: 12,
        fontWeight: 900,
        opacity: 0.95,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: meta.dot }} />
      {meta.label}
    </span>
  );
}

export default function AcceptInviteClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const inviteId = useMemo(
    () => sp.get("invite") || sp.get("inviteId") || "",
    [sp]
  );

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BusyState>(null);
  const [inv, setInv] = useState<GroupInvitation | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const navTimerRef = useRef<number | null>(null);

  function clearTimers() {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (navTimerRef.current) {
      window.clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
  }

  function showToast(t: ToastState) {
    if (!t) return;
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(t);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }

  useEffect(() => {
    return () => clearTimers();
  }, []);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!inviteId || !isUuid(inviteId)) {
          setInv(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        setLoading(true);

        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          const next = encodeURIComponent(
            window.location.pathname + window.location.search
          );
          router.replace(`/auth/login?next=${next}`);
          return;
        }

        setCurrentUserId(data.session.user.id);

        const [invitation, fetchedProfile] = await Promise.all([
          getInvitationById(inviteId),
          getMyProfile().catch(() => null),
        ]);

        if (!alive) return;

        setInv(invitation ?? null);
        setProfile(fetchedProfile ?? null);
      } catch (e: any) {
        if (!alive) return;
        setInv(null);
        setProfile(null);
        showToast({
          title: "No se pudo cargar la invitación",
          subtitle: e?.message || "Intenta otra vez.",
        });
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [inviteId, router]);

  useEffect(() => {
    if (!inviteId) return;
    void trackScreenView({
      screen: "invitation_accept",
      userId: currentUserId ?? undefined,
      metadata: { area: "invitations", invite_id: inviteId },
    });
  }, [inviteId, currentUserId]);

  useEffect(() => {
    if (!inviteId || !inv) return;

    void trackEventOnce({
      event: "invite_opened",
      userId: currentUserId ?? undefined,
      entityId: inviteId,
      scope: "session",
      onceKey: `funnel:invite_opened:${inviteId}`,
      metadata: {
        screen: "invitation_accept",
        source: "invitation_accept",
        invite_kind: "group_internal",
        invite_id: inviteId,
        group_id: inv.group_id,
        group_type: inv.group_type ?? null,
        role: inv.role ?? null,
        status: String(inv.status ?? "pending").toLowerCase(),
      },
    });
  }, [inviteId, inv, currentUserId]);

  const status = String(inv?.status ?? "").toLowerCase();
  const pending = status === "pending";
  const hasPremium = hasPremiumAccess(profile);
  const shouldShowPremiumNudge = !hasPremium && pending;
  const valueBullets = useMemo(() => getValueBullets(inv), [inv]);
  const flowSteps = useMemo(() => getFlowSteps(pending), [pending]);
  const meta = useMemo(() => groupMeta(inv?.group_type), [inv?.group_type]);

  useEffect(() => {
    if (!shouldShowPremiumNudge || !inviteId || !inv) return;

    void trackEventOnce({
      event: "premium_viewed",
      userId: currentUserId ?? undefined,
      entityId: inviteId,
      scope: "session",
      onceKey: `premium_viewed:invitation_accept:${inviteId}`,
      metadata: {
        screen: "invitation_accept",
        source: "invitation_accept_nudge",
        group_id: inv.group_id,
        group_type: inv.group_type ?? null,
        invite_kind: "group_internal",
      },
    });
  }, [shouldShowPremiumNudge, inviteId, inv, currentUserId]);

  async function onAccept() {
    if (!inviteId || !inv || busy) return;

    setBusy("accept");

    try {
      const res = await acceptInvitation(inviteId);
      if (!res?.ok) {
        throw new Error(res?.error || "No se pudo aceptar.");
      }

      void trackEvent({
        event: "invite_accepted",
        userId: currentUserId ?? undefined,
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          invite_kind: "group_internal",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
          role: inv.role ?? null,
        },
      });

      setInv((prev) => (prev ? { ...prev, status: "accepted" as any } : prev));

      try {
        await setActiveGroupIdInDb(inv.group_id);
      } catch {
        // best-effort
      }

      try {
        window.dispatchEvent(
          new CustomEvent("sp:invite-accepted", {
            detail: { groupId: inv.group_id, inviteId },
          })
        );
      } catch {
        // ignore
      }

      const conflictResult = await createConflictNotificationForGroup(
        inv.group_id
      ).catch(() => ({
        created: 0,
        conflictCount: 0,
        targetEventId: null as string | null,
      }));

      if (conflictResult.conflictCount > 0) {
        showToast({
          title: "⚠️ Ya estás dentro y hay algo importante por revisar",
          subtitle:
            "Tu llegada activó un choque visible. Te llevo directo para que entres con claridad, no con ruido.",
        });

        const qp = new URLSearchParams();
        if (conflictResult.targetEventId) {
          qp.set("eventId", conflictResult.targetEventId);
        }
        qp.set("from", "invite_accept");
        qp.set("groupId", inv.group_id);

        navTimerRef.current = window.setTimeout(() => {
          router.push(`/conflicts/detected?${qp.toString()}`);
        }, 700);

        return;
      }

      showToast({
        title: "✅ Ya entraste al mismo contexto que el resto",
        subtitle:
          "Ahora te llevo al grupo activo para que veas qué ya está en movimiento y qué te toca revisar primero.",
      });

      navTimerRef.current = window.setTimeout(() => {
        router.push(`/groups/${inv.group_id}?from=invite_accept&accepted=1`);
      }, 700);
    } catch (e: any) {
      showToast({
        title: "No se pudo aceptar",
        subtitle: e?.message || "Intenta otra vez.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function onDecline() {
    if (!inviteId || !inv || busy) return;

    setBusy("decline");

    try {
      const res = await declineInvitation(inviteId);
      if (!res?.ok) {
        throw new Error(res?.error || "No se pudo rechazar.");
      }

      void trackEvent({
        event: "invite_declined",
        userId: currentUserId ?? undefined,
        entityId: inviteId,
        metadata: {
          screen: "invitation_accept",
          source: "invitation_accept",
          invite_kind: "group_internal",
          group_id: inv.group_id,
          group_type: inv.group_type ?? null,
          role: inv.role ?? null,
        },
      });

      setInv((prev) => (prev ? { ...prev, status: "declined" as any } : prev));

      showToast({
        title: "Invitación rechazada",
        subtitle: "No se hicieron cambios en tus grupos.",
      });
    } catch (e: any) {
      showToast({
        title: "No se pudo rechazar",
        subtitle: e?.message || "Intenta otra vez.",
      });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <MobileScaffold maxWidth={980} style={styles.page}>
        <Section>
          <PremiumHeader
            title="Aceptar invitación"
            subtitle="Preparando el contexto compartido…"
          />
          <Card style={styles.surfaceCard}>
            <div style={styles.loadingRow}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando invitación…</div>
                <div style={styles.loadingSub}>Un momento, por favor.</div>
              </div>
            </div>
          </Card>
        </Section>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={980} style={styles.page}>
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
            title="Invitación"
            subtitle="Entrar al mismo contexto debería sentirse claro, no técnico."
          />
          <LogoutButton />
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

                <div style={styles.heroTitle}>{getHeroTitle(inv, pending)}</div>

                <div style={styles.heroText}>
                  {pending
                    ? "Aceptar esta invitación no solo te mete a un grupo. Te mete a la misma versión compartida de lo que ya está en marcha."
                    : "La invitación ya no está pendiente, pero este contexto sigue siendo la mejor puerta para entender qué está pasando y qué te toca ahora."}
                </div>

                <div style={styles.heroMetaRow}>
                  <StatusPill status={inv?.status} />
                  {inv?.group_name ? (
                    <span style={styles.metaPillSoft}>{inv.group_name}</span>
                  ) : null}
                  {inv?.role ? (
                    <span style={styles.metaPillSoft}>{labelRole(inv.role)}</span>
                  ) : null}
                </div>
              </div>

              <div style={styles.heroRight}>
                <div style={styles.miniCard}>
                  <div style={styles.miniLabel}>Grupo</div>
                  <div style={styles.miniValue}>
                    {inv?.group_name || "Grupo compartido"}
                  </div>
                </div>

                <div style={styles.miniCard}>
                  <div style={styles.miniLabel}>Tipo</div>
                  <div style={styles.miniValue}>{labelType(inv?.group_type)}</div>
                </div>
              </div>
            </Card>

            <div style={styles.grid}>
              <Card tone="muted" style={styles.leftCard}>
                <div style={styles.sectionEyebrow}>Qué ganas al entrar</div>
                <div style={styles.sectionTitle}>Una sola referencia compartida</div>

                <div style={styles.bullets}>
                  {valueBullets.map((item) => (
                    <div key={item} style={styles.bulletItem}>
                      <span style={styles.bulletDot} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {pending ? (
                  <div style={styles.actionsRow}>
                    <button
                      type="button"
                      onClick={onAccept}
                      disabled={busy !== null}
                      style={{
                        ...styles.primary,
                        ...(busy !== null ? styles.primaryDisabled : null),
                      }}
                    >
                      {busy === "accept" ? "Aceptando…" : "Aceptar invitación"}
                    </button>

                    <button
                      type="button"
                      onClick={onDecline}
                      disabled={busy !== null}
                      style={styles.secondary}
                    >
                      {busy === "decline" ? "Rechazando…" : "Rechazar"}
                    </button>
                  </div>
                ) : (
                  <div style={styles.actionsRow}>
                    <button
                      type="button"
                      style={styles.primary}
                      onClick={() =>
                        inv?.group_id
                          ? router.push(`/groups/${inv.group_id}`)
                          : router.push("/groups")
                      }
                    >
                      Abrir grupo
                    </button>

                    <button
                      type="button"
                      style={styles.secondary}
                      onClick={() => router.push("/calendar")}
                    >
                      Ver calendario
                    </button>
                  </div>
                )}
              </Card>

              <Card tone="muted" style={styles.rightCard}>
                <div style={styles.sectionEyebrow}>Qué pasa después</div>
                <div style={styles.sectionTitle}>Ruta de entrada ideal</div>

                <div style={styles.flowList}>
                  {flowSteps.map((step, idx) => (
                    <div key={`${idx}-${step}`} style={styles.flowItem}>
                      <div style={styles.flowIndex}>{idx + 1}</div>
                      <div style={styles.flowText}>{step}</div>
                    </div>
                  ))}
                </div>

                {shouldShowPremiumNudge ? (
                  <div style={styles.premiumNudge}>
                    <div style={styles.premiumLabel}>Premium encaja mejor después</div>
                    <div style={styles.premiumText}>
                      Primero entra y entiende el contexto. Luego Premium puede sumar más claridad, más contexto y menos fricción para coordinar.
                    </div>
                  </div>
                ) : null}
              </Card>
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
  heroCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(240px, 0.92fr)",
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
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
    maxWidth: 720,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 1.62,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 720,
  },
  heroMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
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
  heroRight: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  miniCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  miniLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.80)",
  },
  miniValue: {
    fontSize: 13,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.86)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.08fr) minmax(260px, 0.92fr)",
    gap: 14,
  },
  leftCard: {
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 12,
  },
  rightCard: {
    borderRadius: 22,
    padding: 18,
    display: "grid",
    gap: 12,
    alignContent: "start",
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  bullets: {
    display: "grid",
    gap: 10,
  },
  bulletItem: {
    display: "grid",
    gridTemplateColumns: "12px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    fontSize: 14,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.84)",
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(96,165,250,0.95)",
    marginTop: 7,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
  },
  flowList: {
    display: "grid",
    gap: 10,
  },
  flowItem: {
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr)",
    gap: 10,
    alignItems: "start",
    padding: "10px 10px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  flowIndex: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: "rgba(59,130,246,0.16)",
    color: "rgba(219,234,254,0.96)",
    fontSize: 12,
    fontWeight: 900,
  },
  flowText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.84)",
  },
  premiumNudge: {
    borderRadius: 16,
    border: "1px solid rgba(168,85,247,0.18)",
    background: "rgba(168,85,247,0.08)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  premiumLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(233,213,255,0.92)",
  },
  premiumText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(243,232,255,0.84)",
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
  primaryDisabled: {
    opacity: 0.6,
    cursor: "not-allowed",
    boxShadow: "none",
    background: "rgba(51,65,85,0.76)",
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