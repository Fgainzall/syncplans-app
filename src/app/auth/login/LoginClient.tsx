// src/app/auth/login/LoginClient.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

/** Canonical origin helper */
function getAppOrigin() {
  const env =
    (process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "").trim();

  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/summary"),
    [nextParam]
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [slowMessage, setSlowMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectTimerRef = useRef<number | null>(null);
  const slowUiTimerRef = useRef<number | null>(null);
  const redirectingRef = useRef(false);

  const isBusy = loadingEmail || loadingGoogle || isRedirecting;

  function clearTimers() {
    if (redirectTimerRef.current !== null) {
      window.clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
    if (slowUiTimerRef.current !== null) {
      window.clearTimeout(slowUiTimerRef.current);
      slowUiTimerRef.current = null;
    }
  }

  function startRedirect(nextPath: string) {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    setIsRedirecting(true);
    setSlowMessage(null);
    clearTimers();

    router.replace(nextPath);
    router.refresh();

    if (typeof window !== "undefined") {
      slowUiTimerRef.current = window.setTimeout(() => {
        setSlowMessage("Esto está tardando más de lo esperado…");
      }, 2500);

      redirectTimerRef.current = window.setTimeout(() => {
        window.location.assign(nextPath);
      }, 4000);
    }
  }

  useEffect(() => {
    let alive = true;

    async function go() {
      try {
        if (typeof window !== "undefined") {
          const h = window.location.hash || "";
          if (h.includes("access_token=") || h.includes("provider_token=")) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search
            );
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        if (data?.session) {
          startRedirect(nextTarget);
        }
      } catch {
        // no-op
      }
    }

    void go();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        startRedirect(nextTarget);
      }
    });

    return () => {
      alive = false;
      clearTimers();
      sub?.subscription?.unsubscribe();
    };
  }, [router, nextTarget]);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && password.trim().length >= 6 && !isBusy;
  }, [email, password, isBusy]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSlowMessage(null);
    clearTimers();
    setLoadingEmail(true);

    try {
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });

      if (signInError) {
        const msg = String(signInError.message || "").toLowerCase();

        if (
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed") ||
          msg.includes("confirm") ||
          msg.includes("confirmation")
        ) {
          setError(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja o spam y entra desde el link."
          );
        } else if (msg.includes("invalid login") || msg.includes("invalid")) {
          setError("Correo o contraseña incorrectos.");
        } else {
          setError(signInError.message);
        }

        setLoadingEmail(false);
        return;
      }

      if (!data?.session) {
        setError("No se pudo iniciar sesión correctamente. Intenta otra vez.");
        setLoadingEmail(false);
        return;
      }

      setLoadingEmail(false);
      startRedirect(nextTarget);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
      setLoadingEmail(false);
      setIsRedirecting(false);
      setSlowMessage(null);
      redirectingRef.current = false;
      clearTimers();
    }
  }

  async function onGoogle() {
    setError(null);
    setSlowMessage(null);
    setLoadingGoogle(true);

    try {
      const origin = getAppOrigin();
      const redirectTo = origin
        ? `${origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`
        : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoadingGoogle(false);
        return;
      }

      if (!data?.url) {
        setError("No se pudo iniciar el acceso con Google.");
        setLoadingGoogle(false);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? "Error iniciando sesión con Google.");
      setLoadingGoogle(false);
    }
  }

  return (
    <AuthCard
      mode="login"
      title="Vuelve a tener claridad entre ustedes"
      subtitle="Entra a SyncPlans y retoma tus planes compartidos desde una sola agenda clara."
      onToggleMode={() =>
        router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
      }
    >
      <>
        <div style={introCardStyle}>
          <div style={introTitleStyle}>Entrar debería tomar segundos</div>
          <p style={introTextStyle}>
            Vuelve a tus próximos planes, a los choques detectados y a lo que
            todavía necesitan decidir juntos.
          </p>
        </div>

        <form onSubmit={onSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="login-email" style={labelStyle}>
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={isBusy}
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="login-password" style={labelStyle}>
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              disabled={isBusy}
            />
          </div>

          <button
            type="button"
            onClick={() => router.push("/auth/reset-password")}
            style={forgotButtonStyle}
            disabled={isBusy}
          >
            ¿Olvidaste tu contraseña?
          </button>

          {error && <div style={errorBoxStyle}>{error}</div>}

          {slowMessage && !error && (
            <div style={infoBoxStyle}>{slowMessage}</div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            style={primaryButtonStyle}
          >
            {loadingEmail || isRedirecting ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>

        <div style={separatorRowStyle}>
          <span style={separatorLineStyle} />
          <span style={separatorTextStyle}>o</span>
          <span style={separatorLineStyle} />
        </div>

        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={onGoogle}
          disabled={isBusy}
        >
          {loadingGoogle ? "Conectando…" : "Continuar con Google"}
        </button>

        <button
          type="button"
          style={ghostButtonStyle}
          onClick={() =>
            router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
          }
          disabled={isBusy}
        >
          Crear cuenta
        </button>

        <p style={helperTextStyle}>
          Si ya habías entrado antes, volverás directo a tu resumen y a tus
          próximos planes.
        </p>
      </>
    </AuthCard>
  );
}

const introCardStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  padding: "12px 12px",
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.14)",
  background: "rgba(15,23,42,0.42)",
};

const introTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 850,
  color: "rgba(248,250,252,0.98)",
  lineHeight: 1.35,
};

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

const errorBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.20)",
  color: "rgba(254,226,226,0.96)",
  padding: "11px 12px",
  fontSize: 12,
  lineHeight: 1.55,
};

const infoBoxStyle: CSSProperties = {
  borderRadius: 16,
  border: "1px solid rgba(56,189,248,0.28)",
  background: "rgba(2,132,199,0.14)",
  color: "rgba(224,242,254,0.96)",
  padding: "11px 12px",
  fontSize: 12,
  lineHeight: 1.55,
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

const separatorRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const separatorLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: "rgba(148,163,184,0.22)",
};

const separatorTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(148,163,184,0.78)",
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

const helperTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  lineHeight: 1.6,
  color: "rgba(148,163,184,0.82)",
};

const forgotButtonStyle: CSSProperties = {
  justifySelf: "end",
  marginTop: -4,
  marginBottom: 2,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "rgba(148,163,184,0.88)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
};