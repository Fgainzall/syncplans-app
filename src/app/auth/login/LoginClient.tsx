// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");

  // ✅ Regla:
  // Si viene ?next=/algo lo respetamos.
  // Si no hay next válido → /summary (una sola verdad sobre tus planes).
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/summary"),
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
        const msg = String(signInError.message || "").toLowerCase();

        // ✅ Mensajes más “humanos” sin perder tu potencia
        if (
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed") ||
          msg.includes("confirm") ||
          msg.includes("confirmation")
        ) {
          setError(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja (y spam) y entra desde el link."
          );
        } else if (msg.includes("invalid login") || msg.includes("invalid")) {
          setError("Correo o contraseña incorrectos.");
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

  // 🎨 Estilos compartidos con register para que queden alineados
  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 15% -10%, rgba(56,189,248,0.20), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 0%, rgba(37,99,235,0.18), transparent 60%)," +
      "#050816",
    color: "rgba(255,255,255,0.92)",
  };

  const shell: React.CSSProperties = {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "32px 24px 56px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    alignItems: "center",
  };

  const topRow: React.CSSProperties = {
    width: "100%",
    maxWidth: 1080,
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
    background: "rgba(15,23,42,0.85)",
    padding: "6px 12px",
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
    opacity: 0.85,
    cursor: "pointer",
  };

  const layout: React.CSSProperties = {
    width: "100%",
    maxWidth: 1080,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
    gap: 20,
    marginTop: 10,
    alignItems: "stretch",
  };

  const heroCard: React.CSSProperties = {
    position: "relative",
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(800px 420px at 0% 0%, rgba(56,189,248,0.24), transparent 55%)," +
      "radial-gradient(800px 420px at 100% 0%, rgba(37,99,235,0.24), transparent 55%)," +
      "rgba(15,23,42,0.96)",
    padding: 24,
    overflow: "hidden",
    boxShadow: "0 30px 90px rgba(0,0,0,0.60)",
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
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.9)",
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.9,
  };

  const heroDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(251,191,36,0.95)",
    boxShadow: "0 0 20px rgba(251,191,36,0.90)",
  };

  const heroTitle: React.CSSProperties = {
    margin: "16px 0 6px",
    fontSize: 30,
    fontWeight: 900,
    letterSpacing: -0.6,
  };

  const heroGradientWord: React.CSSProperties = {
    background:
      "linear-gradient(120deg, #38bdf8 0%, #22c55e 45%, #14b8a6 100%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  };

  const heroSub: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.8,
    maxWidth: 460,
    lineHeight: 1.55,
    fontWeight: 500,
  };

  const heroList: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  };

  const pill: React.CSSProperties = {
    borderRadius: 18,
    border: "1px solid rgba(15,23,42,0.9)",
    background: "rgba(15,23,42,0.92)",
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
    opacity: 0.8,
  };

  const steps: React.CSSProperties = {
    marginTop: 16,
    fontSize: 11,
    opacity: 0.78,
    lineHeight: 1.6,
  };

  const formCard: React.CSSProperties = {
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(15,23,42,0.98)",
    padding: 24,
    boxShadow: "0 26px 80px rgba(0,0,0,0.60)",
    display: "flex",
    flexDirection: "column",
    gap: 14,
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
    opacity: 0.8,
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
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.95)",
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(248,250,252,0.96)",
    outline: "none",
  };

  const errorBox: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.45)",
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
      "linear-gradient(90deg, rgba(56,189,248,0.97), rgba(16,185,129,0.97))",
    padding: "11px 14px",
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
    lineHeight: 1.6,
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
                Inicia sesión y deja que{" "}
                <span style={heroGradientWord}>
                  SyncPlans arbitre el tiempo.
                </span>
              </h1>

              <p style={heroSub}>
                En lugar de tener cada plan en tu cabeza o en distintos chats,
                SyncPlans pone una sola verdad en el centro: un calendario
                compartido que muestra quién está libre, dónde hay conflictos y
                qué decisiones hay que tomar. Al entrar, verás un resumen claro
                de lo que viene y de los cruces detectados.
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
                  <div style={pillSub}>Tu agenda, clara y sin ruido.</div>
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
                  <div style={pillSub}>Menos “pensé que era otro día”.</div>
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
                  <div style={pillSub}>Todos ven lo mismo, al mismo tiempo.</div>
                </div>
              </div>

              <p style={steps}>
                <b>¿Qué pasa después de iniciar sesión?</b>
                <br />
                • Primero ves tu resumen: próximos eventos, cruces y tipos de
                planes.
                <br />
                • Luego puedes abrir el calendario y los conflictos para decidir
                qué se queda, qué se mueve y qué ajustar después.
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
                marginTop: 2,
                marginBottom: 6,
              }}
            >
              Accede a tu calendario compartido y deja que SyncPlans detecte los
              conflictos por ti.
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