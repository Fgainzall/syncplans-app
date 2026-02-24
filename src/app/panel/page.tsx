// src/app/panel/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyEvents } from "@/lib/eventsDb";
import { getMyGroups } from "@/lib/groupsDb";
import {
  buildDashboardStats,
  type DashboardStats,
} from "@/lib/profileDashboard";

type HubCardProps = {
  icon: string;
  tag: string;
  title: string;
  hint: string;
  onClick: () => void;
};

export default function PanelPage() {
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [events, groups] = await Promise.all([
          getMyEvents(),
          getMyGroups(),
        ]);

        if (!alive) return;

        const dashboard = buildDashboardStats(events ?? [], groups ?? []);
        setStats(dashboard);
      } catch (err: any) {
        console.error("Error cargando Panel HUB:", err);
        if (alive) {
          setError("No se pudieron cargar los datos del panel.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.35), transparent 55%), radial-gradient(1200px 700px at 90% 10%, rgba(124,58,237,0.18), transparent 60%), #050816",
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
        className="spPanelShell"
      >
        {/* HEADER SUPERIOR (PremiumHeader + contexto) */}
        <section
          style={{
            marginBottom: 18,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <PremiumHeader />

          <div
            style={{
              borderRadius: 22,
              border: "1px solid rgba(148,163,184,0.32)",
              background:
                "radial-gradient(680px 460px at 0% 0%, rgba(56,189,248,0.32), transparent 55%), rgba(15,23,42,0.96)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(148,163,184,0.92)",
              }}
            >
              Panel · Centro de control
            </div>

            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
              }}
            >
              Todo lo importante de SyncPlans, en un solo lugar.
            </div>

            <div
              style={{
                fontSize: 13,
                color: "rgba(226,232,240,0.88)",
                maxWidth: 620,
                lineHeight: 1.5,
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
          </div>
        </section>

        {/* MÉTRICAS RESUMEN (HUB VIVO) */}
        <section
          style={{
            marginTop: 4,
            marginBottom: 10,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 12,
          }}
        >
          {/* Card: Grupos */}
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,0.30)",
              background:
                "radial-gradient(480px 380px at 0% 0%, rgba(56,189,248,0.25), transparent 55%), rgba(15,23,42,0.96)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(148,163,184,0.96)",
                marginBottom: 2,
              }}
            >
              Grupos
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {stats ? stats.totalGroups : loading ? "…" : "0"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(226,232,240,0.88)",
              }}
            >
              grupos activos donde compartes tu calendario.
            </div>
          </div>

          {/* Card: Eventos últimos 7 días */}
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,0.30)",
              background:
                "radial-gradient(480px 380px at 8% 0%, rgba(129,140,248,0.30), transparent 55%), rgba(15,23,42,0.96)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(148,163,184,0.96)",
                marginBottom: 2,
              }}
            >
              Movimiento reciente
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {stats ? stats.eventsLast7 : loading ? "…" : "0"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(226,232,240,0.88)",
              }}
            >
              eventos en los últimos 7 días
              {stats ? ` · ${stats.totalEvents} en total` : ""}.
            </div>
          </div>

          {/* Card: Conflictos ahora */}
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(148,163,184,0.30)",
              background:
                "radial-gradient(520px 360px at 6% -10%, rgba(244,114,182,0.40), transparent 55%), rgba(15,23,42,0.98)",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "rgba(248,250,252,0.80)",
                marginBottom: 2,
              }}
            >
              Conflictos
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              {stats ? stats.conflictsNow : loading ? "…" : "0"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(226,232,240,0.90)",
              }}
            >
              choques detectados ahora mismo entre tus eventos.
            </div>

            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                padding: "6px 9px",
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(15,23,42,0.96)",
                border: "1px solid rgba(148,163,184,0.45)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  backgroundColor:
                    stats && stats.conflictsNow > 0 ? "#fb7185" : "#22c55e",
                  boxShadow:
                    stats && stats.conflictsNow > 0
                      ? "0 0 0 4px rgba(248,113,113,0.25)"
                      : "0 0 0 4px rgba(34,197,94,0.25)",
                }}
              />
              <span>
                {stats
                  ? stats.conflictsNow > 0
                    ? "Tienes conflictos para revisar."
                    : "Sin conflictos ahora mismo."
                  : loading
                  ? "Revisando tus eventos..."
                  : "Sin datos suficientes."}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div
            style={{
              marginTop: 4,
              marginBottom: 8,
              fontSize: 12,
              color: "rgba(248,113,113,0.92)",
            }}
          >
            {error}
          </div>
        )}

        {/* HUB · Administración (texto de contexto) */}
        <section
          style={{
            marginTop: 4,
            marginBottom: 10,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "rgba(148,163,184,0.96)",
              whiteSpace: "nowrap",
            }}
          >
            HUB · Administración
          </div>

          <div
            style={{
              fontSize: 11,
              color: "rgba(148,163,184,0.86)",
              maxWidth: 520,
              fontWeight: 500,
            }}
          >
            Aquí organizas la parte “administrativa” de SyncPlans: grupos,
            miembros, invitaciones, ajustes y planes.
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
            icon="👤"
            tag="Personas"
            title="Miembros"
            hint="Quién tiene acceso a qué grupo."
            onClick={() => router.push("/members")}
          />

          <HubCard
            icon="✉️"
            tag="Coordinar mejor"
            title="Invitaciones"
            hint="Invita a tu pareja, familia o amigos a probar SyncPlans."
            onClick={() => router.push("/invitations")}
          />

          <HubCard
            icon="⚠️"
            tag="Revisar choques"
            title="Conflictos"
            hint="Detecta y resuelve eventos que se pisan."
            onClick={() => router.push("/conflicts/detected")}
          />

          <HubCard
            icon="📆"
            tag="Visión general"
            title="Calendario"
            hint="Salta directo a tu calendario compartido."
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
          "radial-gradient(640px 420px at 4% 0%, rgba(56,189,248,0.26), transparent 55%), radial-gradient(640px 420px at 90% 0%, rgba(124,58,237,0.26), transparent 55%), rgba(15,23,42,0.96)";
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
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(120px 120px at 0% 0%, rgba(56,189,248,0.60), transparent 60%), rgba(15,23,42,0.96)",
            fontSize: 18,
          }}
        >
          {icon}
        </div>

        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(148,163,184,0.96)",
            marginTop: 4,
            whiteSpace: "nowrap",
          }}
        >
          {tag}
        </div>
      </div>

      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 13,
          color: "rgba(226,232,240,0.86)",
          lineHeight: 1.45,
          maxWidth: 260,
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