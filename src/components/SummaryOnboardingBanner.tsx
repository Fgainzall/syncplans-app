// src/components/SummaryOnboardingBanner.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function SummaryOnboardingBanner({
  hasEvents,
}: {
  hasEvents: boolean;
}) {
  const router = useRouter();

  // Si ya tiene eventos, no mostramos el banner
  if (hasEvents) return null;

  return (
    <section
      style={{
        marginBottom: 16,
        padding: 14,
        borderRadius: 18,
        border: "1px dashed rgba(255,255,255,0.22)",
        background:
          "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(124,58,237,0.22))",
        boxShadow: "0 18px 50px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        color: "rgba(255,255,255,0.95)",
        flexWrap: "wrap",
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
          Crea tu primer evento en SyncPlans
        </div>
        <div style={{ fontSize: 13, opacity: 0.85, maxWidth: 420 }}>
          Empieza con un evento personal o invita a tu pareja. El resumen se
          llenará automáticamente con tus planes y posibles conflictos.
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={() =>
              router.push("/events/new/details?type=personal")
            }
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.3)",
              background:
                "linear-gradient(135deg, rgba(56,189,248,0.7), rgba(124,58,237,0.7))",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Crear evento
          </button>

          <button
            onClick={() => router.push("/groups")}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(5,8,22,0.4)",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Crear grupo
          </button>
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
