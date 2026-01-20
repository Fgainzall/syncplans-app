"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function RegisterClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
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
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setDone(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta de nuevo.");
      setLoading(false);
    }
  }

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%)," +
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
      "linear-gradient(120deg, #22d3ee 0%, #6366f1 35%, #a855f7 60%, #f97316 95%)",
    WebkitBackgroundClip: "text",
    color: "transparent",
  };

  const heroSub: React.CSSProperties = {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.78,
    maxWidth: 440,
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

  const infoBox: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(52,211,153,0.45)",
    background: "rgba(16,185,129,0.10)",
    padding: "8px 10px",
    fontSize: 11,
    color: "rgba(240,253,250,0.95)",
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
            <span>SyncPlans · Registro beta</span>
          </div>

          <button
            type="button"
            style={linkTop}
            onClick={() => router.push("/auth/login")}
          >
            Ya tengo cuenta →
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
                Crea tu cuenta y organiza tu semana{" "}
                <span style={heroGradientWord}>sin choques.</span>
              </h1>

              <p style={heroSub}>
                Confirmas tu correo una vez y listo: calendario personal, grupos
                de pareja y familia, y un flujo de resolución de conflictos para
                que nadie se pise los planes.
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
                  <div style={pillSub}>Tu agenda, simple.</div>
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
                  <div style={pillSub}>Evita solapamientos.</div>
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
                  <div style={pillSub}>Todo sincronizado.</div>
                </div>
              </div>

              <p style={steps}>
                <b>¿Cómo funciona el registro?</b>
                <br />
                1. Escribes tu correo y una contraseña.
                <br />
                2. Te llega un mail de Supabase: haz clic en{" "}
                <b>"Confirm your mail"</b>.
                <br />
                3. Vuelves automáticamente a <b>/auth/callback</b> y entras a tu
                calendario.
              </p>
            </div>
          </article>

          {/* RIGHT: FORM */}
          <article style={formCard}>
            <div style={formHeader}>
              <h2 style={h2}>Crear cuenta</h2>
              <button
                type="button"
                style={subtleLink}
                onClick={() => router.push("/auth/login")}
              >
                Ya tengo cuenta
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
              Empieza a organizar tu vida sin conflictos.
            </div>

            {done ? (
              <>
                <div style={infoBox}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>
                    Cuenta creada ✅
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                    Revisa tu correo y confirma el registro. Después de hacer
                    clic en <b>"Confirm your mail"</b> volverás automáticamente a{" "}
                    <b>/auth/callback</b> y podrás iniciar sesión.
                  </div>
                </div>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() => router.push("/auth/login")}
                >
                  Ir a iniciar sesión
                </button>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() => {
                    setDone(false);
                    setEmail("");
                    setPassword("");
                  }}
                >
                  Crear otra cuenta
                </button>

                <div style={legal}>
                  Si no ves el correo, revisa tu bandeja de spam o busca por
                  &ldquo;Supabase Auth&rdquo;.
                </div>
              </>
            ) : (
              <>
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
                      autoComplete="new-password"
                    />
                  </div>

                  {error && <div style={errorBox}>{error}</div>}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={primaryBtn}
                  >
                    {loading ? "Creando cuenta…" : "Crear cuenta"}
                  </button>
                </form>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() => router.push("/auth/login")}
                >
                  Ya tengo cuenta
                </button>

                <div style={legal}>
                  Al crear una cuenta aceptas que esta es una beta privada
                  pensada para pruebas personales. Podrás borrar tu cuenta y
                  datos cuando quieras desde el panel de perfil.
                </div>
              </>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
