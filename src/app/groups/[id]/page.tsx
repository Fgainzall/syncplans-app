"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { setActiveGroupIdInDb } from "@/lib/activeGroup";
import { inviteToGroup } from "@/lib/invitationsDb";

type Group = {
  id: string;
  name: string | null;
  type: "pair" | "family" | "solo" | "personal" | string;
  owner_id: string | null;
  created_at: string;
};

type MemberRow = {
  user_id: string;
  role: string | null;
  created_at: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function labelGroupType(t?: string | null) {
  const x = (t || "").toLowerCase();
  if (x === "family") return "Familia";
  if (x === "pair" || x === "couple") return "Pareja";
  if (x === "solo" || x === "personal") return "Personal";
  return t ? String(t) : "Grupo";
}

function initials(name?: string | null) {
  const s = (name || "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

export default function GroupDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = String((params as any)?.id || "");

  const [booting, setBooting] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  function showToast(title: string, subtitle?: string) {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  }

  const typeLabel = useMemo(() => labelGroupType(group?.type ?? null), [group]);

  async function loadMembers(gid: string) {
    setMembersLoading(true);
    try {
      const { data: ms, error: mErr } = await supabase
        .from("group_members")
        .select("user_id,role,created_at")
        .eq("group_id", gid)
        .order("created_at", { ascending: true });

      if (mErr) throw mErr;

      const rawMembers = (ms ?? []) as Array<{
        user_id: string;
        role: string | null;
        created_at: string | null;
      }>;

      const ids = Array.from(new Set(rawMembers.map((m) => m.user_id).filter(Boolean)));

      let profilesById = new Map<string, { display_name: string | null; avatar_url: string | null }>();

      if (ids.length > 0) {
        const { data: ps, error: pErr } = await supabase
          .from("profiles")
          .select("id,display_name,avatar_url")
          .in("id", ids);

        if (pErr) throw pErr;

        (ps ?? []).forEach((p: any) => {
          profilesById.set(p.id, {
            display_name: p.display_name ?? null,
            avatar_url: p.avatar_url ?? null,
          });
        });
      }

      const merged: MemberRow[] = rawMembers.map((m) => ({
        ...m,
        profiles: profilesById.get(m.user_id) ?? null,
      }));

      setMembers(merged);
    } finally {
      setMembersLoading(false);
    }
  }

  async function loadAll() {
    if (!groupId) throw new Error("Group id missing");

    const { data: ses, error: sesErr } = await supabase.auth.getSession();
    if (sesErr) throw sesErr;

    if (!ses.session?.user) {
      router.replace("/auth/login");
      return;
    }

    const { data: g, error: gErr } = await supabase
      .from("groups")
      .select("id,name,type,owner_id,created_at")
      .eq("id", groupId)
      .single();

    if (gErr) throw gErr;
    setGroup(g as any);

    await loadMembers(groupId);
  }

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        await loadAll();
      } catch (e: any) {
        if (!alive) return;
        showToast("No se pudo cargar", e?.message || "Intenta nuevamente.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [groupId]);

  const trimmedEmail = email.trim().toLowerCase();
  const canSend = trimmedEmail.includes("@") && trimmedEmail.length >= 6 && !sending;

  async function sendInvite() {
    if (!group) return;

    if (!canSend) {
      showToast("Revisa el email", "Escribe un correo válido.");
      return;
    }

    try {
      setSending(true);

      const res: any = await inviteToGroup({
        groupId: group.id,
        email: trimmedEmail,
        role: "member",
      });

      if (!res?.ok) {
        throw new Error(res?.error || "No se pudo invitar.");
      }

      const emailSent = typeof res?.email_sent === "boolean" ? res.email_sent : null;
      const emailErr = res?.email_error ? String(res.email_error) : "";

      if (emailSent === true) {
        showToast("Invitación enviada ✅", `Correo enviado a ${res.invited_email || trimmedEmail}`);
      } else if (emailSent === false) {
        showToast(
          "Invitación creada (sin email)",
          emailErr ? `Error enviando correo: ${emailErr}` : "No se pudo enviar el correo."
        );
      } else {
        showToast("Invitación creada ✅", `Se invitó a ${res.invited_email || trimmedEmail}`);
      }

      setEmail("");
      await loadMembers(group.id);
    } catch (e: any) {
      showToast("No se pudo invitar", e?.message || "Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  }

  async function goCalendar() {
    try {
      await setActiveGroupIdInDb(groupId);
    } catch {
      // ignore
    }
    router.push("/calendar");
  }

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando grupo…</div>
              <div style={styles.loadingSub}>Miembros e invitaciones</div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!group) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.card}>
            <div style={styles.h1}>Grupo no encontrado</div>
            <div style={styles.sub}>Puede ser que no seas miembro o que el grupo ya no exista.</div>
            <button onClick={() => router.push("/groups")} style={styles.ghostBtnWide}>
              ← Volver a grupos
            </button>
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
            <LogoutButton />
          </div>
        </div>

        <section style={styles.hero}>
          <div>
            <div style={styles.kicker}>Grupo</div>
            <h1 style={styles.h1}>{group.name || typeLabel}</h1>
            <div style={styles.sub}>
              Tipo: <b>{typeLabel}</b> · ID: <span style={{ opacity: 0.85 }}>{group.id}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => router.push("/groups")} style={styles.ghostBtn}>
              ← Volver
            </button>
            <button onClick={goCalendar} style={styles.primaryBtn}>
              Ir al calendario →
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Miembros</div>
          <div style={styles.smallNote}>
            {membersLoading ? "Cargando miembros…" : "Mostramos nombre del perfil + rol."}
          </div>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <div>Usuario</div>
              <div>Rol</div>
            </div>

            {members.length === 0 ? (
              <div style={{ padding: 12, opacity: 0.75, fontSize: 12 }}>
                No hay miembros visibles (si esto pasa, revisamos RLS de group_members).
              </div>
            ) : (
              members.map((m) => {
                const name = m.profiles?.display_name || "Usuario";
                return (
                  <div key={m.user_id} style={styles.tableRow}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={styles.avatarCircle}>{initials(name)}</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>{name}</div>
                        {/* UUID oculto a propósito para no ensuciar la UI */}
                      </div>
                    </div>

                    <div style={{ fontWeight: 900, fontSize: 12 }}>{m.role || "member"}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Invitar</div>
          <div style={styles.smallNote}>
            Escribe el email del invitado. Se creará una invitación <b>pending</b> y podrá aceptarla desde su enlace.
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              style={styles.input}
            />
            <button
              onClick={sendInvite}
              disabled={!canSend}
              style={{ ...styles.primaryBtn, opacity: canSend ? 1 : 0.6 }}
            >
              {sending ? "Enviando…" : "Enviar invitación"}
            </button>
          </div>
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

  hero: {
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 14,
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
  h1: { margin: "10px 0 0", fontSize: 28, letterSpacing: "-0.6px" },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72 },

  input: {
    flex: 1,
    minWidth: 260,
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  },

  table: {
    marginTop: 10,
    borderRadius: 14,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.02)",
  },
  tableHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    gap: 10,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 900,
    opacity: 0.85,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 120px",
    gap: 10,
    padding: "10px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    alignItems: "center",
  },

  avatarCircle: {
    height: 34,
    width: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    fontSize: 12,
  },

  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
  },
  ghostBtnWide: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    minWidth: 240,
    marginTop: 12,
  },
  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
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
