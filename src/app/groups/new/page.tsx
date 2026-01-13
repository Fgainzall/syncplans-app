"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";

type Role = "owner" | "admin" | "member";

type GroupRowUI = {
  id: string;
  name: string | null;
  type: "pair" | "family" | string;
  created_at?: string;
  owner_id?: string;
  my_role?: Role; // opcional si luego quieres mostrar rol
};

function labelType(t?: string | null) {
  const x = (t || "").toLowerCase();
  if (x === "pair") return "Pareja";
  if (x === "family") return "Familia";
  return t || "Grupo";
}

export default function GroupsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [groups, setGroups] = useState<GroupRowUI[]>([]);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

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

    const gs = await getMyGroups();

    // normaliza
    const ui: GroupRowUI[] = (gs ?? []).map((g: GroupRow) => ({
      id: g.id,
      name: g.name ?? null,
      type: (g.type as any) ?? "pair",
      created_at: g.created_at,
      owner_id: g.owner_id,
    }));

    // orden (por created_at si existe)
    ui.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

    setGroups(ui);
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
  }, []);

  const hasGroups = groups.length > 0;

  const grouped = useMemo(() => {
    const pair = groups.filter((g) => (g.type || "").toLowerCase() === "pair");
    const family = groups.filter((g) => (g.type || "").toLowerCase() === "family");
    const other = groups.filter(
      (g) => !["pair", "family"].includes((g.type || "").toLowerCase())
    );
    return { pair, family, other };
  }, [groups]);

  async function openGroup(gid: string) {
    try {
      await setActiveGroupIdInDb(gid);
    } catch {}
    router.push(`/groups/${gid}`);
  }

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
      </main>
    );
  }

  return (
    <main style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? <div style={styles.toastSub}>{toast.subtitle}</div> : null}
          </div>
        </div>
      )}

      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader />
          <div style={styles.topActions}>
            <button onClick={() => router.push("/groups/new")} style={styles.primaryBtn}>
              + Nuevo grupo
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Grupos</div>

          {!hasGroups ? (
            <>
              <div style={styles.emptyTitle}>Aún no tienes grupos</div>
              <div style={styles.emptySub}>
                Crea tu pareja o familia. Entra al grupo para invitar y gestionar miembros.
              </div>

              <div style={{ marginTop: 12 }}>
                <button onClick={() => router.push("/groups/new")} style={styles.primaryBtnWide}>
                  Crear grupo
                </button>
              </div>
            </>
          ) : (
            <>
              {grouped.pair.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Pareja</div>
                  <div style={styles.grid}>
                    {grouped.pair.map((g) => (
                      <button key={g.id} onClick={() => openGroup(g.id)} style={styles.groupCard}>
                        <div style={styles.groupName}>{g.name || "Pareja"}</div>
                        <div style={styles.groupMeta}>{labelType(g.type)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.family.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Familia</div>
                  <div style={styles.grid}>
                    {grouped.family.map((g) => (
                      <button key={g.id} onClick={() => openGroup(g.id)} style={styles.groupCard}>
                        <div style={styles.groupName}>{g.name || "Familia"}</div>
                        <div style={styles.groupMeta}>{labelType(g.type)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {grouped.other.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={styles.kicker}>Otros</div>
                  <div style={styles.grid}>
                    {grouped.other.map((g) => (
                      <button key={g.id} onClick={() => openGroup(g.id)} style={styles.groupCard}>
                        <div style={styles.groupName}>{g.name || "Grupo"}</div>
                        <div style={styles.groupMeta}>{labelType(g.type)}</div>
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

  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 },
  topActions: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },

  emptyTitle: { marginTop: 10, fontWeight: 950, fontSize: 18 },
  emptySub: { marginTop: 6, fontSize: 12, opacity: 0.75 },

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
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
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
