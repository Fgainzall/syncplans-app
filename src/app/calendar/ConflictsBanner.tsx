"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function ConflictsBanner() {
  const router = useRouter();
  const sp = useSearchParams();

  const applied = sp.get("applied") === "1";
  const deleted = sp.get("deleted");
  const appliedCount = sp.get("appliedCount");
  const skipped = sp.get("skipped");

  if (!applied) return null;

  return (
    <div
      style={{
        marginBottom: 14,
        padding: "14px 16px",
        borderRadius: 16,
        border: "1px solid rgba(34,197,94,0.30)",
        background: "rgba(34,197,94,0.10)",
        color: "rgba(255,255,255,0.95)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 14,
      }}
    >
      <div>
        <div style={{ fontWeight: 900, fontSize: 14 }}>
          ✅ Conflictos resueltos
        </div>
        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
          {appliedCount ?? 0} decisión(es) aplicadas
          {deleted ? ` · ${deleted} evento(s) eliminados` : ""}
          {skipped ? ` · ${skipped} ignorado(s)` : ""}
        </div>
      </div>

      <button
        onClick={() => router.replace("/calendar")}
        style={{
          padding: "8px 12px",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.25)",
          background: "rgba(255,255,255,0.08)",
          color: "rgba(255,255,255,0.95)",
          fontWeight: 900,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Entendido
      </button>
    </div>
  );
}
