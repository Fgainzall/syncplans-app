"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";
import { createGroup } from "@/lib/groupsDb";

type GType = "pair" | "family";

export default function NewGroupPage() {
  const router = useRouter();

  const [booting, setBooting] = useState(true);
  const [type, setType] = useState<GType>("pair");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<null | { title: string; subtitle?: string }>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setBooting(true);
      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;

      if (error || !data.session?.user) {
        setBooting(false);
        router.replace("/auth/login");
        return;
      }

      setBooting(false);
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  const typeMeta = useMemo(() => {
    if (type === "pair") {
      return {
        label: "Pareja",
        hint: "Comparte eventos y detecta choques con tu pareja.",
        soft: "rgba(96,165,250,0.14)",
        border: "rgba(96,165,250,0.28)",
      };
    }
    return {
      label: "Familia",
      hint: "Coordina horarios familiares con visibilidad total.",
      soft: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.24)",
    };
  }, [type]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!name.trim()) e.push("Ponle un nombre al grupo.");
    if (name.trim().length < 3) e.push("El nombre debe tener al menos 3 caracteres.");
    return e;
  }, [name]);

  const canSave = errors.length === 0 && !saving;

  const goBack = () => router.push("/groups");

  const save = async () => {
    if (!canSave) {
      setToast({ title: "Revisa el formulario", subtitle: errors[0] });
      window.setTimeout(() => setToast(null), 2500);
      return;
    }

    // ✅ asegurar sesión antes de crear (evita edge-cases en Vercel)
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      router.replace("/auth/login");
      return;
    }

    setSaving(true);
    try {
      // Nota: no asumimos shape exacto del retorno para evitar TS/build issues
      const g: any = await createGroup({ type, name: name.trim() });

      const gid =
        (typeof g?.id === "string" && g.id) ||
        (typeof g?.group?.id === "string" && g.group.id) ||
        null;

      if (!gid) {
        throw new Error("Grupo creado pero no se recibió el ID (respuesta inválida).");
      }

      setToast({ title: "Grupo creado ✅", subtitle: "Abriendo detalle…" });
      window.setTimeout(() => router.push(`/groups/${gid}`), 450);
    } catch (err: any) {
      setToast({
        title: "No se pudo crear",
        subtitle: err?.message || "Intenta nuevamente.",
      });
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <main style={styles.page}>
        <div style={styles.shell}>
          <PremiumHeader />
          <div style={styles.loadingCard}>
            <div style={styles.loadingDot} />
            <div>
              <div style={styles.loadingTitle}>Preparando…</div>
              <div style={styles.loadingSub}>Creación de grupo</div>
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
            <LogoutButton />
          </div>
        </div>

        <section
          style={{
            ...styles.hero,
            borderColor: typeMeta.border,
            background: `linear-gradient(180deg, ${typeMeta.soft}, rgba(255,255,255,0.03))`,
          }}
        >
          <div style={styles.heroLeft}>
            <div style={styles.kicker}>Nuevo grupo</div>
            <h1 style={styles.h1}>Crea tu {typeMeta.label.toLowerCase()}</h1>
            <div style={styles.sub}>{typeMeta.hint}</div>
          </div>

          <div style={styles.heroRight}>
            <button onClick={goBack} style={styles.ghostBtn}>
              Cancelar
            </button>
            <button
              onClick={save}
              style={{ ...styles.primaryBtn, opacity: canSave ? 1 : 0.6 }}
              disabled={!canSave}
            >
              {saving ? "Creando…" : "Crear"}
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.row}>
            <div style={styles.label}>Tipo</div>
            <div style={styles.chips}>
              <button
                type="button"
                onClick={() => setType("pair")}
                style={{
                  ...styles.chip,
                  background: type === "pair" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                }}
              >
                <span style={{ ...styles.chipDot, background: "rgba(96,165,250,0.95)" }} />
                Pareja
              </button>
              <button
                type="button"
                onClick={() => setType("family")}
                style={{
                  ...styles.chip,
                  background:
                    type === "family" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
                }}
              >
                <span style={{ ...styles.chipDot, background: "rgba(34,197,94,0.95)" }} />
                Familia
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <div style={styles.fieldLabel}>Nombre</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === "pair" ? "Ej: Fernando & Ara" : "Ej: Familia Llosa"}
              style={styles.input}
            />
            <div style={styles.hint}>Tip: usa un nombre corto y reconocible.</div>
          </div>

          {errors.length > 0 && (
            <div style={styles.errorBox}>
              <div style={styles.errorTitle}>Antes de crear:</div>
              <ul style={styles.errorList}>
                {errors.map((e) => (
                  <li key={e} style={styles.errorItem}>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section style={styles.footerRow}>
          <button onClick={goBack} style={styles.ghostBtnWide}>
            ← Volver
          </button>
          <button
            onClick={save}
            style={{ ...styles.primaryBtnWide, opacity: canSave ? 1 : 0.6 }}
            disabled={!canSave}
          >
            {saving ? "Creando…" : "Crear grupo"}
          </button>
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
  shell: { maxWidth: 900, margin: "0 auto", padding: "22px 18px 48px" },

  toastWrap: { position: "fixed", top: 18, right: 18, zIndex: 50, pointerEvents: "none" },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 360,
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
  },
  topActions: { display: "flex", gap: 10, alignItems: "center" },

  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  heroLeft: { display: "flex", flexDirection: "column", gap: 8 },
  heroRight: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },

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
  h1: { margin: 0, fontSize: 28, letterSpacing: "-0.6px" },
  sub: { fontSize: 13, opacity: 0.75, maxWidth: 560, lineHeight: 1.4 },

  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  label: { fontSize: 12, opacity: 0.75, fontWeight: 800 },
  chips: { display: "flex", gap: 10, flexWrap: "wrap" },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 900,
  },
  chipDot: { width: 10, height: 10, borderRadius: 999 },

  field: { marginTop: 12, display: "flex", flexDirection: "column", gap: 8 },
  fieldLabel: { fontSize: 12, opacity: 0.8, fontWeight: 900 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(6,10,20,0.55)",
    color: "rgba(255,255,255,0.92)",
    outline: "none",
    fontSize: 14,
  },
  hint: { fontSize: 12, opacity: 0.72 },

  errorBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.28)",
    background: "rgba(248,113,113,0.10)",
    padding: 12,
  },
  errorTitle: { fontWeight: 900, fontSize: 12, marginBottom: 8 },
  errorList: { margin: 0, paddingLeft: 16 },
  errorItem: { fontSize: 12, opacity: 0.9, marginBottom: 4 },

  footerRow: {
    marginTop: 14,
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
    fontWeight: 800,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
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
