"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ConflictsBanner({
  count = 0,
  onClickHref = "/conflicts/detected",
}: {
  count?: number;
  onClickHref?: string;
}) {
  const router = useRouter();

  if (!count) return null;

  return (
    <button
      onClick={() => router.push(onClickHref)}
      style={{
        width: "100%",
        marginTop: 12,
        borderRadius: 18,
        padding: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(244,63,94,0.10)",
        color: "rgba(255,255,255,0.92)",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 13 }}>
        ⚠️ Tienes {count} conflicto{count === 1 ? "" : "s"} detectado{count === 1 ? "" : "s"}
      </div>
      <div style={{ opacity: 0.8, fontSize: 12, marginTop: 4 }}>
        Toca para resolverlos en 1 minuto.
      </div>
    </button>
  );
}
