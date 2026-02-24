// src/app/panel/page.tsx
"use client";

import React, { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import {
  buildDashboardStats,
  type DashboardStats,
} from "@/lib/profileDashboard";

import {
  colors,
  radii,
  shadows,
  spacing,
} from "@/styles/design-tokens";

type QuickLink = {
  id: string;
  label: string;
  hint: string;
  href: string;
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
          getMyEvents().catch((err) => {
            console.error("getMyEvents in /panel failed:", err);
            return [] as DbEventRow[];
          }),
          getMyGroups().catch((err) => {
            console.error("getMyGroups in /panel failed:", err);
            return [] as GroupRow[];
          }),
        ]);

        if (!alive) return;

        const nextStats = buildDashboardStats(events, groups);
        setStats(nextStats);
      } catch (e: any) {
        console.error("PanelPage load error:", e);
        if (!alive) return;
        setError("No pudimos cargar tu resumen. Intenta de nuevo.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const quickLinks: QuickLink[] = [
    {
      id: "calendar",
      label: "Calendario",
      hint: "Revisa tu mes y los choques con tus grupos.",
      href: "/calendar",
    },
    {
      id: "events",
      label: "Eventos",
      hint: "Crea, edita o limpia tus eventos personales.",
      href: "/events",
    },
    {
      id: "conflicts",
      label: "Conflictos",
      hint: "Resuelve choques pendientes antes del fin de semana.",
      href: "/conflicts",
    },
    {
      id: "groups",
      label: "Grupos",
      hint: "Ve tus grupos de pareja, familia y compartidos.",
      href: "/groups",
    },
    {
      id: "members",
      label: "Miembros",
      hint: "Gestiona quién está en qué grupo.",
      href: "/members",
    },
    {
      id: "invitations",
      label: "Invitaciones",
      hint: "Envía y revisa invitaciones pendientes.",
      href: "/invitations",
    },
    {
      id: "settings",
      label: "Ajustes",
      hint: "Preferencias de cuenta y notificaciones.",
      href: "/settings",
    },
    {
      id: "plans",
      label: "Planes",
      hint: "Tu plan actual y futuras mejoras.",
      href: "/planes",
    },
  ];

  const totalEvents = stats?.totalEvents ?? 0;
  const eventsLast7 = stats?.eventsLast7 ?? 0;
  const totalGroups = stats?.totalGroups ?? 0;
  const pairGroups = stats?.pairGroups ?? 0;
  const familyGroups = stats?.familyGroups ?? 0;
  const otherGroups = stats?.otherGroups ?? 0;
  const conflictsNow = stats?.conflictsNow ?? 0;

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Panel"
        subtitle="Tu centro de control de SyncPlans: grupos, eventos y conflictos en un solo lugar."
      />

      <div style={sectionWrapperStyle}>
        {/* Bloque principal de métricas */}
        <section style={metricsCardStyle}>
          <div style={metricsHeaderRowStyle}>
            <div>
              <h2 style={metricsTitleStyle}>Resumen rápido</h2>
              <p style={metricsSubtitleStyle}>
                Un vistazo a cómo va tu semana y tus grupos compartidos.
              </p>
            </div>

            <div style={metricsBadgeStyle}>
              {loading ? "Actualizando…" : "Actualizado"}
            </div>
          </div>

          {error && (
            <div style={errorBannerStyle}>
              <span>{error}</span>
            </div>
          )}

          <div style={metricsGridStyle}>
            <div style={metricItemStyle}>
              <div style={metricLabelStyle}>Eventos totales</div>
              <div style={metricValueStyle}>{totalEvents}</div>
              <div style={metricHintStyle}>
                Toda tu actividad registrada en SyncPlans.
              </div>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelStyle}>Últimos 7 días</div>
              <div style={metricValueStyle}>{eventsLast7}</div>
              <div style={metricHintStyle}>
                Eventos creados o que caen en esta semana.
              </div>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelStyle}>Grupos</div>
              <div style={metricValueStyle}>{totalGroups}</div>
              <div style={metricHintStyle}>
                Pareja, familia y otros grupos con los que compartes tiempo.
              </div>
              <div style={metricTagRowStyle}>
                <span style={metricTagStyle}>Pareja: {pairGroups}</span>
                <span style={metricTagStyle}>Familia: {familyGroups}</span>
                <span style={metricTagStyle}>Otros: {otherGroups}</span>
              </div>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelStyle}>Conflictos</div>
              <div style={metricValueStyle}>{conflictsNow}</div>
              <div style={metricHintStyle}>
                Choques detectados ahora mismo entre tus calendarios.
              </div>
              <button
                type="button"
                style={metricButtonStyle}
                onClick={() => router.push("/conflicts")}
              >
                Revisar conflictos
              </button>
            </div>
          </div>
        </section>

        {/* Bloque de accesos rápidos */}
        <section style={quickLinksSectionStyle}>
          <div style={quickLinksHeaderRowStyle}>
            <h3 style={quickLinksTitleStyle}>Accesos rápidos</h3>
            <p style={quickLinksSubtitleStyle}>
              Entra directo a las vistas que más usas.
            </p>
          </div>

          <div style={quickLinksGridStyle}>
            {quickLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                style={quickLinkButtonStyle}
                onClick={() => router.push(link.href)}
              >
                <div style={quickLinkTopRowStyle}>
                  <span style={quickLinkLabelStyle}>{link.label}</span>
                  <span style={quickLinkIconStyle}>↗</span>
                </div>
                <p style={quickLinkHintStyle}>{link.hint}</p>
              </button>
            ))}
          </div>
        </section>
      </div>
    </MobileScaffold>
  );
}

