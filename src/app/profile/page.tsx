"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

type UserUI = {
  name: string;
  email: string;
  verified: boolean;
};

export default function ProfilePage() {
  const router = useRouter();
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState<UserUI | null>(null);

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

        // nombre: prioriza metadata si existe
        const name =
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email ? u.email.split("@")[0] : "Usuario");

        setUser({
          name,
          email: u.email ?? "—",
          verified: !!u.email_confirmed_at,
        });
      } finally {
        if (!alive) return;
        setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader title="Panel" subtitle="Gestiona tu cuenta y revisa tu estado." />
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
          <PremiumHeader title="Panel" subtitle="Gestiona tu cuenta y revisa tu estado." />
          <div style={styles.topActions}>
            <LogoutButton />
          </div>
        </div>

        <section style={styles.card}>
          <div style={styles.profileRow}>
            <div style={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.name}>{user.name}</div>
              <div style={styles.email}>{user.email}</div>
            </div>
          </div>

          <div style={styles.infoGrid}>
            <InfoRow label="Estado de cuenta" value={user.verified ? "Verificada" : "No verificada"} tone={user.verified ? "good" : "warn"} />
            <InfoRow label="Plan" value="Demo Premium" tone="neutral" />
          </div>

          <div style={styles.actions}>
            <button onClick={() => router.push("/summary")} style={styles.ghostBtn}>
              Ver resumen semanal
            </button>
          </div>
        </section>

        <div style={styles.footer}>
          SyncPlans está diseñado para ayudarte a organizar tu vida sin conflictos, en todos tus grupos.
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
      ? { border: "1px solid rgba(250,204,21,0.30)", bg: "rgba(250,204,21,0.10)" }
      : { border: "1px solid rgba(255,255,255,0.12)", bg: "rgba(255,255,255,0.06)" };

  return (
    <div style={styles.infoRow}>
      <div style={styles.infoLabel}>{label}</div>
      <div style={{ ...styles.badge, border: badge.border, background: badge.bg }}>{value}</div>
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
  topRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 14 },
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
  name: { fontSize: 18, fontWeight: 950, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  email: { marginTop: 4, fontSize: 13, opacity: 0.72, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  infoGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 },
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
