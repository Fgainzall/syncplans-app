// src/app/invitations/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  getMyInvitations,
  declineInvitation,
  type GroupInvitation,
} from "@/lib/invitationsDb";

const groupLabel: Record<string, string> = {
  personal: "Personal",
  solo: "Personal",
  pair: "Pareja",
  couple: "Pareja",
  family: "Familia",
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
  const [error, setError] = useState<string | null>(null);

  const normalizedInvites = useMemo(() => {
    return (invites ?? []).map((i) => ({
      ...i,
      created_at: i.created_at ?? null,
      group_name: i.group_name ?? null,
      group_type: i.group_type ?? null,
    }));
  }, [invites]);

  async function requireSessionOrRedirect() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      router.replace("/auth/login");
      return null;
    }
    return data.session.user;
  }

  const load = async () => {
    setLoading(true);
    try {
      const user = await requireSessionOrRedirect();
      if (!user) return;

      const data = await getMyInvitations();
      setInvites(data ?? []);
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando invitaciones");
    } finally {
      setLoading(false);
    }
  };

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

  // ✅ Ahora ya NO aceptamos directamente.
  // Solo redirigimos a la pantalla premium:
  // /invitations/accept?invite=<ID>
  const onAccept = (id: string) => {
    router.push(`/invitations/accept?invite=${id}`);
  };

  const onDecline = async (id: string) => {
    if (!confirm("¿Rechazar invitación?")) return;
    setActing(id);
    try {
      const user = await requireSessionOrRedirect();
      if (!user) return;

      await declineInvitation(id);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "No se pudo rechazar");
    } finally {
      setActing(null);
    }
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <div style={styles.headerRow}>
            <PremiumHeader rightSlot={<LogoutButton />} />
          </div>

          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando…</div>
              <div style={styles.loadingSub}>Invitaciones</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isEmpty = !loading && !error && normalizedInvites.length === 0;

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.headerRow}>
          <PremiumHeader rightSlot={<LogoutButton />} />
        </div>

        <section style={styles.hero}>
          <div>
            <h1 style={styles.h1}>Invitaciones</h1>
            <p style={styles.sub}>Grupos a los que te han invitado</p>
          </div>

          <div style={styles.heroActions}>
            <button
              onClick={() => router.push("/groups")}
              style={styles.ghostBtn}
              disabled={loading}
            >
              ← Volver a grupos
            </button>

            <button onClick={load} style={styles.primaryBtn} disabled={loading}>
              {loading ? "Actualizando…" : "Actualizar"}
            </button>
          </div>
        </section>

        {loading ? (
          <div style={styles.card}>Cargando…</div>
        ) : error ? (
          <div style={styles.card}>{error}</div>
        ) : isEmpty ? (
          <div style={styles.empty}>
            <div style={styles.emptyTitle}>No tienes invitaciones pendientes</div>
            <div style={styles.emptySub}>
              Cuando alguien te invite a un grupo aparecerá aquí.
            </div>
          </div>
        ) : (
          <div style={styles.list}>
            {normalizedInvites.map((i) => {
              const t = i.group_type ?? null;

              return (
                <div key={i.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <div style={styles.groupName}>
                        {i.group_name ?? "Grupo sin nombre"}
                      </div>
                      <div style={styles.groupType}>
                        {labelForGroupType(t)}
                      </div>
                    </div>
                    <div style={styles.date}>
                      {safeDateLabel(i.created_at)}
                    </div>
                  </div>

                  <div style={styles.actions}>
                    <button
                      onClick={() => onDecline(i.id)}
                      disabled={acting === i.id}
                      style={styles.ghostBtn}
                    >
                      {acting === i.id ? "…" : "Rechazar"}
                    </button>

                    <button
                      onClick={() => onAccept(i.id)}
                      disabled={acting === i.id}
                      style={styles.primaryBtn}
                    >
                      {acting === i.id ? "…" : "Aceptar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
  shell: { maxWidth: 720, margin: "0 auto", padding: 24 },

  headerRow: {
    marginBottom: 16,
  },

  hero: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  heroActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },

  h1: { fontSize: 28, fontWeight: 900, margin: 0 },
  sub: { opacity: 0.75, margin: "6px 0 0" },

  list: { display: "flex", flexDirection: "column", gap: 12 },

  card: {
    borderRadius: 16,
    padding: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  groupName: { fontSize: 16, fontWeight: 900 },
  groupType: { fontSize: 13, opacity: 0.72, marginTop: 4 },
  date: { fontSize: 12, opacity: 0.6, whiteSpace: "nowrap" },

  actions: { display: "flex", justifyContent: "flex-end", gap: 10 },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(34,197,94,0.40)",
    background: "rgba(34,197,94,0.20)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },

  ghostBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  empty: {
    marginTop: 22,
    padding: 24,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.20)",
    textAlign: "center",
    background: "rgba(255,255,255,0.02)",
  },
  emptyTitle: { fontWeight: 900, fontSize: 16 },
  emptySub: { opacity: 0.75, marginTop: 6, fontSize: 12 },

  loadingCard: {
    marginTop: 10,
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
