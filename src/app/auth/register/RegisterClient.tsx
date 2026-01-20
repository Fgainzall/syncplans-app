// src/app/auth/register/RegisterClient.tsx
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
          // vuelve a tu app cuando confirmas el mail
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

  return (
    <main style={S.page}>
      <div style={S.shell}>
        {/* Top bar: logo pequeño + link a login */}
        <header style={S.topBar}>
          <div style={S.brandMini}>
            <span style={S.brandDot} />
            <span>SyncPlans · Beta privada</span>
          </div>

          <button
            type="button"
            onClick={() => router.push("/auth/login")}
            style={S.topLink}
          >
            Ya tengo cuenta →
          </button>
        </header>

        {/* Contenido principal */}
        <section style={S.row}>
          {/* Card izquierda: pitch */}
          <div style={S.heroCard}>
            <div style={S.heroInner}>
              <div style={S.badge}>
                <span style={S.badgeDot} />
                Calendario · Pareja · Familia
              </div>

              <h1 style={S.title}>
                Crea tu cuenta y organiza tu semana{" "}
                <span style={S.titleAccent}>sin choques.</span>
              </h1>

              <p style={S.subtitle}>
                Registra tus planes una sola vez y deja que SyncPlans se encargue
                del resto: conflictos, grupos y quién está libre en cada momento.
              </p>

              {/* Mini chips como en el calendario */}
              <div style={S.chipsRow}>
                <MiniChip
                  label="Personal"
                  caption="Tu agenda, limpia y clara."
                  color="#FBBF24"
                />
                <MiniChip
                  label="Pareja"
                  caption="Citas sin solaparse."
                  color="#F87171"
                />
                <MiniChip
                  label="Familia"
                  caption="Horarios alineados."
                  color="#60A5FA"
                />
              </div>

              <div style={S.howBox}>
                <div style={S.howTitle}>¿Cómo funciona el registro?</div>
                <ol style={S.howList}>
                  <li>Escribes tu correo y una contraseña segura.</li>
                  <li>
                    Te llega un mail de Supabase: haz click en{" "}
                    <strong>“Confirm your mail”</strong>.
                  </li>
                  <li>
                    Vuelves automáticamente a{" "}
                    <code style={S.code}>/auth/callback</code> y entras a tu
                    calendario.
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Card derecha: formulario */}
          <div style={S.formCard}>
            <div style={S.formInner}>
              <div style={S.formHeader}>
                <h2 style={S.formTitle}>Crear cuenta</h2>
                <span style={S.betaPill}>100% gratis en beta</span>
              </div>

              <p style={S.formSub}>
                Empieza a organizar tu vida sin conflictos en menos de un minuto.
              </p>

              {done ? (
                <div style={S.successBox}>
                  <div style={S.successTitle}>Cuenta creada ✅</div>
                  <div style={S.successText}>
                    Revisa tu correo, confirma el registro y luego vuelve para
                    iniciar sesión.
                  </div>

                  <div style={S.successActions}>
                    <button
                      type="button"
                      onClick={() => router.push("/auth/login")}
                      style={S.primaryBtn}
                    >
                      Ir a iniciar sesión →
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDone(false);
                        setEmail("");
                        setPassword("");
                      }}
                      style={S.secondaryBtn}
                    >
                      Crear otra cuenta
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} style={S.form}>
                  <Field label="Correo">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      autoComplete="email"
                      style={S.input}
                    />
                  </Field>

                  <Field label="Contraseña">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres"
                      type="password"
                      autoComplete="new-password"
                      style={S.input}
                    />
                  </Field>

                  {error && (
                    <div style={S.errorBox}>
                      <div style={S.errorTitle}>No se pudo crear la cuenta</div>
                      <div style={S.errorText}>{error}</div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    style={{
                      ...S.primaryBtn,
                      ...(canSubmit ? {} : S.primaryBtnDisabled),
                    }}
                  >
                    {loading ? "Creando cuenta…" : "Crear cuenta"}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/auth/login")}
                    style={S.secondaryBtn}
                  >
                    Ya tengo cuenta
                  </button>

                  <p style={S.legal}>
                    Al crear una cuenta aceptas que esta es una beta privada
                    pensada para pruebas personales. Podrás borrar tu cuenta y
                    datos cuando quieras desde el panel de perfil.
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={S.field}>
      <div style={S.fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

function MiniChip(props: {
  label: string;
  caption: string;
  color: string;
}) {
  return (
    <div style={S.chip}>
      <div style={S.chipTop}>
        <span
          style={{
            ...S.chipDot,
            background: props.color,
          }}
        />
        <span>{props.label}</span>
      </div>
      <div style={S.chipCaption}>{props.caption}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1100px 600px at 10% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 520px at 90% 0%, rgba(124,58,237,0.18), transparent 60%), #050816",
    color: "rgba(255,255,255,0.94)",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "24px 18px 40px",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 12,
  },
  brandMini: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.82)",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(239,68,68,0.95)",
    boxShadow: "0 0 12px rgba(239,68,68,0.7)",
  },
  topLink: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(15,23,42,0.85)",
    padding: "7px 14px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    color: "rgba(255,255,255,0.88)",
  },

  row: {
    display: "flex",
    gap: 20,
    alignItems: "stretch",
    flexWrap: "wrap",
  },

  heroCard: {
    flex: 1.1,
    minWidth: 280,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "radial-gradient(900px 420px at 0% 0%, rgba(37,99,235,0.28), transparent 55%), radial-gradient(900px 420px at 100% 0%, rgba(124,58,237,0.26), transparent 55%), rgba(9,9,20,0.94)",
    boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
    position: "relative",
    overflow: "hidden",
  },
  heroInner: {
    position: "relative",
    padding: 20,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.75)",
    fontSize: 11,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  badgeDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "rgba(34,197,94,0.95)",
    boxShadow: "0 0 18px rgba(34,197,94,0.7)",
  },
  title: {
    margin: "16px 0 4px",
    fontSize: 26,
    fontWeight: 900,
    letterSpacing: -0.6,
  },
  titleAccent: {
    color: "#86efac",
  },
  subtitle: {
    margin: "4px 0 14px",
    fontSize: 13,
    opacity: 0.88,
    maxWidth: 420,
    lineHeight: 1.5,
  },

  chipsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
  },
  chip: {
    flex: "0 0 auto",
    minWidth: 120,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.8)",
    padding: 10,
  },
  chipTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 850,
  },
  chipDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  chipCaption: {
    marginTop: 4,
    fontSize: 11,
    opacity: 0.78,
  },

  howBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.8)",
    fontSize: 12,
  },
  howTitle: {
    fontWeight: 850,
    marginBottom: 4,
  },
  howList: {
    margin: 0,
    paddingLeft: 16,
    lineHeight: 1.5,
    opacity: 0.85,
  },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
    fontSize: 11,
    padding: "1px 4px",
    borderRadius: 6,
    background: "rgba(15,23,42,0.9)",
    border: "1px solid rgba(148,163,184,0.5)",
  },

  formCard: {
    flex: 0.9,
    minWidth: 320,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,20,0.95)",
    boxShadow: "0 26px 80px rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "stretch",
  },
  formInner: {
    padding: 20,
    width: "100%",
  },
  formHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  formTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.3,
  },
  betaPill: {
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(52,211,153,0.6)",
    background: "rgba(16,185,129,0.16)",
    fontSize: 11,
    fontWeight: 850,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  formSub: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.78,
  },

  form: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  field: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.8,
  },
  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.9)",
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(248,250,252,0.95)",
    outline: "none",
  },

  errorBox: {
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.4)",
    background: "rgba(248,113,113,0.12)",
    padding: 10,
    fontSize: 12,
  },
  errorTitle: {
    fontWeight: 850,
    marginBottom: 4,
  },
  errorText: {
    opacity: 0.9,
  },

  primaryBtn: {
    marginTop: 4,
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.8)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.9), rgba(129,140,248,0.9))",
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    color: "#fff",
  },
  primaryBtnDisabled: {
    opacity: 0.45,
    cursor: "not-allowed",
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.9)",
  },
  secondaryBtn: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.9)",
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
    color: "rgba(248,250,252,0.9)",
    marginTop: 6,
  },

  legal: {
    marginTop: 6,
    fontSize: 11,
    opacity: 0.6,
    lineHeight: 1.5,
  },

  successBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(22,163,74,0.15)",
    fontSize: 12,
  },
  successTitle: {
    fontWeight: 900,
    marginBottom: 4,
  },
  successText: {
    opacity: 0.9,
  },
  successActions: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
};
