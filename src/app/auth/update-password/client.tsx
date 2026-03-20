"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

export default function Client() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const passwordError = useMemo(() => {
    if (!password) return null;
    if (password.length < 6) return "La contraseña debe tener al menos 6 caracteres.";
    return null;
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null;
    if (password !== confirmPassword) return "Las contraseñas no coinciden.";
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

  async function handleRecovery() {
    try {
      // 🔥 1. Forzar a Supabase a leer el hash del URL
      const { data: sessionData } = await supabase.auth.getSession();

      if (!mounted) return;

      if (sessionData?.session) {
        setSessionReady(true);
        setCheckingSession(false);
        return;
      }

      // 🔥 2. Escuchar si Supabase detecta sesión desde el hash
      const { data: listener } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) return;

          if (event === "SIGNED_IN" && session) {
            setSessionReady(true);
            setCheckingSession(false);
          }
        }
      );

      // 🔥 3. fallback (si nada pasa)
      setTimeout(() => {
        if (!mounted) return;

        setError(
          "No pudimos validar tu enlace de recuperación."
        );
        setSessionReady(false);
        setCheckingSession(false);
      }, 1500);

      return () => {
        listener.subscription.unsubscribe();
      };
    } catch {
      if (!mounted) return;
      setError("Ocurrió un error al validar tu acceso.");
      setSessionReady(false);
      setCheckingSession(false);
    }
  }

  handleRecovery();

  return () => {
    mounted = false;
  };
}, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Actualizar contraseña
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message || "No se pudo actualizar la contraseña.");
        setLoading(false);
        return;
      }

      // 2. Confirmar sesión activa (auto-login)
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData?.session) {
        setError("No se pudo iniciar sesión automáticamente.");
        setLoading(false);
        return;
      }

      // 3. Mensaje + redirect
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

const infoBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(96,165,250,0.28)",
  background: "rgba(30,41,59,0.72)",
  color: "#BFDBFE",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const hintErrorStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: "#FCA5A5",
};

const errorBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.22)",
  color: "#FCA5A5",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};

const successBoxStyle: CSSProperties = {
  borderRadius: 14,
  border: "1px solid rgba(52,211,153,0.30)",
  background: "rgba(6,95,70,0.22)",
  color: "#86EFAC",
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5,
};