/* ============================
   Estilos con design tokens
============================ */

const sectionWrapperStyle: CSSProperties = {
  marginTop: spacing.lg,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const metricsCardStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const metricsHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
};

const metricsTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: colors.textPrimary,
};

const metricsSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const metricsBadgeStyle: CSSProperties = {
  padding: "4px 10px",
  borderRadius: radii.full,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  background: colors.surfaceLow,
  border: `1px solid ${colors.borderSubtle}`,
  color: colors.textMuted,
  whiteSpace: "nowrap",
};

const errorBannerStyle: CSSProperties = {
  fontSize: 12,
  color: colors.accentDanger,
  background: "rgba(248,113,113,0.08)",
  borderRadius: radii.md,
  border: `1px solid rgba(248,113,113,0.35)`,
  padding: `${spacing.sm}px ${spacing.md}px`,
};

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: spacing.lg,
};

const metricItemStyle: CSSProperties = {
  padding: `${spacing.md}px ${spacing.md}px`,
  borderRadius: radii.lg,
  background: colors.surfaceLow,
  border: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const metricLabelStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: colors.textMuted,
};

const metricValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.03em",
  color: colors.textPrimary,
};

const metricHintStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const metricTagRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 6,
};

const metricTagStyle: CSSProperties = {
  fontSize: 11,
  padding: "3px 8px",
  borderRadius: radii.full,
  background: "rgba(15,23,42,0.85)",
  border: `1px solid ${colors.borderSubtle}`,
  color: colors.textMuted,
};

const metricButtonStyle: CSSProperties = {
  marginTop: spacing.sm,
  alignSelf: "flex-start",
  padding: "6px 10px",
  borderRadius: radii.full,
  border: "none",
  background:
    "linear-gradient(135deg, rgba(56,189,248,0.16), rgba(180,83,249,0.22))",
  color: colors.textPrimary,
  fontSize: 11,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

/* Quick links */

const quickLinksSectionStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.soft,
  padding: `${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const quickLinksHeaderRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const quickLinksTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: colors.textPrimary,
};

const quickLinksSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: colors.textSecondary,
};

const quickLinksGridStyle: CSSProperties = {
  marginTop: spacing.md,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: spacing.md,
};

const quickLinkButtonStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.md}px ${spacing.md}px`,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  boxShadow: "0 10px 25px rgba(15,23,42,0.55)",
};

const quickLinkTopRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
};

const quickLinkLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: colors.textPrimary,
};

const quickLinkIconStyle: CSSProperties = {
  fontSize: 14,
  opacity: 0.72,
};

const quickLinkHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textSecondary,
};