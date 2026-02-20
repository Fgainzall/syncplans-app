// src/app/panel/page.tsx
"use client";

import React from "react";
import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

export default function PanelPage() {
  return (
    <MobileScaffold>
      <PremiumHeader title="Panel" />

      <div
        style={{
          marginTop: 20,
          padding: 20,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(15,23,42,0.6)",
          color: "#E5E7EB",
          fontWeight: 600,
        }}
      >
        Aquí va tu Hub de Panel (grupos, miembros, invitaciones, settings,
        planes). Por ahora es solo un placeholder para que el build pase
        perfecto.
      </div>
    </MobileScaffold>
  );
}