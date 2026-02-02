// src/app/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import {
  getMyProfile,
  getInitials,
  createMyProfile,
  type Profile,
} from "@/lib/profilesDb";

type UserUI = {
  name: string;
  email: string;
  verified: boolean;
  initials: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserUI | null>(null);

  // 👇 formulario de nombre/apellido
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const { data, error } = await supabase.auth.getSession();
        if (!alive) return;

        if (error || !data.session?.user) {
          router.replace("/auth/login?next=/profile");
          return;
        }

        const u = data.session.user;

        // Nombre base desde metadata o email
        let baseName =
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email ? u.email.split("@")[0] : "Usuario");

        const email = u.email ?? "—";
        const verified = !!u.email_confirmed_at;

        let finalName = baseName;
        let initials =
          baseName && baseName.length > 0
            ? baseName.charAt(0).toUpperCase()
            : "U";

        let localFirst = "";
        let localLast = "";

        // 👇 Intentar leer perfil real desde la tabla `profiles`
        try {
          const profile: Profile | null = await getMyProfile();
          if (profile) {
            const dn = (
              profile.display_name ??
              `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
            ).trim();

            if (dn) {
              finalName = dn;
            }

            initials = getInitials({
              first_name: profile.first_name,
              last_name: profile.last_name,
              display_name: profile.display_name,
            });

            localFirst = (profile.first_name ?? "").trim();
            localLast = (profile.last_name ?? "").trim();
          } else {
            // Si no hay perfil aún, intentamos inferir del baseName
            const parts = baseName.trim().split(/\s+/);
            if (parts.length >= 2) {
              localFirst = parts[0];
              localLast = parts.slice(1).join(" ");
            } else {
              localFirst = baseName.trim();
              localLast = "";
            }
          }
        } catch (e) {
          console.error("Error leyendo perfil desde DB:", e);
        }

        if (!alive) return;

        setUser({
          name: finalName,
          email,
          verified,
          initials,
        });

        setFirstName(localFirst);
        setLastName(localLast);
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveOk(null);

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setSaveError("Nombre y apellido son obligatorios.");
      return;
    }

    try {
      setSaving(true);
      const profile = await createMyProfile({
        first_name: fn,
        last_name: ln,
      });

      // 🔧 AQUÍ EL CAMBIO IMPORTANTE: siempre devolver string
      const baseDisplay = (
        profile.display_name ??
        `${profile.first_name ?? ""} ${profile.last_name ?? ""}`
      ).trim();

      const newDisplay: string =
        baseDisplay || user?.name || "Usuario";

      const newInitials = getInitials({
        first_name: profile.first_name,
        last_name: profile.last_name,
        display_name: profile.display_name,
      });

      setUser((prev) =>
        prev
          ? {
              ...prev,
              name: newDisplay,      // ahora es string seguro
              initials: newInitials,
            }
          : prev
      );

      setSaveOk("Perfil actualizado correctamente.");
    } catch (err: any) {
      console.error("Error guardando perfil:", err);
      setSaveError(
        typeof err?.message === "string"
          ? err.message
          : "No se pudo actualizar tu perfil. Intenta de nuevo."
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
          <div style={styles.profileRow}>
            <div style={styles.avatar}>{user.initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.name}>{user.name}</div>
              <div style={styles.email}>{user.email}</div>
            </div>
          </div>

          <div style={styles.infoGrid}>
            <InfoRow
              label="Estado de cuenta"
              value={user.verified ? "Verificada" : "No verificada"}
              tone={user.verified ? "good" : "warn"}
            />
            <InfoRow label="Plan" value="Demo Premium" tone="neutral" />
          </div>

          {/* 👇 Formulario para editar nombre/apellido */}
          <div style={styles.editBlock}>
            <div style={styles.editTitle}>Tu nombre en SyncPlans</div>
            <div style={styles.editSub}>
              Esto se usará en miembros, notificaciones y futuros features
              compartidos.
            </div>

            <form onSubmit={onSaveProfile} style={styles.form}>
              <div style={styles.formRow}>
                <div style={styles.field}>
                  <label style={styles.label}>Nombre</label>
                  <input
                    style={styles.input}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Fernando"
                  />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Apellido</label>
                  <input
                    style={styles.input}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Gainza Llosa"
                  />
                </div>
              </div>

              {saveError && <div style={styles.error}>{saveError}</div>}
              {saveOk && <div style={styles.ok}>{saveOk}</div>}

              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={() => router.push("/summary")}
                  style={styles.ghostBtn}
                >
                  Ver resumen semanal
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    ...styles.primaryBtn,
                    opacity: saving ? 0.7 : 1,
                    cursor: saving ? "progress" : "pointer",
                  }}
                >
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </div>
            </form>
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
      ? {
          border: "1px solid rgba(34,197,94,0.30)",
          bg: "rgba(34,197,94,0.10)",
        }
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
        style={{
          ...styles.badge,
          border: badge.border,
          background: badge.bg,
        }}
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

  editBlock: {
    marginTop: 18,
    paddingTop: 14,
    borderTop: "1px solid rgba(255,255,255,0.12)",
  },
  editTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
  editSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
  },

  form: {
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
    fontSize: 12,
    opacity: 0.8,
    fontWeight: 700,
  },
  input: {
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "8px 10px",
    background: "rgba(15,23,42,0.85)",
    color: "rgba(248,250,252,0.96)",
    fontSize: 13,
    outline: "none",
  } as React.CSSProperties,
  error: {
    fontSize: 12,
    color: "rgba(248,113,113,0.95)",
  },
  ok: {
    fontSize: 12,
    color: "rgba(52,211,153,0.95)",
  },

  actions: {
    marginTop: 8,
    display: "flex",
    gap: 10,
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.35)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.25), rgba(124,58,237,0.25))",
    color: "rgba(255,255,255,0.96)",
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
