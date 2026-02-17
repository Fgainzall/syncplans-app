// src/app/summary/page.tsx
import React, { Suspense } from "react";
import SummaryClient from "./SummaryClient";

export const dynamic = "force-dynamic";

function SummaryFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050816",
        color: "rgba(248,250,252,0.96)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "22px 18px 48px",
        }}
      >
        <div
          style={{
            marginTop: 32,
            padding: 16,
            borderRadius: 18,
            border: "1px solid rgba(148,163,184,0.45)",
            background: "rgba(15,23,42,0.96)",
            fontSize: 13,
          }}
        >
          Cargando tu resumen…
        </div>
      </div>
    </main>
  );
}

export default function SummaryPage() {
  return (
    <Suspense fallback={<SummaryFallback />}>
      {/* Props requeridas por SummaryClient: las inicializamos en null */}
      <SummaryClient highlightId={null} appliedToast={null} />
    </Suspense>
  );
}