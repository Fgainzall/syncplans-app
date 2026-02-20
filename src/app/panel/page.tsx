// src/app/panel/page.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

export default function PanelPage() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1000px 600px at 20% -10%, rgba(56,189,248,0.15), transparent 60%), #050816",
        color: "rgba(255,255,255,0.92)",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <MobileScaffold
        maxWidth={1120}
        paddingDesktop="22px 18px 48px"
        paddingMobile="18px 14px 90px"
        mobileBottomSafe={120}
      >
        <PremiumHeader
          title="Panel"
          subtitle="Tu centro de control en SyncPlans."
        />

        {/* GRID PRINCIPAL */}
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          <HubCard
            title="Grupos"
            hint="Pareja, familia y grupos compartidos."
            onClick={() => router.push("/groups")}
          />

          <HubCard
            title="Miembros"
            hint="Gestiona quién está en cada grupo."
            onClick={() => router.push("/members")}
          />

          <HubCard
            title="Invitaciones"
            hint="Envía y acepta accesos."
            onClick={() => router.push("/invitations")}
          />

          <HubCard
            title="Calendario"
            hint="Ver tu agenda y crear eventos."
            onClick={() => router.push("/calendar")}
          />

          <HubCard
            title="Planes"
            hint="Ver tu plan actual y opciones Premium."
            onClick={() => router.push("/planes")}
          />

          <HubCard
            title="Perfil"
            hint="Preferencias y configuración personal."
            onClick={() => router.push("/profile")}
          />
        </div>
      </MobileScaffold>
    </main>
  );
}

function HubCard(props: {
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.20), transparent 55%), rgba(15,23,42,0.92)",
        padding: 16,
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          marginBottom: 4,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 13,
          opacity: 0.8,
        }}
      >
        {props.hint}
      </div>
    </button>
  );
}