// src/app/auth/register/RegisterClient.tsx
"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";
import { trackEvent, trackEventOnce, trackScreenView } from "@/lib/analytics";

function getAppOrigin() {
  const env =
    (process.env.NEXT_PUBLIC_APP_URL ??
      process.env.APP_URL ??
      "https://syncplansapp.com").trim();

  try {
    return new URL(env).origin;
  } catch {
    return "https://syncplansapp.com";
  }
}

export default function RegisterClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const inviteParam = sp.get("invite");
  const sourceParam = sp.get("source");

  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/onboarding"),
    [nextParam],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.trim() === password2.trim();

  const analyticsBase = useMemo(
    () => ({
      screen: "register",
      next_target: nextTarget,
      invite_id: inviteParam || undefined,
      source: sourceParam || undefined,
      entry_path: typeof window !== "undefined" ? window.location.pathname : "/auth/register",
    }),
    [inviteParam, nextTarget, sourceParam],
  );

  useEffect(() => {
    void trackScreenView({
      screen: "register",
      metadata: analyticsBase,
    });
  }, [analyticsBase]);

  const markSignupStarted = useCallback(() => {
    void trackEventOnce({
      event: "signup_started",
      scope: "session",
      onceKey: inviteParam
        ? `signup-started:${nextTarget}:${inviteParam}`
        : `signup-started:${nextTarget}`,
      metadata: analyticsBase,
    });
  }, [analyticsBase, inviteParam, nextTarget]);

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    const trimmedPass2 = password2.trim();

    return (
      trimmedName.length > 0 &&
      trimmedEmail.includes("@") &&
      trimmedPass.length >= 6 &&
      trimmedPass2.length >= 6 &&
      trimmedPass === trimmedPass2 &&
      !loading
    );
  }, [name, email, password, password2, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    markSignupStarted();
    if (!canSubmit) return;

    setError(null);
    setLoading(true);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    const trimmedPass2 = password2.trim();

    if (!trimmedName) {
      setError("Pon tu nombre para mostrarte bien dentro de SyncPlans.");
      setLoading(false);
      return;
    }

    if (trimmedPass !== trimmedPass2) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const origin = getAppOrigin();
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`;

      const { data, error: signUpError } = await supabase.auth.signUp({
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

      const userId = data.user?.id ?? null;

      void trackEvent({
        event: "signup_completed",
        userId,
        metadata: {
          ...analyticsBase,
          method: "email_password",
          has_email_confirmation: true,
          redirected_to: nextTarget,
        },
      });

      setDone(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
      setLoading(false);
    }
  }

  function resetForm() {
    setDone(false);
    setName("");
    setEmail("");
    setPassword("");
    setPassword2("");
    setError(null);
  }

  return (
    <AuthCard
      mode="register"
      title="Crea tu cuenta"
      subtitle="Empieza a coordinar mejor con las personas que comparten tiempo contigo."
      onToggleMode={() =>
        router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
      }
    >
      <>
        {done ? (
          <>
            <div style={successBoxStyle}>
              <div style={successTitleStyle}>Cuenta creada ✅</div>
              <p style={successTextStyle}>
                Te enviamos un correo para confirmar tu registro. Apenas abras
                ese link, volverás a SyncPlans y podrás entrar con normalidad.
              </p>
            </div>

            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() =>
                router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
              }
              disabled={loading}
            >
              Ir a iniciar sesión
            </button>

            <button
              type="button"
              style={ghostButtonStyle}
              onClick={resetForm}
              disabled={loading}
            >
              Crear otra cuenta
            </button>

            <p style={helperTextStyle}>
              No olvides revisar spam o promociones si el correo no aparece de
              inmediato.
            </p>
          </>
        ) : (
          <>
            <p style={introTextStyle}>
              SyncPlans te ayuda a coordinar planes con claridad, detectar cruces a tiempo y evitar discusiones innecesarias.
            </p>

            <form onSubmit={onSubmit} style={formStyle}>
              <div style={fieldStyle}>
                <label htmlFor="register-name" style={labelStyle}>
                  Nombre
                </label>
                <input
                  id="register-name"
                  type="text"
                  autoComplete="name"
                  placeholder="Cómo quieres que te vean"
                  value={name}
                  onFocus={markSignupStarted}
                  onChange={(e) => {
                    markSignupStarted();
                    setName(e.target.value);
                  }}
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="register-email" style={labelStyle}>
                  Correo
                </label>
                <input
                  id="register-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onFocus={markSignupStarted}
                  onChange={(e) => {
                    markSignupStarted();
                    setEmail(e.target.value);
                  }}
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="register-password" style={labelStyle}>
                  Contraseña
                </label>
                <input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onFocus={markSignupStarted}
                  onChange={(e) => {
                    markSignupStarted();
                    setPassword(e.target.value);
                  }}
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              <div style={fieldStyle}>
                <label htmlFor="register-password-2" style={labelStyle}>
                  Confirmar contraseña
                </label>
                <input
                  id="register-password-2"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repite tu contraseña"
                  value={password2}
                  onFocus={markSignupStarted}
                  onChange={(e) => {
                    markSignupStarted();
                    setPassword2(e.target.value);
                  }}
                  style={inputStyle}
                  disabled={loading}
                />
              </div>

              {!passwordsMatch && password2.trim().length > 0 && (
                <div style={warningBoxStyle}>
                  Las contraseñas todavía no coinciden.
                </div>
              )}

              {error && <div style={errorBoxStyle}>{error}</div>}

              <button type="submit" disabled={!canSubmit} style={primaryButtonStyle}>
                {loading ? "Creando cuenta…" : "Crear cuenta"}
              </button>
            </form>

            <button
              type="button"
              style={ghostButtonStyle}
              onClick={() =>
                router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
              }
              disabled={loading}
            >
              Ya tengo cuenta
            </button>

            <p style={helperTextStyle}>
              Después podrás crear grupos, invitar personas y empezar a coordinar
              eventos compartidos.
            </p>
          </>
        )}
      </>
    </AuthCard>
  );
}

const introTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.65,
  color: "rgba(203,213,225,0.92)",
};

const formStyle: CSSProperties = {
  display: "grid",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(148,163,184,0.95)",
};

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.36)",
  background: "rgba(15,23,42,0.88)",
  color: "rgba(248,250,252,0.98)",
  padding: "13px 14px",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const primaryButtonStyle: CSSProperties = {
  width: "100%",
  borderRadius: 999,
  border: "1px solid rgba(56,189,248,0.90)",
  background:
    "linear-gradient(90deg, rgba(56,189,248,0.98), rgba(16,185,129,0.96))",
  color: "#06131F",
  padding: "13px 16px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  width: "100%",
  borderRadius: 999,
  border: "1px solid rgba(148,163,184,0.38)",
  background: "rgba(15,23,42,0.62)",
  color: "rgba(241,245,249,0.96)",
  padding: "12px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostButtonStyle: CSSProperties = {
  width: "100%",
  borderRadius: 999,
  border: "1px solid rgba(71,85,105,0.32)",
  background: "transparent",
  color: "rgba(148,163,184,0.96)",
  padding: "11px 16px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const errorBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.20)",
  color: "rgba(254,226,226,0.96)",
  padding: "11px 12px",
  fontSize: 12,
  lineHeight: 1.55,
};

const warningBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(250,204,21,0.30)",
  background: "rgba(120,53,15,0.16)",
  color: "rgba(254,243,199,0.96)",
  padding: "10px 12px",
  fontSize: 12,
  lineHeight: 1.5,
};

const successBoxStyle: CSSProperties = {
  borderRadius: 18,
  border: "1px solid rgba(52,211,153,0.30)",
  background: "rgba(6,95,70,0.18)",
  padding: "14px 14px 13px",
  display: "grid",
  gap: 6,
};

const successTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "rgba(220,252,231,0.98)",
};

const successTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: "rgba(220,252,231,0.92)",
};

const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.6,
  color: "rgba(148,163,184,0.82)",
};