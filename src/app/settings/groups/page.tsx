// src/app/settings/groups/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getUser } from "@/lib/auth";
import { getSettingsFromDb, saveSettingsToDb, type NotificationSettings } from "@/lib/settings";

type UiToast = { title: string; subtitle?: string } | null;
type PermMode = "owner_only" | "shared_read" | "shared_write";

export default function GroupPermsSettingsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [s, setS] = useState<NotificationSettings | null>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);

        const u = getUser();
        if (!u) {
          router.push("/auth/login?next=/settings/groups");
          return;
        }

        const db = await getSettingsFromDb();
        if (!alive) return;
        setS(db);
      } catch (e) {
        console.error("[GroupsSettings] load error", e);
        showToast("No se pudieron cargar tus permisos", "Refresca la página o intenta de nuevo.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  async function commit(next: NotificationSettings) {
    setS(next);
    setSaving(true);
    try {
      await saveSettingsToDb(next);
      setSavedPulse(true);
      window.setTimeout(() => setSavedPulse(false), 700);
    } catch (e) {
      console.error("[GroupsSettings] save error", e);
      showToast("No se pudo guardar", "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const personal = (((s as any)?.permPersonal ?? "owner_only") as PermMode) || "owner_only";
  const pair = (((s as any)?.permPair ?? "shared_write") as PermMode) || "shared_write";
  const family = (((s as any)?.permFamily ?? "shared_read") as PermMode) || "shared_read";

  const meta = useMemo(() => {
    if (!s) return null;
    return `${personal} · ${pair} · ${family}`;
  }, [s, personal, pair, family]);

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
            <div style={styles.kicker}>Settings</div>
            <h1 style={styles.h1}>Permisos por grupo</h1>
            <div style={styles.sub}>Defaults para Personal / Pareja / Familia (por ahora UX; luego lo conectamos a roles reales).</div>
            {meta ? (
              <div style={styles.heroMeta}>
                <span style={styles.pillSoft}>{meta}</span>
                <span style={{ ...styles.pillSoft, ...(savedPulse ? styles.pillOkSoft : null) }}>
                  {saving ? "Guardando…" : savedPulse ? "Guardado ✓" : "Auto-guardado"}
                </span>
              </div>
            ) : null}
          </div>

          <div style={styles.heroBtns}>
            <button onClick={() => router.push("/settings")} style={styles.ghostBtn}>
              Volver a settings →
            </button>
            <button onClick={() => router.push("/calendar")} style={styles.ghostBtn}>
              Ir al calendario →
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Defaults</div>
          <div style={styles.smallNote}>Elige cómo quieres que se comporte SyncPlans por tipo de grupo.</div>

          <div style={styles.innerCard}>
            <PermCard
              title="Personal"
              subtitle="Recomendado: Solo yo."
              dot="rgba(251,191,36,0.95)"
              value={personal}
              onChange={(v) => commit({ ...(s as any), permPersonal: v })}
              disabled={!s || saving}
            />
            <Divider />
            <PermCard
              title="Pareja"
              subtitle="Recomendado: Edición compartida."
              dot="rgba(244,63,94,0.95)"
              value={pair}
              onChange={(v) => commit({ ...(s as any), permPair: v })}
              disabled={!s || saving}
            />
            <Divider />
            <PermCard
              title="Familia"
              subtitle="Recomendado: Lectura compartida."
              dot="rgba(56,189,248,0.95)"
              value={family}
              onChange={(v) => commit({ ...(s as any), permFamily: v })}
              disabled={!s || saving}
            />
          </div>

          <div style={styles.note}>
            <b>Nota:</b> Esto guarda tus preferencias. En el siguiente upgrade lo conectamos a roles reales (RLS / permisos por miembro).
          </div>
        </section>

        {booting ? (
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Permisos</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Divider() {
  return <div style={styles.divider} />;
}

function PermCard({
  title,
  subtitle,
  dot,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  dot: string;
  value: PermMode;
  onChange: (v: PermMode) => void;
  disabled: boolean;
}) {
  return (
    <div style={styles.permRow}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.permTitleLine}>
          <span style={{ ...styles.dot, background: dot }} />
          <div style={styles.permTitle}>{title}</div>
        </div>
        <div style={styles.permSub}>{subtitle}</div>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PermMode)}
        disabled={disabled}
        style={{
          ...styles.select,
          opacity: disabled ? 0.6 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <option value="owner_only">Solo yo (owner only)</option>
        <option value="shared_read">Compartido (solo lectura)</option>
        <option value="shared_write">Compartido (edición)</option>
      </select>
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
  shell: { maxWidth: 980, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
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
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
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
  h1: { margin: "10px 0 0", fontSize: 26, letterSpacing: "-0.6px", fontWeight: 900 as any },
  sub: { marginTop: 8, fontSize: 13, opacity: 0.75, maxWidth: 720 },
  heroBtns: { display: "flex", gap: 10, flexWrap: "wrap" },
  heroMeta: { marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 12,
  },
  sectionTitle: { fontWeight: 950, fontSize: 14 },
  smallNote: { marginTop: 6, fontSize: 12, opacity: 0.72, maxWidth: 760 },

  innerCard: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
  },

  permRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 10px",
    flexWrap: "wrap",
  },
  permTitleLine: { display: "flex", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 999, boxShadow: "0 0 16px rgba(255,255,255,0.10)" },
  permTitle: { fontSize: 13, fontWeight: 950 as any, letterSpacing: "-0.2px" },
  permSub: { marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.3 },

  select: {
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    fontWeight: 800 as any,
    outline: "none",
  },

  divider: { height: 1, background: "rgba(255,255,255,0.08)" },

  note: { marginTop: 10, fontSize: 12, opacity: 0.78, fontWeight: 650 as any, lineHeight: 1.4 },

  pillSoft: {
    fontSize: 10,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.35)",
    background: "rgba(148,163,184,0.08)",
    opacity: 0.9,
    whiteSpace: "nowrap",
  },
  pillOkSoft: { border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.10)" },

  ghostBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900 as any,
  },

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
  loadingDot: { width: 12, height: 12, borderRadius: 999, background: "rgba(56,189,248,0.95)", boxShadow: "0 0 24px rgba(56,189,248,0.55)" },
  loadingTitle: { fontWeight: 900 as any },
  loadingSub: { fontSize: 12, opacity: 0.75, marginTop: 2 },
};