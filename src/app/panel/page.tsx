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
          "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
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

        {/* GRID PRINCIPAL (HUB) */}
        <section
          style={{
            marginTop: 24,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
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
            hint="Quién está en cada grupo."
            onClick={() => router.push("/members")}
          />

          <HubCard
            title="Invitaciones"
            hint="Enviar y aceptar accesos."
            onClick={() => router.push("/invitations")}
          />

          <HubCard
            title="Calendario"
            hint="Ver tu agenda y crear eventos."
            onClick={() => router.push("/calendar")}
          />

          <HubCard
            title="Settings"
            hint="Notificaciones, zonas horarias y más."
            onClick={() => router.push("/settings")}
          />

          <HubCard
            title="Planes"
            hint="Ver tu plan actual y opciones Premium."
            onClick={() => router.push("/planes")}
          />

          <HubCard
            title="Perfil"
            hint="Datos de cuenta y preferencias."
            onClick={() => router.push("/profile")}
          />
        </section>
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
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.20), transparent 55%), rgba(15,23,42,0.94)",
        padding: 18,
        textAlign: "left",
        cursor: "pointer",
        transition: "transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease",
        boxShadow: "0 18px 50px rgba(0,0,0,0.40)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform =
          "translateY(-2px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 22px 60px rgba(0,0,0,0.55)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(255,255,255,0.22)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform =
          "translateY(0px)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow =
          "0 18px 50px rgba(0,0,0,0.40)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "rgba(255,255,255,0.12)";
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          marginBottom: 6,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 13,
          opacity: 0.8,
          fontWeight: 650,
        }}
      >
        {props.hint}
      </div>
    </button>
  );
}