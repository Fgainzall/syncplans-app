// src/app/summary/page.tsx

import React, { Suspense } from "react";
import SummaryClient from "./SummaryClient";

export default function SummaryPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background: "#050816",
            color: "rgba(248,250,252,0.98)",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              padding: 16,
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.5)",
              background: "rgba(15,23,42,0.96)",
              fontSize: 13,
            }}
          >
            Cargando resumen…
          </div>
        </main>
      }
    >
      <SummaryClient />
    </Suspense>
  );
}
