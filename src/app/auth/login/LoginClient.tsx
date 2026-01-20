// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

function safeNext(raw: string | null): string {
  if (!raw) return "/calendar";
  return raw.startsWith("/") ? raw : "/calendar";
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextTarget = useMemo(() => safeNext(sp.get("next")), [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && password.trim().length >= 6 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes("email") && (msg.includes("confirm") || msg.includes("verified"))) {
          setError(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
          );
        } else {
          setError(signInError.message);
        }
        return;
      }

      // ✅ Login OK
      router.replace(nextTarget);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  }

  // ---------- ESTILOS PREMIUM (MISMA LÍNEA QUE REGISTER) ----------

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1400px 700px at 15% -10%, rgba(56,189,248,0.22), transparent 60%)," +
      "radial-gradient(1100px 600px at 90% 0%, rgba(129,140,248,0.20), transparent 60%)," +
      "#050816",
    color: "rgba(248,250,252,0.96)",
  };

  const shell: React.CSSProperties = {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "32px 20px 56px",
    display: "flex",
    flexDirection: "column",
    gap: 22,
  };

  const topRow: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  };

  const badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.80)",
    padding: "6px 11px",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 800,
    opacity: 0.95,
  };

  const badgeDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(45,212,191,0.95)",
    boxShadow: "0 0 16px rgba(45,212,191,0.85)",
  };

  const linkTop: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.85,
    cursor: "pointer",
  };

  const layout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
    gap: 22,
    marginTop: 6,
    alignItems: "stretch",
  };

  const heroCard: React.CSSProperties = {
    position: "relative",
    borderRadius: 26,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(900px 480px at 0% 0%, rgba(56,189,248,0.28), transparent 55%)," +
      "radial-gradient(900px 480px at 100% 0%, rgba(129,140,248,0.26), transparent 55%)," +
      "rgba(15,23,42,0.94)",
    padding: 24,
    overflow: "hidden",
    boxShadow: "0 30px 95px rgba(0,0,0,0.65)",
  };

  const heroInner: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
  };

  const heroKicker: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.88)",
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.95,
  };

  const heroDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(251,191,36,0.95)",
    boxShadow: "0 0 20px rgba(251,191,36,0.9)",
  };

  const heroTitle: React.CSSProperties = {
    margin: "16px 0 6px",
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: -0.7,
  };

  // Gradiente solo en gama fría (azules/violetas) para que quede más “marca SyncPlans”
  const heroGradientWord: React.CSSProperties = {
    background:
      "linear-gradient(120deg, #22d3ee 0%, #38bdf8 30%, #6366f1 65%, #a855f7 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  };

  const heroSub: React.CSSProperties = {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.80,
    maxWidth: 460,
    lineHeight: 1.55,
    fontWeight: 500,
  };

  const heroList: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 18,
  };

  const pill: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.95)",
    background: "rgba(15,23,42,0.9)",
    padding: "10px 11px",
  };

  const pillRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    fontSize: 11,
    fontWeight: 800,
  };

  const pillDotBase: React.CSSProperties = {
    width: 9,
    height: 9,
    borderRadius: 999,
    boxShadow: "0 0 12px rgba(255,255,255,0.45)",
  };

  const pillSub: React.CSSProperties = {
    marginTop: 4,
    fontSize: 11,
    opacity: 0.80,
  };

  const steps: React.CSSProperties = {
    marginTop: 16,
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 1.55,
  };

  const formCard: React.CSSProperties = {
    borderRadius: 26,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.97)",
    padding: 24,
    boxShadow: "0 28px 90px rgba(0,0,0,0.70)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  };

  const formHeader: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
  };

  const h2: React.CSSProperties = {
    fontSize: 19,
    fontWeight: 800,
    margin: 0,
  };

  const subtleLink: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.78,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 3,
  };

  const label: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.82,
  };

  const input: React.CSSProperties = {
    width: "100%",
    borderRadius: 17,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.95)",
    padding: "10px 13px",
    fontSize: 13,
    color: "rgba(248,250,252,0.96)",
    outline: "none",
  };

  const errorBox: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(248,113,113,0.55)",
    background: "rgba(248,113,113,0.14)",
    padding: "8px 10px",
    fontSize: 12,
    color: "rgba(254,242,242,0.95)",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.9)",
    background:
      "linear-gradient(90deg, rgba(56,189,248,0.98), rgba(16,185,129,0.98))",
    padding: "11px 15px",
    fontSize: 13,
    fontWeight: 800,
    cursor: canSubmit ? "pointer" : "not-allowed",
    opacity: canSubmit ? 1 : 0.55,
  };

  const secondaryBtn: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.95)",
    padding: "10px 15px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
    opacity: 0.92,
  };

  const legal: React.CSSProperties = {
    marginTop: 4,
    fontSize: 10,
    opacity: 0.62,
    lineHeight: 1.55,
  };

  return (
    <main style={page}>
      <div style={shell}>
        {/* TOP BAR */}
        <div style={topRow}>
          <div style={badge}>
            <span style={badgeDot} />
            <span>SyncPlans · Beta privada</span>
          </div>

          <button
            type="button"
            style={linkTop}
            onClick={() =>
              router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
            }
          >
            ¿Nuevo aquí? Crear cuenta →
          </button>
        </div>

        {/* MAIN GRID */}
        <section style={layout}>
          {/* LEFT: HERO */}
          <article style={heroCard}>
            <div style={heroInner}>
              <div style={heroKicker}>
                <span style={heroDot} />
                <span>Calendario · Pareja · Familia</span>
              </div>

              <h1 style={heroTitle}>
                Inicia sesión y mantén tu semana{" "}
                <span style={heroGradientWord}>sin choques.</span>
              </h1>

              <p style={heroSub}>
                Registra tus planes una sola vez y deja que SyncPlans te muestre
                quién está libre, dónde hay conflictos y qué eventos se pisan
                entre sí.
              </p>

              <div style={heroList}>
                <div style={pill}>
                  <div style={pillRow}>
                    <span>Personal</span>
                    <span
                      style={{
                        ...pillDotBase,
                        background: "rgba(251,191,36,0.95)",
                      }}
                    />
                  </div>
                  <div style={pillSub}>Tu agenda limpia y clara.</div>
                </div>

                <div style={pill}>
                  <div style={pillRow}>
                    <span>Pareja</span>
                    <span
                      style={{
                        ...pillDotBase,
                        background: "rgba(248,113,113,0.95)",
                      }}
                    />
                  </div>
                  <div style={pillSub}>Citas sin solapamientos.</div>
                </div>

                <div style={pill}>
                  <div style={pillRow}>
                    <span>Familia</span>
                    <span
                      style={{
                        ...pillDotBase,
                        background: "rgba(96,165,250,0.95)",
                      }}
                    />
                  </div>
                  <div style={pillSub}>Horarios alineados siempre.</div>
                </div>
              </div>

              <p style={steps}>
                <b>¿Cómo funciona?</b>
                <br />
                1. Inicia sesión con tu correo y contraseña.
                <br />
                2. Crea tus grupos de pareja / familia.
                <br />
                3. Empieza a crear eventos y deja que SyncPlans te avise de los
                choques.
              </p>
            </div>
          </article>

          {/* RIGHT: FORM */}
          <article style={formCard}>
            <div style={formHeader}>
              <h2 style={h2}>Iniciar sesión en SyncPlans</h2>
              <button
                type="button"
                style={subtleLink}
                onClick={() =>
                  router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
                }
              >
                Crear cuenta nueva
              </button>
            </div>

            <div
              style={{
                fontSize: 12,
                opacity: 0.78,
                marginTop: 3,
                marginBottom: 8,
              }}
            >
              Accede a tu agenda sin choques de horario.
            </div>

            <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={label}>Correo</div>
                <input
                  style={input}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <div style={label}>Contraseña</div>
                <input
                  style={input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="mínimo 6 caracteres"
                  autoComplete="current-password"
                />
              </div>

              {error && <div style={errorBox}>{error}</div>}

              <button type="submit" disabled={!canSubmit} style={primaryBtn}>
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>

            <button
              type="button"
              style={secondaryBtn}
              onClick={() =>
                router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
              }
            >
              Crear cuenta
            </button>

            <div style={legal}>
              Al entrar aceptas que esta es una beta privada pensada para pruebas
              personales. Podrás borrar tu cuenta y datos cuando quieras desde el
              panel de perfil.
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
