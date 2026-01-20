"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/calendar"),
    [nextParam]
  );

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
        if (signInError.message.toLowerCase().includes("email")) {
          setError(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
          );
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      router.replace(nextTarget);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
      setLoading(false);
    }
  }

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 10%, rgba(129,140,248,0.18), transparent 60%)," +
      "#050816",
    color: "rgba(255,255,255,0.92)",
  };

  const shell: React.CSSProperties = {
    maxWidth: 980,
    margin: "0 auto",
    padding: "22px 18px 48px",
    display: "flex",
    flexDirection: "column",
    gap: 18,
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
    background: "rgba(15,23,42,0.75)",
    padding: "6px 10px",
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    fontWeight: 800,
    opacity: 0.9,
  };

  const badgeDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 16px rgba(56,189,248,0.65)",
  };

  const linkTop: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.8,
    cursor: "pointer",
  };

  const layout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
    gap: 18,
    marginTop: 10,
    alignItems: "stretch",
  };

  const heroCard: React.CSSProperties = {
    position: "relative",
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(800px 420px at 0% 0%, rgba(56,189,248,0.24), transparent 55%)," +
      "radial-gradient(800px 420px at 100% 0%, rgba(129,140,248,0.24), transparent 55%)," +
      "rgba(15,23,42,0.92)",
    padding: 20,
    overflow: "hidden",
    boxShadow: "0 28px 90px rgba(0,0,0,0.55)",
  };

  const heroInner: React.CSSProperties = {
    position: "relative",
    zIndex: 1,
  };

  const heroKicker: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "4px 9px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.85)",
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.9,
  };

  const heroDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(251,191,36,0.95)",
    boxShadow: "0 0 20px rgba(251,191,36,0.8)",
  };

  const heroTitle: React.CSSProperties = {
    margin: "14px 0 4px",
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: -0.6,
  };

  const heroGradientWord: React.CSSProperties = {
    background:
      "linear-gradient(120deg, #22d3ee 0%, #38bdf8 25%, #6366f1 60%, #a855f7 95%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  };

  const heroSub: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.78,
    maxWidth: 420,
    lineHeight: 1.5,
    fontWeight: 500,
  };

  const heroList: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 14,
  };

  const pill: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.9)",
    background: "rgba(15,23,42,0.85)",
    padding: "9px 10px",
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
    opacity: 0.78,
  };

  const steps: React.CSSProperties = {
    marginTop: 14,
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 1.5,
  };

  const formCard: React.CSSProperties = {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.96)",
    padding: 20,
    boxShadow: "0 26px 80px rgba(0,0,0,0.6)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };

  const formHeader: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 8,
  };

  const h2: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    margin: 0,
  };

  const subtleLink: React.CSSProperties = {
    fontSize: 11,
    opacity: 0.75,
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
    opacity: 0.8,
  };

  const input: React.CSSProperties = {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.9)",
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(248,250,252,0.96)",
    outline: "none",
  };

  const errorBox: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(248,113,113,0.12)",
    padding: "8px 10px",
    fontSize: 12,
    color: "rgba(254,242,242,0.95)",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.8)",
    background:
      "linear-gradient(90deg, rgba(56,189,248,0.95), rgba(16,185,129,0.95))",
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: canSubmit ? "pointer" : "not-allowed",
    opacity: canSubmit ? 1 : 0.55,
  };

  const secondaryBtn: React.CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.9)",
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
    opacity: 0.9,
  };

  const legal: React.CSSProperties = {
    marginTop: 4,
    fontSize: 10,
    opacity: 0.6,
    lineHeight: 1.5,
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
            onClick={() => router.push("/auth/register")}
          >
            ¿Nuevo aquí? Crear cuenta →
          </button>
        </div>

        {/* MAIN LAYOUT */}
        <section style={layout}>
          {/* LEFT: HERO / PITCH */}
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
                Registra tus planes una sola vez y deja que SyncPlans se
                encargue de mostrar quién está libre, dónde hay conflictos y
                qué eventos chocan entre sí.
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
                  <div style={pillSub}>Tu agenda, limpia y clara.</div>
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

          {/* RIGHT: LOGIN FORM */}
          <article style={formCard}>
            <div style={formHeader}>
              <h2 style={h2}>Iniciar sesión en SyncPlans</h2>
              <button
                type="button"
                style={subtleLink}
                onClick={() => router.push("/auth/register")}
              >
                Crear cuenta nueva
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                opacity: 0.75,
                marginTop: 2,
                marginBottom: 6,
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
              onClick={() => router.push("/auth/register")}
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
