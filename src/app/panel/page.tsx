// src/app/panel/page.tsx
"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";
import supabase from "@/lib/supabaseClient";

import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import { getMyGroups, type GroupRow } from "@/lib/groupsDb";
import {
  buildDashboardStats,
  type DashboardStats,
} from "@/lib/profileDashboard";
import {
  normalizeGoogleCalendarItems,
  type ExternalEvent,
} from "@/lib/externalEvents";

import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

type QuickLink = {
  id: string;
  label: string;
  hint: string;
  href: string;
};

type GoogleStatus = {
  ok: boolean;
  connected: boolean;
  account?:
    | {
        provider?: string | null;
        email?: string | null;
        created_at?: string | null;
        updated_at?: string | null;
      }
    | null;
  error?: string;
};

export default function PanelPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleEvents, setGoogleEvents] = useState<ExternalEvent[] | null>(null);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [googleEventsError, setGoogleEventsError] = useState<string | null>(
    null,
  );

  const fetchGoogleEvents = useCallback(async () => {
    try {
      setGoogleEventsLoading(true);
      setGoogleEventsError(null);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/integrations/google/list", {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; items?: any[]; error?: string }
        | null;

      if (!res.ok || !json?.ok) {
        setGoogleEvents([]);
        setGoogleEventsError(
          json?.error || "No se pudieron leer los eventos de Google.",
        );
        return;
      }

      const normalized = normalizeGoogleCalendarItems(json.items ?? [], {
        calendarId: "primary",
      });
      setGoogleEvents(normalized);
    } catch (err: any) {
      console.error("Error leyendo eventos de Google:", err);
      setGoogleEvents([]);
      setGoogleEventsError(
        err?.message || "Error inesperado al leer eventos de Google.",
      );
    } finally {
      setGoogleEventsLoading(false);
    }
  }, []);

  const fetchGoogleStatus = useCallback(async () => {
    try {
      setGoogleLoading(true);

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      const res = await fetch("/api/google/status", {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });

      const json = (await res.json().catch(() => null)) as GoogleStatus | null;

      if (!res.ok || !json?.ok) {
        setGoogleStatus({
          ok: false,
          connected: false,
          error: json?.error || "No se pudo leer el estado de Google.",
        });
        setGoogleEvents(null);
        return;
      }

      setGoogleStatus(json);

      if (json.connected) {
        // Si está conectado, traemos una snapshot de eventos
        fetchGoogleEvents();
      } else {
        setGoogleEvents(null);
      }
    } catch (err: any) {
      console.error("Error leyendo estado de Google:", err);
      setGoogleStatus({
        ok: false,
        connected: false,
        error: err?.message || "Error al leer el estado de Google.",
      });
      setGoogleEvents(null);
    } finally {
      setGoogleLoading(false);
    }
  }, [fetchGoogleEvents]);

  const handleConnectClick = useCallback(() => {
    if (typeof window !== "undefined") {
      window.location.href = "/api/google/connect";
    }
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [events, groups] = await Promise.all([
          getMyEvents().catch((err) => {
            console.error("Error cargando eventos en Panel:", err);
            return [] as DbEventRow[];
          }),
          getMyGroups().catch((err) => {
            console.error("Error cargando grupos en Panel:", err);
            return [] as GroupRow[];
          }),
        ]);

        if (!alive) return;

        const stats = buildDashboardStats(events, groups);
        setStats(stats);
      } catch (e: any) {
        if (!alive) return;
        console.error("Error cargando Panel:", e);
        setError(e?.message || "No se pudo cargar el panel.");
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
      hint: "Revisa quién tiene acceso a qué grupos.",
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

  const googleConnected = !!googleStatus?.connected;
  const googleEmail = googleStatus?.account?.email ?? null;

  const hasGoogleEvents = (googleEvents ?? []).length > 0;

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

        {/* Bloque de integración con Google Calendar */}
        <section style={googleSectionStyle}>
          <div style={googleHeaderRowStyle}>
            <div>
              <h3 style={googleTitleStyle}>Google Calendar</h3>
              <p style={googleSubtitleStyle}>
                Conecta tu calendario de Google para que SyncPlans tenga una sola
                verdad en el centro.
              </p>
            </div>

            <div style={googlePillStyle}>
              {googleLoading
                ? "Revisando…"
                : googleConnected
                ? "Conectado"
                : "No conectado"}
            </div>
          </div>

          <div style={googleBodyStyle}>
            <div style={googleStatusColumnStyle}>
              <p style={googleStatusLineStyle}>
                {googleConnected
                  ? googleEmail
                    ? `Sincronizando con ${googleEmail}.`
                    : "Sincronizando con tu cuenta de Google."
                  : "Todavía no has conectado tu cuenta de Google Calendar."}
              </p>

              {googleStatus?.error && (
                <div style={googleErrorTextStyle}>{googleStatus.error}</div>
              )}
            </div>

            <div style={googleActionsColumnStyle}>
              <button
                type="button"
                onClick={handleConnectClick}
                style={googlePrimaryButtonStyle}
                disabled={googleLoading}
              >
                {googleConnected ? "Gestionar conexión" : "Conectar Google"}
              </button>

              <button
                type="button"
                onClick={fetchGoogleStatus}
                style={googleSecondaryButtonStyle}
                disabled={googleLoading}
              >
                {googleLoading ? "Actualizando…" : "Revisar estado"}
              </button>
            </div>
          </div>

          {/* Snapshot de próximos eventos de Google */}
          {googleConnected && (
            <div style={googleEventsWrapperStyle}>
              <div style={googleEventsHeaderRowStyle}>
                <h4 style={googleEventsTitleStyle}>
                  Próximos eventos en Google
                </h4>
                <span style={googleEventsMetaStyle}>
                  {googleEventsLoading
                    ? "Cargando…"
                    : hasGoogleEvents
                    ? `${googleEvents?.length ?? 0} eventos encontrados`
                    : "Sin eventos próximos"}
                </span>
              </div>

              {googleEventsError && (
                <div style={googleErrorTextStyle}>{googleEventsError}</div>
              )}

              {!googleEventsLoading && hasGoogleEvents && (
                <ul style={googleEventsListStyle}>
                  {(googleEvents ?? [])
                    .slice(0, 3)
                    .map((ev) => (
                      <li key={ev.id} style={googleEventItemStyle}>
                        <div style={googleEventMainRowStyle}>
                          <span style={googleEventTitleStyle}>
                            {ev.title || "Evento sin título"}
                          </span>
                          {ev.allDay && (
                            <span style={googleEventBadgeStyle}>Todo el día</span>
                          )}
                        </div>
                        <div style={googleEventRangeStyle}>
                          {formatExternalEventRange(ev)}
                        </div>
                        {ev.location && (
                          <div style={googleEventLocationStyle}>
                            {ev.location}
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              )}

              {!googleEventsLoading && !hasGoogleEvents && !googleEventsError && (
                <p style={googleEventsEmptyStyle}>
                  Por ahora no vemos eventos próximos en tu calendario de Google.
                </p>
              )}
            </div>
          )}
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
                onClick={() => router.push(link.href)}
                style={quickLinkBaseStyle}
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

function formatExternalEventRange(ev: ExternalEvent): string {
  const start = new Date(ev.start);
  const end = new Date(ev.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "";
  }

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dayLabel = start.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  const startTime = start.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const endTime = end.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (ev.allDay) {
    return dayLabel;
  }

  if (sameDay) {
    return `${dayLabel} · ${startTime} – ${endTime}`;
  }

  const endDayLabel = end.toLocaleDateString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return `${dayLabel} ${startTime} → ${endDayLabel} ${endTime}`;
}

const sectionWrapperStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
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
  flexWrap: "wrap",
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
  fontSize: 12,
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
  gap: spacing.md,
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
  padding: "2px 8px",
  borderRadius: radii.full,
  border: `1px solid ${colors.borderSubtle}`,
  fontSize: 11,
  color: colors.textSecondary,
  background: colors.surfaceLow,
};

const metricButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: "8px 12px",
  borderRadius: radii.lg,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: colors.accentPrimary,
  color: "#FFFFFF",
};

const googleSectionStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const googleHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
};

const googleTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: colors.textPrimary,
};

const googleSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 12,
  lineHeight: 1.5,
  color: colors.textSecondary,
};

const googlePillStyle: CSSProperties = {
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

const googleBodyStyle: CSSProperties = {
  marginTop: spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const googleStatusColumnStyle: CSSProperties = {
  flex: 1,
};

const googleStatusLineStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: colors.textPrimary,
};

const googleErrorTextStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: colors.accentDanger,
};

const googleActionsColumnStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing.sm,
};

const googlePrimaryButtonStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: radii.lg,
  border: "none",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  background: colors.accentPrimary,
  color: "#FFFFFF",
};

const googleSecondaryButtonStyle: CSSProperties = {
  padding: "8px 14px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  background: colors.surfaceLow,
  color: colors.textPrimary,
};

const googleEventsWrapperStyle: CSSProperties = {
  marginTop: spacing.md,
  paddingTop: spacing.md,
  borderTop: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
};

const googleEventsHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
  flexWrap: "wrap",
};

const googleEventsTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: colors.textPrimary,
};

const googleEventsMetaStyle: CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
};

const googleEventsListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
};

const googleEventItemStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.sm}px ${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const googleEventMainRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.sm,
};

const googleEventTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: colors.textPrimary,
};

const googleEventBadgeStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: radii.full,
  border: `1px solid ${colors.borderSubtle}`,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: colors.textMuted,
};

const googleEventRangeStyle: CSSProperties = {
  fontSize: 12,
  color: colors.textSecondary,
};

const googleEventLocationStyle: CSSProperties = {
  fontSize: 11,
  color: colors.textMuted,
};

const googleEventsEmptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: colors.textSecondary,
};

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

const quickLinkBaseStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: `${spacing.md}px`,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 6,
  textAlign: "left",
  cursor: "pointer",
};

const quickLinkTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  gap: 8,
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