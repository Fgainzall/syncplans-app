// src/app/panel/operations/page.tsx
import { Suspense } from "react";
import OperationsClient from "./OperationsClient";

function OperationsFallback() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#050817",
        color: "#F8FAFC",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div
          style={{
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 24,
            padding: 20,
            background: "rgba(15, 23, 42, 0.72)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#93C5FD",
              fontWeight: 800,
              marginBottom: 8,
            }}
          >
            Operaciones
          </div>
          <h1 style={{ fontSize: 24, lineHeight: 1.1, margin: 0 }}>
            Preparando dashboard…
          </h1>
        </div>
      </div>
    </main>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<OperationsFallback />}>
      <OperationsClient />
    </Suspense>
  );
}
