"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import {
  getMyProfile,
  createMyProfile,
  updateMyProfile,
  type Profile,
} from "@/lib/profilesDb";

type UserUI = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);

  const [user, setUser] = useState<UserUI | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"ok" | "error">("ok");

  // Carga sesión + perfil
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error || !data.session?.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        const u = data.session.user;

        // nombre base desde metadata/email (fallback)
        const metaName =
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email ? u.email.split("@")[0] : "Usuario");

        const baseUser: UserUI = {
          id: u.id,
          name: metaName,
          email: u.email ?? "—",
          verified: !!u.email_confirmed_at,
        };

        setUser(baseUser);

        // cargar perfil real desde DB
        try {
          const p = await getMyProfile();
          if (!alive) return;

          if (p) {
            setProfile(p);
            setFirstName(p.first_name ?? "");
            setLastName(p.last_name ?? "");
            // sobreescribimos el nombre visible con nombre + apellido
            setUser((prev) =>
              prev
                ? {
                    ...prev,
                    name: [p.first_name, p.last_name].filter(Boolean).join(" "),
                  }
                : prev
            );
          } else {
            // si no hay perfil, prellenamos con el nombre base
            const parts = metaName.split(" ");
            const f = parts[0] ?? "";
            const l = parts.slice(1).join(" ");
            setFirstName(f);
            setLastName(l);
          }
        } catch {
          // si falla perfiles, seguimos con el nombre base
        }
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setStatusTone("error");
      setStatusMsg("Completa nombre y apellido.");
      return;
    }

    try {
      setSaving(true);

      let p: Profile;
      if (profile) {
        p = await updateMyProfile({ first_name: fn, last_name: ln });
      } else {
        p = await createMyProfile({ first_name: fn, last_name: ln });
      }

      setProfile(p);
      setStatusTone("ok");
      setStatusMsg("Perfil actualizado.");

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: [p.first_name, p.last_name].filter(Boolean).join(" "),
            }
          : prev
      );
    } catch (err: any) {
      console.error(err);
      setStatusTone("error");
      setStatusMsg(
        err?.message || "No pudimos guardar tu perfil. Inténtalo de nuevo."
      );
    } finally {
      setSaving(false);
    }
  }

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader
            title="Panel"
            subtitle="Gestiona tu cuenta y revisa tu estado."
          />
          <div style={styles.loadingCard}>Cargando perfil…</div>
        </div>
      </main>
    );
  }

  if (!user) return null;

  const initials =
    (profile?.first_name?.[0] || user.name.charAt(0) || "U").toUpperCase();

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.topRow}>
          <PremiumHeader
            title="Panel"
            subtitle="Gestiona tu cuenta y revisa tu estado."
          />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.card}>
          {/* Cabecera perfil */}
          <div style={styles.profileRow}>
            <div style={styles.avatar}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.name}>{user.name}</div>
              <div style={styles.email}>{user.email}</div>
            </div>
          </div>

          {/* Estado de cuenta / plan */}
          <div style={styles.infoGrid}>
            <InfoRow
              label="Estado de cuenta"
              value={user.verified ? "Verificada" : "No verificada"}
              tone={user.verified ? "good" : "warn"}
            />
            <InfoRow label="Plan" value="Demo Premium" tone="neutral" />
          </div>

          {/* Formulario de datos básicos */}
          <div style={styles.formBlock}>
            <h3 style={styles.formTitle}>Datos básicos</h3>
            <p style={styles.formSub}>
              Personaliza cómo quieres que se vea tu nombre dentro de tus
              grupos y en las invitaciones.
            </p>

            <form onSubmit={handleSaveProfile} style={styles.profileForm}>
              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Nombre</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={styles.input}
                    placeholder="Nombre"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Apellido</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={styles.input}
                    placeholder="Apellido"
                  />
                </div>
              </div>

              {/* Futuro: más campos (teléfono, nombre de usuario, foto, etc.) */}

              <div style={styles.formFooter}>
                {statusMsg && (
                  <span
                    style={{
                      ...styles.statusMsg,
                      color:
                        statusTone === "ok"
                          ? "rgba(34,197,94,0.95)"
                          : "rgba(248,113,113,0.95)",
                    }}
                  >
                    {statusMsg}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={saving || !firstName.trim() || !lastName.trim()}
                  style={{
                    ...styles.saveBtn,
                    opacity:
                      saving || !firstName.trim() || !lastName.trim()
                        ? 0.7
                        : 1,
                    cursor:
                      saving || !firstName.trim() || !lastName.trim()
                        ? "default"
                        : "pointer",
                  }}
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>

          <div style={styles.actions}>
            <button
              onClick={() => router.push("/summary")}
              style={styles.ghostBtn}
            >
              Ver resumen semanal
            </button>
          </div>
        </section>

        <div style={styles.footer}>
          SyncPlans está diseñado para ayudarte a organizar tu vida sin
          conflictos, en todos tus grupos.
        </div>
      </div>
    </main>
  );
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
}) {
  const badge =
    tone === "good"
      ? { border: "1px solid rgba(34,197,94,0.30)", bg: "rgba(34,197,94,0.10)" }
      : tone === "warn"
      ? {
          border: "1px solid rgba(250,204,21,0.30)",
          bg: "rgba(250,204,21,0.10)",
        }
      : {
          border: "1px solid rgba(255,255,255,0.12)",
          bg: "rgba(255,255,255,0.06)",
        };

  return (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>{label}</div>
      <div
        style={{ ...styles.badge, border: badge.border, background: badge.bg }}
      >
        {value}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 14,
  },
  topActions: { display: "flex", gap: 10, alignItems: "center" },

  card: {
    marginTop: 12,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 18,
  },

  profileRow: { display: "flex", gap: 14, alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 950,
    fontSize: 18,
  },
  name: {
    fontSize: 18,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  email: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.72,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  infoGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
  },
  infoLabel: { fontSize: 12, fontWeight: 900, opacity: 0.7 },
  badge: {
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  formBlock: {
    marginTop: 18,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.96)",
    padding: 14,
  },
  formTitle: { fontSize: 14, fontWeight: 900 },
  formSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    maxWidth: 520,
  },
  profileForm: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: 750,
    color: "rgba(148,163,184,0.96)",
  },
  input: {
    height: 36,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.8)",
    background: "rgba(15,23,42,0.9)",
    color: "#E5E7EB",
    padding: "0 12px",
    fontSize: 13,
    outline: "none",
  },
  formFooter: {
    marginTop: 4,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  statusMsg: {
    fontSize: 12,
    fontWeight: 700,
  },
  saveBtn: {
    padding: "8px 16px",
    borderRadius: 999,
    border: "1px solid rgba(37,99,235,0.9)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.75))",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
  },

  actions: { marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },

  footer: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.25)",
    padding: 12,
    fontSize: 12,
    opacity: 0.7,
    fontWeight: 650,
  },

  loadingCard: {
    marginTop: 14,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    fontWeight: 900,
    opacity: 0.85,
  },
};
