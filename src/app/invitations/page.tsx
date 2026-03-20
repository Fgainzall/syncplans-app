// src/app/invitations/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";

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

  // ✅ aceptar SIEMPRE por pantalla premium
  const onAccept = (id: string) => {
    router.push(`/invitations/accept?invite=${encodeURIComponent(id)}`);
  };

  // ✅ rechazar: sin confirm(), con toast + recarga
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

  const title = "Invitaciones";
  const isEmpty = !loading && !error && pendingInvites.length === 0;

  return (
    <main style={styles.page} className="spInv-page">
      {toast && (
        <div style={styles.toastWrap} className="spInv-toastWrap">
          <div style={styles.toastCard} className="spInv-toastCard">
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <div style={styles.shell} className="spInv-shell">
        <div style={styles.headerRow} className="spInv-headerRow">
          <PremiumHeader />
        </div>

        <section style={styles.hero} className="spInv-hero">
          <div>
            <div style={styles.kicker}>Tu bandeja</div>
            <h1 style={styles.h1} className="spInv-h1">
              {title}
            </h1>
            <div style={styles.sub} className="spInv-sub">
             Grupos a los que te han invitado. Acepta para unirte.
            </div>
          </div>

          <div style={styles.heroActions} className="spInv-heroActions">
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
        </section>

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
          <div
            style={{
              ...styles.card,
              border: "1px solid rgba(248,113,113,0.22)",
              background: "rgba(248,113,113,0.08)",
              color: "#ffe6e6",
            }}
          >
            {error}
          </div>
        ) : isEmpty ? (
          <div style={styles.emptyCard} className="spInv-emptyCard">
            <div style={styles.emptyTitle}>No tienes invitaciones pendientes</div>
            <div style={styles.emptySub}>
              Cuando alguien te invite a un grupo, aparecerá aquí.
            </div>
          </div>
        ) : (
          <section style={styles.list} className="spInv-list">
            {pendingInvites.map((invite) => {
              const busy = acting === invite.id;
              return (
                <article
                  key={invite.id}
                  style={styles.inviteCard}
                  className="spInv-inviteCard"
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
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background:
      "radial-gradient(circle at top, rgba(40,69,135,0.22), transparent 28%), #050816",
    color: "#f8fafc",
    padding: "18px 14px 140px",
  },

  shell: {
    width: "100%",
    maxWidth: 880,
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },

  headerRow: {
    display: "block",
  },

  hero: {
    display: "grid",
    gap: 16,
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(8,15,35,0.94), rgba(6,10,24,0.9))",
    boxShadow:
      "0 24px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
    padding: 22,
  },

  kicker: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    marginBottom: 14,
  },

  h1: {
    margin: 0,
    fontSize: "clamp(2rem, 4vw, 3rem)",
    lineHeight: 1.02,
    letterSpacing: "-0.03em",
    fontWeight: 900,
  },

  sub: {
    marginTop: 12,
    maxWidth: 680,
    fontSize: "1.05rem",
    lineHeight: 1.65,
    color: "rgba(226,232,240,0.84)",
  },

  heroActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
  },

  primaryBtn: {
    appearance: "none",
    border: "1px solid rgba(96,165,250,0.34)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.34), rgba(124,58,237,0.34))",
    color: "#ffffff",
    borderRadius: 18,
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(29,78,216,0.18)",
  },

  ghostBtn: {
    appearance: "none",
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    borderRadius: 18,
    padding: "14px 18px",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  },

  card: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(8,15,35,0.90), rgba(6,10,24,0.88))",
    padding: 18,
  },

  emptyCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(8,15,35,0.90), rgba(6,10,24,0.88))",
    padding: 24,
    display: "grid",
    gap: 10,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },

  emptySub: {
    color: "rgba(226,232,240,0.78)",
    lineHeight: 1.65,
  },

  loadingCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(8,15,35,0.90), rgba(6,10,24,0.88))",
    padding: 20,
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
    fontSize: 18,
    fontWeight: 800,
  },

  loadingSub: {
    marginTop: 4,
    color: "rgba(226,232,240,0.72)",
  },

  list: {
    display: "grid",
    gap: 14,
  },

  inviteCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(8,15,35,0.90), rgba(6,10,24,0.88))",
    padding: 18,
    display: "grid",
    gap: 16,
  },

  inviteTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },

  inviteMeta: {
    display: "grid",
    gap: 6,
  },

  inviteTitle: {
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },

  inviteSub: {
    color: "rgba(226,232,240,0.78)",
    lineHeight: 1.55,
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