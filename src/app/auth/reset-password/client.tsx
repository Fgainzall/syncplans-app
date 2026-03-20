"use client";

import React, { useMemo, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

function getCurrentOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const env =
    (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.APP_URL ??
      ""
    ).trim();

  if (!env) return "";

  try {
    return new URL(env).origin;
  } catch {
    return "";
  }
}

export default function Client() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/auth/login"),
    [nextParam]
  );

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().includes("@") && !loading;
  }, [email, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const origin = getCurrentOrigin();
      const redirectTo = origin ? `${origin}/auth/update-password` : undefined;

      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        redirectTo ? { redirectTo } : undefined
      );

      if (error) {
        setError(error.message || "No se pudo enviar el enlace.");
        setLoading(false);
        return;
      }

      setSuccess(
        "Te enviamos un enlace para cambiar tu contraseña. Revisa tu bandeja de entrada y también spam."
      );
      setLoading(false);
    } catch (err: any) {
      setError(err?.message ?? "Ocurrió un error inesperado.");
      setLoading(false);
    }
  }

  return (
    <AuthCard
      mode="login"
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace seguro para que definas una nueva contraseña."
      onToggleMode={() =>
        router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
      }
    >
      <>
        <p style={introTextStyle}>
          Ingresa el correo con el que creaste tu cuenta en SyncPlans.
        </p>

        <form onSubmit={onSubmit} style={formStyle}>
          <div style={fieldStyle}>
            <label htmlFor="reset-email" style={labelStyle}>
              Correo
            </label>
            <input
              id="reset-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              disabled={loading}
            />
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}
          {success && <div style={successBoxStyle}>{success}</div>}

          <button type="submit" disabled={!canSubmit} style={primaryButtonStyle}>
            {loading ? "Enviando…" : "Enviar enlace"}
          </button>
        </form>

        <button
          type="button"
          onClick={() =>
            router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
          }
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