"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

function readHashParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  return new URLSearchParams(hash);
}

export default function Client() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    return null;
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null;
    if (password !== confirmPassword) {
      return "Las contraseñas no coinciden.";
    }
    return null;
  }, [password, confirmPassword]);

  const canSubmit = useMemo(() => {
    return (
      !loading &&
      sessionReady &&
      password.length >= 6 &&
      confirmPassword.length >= 6 &&
      password === confirmPassword
    );
  }, [loading, sessionReady, password, confirmPassword]);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      try {
        setCheckingSession(true);
        setError(null);

        const code = searchParams.get("code");
        const hashParams = readHashParams();

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        // Caso 1: PKCE / code en query
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            if (!mounted) return;
            setError(
              "No pudimos validar tu enlace de recuperación. Solicita uno nuevo e inténtalo otra vez."
            );
            setSessionReady(false);
            setCheckingSession(false);
            return;
          }

          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, "/auth/update-password");
          }
        }

        // Caso 2: tokens en hash (#access_token=...&refresh_token=...)
        else if (accessToken && refreshToken && type === "recovery") {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            if (!mounted) return;
            setError(
              "No pudimos validar tu enlace de recuperación. Solicita uno nuevo e inténtalo otra vez."
            );
            setSessionReady(false);
            setCheckingSession(false);
            return;
          }

          if (typeof window !== "undefined") {
            window.history.replaceState({}, document.title, "/auth/update-password");
          }
        }

        // Esperamos la sesión final ya armada
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError) {
          setError("No pudimos validar tu enlace de recuperación.");
          setSessionReady(false);
          setCheckingSession(false);
          return;
        }

        if (!data.session) {
          setError(
            "Este enlace no es válido, ya expiró o no pudo completarse. Solicita uno nuevo para cambiar tu contraseña."
          );
          setSessionReady(false);
          setCheckingSession(false);
          return;
        }

        setSessionReady(true);
        setCheckingSession(false);
      } catch {
        if (!mounted) return;
        setError("Ocurrió un error al validar tu acceso.");
        setSessionReady(false);
        setCheckingSession(false);
      }
    }

    boot();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message || "No se pudo actualizar la contraseña.");
        setLoading(false);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        setError("No se pudo iniciar sesión automáticamente.");
        setLoading(false);
        return;
      }

      setSuccess("Listo. Entrando a SyncPlans…");
      router.replace("/summary");
    } catch (err: any) {
      setError(err?.message ?? "Ocurrió un error inesperado.");
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <AuthCard
      mode="login"
      title="Nueva contraseña"
      subtitle="Define una nueva contraseña para volver a entrar a SyncPlans."
      onToggleMode={() => router.push("/auth/login")}
    >
      <>
        <p style={introTextStyle}>
          Elige una contraseña nueva y confirma el cambio.
        </p>

        {checkingSession ? (
          <div style={infoBoxStyle}>Validando enlace seguro…</div>
        ) : (
          <form onSubmit={onSubmit} style={formStyle}>
            <div style={fieldStyle}>
              <label htmlFor="new-password" style={labelStyle}>
                Nueva contraseña
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                disabled={loading || !sessionReady}
              />
              {passwordError && <div style={hintErrorStyle}>{passwordError}</div>}
            </div>

            <div style={fieldStyle}>
              <label htmlFor="confirm-password" style={labelStyle}>
                Confirmar contraseña
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Repite tu nueva contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                disabled={loading || !sessionReady}
              />
              {confirmError && <div style={hintErrorStyle}>{confirmError}</div>}
            </div>

            {error && <div style={errorBoxStyle}>{error}</div>}
            {success && <div style={successBoxStyle}>{success}</div>}

            <button type="submit" disabled={!canSubmit} style={primaryButtonStyle}>
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => router.push("/auth/login")}
          style={backButtonStyle}
          disabled={loading}
        >
          Volver al login
        </button>
      </>
    </AuthCard>
  );
}

const introTextStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "rgba(226,232,240,0.78)",
};

const formStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#E5E7EB",
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 48,
  borderRadius: 14,
  border: "1px solid rgba(148,163,184,0.22)",
  background: "rgba(15,23,42,0.72)",
  color: "#F8FAFC",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
};

const primaryButtonStyle: CSSProperties = {
  marginTop: 4,
  minHeight: 48,
  border: "none",
  borderRadius: 14,
  background:
    "linear-gradient(135deg, rgba(56,189,248,1) 0%, rgba(99,102,241,1) 100%)",
  color: "#04111D",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  padding: "0 16px",
};

const backButtonStyle: CSSProperties = {
  marginTop: 14,
  border: "none",
  background: "transparent",
  color: "rgba(148,163,184,0.92)",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  padding: 0,
  alignSelf: "flex-start",
};

const errorBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.28)",
  color: "#FCA5A5",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const successBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(74,222,128,0.28)",
  background: "rgba(20,83,45,0.28)",
  color: "#86EFAC",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const infoBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.22)",
  background: "rgba(15,23,42,0.56)",
  color: "#BFDBFE",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const hintErrorStyle: CSSProperties = {
  fontSize: 12,
  color: "#FCA5A5",
};