// src/app/settings/conflicts/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getSettingsFromDb, saveSettingsToDb, type NotificationSettings } from "@/lib/settings";

type UiToast = { title: string; subtitle?: string } | null;
type ConflictDefaultResolution = "ask_me" | "keep_existing" | "replace_with_new" | "none";

export default function ConflictsSettingsPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<UiToast>(null);

  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToast({ title, subtitle });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setBooting(true);
        const s = await getSettingsFromDb();
        if (!alive) return;
        setSettings(s);
      } catch (e) {
        console.error("[ConflictsSettings] load error", e);
        showToast("No se pudieron cargar tus ajustes", "Refresca la página o intenta de nuevo.");
      } finally {
        if (alive) setBooting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const currentResolution = (settings?.conflictDefaultResolution as ConflictDefaultResolution) ?? "ask_me";

  const resolutionLabel = useMemo(() => {
    const map: Record<ConflictDefaultResolution, string> = {
      ask_me: "Preguntarme siempre",
      keep_existing: "Mantener existente",
      replace_with_new: "Reemplazar por el nuevo",
      none: "Conservar ambos",
    };
    return map[currentResolution];
  }, [currentResolution]);

  function update<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    try {
      setSaving(true);
      await saveSettingsToDb(settings);
      showToast("Ajustes guardados ✅", "Tus preferencias de conflictos se actualizaron.");
    } catch (e) {
      console.error("[ConflictsSettings] save error", e);
      showToast("No se pudieron guardar los cambios", "Inténtalo de nuevo en unos segundos.");
    } finally {
      setSaving(false);
    }
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
            <div style={styles.kicker}>Settings</div>
            <h1 style={styles.h1}>Preferencias de conflictos</h1>
            <div style={styles.sub}>
              Define si te avisamos antes de guardar y qué decisión usar por defecto cuando haya choques.
            </div>

            <div style={styles.heroMeta}>
              <span style={styles.pillSoft}>Default: {resolutionLabel}</span>
            </div>
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
          <div style={styles.sectionTitle}>Aviso previo</div>
          <div style={styles.smallNote}>Si está ON, verás una pantalla previa para decidir qué hacer ante un choque.</div>

          <div style={styles.innerCard}>
            <ToggleRow
              title="Avisarme antes de guardar"
              subtitle="Si lo apagas, SyncPlans aplicará tu decisión por defecto directamente."
              value={!!settings?.conflictWarnBeforeSave}
              onChange={(v) => update("conflictWarnBeforeSave", v)}
            />
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.sectionTitle}>Decisión por defecto</div>
          <div style={styles.smallNote}>
            Se usa cuando aplicas una decisión rápida (o si el aviso previo está apagado). Puedes cambiar caso por caso.
          </div>

          <div style={styles.grid}>
            <ResolutionCard
              title="Preguntarme siempre"
              desc="Siempre quiero ver la pantalla con opciones antes de guardar."
              selected={currentResolution === "ask_me"}
              onClick={() => update("conflictDefaultResolution", "ask_me" as any)}
            />
            <ResolutionCard
              title="Mantener existente"
              desc="Si hay choque, se conserva el evento que ya estaba (el nuevo no se guarda)."
              selected={currentResolution === "keep_existing"}
              onClick={() => update("conflictDefaultResolution", "keep_existing" as any)}
            />
            <ResolutionCard
              title="Reemplazar por el nuevo"
              desc="Si hay choque, se borran los existentes y se guarda el nuevo."
              selected={currentResolution === "replace_with_new"}
              onClick={() => update("conflictDefaultResolution", "replace_with_new" as any)}
            />
            <ResolutionCard
              title="Conservar ambos"
              desc="Si hay choque, se guardan ambos eventos. Luego puedes ajustar manualmente."
              selected={currentResolution === "none"}
              onClick={() => update("conflictDefaultResolution", "none" as any)}
            />
          </div>

          <div style={styles.footerRow}>
            <div style={styles.footerLeft}>
              <div style={styles.footerTitle}>Regla de oro</div>
              <div style={styles.footerText}>Nada se borra sin que lo confirmes directa o indirectamente con estas reglas.</div>
            </div>

            <button
              onClick={handleSave}
              style={{
                ...styles.primaryBtn,
                opacity: saving ? 0.7 : 1,
                cursor: saving ? "progress" : "pointer",
              }}
              disabled={saving || booting || !settings}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </section>

        {booting ? (
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Cargando…</div>
              <div style={styles.loadingSub}>Conflictos</div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div style={styles.toggleRow}>
      <div style={{ minWidth: 0 }}>
        <div style={styles.toggleTitle}>{title}</div>
        <div style={styles.toggleSub}>{subtitle}</div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!value)}
        style={{
          ...styles.toggleBtn,
          ...(value ? styles.toggleOn : styles.toggleOff),
        }}
        aria-label={title}
      >
        <span
          style={{
            ...styles.toggleKnob,
            ...(value ? styles.knobOn : styles.knobOff),
          }}
        />
      </button>
    </div>
  );
}

function ResolutionCard({
  title,
  desc,
  selected,
  onClick,
}: {
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.resCard,
        ...(selected ? styles.resCardOn : styles.resCardOff),
      }}
    >
      <div>
        <div style={styles.resTitle}>{title}</div>
        <div style={styles.resDesc}>{desc}</div>
      </div>
      <div style={styles.resFoot}>{selected ? "Seleccionado" : "Elegir como defecto"}</div>
    </button>
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

  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 10px" },
  toggleTitle: { fontSize: 13, fontWeight: 900 as any },
  toggleSub: { marginTop: 4, fontSize: 12, opacity: 0.72, lineHeight: 1.3 },

  toggleBtn: {
    position: "relative",
    width: 56,
    height: 32,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    cursor: "pointer",
    flexShrink: 0,
  },
  toggleOn: { border: "1px solid rgba(34,197,94,0.30)", background: "rgba(34,197,94,0.14)" },
  toggleOff: { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)" },
  toggleKnob: {
    position: "absolute",
    top: 4,
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#050816",
    border: "1px solid rgba(255,255,255,0.10)",
    transition: "all 180ms ease",
  },
  knobOn: { left: 28, border: "1px solid rgba(34,197,94,0.35)" },
  knobOff: { left: 4 },

  grid: { marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" },

  resCard: {
    width: "100%",
    textAlign: "left",
    borderRadius: 16,
    padding: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 10,
  },
  resCardOn: { border: "1px solid rgba(244,63,94,0.45)", background: "rgba(244,63,94,0.12)" },
  resCardOff: { border: "1px solid rgba(255,255,255,0.10)", background: "rgba(6,10,20,0.55)" },
  resTitle: { fontWeight: 950 as any, fontSize: 13, letterSpacing: "-0.2px" },
  resDesc: { marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.3 },
  resFoot: { fontSize: 11, opacity: 0.70, fontWeight: 800 as any },

  footerRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  footerLeft: { maxWidth: 680 },
  footerTitle: { fontWeight: 900 as any, fontSize: 12 },
  footerText: { marginTop: 6, fontSize: 12, opacity: 0.72, lineHeight: 1.35 },

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

  primaryBtn: {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.22), rgba(124,58,237,0.22))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900 as any,
  },
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