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
          subtitle="Tu centro de control: grupos, miembros, invitaciones y cuenta en un solo lugar."
        />

        {/* Descripción breve del HUB */}
        <section
          style={{
            marginTop: 18,
            marginBottom: 4,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "rgba(148,163,184,0.96)",
              maxWidth: 520,
              fontWeight: 500,
            }}
          >
            Piensa en el panel como la consola de SyncPlans: desde aquí
            gestionas <b>con quién compartes</b>, cómo se ve tu cuenta y
            qué plan tienes activo.
          </div>

          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "6px 10px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.42)",
              background: "rgba(15,23,42,0.88)",
              color: "rgba(226,232,240,0.96)",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            HUB · Administración
          </div>
        </section>

        {/* GRID PRINCIPAL (HUB) */}
        <section
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
            gap: 16,
          }}
        >
          <HubCard
            icon="👥"
            tag="Relaciones"
            title="Grupos"
            hint="Pareja, familia y grupos compartidos."
            onClick={() => router.push("/groups")}
          />

          <HubCard
            icon="🧑‍🤝‍🧑"
            tag="Personas"
            title="Miembros"
            hint="Quién está en cada grupo y qué rol tiene."
            onClick={() => router.push("/members")}
          />

          <HubCard
            icon="✉️"
            tag="Invitaciones"
            title="Invitaciones"
            hint="Bandeja y envíos de invitación."
            onClick={() => router.push("/invitations")}
          />

          <HubCard
            icon="🗓️"
            tag="Agenda"
            title="Calendario"
            hint="Ver tu agenda y crear eventos."
            onClick={() => router.push("/calendar")}
          />

          <HubCard
            icon="⚙️"
            tag="Preferencias"
            title="Settings"
            hint="Notificaciones, zonas horarias y más."
            onClick={() => router.push("/settings")}
          />

          <HubCard
            icon="💎"
            tag="Suscripción"
            title="Planes"
            hint="Tu plan actual y opciones Premium."
            onClick={() => router.push("/planes")}
          />

          <HubCard
            icon="👤"
            tag="Cuenta"
            title="Perfil"
            hint="Datos de cuenta y preferencias personales."
            onClick={() => router.push("/profile")}
          />
        </section>
      </MobileScaffold>
    </main>
  );
}

type HubCardProps = {
  icon: string;
  tag: string;
  title: string;
  hint: string;
  onClick: () => void;
};

function HubCard({ icon, tag, title, hint, onClick }: HubCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: "relative",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.12)",
        background:
          "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.20), transparent 55%), rgba(15,23,42,0.94)",
        padding: 18,
        textAlign: "left",
        cursor: "pointer",
        transition:
          "transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease, background 0.14s ease",
        boxShadow: "0 18px 50px rgba(0,0,0,0.40)",
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(-2px)";
        el.style.boxShadow = "0 22px 60px rgba(0,0,0,0.55)";
        el.style.borderColor = "rgba(255,255,255,0.22)";
        el.style.background =
          "radial-gradient(640px 420px at 4% 0%, rgba(56,189,248,0.30), transparent 55%), radial-gradient(640px 420px at 100% 0%, rgba(124,58,237,0.20), transparent 55%), rgba(15,23,42,0.96)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = "translateY(0px)";
        el.style.boxShadow = "0 18px 50px rgba(0,0,0,0.40)";
        el.style.borderColor = "rgba(255,255,255,0.12)";
        el.style.background =
          "radial-gradient(600px 400px at 0% 0%, rgba(56,189,248,0.20), transparent 55%), rgba(15,23,42,0.94)";
      }}
    >
      {/* icono + pill superior */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            border: "1px solid rgba(56,189,248,0.55)",
            background:
              "radial-gradient(circle at 30% 0%, rgba(56,189,248,0.32), transparent 55%), rgba(15,23,42,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "1px solid rgba(148,163,184,0.55)",
            background: "rgba(15,23,42,0.95)",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.09em",
            textTransform: "uppercase",
            color: "rgba(226,232,240,0.9)",
            whiteSpace: "nowrap",
          }}
        >
          {tag}
        </div>
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 900,
          marginBottom: 6,
          letterSpacing: "-0.1px",
          color: "#F9FAFB",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          opacity: 0.82,
          fontWeight: 650,
          color: "rgba(209,213,219,0.96)",
        }}
      >
        {hint}
      </div>

      {/* micro “flecha” inferior derecha */}
      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 14,
          fontSize: 11,
          opacity: 0.72,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 800,
        }}
      >
        <span>Ir</span>
        <span>↗</span>
      </div>
    </button>
  );
}