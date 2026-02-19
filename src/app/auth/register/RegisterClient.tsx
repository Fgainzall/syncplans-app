// src/app/auth/register/RegisterClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function RegisterClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/summary"),
    [nextParam],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    const n = name.trim();
    const p1 = password.trim();
    const p2 = password2.trim();
    return (
      e.includes("@") &&
      n.length > 0 &&
      p1.length >= 6 &&
      p2.length >= 6 &&
      p1 === p2 &&
      !loading
    );
  }, [email, name, password, password2, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    const trimmedPass2 = password2.trim();

    if (!trimmedName) {
      setError("Pon tu nombre. Lo usaremos dentro de SyncPlans.");
      setLoading(false);
      return;
    }

    if (trimmedPass !== trimmedPass2) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const APP_URL =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "https://syncplansapp.com";

      // ✅ Importante: preservamos next para que después del callback caiga donde toca
      const redirectTo =
        `${APP_URL}/auth/callback?next=` + encodeURIComponent(nextTarget);

      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPass,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: trimmedName,
            display_name: trimmedName,
          },
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

  // 🎨 Estilos: alineados con Login (centro, card, blur, responsive)
  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 15% -10%, rgba(56,189,248,0.20), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 0%, rgba(37,99,235,0.18), transparent 60%)," +
      "#050816",
    color: "rgba(255,255,255,0.92)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const shell: React.CSSProperties = {
    maxWidth: 1180,
    width: "100%",
    margin: "0 auto",
    padding: "32px 24px 56px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
    alignItems: "center",
    borderRadius: 28,
    border: "1px solid rgba(148,163,184,0.26)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(2,6,23,0.90))",
    boxShadow: "0 30px 80px rgba(15,23,42,0.75)",
    backdropFilter: "blur(16px)",
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

  const infoBox: React.CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(52,211,153,0.45)",
    background: "rgba(16,185,129,0.12)",
    padding: "8px 10px",
    fontSize: 11,
    color: "rgba(240,253,250,0.95)",
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
    <main style={page} className="spAuth-page">
      <div style={shell} className="spAuth-shell">
        {/* TOP BAR */}
        <div style={topRow} className="spAuth-topRow">
          <div style={badge}>
            <span style={badgeDot} />
            <span>SyncPlans · Registro beta</span>
          </div>

          <button
            type="button"
            style={linkTop}
            onClick={() =>
              router.push(
                `/auth/login?next=${encodeURIComponent(nextTarget)}`,
              )
            }
          >
            Ya tengo cuenta →
          </button>
        </div>

        {/* MAIN LAYOUT */}
        <section style={layout} className="spAuth-layout">
          {/* LEFT: HERO / PITCH */}
          <article style={heroCard}>
            <div style={heroInner}>
              <div style={heroKicker}>
                <span style={heroDot} />
                <span>Calendario · Pareja · Familia</span>
              </div>

              <h1 style={heroTitle}>
                Crea tu espacio y pon{" "}
                <span style={heroGradientWord}>una sola verdad</span> en el
                centro.
              </h1>

              <p style={heroSub}>
                Con una sola cuenta tendrás tu calendario personal y el de tus
                grupos de pareja y familia. SyncPlans detecta choques de horario
                y te obliga a decidir antes, para evitar discusiones después. Al
                entrar, empezarás por un resumen claro de tus próximos planes.
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
                  <div style={pillSub}>Tus cosas, claras y visibles.</div>
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
                  <div style={pillSub}>
                    Un solo lugar para los planes juntos.
                  </div>
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
                  <div style={pillSub}>
                    Todos alineados con la misma agenda.
                  </div>
                </div>
              </div>

              <p style={steps}>
                <b>¿Qué pasa cuando creas tu cuenta?</b>
                <br />
                1. Confirmas tu correo con un mail de Supabase.
                <br />
                2. Después de iniciar sesión, SyncPlans te lleva a un resumen
                donde ves qué viene pronto y dónde se cruzan las cosas.
                <br />
                3. Luego podrás crear grupos, eventos y usar el detector de
                conflictos para decidir qué se queda y qué se mueve.
              </p>
            </div>
          </article>

          {/* RIGHT: FORM */}
          <article style={formCard}>
            <div style={formHeader}>
              <h2 style={h2}>Crear cuenta en SyncPlans</h2>
              <button
                type="button"
                style={subtleLink}
                onClick={() =>
                  router.push(
                    `/auth/login?next=${encodeURIComponent(nextTarget)}`,
                  )
                }
              >
                Ya tengo cuenta
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
              Empieza por ti. Después podrás invitar a tu pareja, familia o
              amigos para compartir el calendario.
            </div>

            {done ? (
              <>
                <div style={infoBox}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>
                    Cuenta creada ✅
                  </div>
                  <div style={{ fontSize: 11, lineHeight: 1.5 }}>
                    Te enviamos un correo para confirmar tu registro. Después de
                    hacer clic en <b>"Confirm your mail"</b> volverás
                    automáticamente a{" "}
                    <b>https://syncplansapp.com/auth/callback</b> y desde ahí
                    podrás iniciar sesión. Al entrar, comenzarás en tu resumen
                    de planes.
                  </div>
                </div>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() =>
                    router.push(
                      `/auth/login?next=${encodeURIComponent(nextTarget)}`,
                    )
                  }
                >
                  Ir a iniciar sesión
                </button>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() => {
                    setDone(false);
                    setName("");
                    setEmail("");
                    setPassword("");
                    setPassword2("");
                    setError(null);
                  }}
                >
                  Crear otra cuenta
                </button>

                <div style={legal}>
                  Si no ves el correo, revisa tu bandeja de spam o busca por
                  &ldquo;Supabase Auth&rdquo;. Sin confirmar el correo no podrás
                  acceder a tu calendario.
                </div>
              </>
            ) : (
              <>
                <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={label}>Nombre</div>
                    <input
                      style={input}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Cómo quieres que te vean en SyncPlans"
                      autoComplete="name"
                    />
                  </div>

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

                  <div>
                    <div style={label}>Confirmar contraseña</div>
                    <input
                      style={input}
                      type="password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      placeholder="Repite tu contraseña para confirmar"
                      autoComplete="new-password"
                    />
                  </div>

                  {error && <div style={errorBox}>{error}</div>}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={primaryBtn}
                  >
                    {loading
                      ? "Creando cuenta…"
                      : "Crear mi calendario compartido"}
                  </button>
                </form>

                <button
                  type="button"
                  style={secondaryBtn}
                  onClick={() =>
                    router.push(
                      `/auth/login?next=${encodeURIComponent(nextTarget)}`,
                    )
                  }
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

      {/* Responsive sin tocar desktop */}
      <style>{`
        @media (max-width: 960px) {
          .spAuth-shell {
            padding: 22px 16px 36px !important;
            border-radius: 22px !important;
          }
          .spAuth-layout {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .spAuth-page {
            padding: 16px !important;
          }
          .spAuth-topRow {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
        }
      `}</style>
    </main>
  );
}