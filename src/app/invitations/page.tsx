"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import MobileScaffold from "@/components/MobileScaffold";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";

import {
  getMyInvitations,
  declineInvitation,
  type GroupInvitation,
} from "@/lib/invitationsDb";

type UiToast = { title: string; subtitle?: string } | null;

const groupLabel: Record<string, string> = {
  personal: "Personal",
  solo: "Personal",
  pair: "Pareja",
  couple: "Pareja",
  family: "Familia",
  other: "Compartido",
  shared: "Compartido",
};

function labelForGroupType(t?: string | null) {
  const key = String(t ?? "").toLowerCase();
  return groupLabel[key] ?? "Grupo";
}

function safeDateLabel(createdAt?: string | null) {
  if (!createdAt) return "—";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export default function InvitationsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<GroupInvitation[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const [toast, setToast] = useState<UiToast>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const normalizedInvites = useMemo(() => {
    return (invites ?? []).map((i) => ({
      ...i,
      created_at: i.created_at ?? null,
      group_name: i.group_name ?? null,
      group_type: i.group_type ?? null,
      status: i.status ?? "pending",
    }));
  }, [invites]);

  async function requireSessionOrRedirect() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      const next = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      router.replace(`/auth/login?next=${next}`);
      return null;
    }
    return data.session.user;
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const user = await requireSessionOrRedirect();
      if (!user) return;

      const data = await getMyInvitations();
      setInvites(Array.isArray(data) ? data : []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando invitaciones");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const user = await requireSessionOrRedirect();
        if (!alive) return;
        if (!user) return;
        await load();
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAccept = (id: string) => {
    router.push(`/invitations/accept?invite=${encodeURIComponent(id)}`);
  };

  const onDecline = async (id: string) => {
    setActing(id);
    try {
      const user = await requireSessionOrRedirect();
      if (!user) return;

      const r = await declineInvitation(id);
      if (!r?.ok) throw new Error(r?.error || "No se pudo rechazar.");

      showToast(
        "Invitación rechazada",
        "Listo. Ya no aparecerá como pendiente."
      );
      await load();
    } catch (e: any) {
      showToast("No se pudo rechazar", e?.message || "Intenta otra vez.");
    } finally {
      setActing(null);
    }
  };

  const pendingInvites = useMemo(() => {
    return normalizedInvites.filter(
      (i) => String(i.status ?? "").toLowerCase() === "pending"
    );
  }, [normalizedInvites]);

  const isEmpty = !loading && !error && pendingInvites.length === 0;
  const pendingCount = pendingInvites.length;

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
          title="Invitaciones"
          subtitle="Gestiona accesos pendientes y acepta nuevos espacios compartidos."
        />

        <Card style={styles.surfaceCard}>
          <Section style={styles.contentStack}>
            <div style={styles.headerRow}>
              <div style={styles.headerCopy}>
                <div style={styles.kicker}>Tu bandeja</div>
                <h1 style={styles.h1}>Invitaciones</h1>
                <p style={styles.sub}>
                  Grupos a los que te han invitado. Acepta para unirte y empezar
                  a coordinar desde un mismo lugar.
                </p>
              </div>

              <div style={styles.topActions}>
                <button
                  onClick={() => router.push("/groups")}
                  style={styles.ghostBtn}
                  disabled={loading}
                >
                  ← Volver a grupos
                </button>
                <button
                  onClick={load}
                  style={styles.primaryBtn}
                  disabled={loading}
                >
                  {loading ? "Actualizando…" : "Actualizar"}
                </button>
              </div>
            </div>

            <Card tone="muted" style={styles.heroSection}>
              <div style={styles.heroLeft}>
                <div style={styles.heroPill}>
                  <span style={styles.heroDot} />
                  Accesos pendientes
                </div>

                <h2 style={styles.heroTitle}>
                  Todo lo que aún está esperando tu decisión
                </h2>

                <p style={styles.heroText}>
                  Aquí aparecen los grupos a los que te han invitado. Cuando
                  aceptas, pasas a formar parte del espacio compartido y SyncPlans
                  puede empezar a coordinar mejor tu tiempo con los demás.
                </p>
              </div>

              <Card tone="strong" style={styles.heroSummary}>
                <div style={styles.heroSummaryTitle}>Resumen rápido</div>
                <div style={styles.heroSummaryNumber}>{pendingCount}</div>
                <div style={styles.heroSummaryLabel}>
                  invitación{pendingCount === 1 ? "" : "es"} pendiente
                  {pendingCount === 1 ? "" : "s"}
                </div>
                <div style={styles.heroSummaryHint}>
                  Aceptar te lleva por el flujo premium de ingreso al grupo.
                </div>
              </Card>
            </Card>

            {booting ? (
              <Card tone="muted" style={styles.stateCard}>
                <div style={styles.loadingRow}>
                  <div style={styles.loadingDot} />
                  <div>
                    <div style={styles.loadingTitle}>Preparando…</div>
                    <div style={styles.loadingSub}>Invitaciones</div>
                  </div>
                </div>
              </Card>
            ) : loading ? (
              <Card tone="muted" style={styles.stateCard}>
                <div style={styles.loadingRow}>
                  <div style={styles.loadingDot} />
                  <div>
                    <div style={styles.loadingTitle}>Cargando invitaciones…</div>
                    <div style={styles.loadingSub}>Un momento, por favor.</div>
                  </div>
                </div>
              </Card>
            ) : error ? (
              <Card style={styles.errorCard}>
                <div style={styles.errorTitle}>No se pudieron cargar</div>
                <div style={styles.errorText}>{error}</div>
              </Card>
            ) : isEmpty ? (
              <Card tone="muted" style={styles.emptyCard}>
                <div style={styles.emptyTitle}>
                  No tienes invitaciones pendientes
                </div>
                <div style={styles.emptySub}>
                  Cuando alguien te invite a un grupo, aparecerá aquí.
                </div>
              </Card>
            ) : (
              <div style={styles.list}>
                {pendingInvites.map((invite) => {
                  const busy = acting === invite.id;
                  return (
                    <Card
                      key={invite.id}
                      tone="muted"
                      style={styles.inviteCard}
                    >
                      <div style={styles.inviteTop}>
                        <div style={styles.inviteMeta}>
                          <div style={styles.inviteTitle}>
                            {invite.group_name || "Grupo sin nombre"}
                          </div>
                          <div style={styles.inviteSub}>
                            {labelForGroupType(invite.group_type)} ·{" "}
                            {safeDateLabel(invite.created_at)}
                          </div>
                        </div>

                        <div style={styles.badgePending}>Pendiente</div>
                      </div>

                      <div style={styles.actions}>
                        <button
                          onClick={() => onAccept(invite.id)}
                          disabled={busy}
                          style={styles.primaryBtn}
                        >
                          Aceptar
                        </button>
                        <button
                          onClick={() => onDecline(invite.id)}
                          disabled={busy}
                          style={styles.ghostBtn}
                        >
                          {busy ? "Procesando…" : "Rechazar"}
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Section>
        </Card>
      </Section>
    </MobileScaffold>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    background:
      "radial-gradient(circle at top, rgba(40,69,135,0.22), transparent 28%), #050816",
    color: "#f8fafc",
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
  },
  headerCopy: {
    minWidth: 0,
    flex: 1,
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
    maxWidth: 700,
    fontSize: 13,
    lineHeight: 1.65,
    color: "rgba(226,232,240,0.84)",
  },

  topActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  heroSection: {
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
  heroSummary: {
    width: 240,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  heroSummaryTitle: {
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 8,
  },
  heroSummaryNumber: {
    fontSize: 32,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "#ffffff",
  },
  heroSummaryLabel: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(226,232,240,0.88)",
    fontWeight: 700,
  },
  heroSummaryHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(148,163,184,0.96)",
  },

  primaryBtn: {
    appearance: "none",
    border: "1px solid rgba(96,165,250,0.34)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.34), rgba(124,58,237,0.34))",
    color: "#ffffff",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(29,78,216,0.18)",
  },

  ghostBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    borderRadius: 16,
    padding: "12px 16px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  },

  stateCard: {
    padding: 18,
  },

  emptyCard: {
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  emptySub: {
    marginTop: 6,
    color: "rgba(226,232,240,0.78)",
    lineHeight: 1.65,
  },

  errorCard: {
    border: "1px solid rgba(248,113,113,0.22)",
    background: "rgba(248,113,113,0.08)",
    color: "#ffe6e6",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: 900,
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.55,
  },

  loadingRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  loadingDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    background: "#38bdf8",
    boxShadow: "0 0 28px rgba(56,189,248,0.55)",
    flexShrink: 0,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: 800,
  },
  loadingSub: {
    marginTop: 4,
    color: "rgba(226,232,240,0.72)",
    fontSize: 13,
  },

  list: {
    display: "grid",
    gap: 14,
  },

  inviteCard: {
    display: "grid",
    gap: 16,
  },

  inviteTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },

  inviteMeta: {
    display: "grid",
    gap: 6,
  },

  inviteTitle: {
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },

  inviteSub: {
    color: "rgba(226,232,240,0.78)",
    lineHeight: 1.55,
    fontSize: 13,
  },

  badgePending: {
    alignSelf: "flex-start",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(250,204,21,0.24)",
    background: "rgba(250,204,21,0.12)",
    color: "#fde68a",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  toastWrap: {
    position: "fixed",
    top: 18,
    left: 12,
    right: 12,
    zIndex: 120,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  },

  toastCard: {
    minWidth: 240,
    maxWidth: 520,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,12,28,0.92)",
    boxShadow: "0 16px 36px rgba(0,0,0,0.38)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    padding: "14px 16px",
    pointerEvents: "auto",
  },

  toastTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#ffffff",
  },

  toastSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.78)",
  },
};