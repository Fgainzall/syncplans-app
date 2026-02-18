// src/app/invitations/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getMyInvitations, declineInvitation, type GroupInvitation } from "@/lib/invitationsDb";

type UiToast = { title: string; subtitle?: string } | null;

const groupLabel: Record<string, string> = {
  personal: "Personal",
  solo: "Personal",
  pair: "Pareja",
  couple: "Pareja",
  family: "Familia",
  other: "Compartido",
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
      const next = encodeURIComponent(window.location.pathname + window.location.search);
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

  // ✅ aceptar SIEMPRE por pantalla premium
  const onAccept = (id: string) => {
    router.push(`/invitations/accept?invite=${encodeURIComponent(id)}`);
  };

  // ✅ rechazar: sin confirm(), con toast + botón "Deshacer" simple (recarga)
  const onDecline = async (id: string) => {
    setActing(id);
    try {
      const user = await requireSessionOrRedirect();
      if (!user) return;

      const r = await declineInvitation(id);
      if (!r?.ok) throw new Error(r?.error || "No se pudo rechazar.");

      showToast("Invitación rechazada", "Listo. Ya no aparecerá como pendiente.");
      await load();
    } catch (e: any) {
      showToast("No se pudo rechazar", e?.message || "Intenta otra vez.");
    } finally {
      setActing(null);
    }
  };

  const pendingInvites = useMemo(() => {
    return normalizedInvites.filter((i) => String(i.status ?? "").toLowerCase() === "pending");
  }, [normalizedInvites]);

  const title = "Invitaciones";
  const isEmpty = !loading && !error && pendingInvites.length === 0;

  return (
    <main style={styles.page} className="spInv-page">
      {/* Toast */}
      {toast && (
        <div style={styles.toastWrap} className="spInv-toastWrap">
          <div style={styles.toastCard} className="spInv-toastCard">
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div style={styles.shell} className="spInv-shell">
        <div style={styles.headerRow} className="spInv-headerRow">
          <PremiumHeader />
          <LogoutButton />
        </div>

        {/* Hero */}
        <section style={styles.hero} className="spInv-hero">
          <div>
            <div style={styles.kicker}>Tu bandeja</div>
            <h1 style={styles.h1} className="spInv-h1">
              {title}
            </h1>
            <div style={styles.sub} className="spInv-sub">
              Grupos a los que te han invitado. Aceptar abre la pantalla premium para confirmarlo.
            </div>
          </div>

          <div style={styles.heroActions} className="spInv-heroActions">
            <button onClick={() => router.push("/groups")} style={styles.ghostBtn} disabled={loading}>
              ← Volver a grupos
            </button>
            <button onClick={load} style={styles.primaryBtn} disabled={loading}>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </section>

        {/* Estados */}
        {booting ? (
          <div style={styles.loadingCard} className="spInv-loadingCard">
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando…</div>
              <div style={styles.loadingSub}>Invitaciones</div>
            </div>
          </div>
        ) : loading ? (
          <div style={styles.card} className="spInv-card">
            Cargando…
          </div>
        ) : error ? (
          <div style={{ ...styles.card, border: "1px solid rgba(248,113,113,0.22)", background: "rgba(248,113,113,0.08)" }}>
            <div style={{ fontWeight: 900 }}>No se pudo cargar</div>
            <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>{error}</div>
            <button onClick={load} style={{ ...styles.primaryBtn, marginTop: 10 }}>
              Reintentar
            </button>
          </div>
        ) : isEmpty ? (
          <div style={styles.empty} className="spInv-empty">
            <div style={styles.emptyTitle}>No tienes invitaciones pendientes</div>
            <div style={styles.emptySub}>Cuando alguien te invite a un grupo, aparecerá aquí.</div>
            <div style={styles.emptyActions} className="spInv-emptyActions">
              <button onClick={() => router.push("/groups")} style={styles.primaryBtn}>
                Ir a grupos →
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={styles.smallNote} className="spInv-smallNote">
              Pendientes: <b>{pendingInvites.length}</b>
            </div>

            <div style={styles.list} className="spInv-list">
              {pendingInvites.map((i) => {
                const t = i.group_type ?? null;
                const name = i.group_name ?? "Grupo";
                const role = i.role ?? "member";

                return (
                  <div key={i.id} style={styles.card} className="spInv-card">
                    <div style={styles.cardTop} className="spInv-cardTop">
                      <div>
                        <div style={styles.groupName}>{name}</div>
                        <div style={styles.groupType}>
                          {labelForGroupType(t)} · Rol: <b>{role}</b>
                        </div>
                      </div>

                      <div style={styles.metaRight}>
                        <div style={styles.date}>{safeDateLabel(i.created_at)}</div>
                        <span style={styles.pill}>Pendiente</span>
                      </div>
                    </div>

                    <div style={styles.actions} className="spInv-actions">
                      <button
                        onClick={() => onDecline(i.id)}
                        disabled={acting === i.id}
                        style={styles.ghostBtn}
                        className="spInv-btn"
                      >
                        {acting === i.id ? "…" : "Rechazar"}
                      </button>

                      <button
                        onClick={() => onAccept(i.id)}
                        disabled={acting === i.id}
                        style={styles.primaryBtn}
                        className="spInv-btn"
                      >
                        {acting === i.id ? "…" : "Aceptar"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Responsive aislado */}
      <style>{`
        @media (max-width: 520px) {
          .spInv-shell { padding: 18px 14px 64px !important; }
          .spInv-headerRow { gap: 10px !important; flex-wrap: wrap !important; }
          .spInv-hero { padding: 12px !important; border-radius: 16px !important; }
          .spInv-h1 { font-size: 22px !important; letter-spacing: -0.4px !important; }
          .spInv-sub { font-size: 12px !important; }
          .spInv-heroActions { width: 100% !important; }
          .spInv-btn { flex: 1 1 auto !important; }
          .spInv-card { padding: 12px !important; border-radius: 16px !important; }
          .spInv-cardTop { flex-wrap: wrap !important; }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
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
    maxWidth: 420,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  shell: { maxWidth: 820, margin: "0 auto", padding: "22px 18px 56px" },

  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },

  hero: {
    padding: "16px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },

  kicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
  },

  h1: { margin: "10px 0 0", fontSize: 26, letterSpacing: "-0.6px" },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 640 },

  heroActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  smallNote: { marginTop: 10, fontSize: 12, opacity: 0.72 },

  list: { marginTop: 10, display: "flex", flexDirection: "column", gap: 12 },

  card: {
    borderRadius: 18,
    padding: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
    alignItems: "flex-start",
  },

  groupName: { fontSize: 16, fontWeight: 950, letterSpacing: "-0.2px" },
  groupType: { fontSize: 13, opacity: 0.75, marginTop: 6 },

  metaRight: { display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" },
  date: { fontSize: 12, opacity: 0.6, whiteSpace: "nowrap" },

  pill: {
    fontSize: 10,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,0.35)",
    background: "rgba(251,191,36,0.12)",
    whiteSpace: "nowrap",
  },

  actions: { display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },

  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  empty: {
    marginTop: 16,
    padding: 22,
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.02)",
    textAlign: "center",
  },
  emptyTitle: { fontWeight: 950, fontSize: 16 },
  emptySub: { opacity: 0.75, marginTop: 6, fontSize: 12 },
  emptyActions: { marginTop: 12, display: "flex", justifyContent: "center" },

  loadingCard: {
    marginTop: 12,
    display: "flex",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 24px rgba(56,189,248,0.55)",
  },
  loadingTitle: { fontWeight: 900 },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};