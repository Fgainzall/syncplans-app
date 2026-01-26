// src/app/onboarding/profile/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createMyProfile } from "@/lib/profilesDb";

export default function CompleteProfilePage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fn = firstName.trim();
    const ln = lastName.trim();

    if (!fn || !ln) {
      setError("Por favor escribe tu nombre y apellido.");
      return;
    }

    try {
      setLoading(true);
      await createMyProfile({
        first_name: fn,
        last_name: ln,
      });

      // Cuando todo va bien → al resumen (nuevo home)
      router.replace("/summary");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "No se pudo guardar tu perfil.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !loading && firstName.trim().length >= 2 && lastName.trim().length >= 2;

  return (
    <main style={S.page}>
      <div style={S.glow} aria-hidden />

      <section style={S.card}>
        <div style={S.badge}>Paso 1 de 1 · Tu perfil</div>

        <h1 style={S.title}>¿Cómo te llamas?</h1>
        <p style={S.subtitle}>
          Tu nombre aparecerá en los grupos y eventos compartidos. Nada de
          correos raros, solo tú.
        </p>

        <form onSubmit={onSubmit} style={S.form}>
          <div style={S.inputsRow}>
            <div style={S.field}>
              <label style={S.label}>Nombre</label>
              <input
                style={S.input}
                placeholder="Fernando"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>

            <div style={S.field}>
              <label style={S.label}>Apellido</label>
              <input
                style={S.input}
                placeholder="Gainza"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          {error && <div style={S.error}>{error}</div>}

          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              ...S.button,
              opacity: canSubmit ? 1 : 0.5,
              cursor: canSubmit ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Guardando…" : "Continuar a mi resumen"}
          </button>

          <p style={S.hint}>
            Solo usaremos tu nombre dentro de SyncPlans para identificarte frente
            a tu pareja o familia.
          </p>
        </form>
      </section>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at 5% 0%, rgba(37,99,235,0.28), transparent 55%), radial-gradient(circle at 95% 10%, rgba(236,72,153,0.26), transparent 55%), #050816",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    color: "#F9FAFB",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    position: "relative",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    inset: -160,
    background:
      "radial-gradient(circle at 12% 10%, rgba(56,189,248,0.25), transparent 55%), radial-gradient(circle at 82% 0%, rgba(168,85,247,0.23), transparent 55%), radial-gradient(circle at 50% 100%, rgba(52,211,153,0.20), transparent 55%)",
    filter: "blur(18px)",
    opacity: 0.9,
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 480,
    borderRadius: 26,
    padding: 24,
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.92))",
    border: "1px solid rgba(148,163,184,0.45)",
    boxShadow: "0 30px 90px rgba(15,23,42,0.9)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.95)",
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(226,232,240,0.96)",
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(203,213,225,0.95)",
  },
  form: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  inputsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: "rgba(148,163,184,0.95)",
    fontWeight: 650,
  },
  input: {
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.95)",
    color: "#F9FAFB",
    padding: "0 14px",
    fontSize: 14,
    outline: "none",
  },
  button: {
    marginTop: 6,
    height: 46,
    borderRadius: 999,
    border: "none",
    background: "linear-gradient(135deg, #2563EB, #22C55E)",
    color: "#F9FAFB",
    fontSize: 15,
    fontWeight: 900,
    boxShadow: "0 18px 40px rgba(37,99,235,0.45)",
  },
  error: {
    marginTop: 2,
    fontSize: 12,
    color: "#F97373",
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    color: "rgba(148,163,184,0.95)",
  },
};
