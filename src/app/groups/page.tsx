// src/app/groups/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { getMyGroups, getGroupTypeLabel } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { getMyInvitations } from "@/lib/invitationsDb";

type GroupRowUI = {
  id: string;
  name: string | null;
  type: "pair" | "family" | "other" | string;
  created_at: string | null;
  owner_id: string | null;
};

function labelType(t?: string | null) {
  return getGroupTypeLabel(t ?? "");
}

export default function GroupsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [groups, setGroups] = useState<GroupRowUI[]>([]);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(
    null
  );

  function showToast(title: string, subtitle?: string) {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 2800);
  }

  async function load() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      router.replace("/auth/login");
      return;
    }

    const gs: any[] = (await getMyGroups()) as any[];

    const ui: GroupRowUI[] = (gs ?? [])
      .map((g: any) => ({
        id: String(g?.id ?? ""),
        name: g?.name ?? null,
        type: (g?.type as any) ?? "pair",
        created_at: g?.created_at ?? null,
        owner_id: g?.owner_id ?? null,
      }))
      .filter((g) => !!g.id);

    ui.sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );
    setGroups(ui);

    try {
      const invites = await getMyInvitations();
      setPendingInvites((invites ?? []).length);
    } catch {
      setPendingInvites(0);
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setBooting(true);
        await load();
      } catch (e: any) {
        if (!alive) return;
        showToast("No se pudo cargar grupos", e?.message || "Intenta nuevamente.");
      } finally {
        if (alive) setBooting(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasGroups = groups.length > 0;

  const grouped = useMemo(() => {
    const pair = groups.filter((g) => (g.type || "").toLowerCase() === "pair");
    const family = groups.filter((g) => (g.type || "").toLowerCase() === "family");
    const other = groups.filter((g) => {
      const t = (g.type || "").toLowerCase();
      return !["pair", "family"].includes(t);
    });
    return { pair, family, other };
  }, [groups]);

  async function openGroup(gid: string) {
    try {
      await setActiveGroupIdInDb(gid);
    } catch {
      // no bloquear navegación
    }
    router.push(`/groups/${gid}`);
  }

  const invitationsLabel =
    pendingInvites > 0 ? `Invitaciones (${pendingInvites})` : "Invitaciones";

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Tus grupos</div>
            </div>
          </div>
        </div>

        {/* Mobile polish */}
        <style jsx global>{`
          @media (max-width: 680px) {
            .sp-groups-topActions {
              width: 100%;
              display: grid !important;
              grid-template-columns: 1fr !important;
              gap: 10px !important;
            }
            .sp-groups-topActions > button,
            .sp-groups-topActions > a {
              width: 100% !important;
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {/* Mobile polish */}
      <style jsx global>{`
        @media (max-width: 680px) {
          .sp-groups-shell {
            padding: 16px 14px 44px !important;
          }

          .sp-groups-topRow {
            gap: 10px !important;
          }

          .sp-groups-topActions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .sp-groups-topActions > button {
            width: 100% !important;
          }

          .sp-groups-hero {
            padding: 14px !important;
            border-radius: 18px !important;
          }
          .sp-groups-heroTip {
            max-width: 100% !important;
            width: 100% !important;
          }

          .sp-groups-grid {
            grid-template-columns: 1fr !important;
          }

          .sp-groups-cardBtn {
            padding: 14px !important;
          }
        }

        @media (hover: hover) {
          .sp-groups-cardBtn:hover {
            border-color: rgba(255, 255, 255, 0.18) !important;
            background: rgba(255, 255, 255, 0.05) !important;
          }
        }

        .sp-tap:active {
          transform: translateY(1px);
        }
      `}</style>

      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div className="sp-groups-shell" style={styles.shell}>
        <div className="sp-groups-topRow" style={styles.topRow}>
          <PremiumHeader />
          <div className="sp-groups-topActions" style={styles.topActions}>
            <button
              className="sp-tap"
              onClick={() => router.push("/invitations")}
              style={styles.secondaryBtn}
            >
              {invitationsLabel}
            </button>

            <button
              className="sp-tap"
              onClick={() => router.push("/groups/new")}
              style={styles.primaryBtn}
            >
              + Nuevo grupo
            </button>

            <LogoutButton />
          </div>
        </div>

        <section className="sp-groups-hero" style={styles.hero}>
          <div>
            <div style={styles.heroKicker}>Personas con las que te organizas</div>
            <h1 style={styles.heroTitle}>Grupos para coordinar sin fricciones</h1>
            <p style={styles.heroSub}>
              Cada grupo tiene su propio calendario compartido. Aquí decides con quién se cruzan
              tus planes: pareja, familia o grupos compartidos como amigos y equipos.
            </p>
          </div>

          <div className="sp-groups-heroTip" style={styles.heroTip}>
            <div style={styles.heroTipTitle}>Tip</div>
            <p style={styles.heroTipBody}>
              Crea primero el grupo de <b>Pareja</b> o <b>Familia</b>. Después puedes sumar grupos
              compartidos (amigos, pádel, trabajo) y dejar que SyncPlans señale los choques por
              ustedes.
            </p>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <div style={styles.sectionTitle}>Tus grupos</div>
              <div style={styles.sectionSub}>
                Elige un grupo para ver miembros, enviar invitaciones o saltar directo al calendario
                compartido.
              </div>
            </div>
          </div>

          {!hasGroups ? (
            <>
              <div style={styles.emptyTitle}>Todavía no tienes grupos</div>
              <div style={styles.emptySub}>
                Crea un grupo de <b>pareja</b>, <b>familia</b> o un grupo <b>compartido</b> para
                amigos o equipos.
              </div>

              <div style={{ marginTop: 12 }}>
                <button
                  className="sp-tap"
                  onClick={() => router.push("/groups/new")}
                  style={styles.primaryBtnWide}
                >
                  Crear mi primer grupo
                </button>
              </div>
            </>
          ) : (
            <>
              {grouped.pair.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Pareja</div>
                  <div className="sp-groups-grid" style={styles.grid}>
                    {grouped.pair.map((g) => (
                      <button
                        className="sp-groups-cardBtn sp-tap"
                        key={g.id}
                        onClick={() => openGroup(g.id)}
                        style={styles.groupCard}
                      >
                        <div style={styles.groupName}>{g.name || "Pareja"}</div>
                        <div style={styles.groupMeta}>
                          {labelType(g.type)} · Calendario compartido de pareja
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.family.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Familia</div>
                  <div className="sp-groups-grid" style={styles.grid}>
                    {grouped.family.map((g) => (
                      <button
                        className="sp-groups-cardBtn sp-tap"
                        key={g.id}
                        onClick={() => openGroup(g.id)}
                        style={styles.groupCard}
                      >
                        <div style={styles.groupName}>{g.name || "Familia"}</div>
                        <div style={styles.groupMeta}>
                          {labelType(g.type)} · Agenda donde todos ven todo
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.other.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Otros grupos</div>
                  <div className="sp-groups-grid" style={styles.grid}>
                    {grouped.other.map((g) => (
                      <button
                        className="sp-groups-cardBtn sp-tap"
                        key={g.id}
                        onClick={() => openGroup(g.id)}
                        style={styles.groupCard}
                      >
                        <div style={styles.groupName}>{g.name || "Grupo"}</div>
                        <div style={styles.groupMeta}>
                          {labelType(g.type)} · Calendario compartido
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
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
  shell: { maxWidth: 980, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 380,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
    padding: "12px 14px",
  },
  toastTitle: { fontWeight: 900, fontSize: 13 },
  toastSub: { marginTop: 4, fontSize: 12, opacity: 0.75, fontWeight: 650 },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  hero: {
    marginBottom: 14,
    borderRadius: 20,
    border: "1px solid rgba(148,163,184,0.35)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(circle at 100% 0%, rgba(34,197,94,0.18), transparent 55%), rgba(15,23,42,0.96)",
    padding: 16,
    display: "flex",
    alignItems: "stretch",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },
  heroKicker: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    color: "rgba(226,232,240,0.96)",
    background: "rgba(15,23,42,0.85)",
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  heroSub: {
    marginTop: 6,
    fontSize: 13,
    maxWidth: 520,
    color: "rgba(203,213,225,0.96)",
  },
  heroTip: {
    minWidth: 220,
    maxWidth: 280,
    borderRadius: 16,
    border: "1px dashed rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    padding: 10,
  },
  heroTipTitle: { fontSize: 12, fontWeight: 800, color: "rgba(226,232,240,0.96)" },
  heroTipBody: { marginTop: 4, fontSize: 12, color: "rgba(148,163,184,0.96)" },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
    flexWrap: "wrap",
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  sectionSub: { marginTop: 4, fontSize: 12, opacity: 0.8, maxWidth: 560 },

  emptyTitle: { marginTop: 10, fontWeight: 950, fontSize: 18 },
  emptySub: { marginTop: 6, fontSize: 12, opacity: 0.8 },

  kicker: {
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
    display: "inline-flex",
  },

  grid: {
    marginTop: 10,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: 10,
  },
  groupCard: {
    textAlign: "left",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
  },
  groupName: { fontWeight: 950, fontSize: 14 },
  groupMeta: { marginTop: 6, fontSize: 12, opacity: 0.75 },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  primaryBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
  },

  loadingCard: {
    marginTop: 18,
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