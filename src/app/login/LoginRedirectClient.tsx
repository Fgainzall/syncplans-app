// src/app/login/LoginRedirectClient.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginRedirectClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const nextParam = sp.get("next");
    const nextTarget =
      nextParam && nextParam.startsWith("/") ? nextParam : "/summary";

    // 🚀 Redirigimos todo el tráfico de /login → /auth/login
    router.replace(`/auth/login?next=${encodeURIComponent(nextTarget)}`);
  }, [router, sp]);

  const page: React.CSSProperties = {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%)," +
      "radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%)," +
      "#050816",
    color: "rgba(255,255,255,0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  };

  const box: React.CSSProperties = {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.4)",
    background: "rgba(15,23,42,0.96)",
    padding: "18px 20px",
    maxWidth: 360,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 28px 80px rgba(0,0,0,0.6)",
    fontSize: 13,
  };

  const dot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    margin: "0 auto 10px",
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 18px rgba(56,189,248,0.8)",
  };

  const title: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 800,
    marginBottom: 4,
  };

  const text: React.CSSProperties = {
    opacity: 0.8,
    lineHeight: 1.5,
  };

  return (
    <main style={page}>
      <div style={box}>
        <div style={dot} />
        <div style={title}>Redirigiendo al inicio de sesión…</div>
        <p style={text}>
          Estamos llevándote a la pantalla principal de acceso de SyncPlans.
        </p>
      </div>
    </main>
  );
}