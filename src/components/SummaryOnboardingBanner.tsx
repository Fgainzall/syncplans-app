// src/components/SummaryOnboardingBanner.tsx
"use client";

import React from "react";

export default function SummaryOnboardingBanner() {
  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.08)",
        background:
          "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(124,58,237,0.18))",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        color: "rgba(255,255,255,0.95)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.9,
          }}
        >
          Resumen inteligente
        </div>
        <div style={{ fontSize: 16, fontWeight: 900 }}>
          Tu semana, explicada en 30 segundos
        </div>
        <div style={{ fontSize: 13, opacity: 0.8, maxWidth: 420 }}>
          Muy pronto verás aquí un resumen automático de tus eventos:
          tiempo en pareja, familia, trabajo y más. Todo en un solo vistazo.
        </div>
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.85,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,0.28)",
          background: "rgba(5,8,22,0.25)",
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      >
        Beta interna · SyncPlans
      </div>
    </section>
  );
}
