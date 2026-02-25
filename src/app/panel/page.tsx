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
import { getMyProfile, type Profile } from "@/lib/profilesDb";
import { isPremiumUser, isTrialActive, type PlanTier } from "@/lib/premium";

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
  error?: string | null;
};

export default function PanelPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
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
      setGoogleStatus(null);

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
          error:
            json?.error ||
            "No se pudo leer el estado de la integración con Google.",
        });
        return;
      }

      setGoogleStatus(json);
    } catch (err: any) {
      console.error("Error leyendo estado de Google:", err);
      setGoogleStatus({
        ok: false,
        connected: false,
        error:
          err?.message ||
          "Error inesperado al consultar el estado de Google Calendar.",
      });
    } finally {
      setGoogleLoading(false);
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

        const [events, groups, profile] = await Promise.all([
          getMyEvents().catch((err) => {
            console.error("Error cargando eventos en Panel:", err);
            return [] as DbEventRow[];
          }),
          getMyGroups().catch((err) => {
            console.error("Error cargando grupos en Panel:", err);
            return [] as GroupRow[];
          }),
          getMyProfile().catch((err) => {
            console.error("Error cargando perfil en Panel:", err);
            return null as Profile | null;
          }),
        ]);

        if (!alive) return;

        const stats = buildDashboardStats(events, groups);
        setStats(stats);
        setProfile(profile);
      } catch (e: any) {
        if (!alive) return;
        console.error("Error cargando Panel:", e);
        setError(
          e?.message ||
            "No se pudo cargar el Panel. Intenta recargar la página.",
        );
      } finally {
        if (!alive) return;
        setLoading(false);
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
      hint: "Ve y resuelve choques de agenda en un solo lugar.",
      href: "/conflicts/detected",
    },
    {
      id: "summary",
      label: "Resumen",
      hint: "Mira cómo se reparte tu tiempo esta semana.",
      href: "/summary",
    },
    {
      id: "groups",
      label: "Grupos",
      hint: "Administra tus grupos de Pareja, Familia y más.",
      href: "/groups",
    },
    {
      id: "members",
      label: "Miembros",
      hint: "Quién tiene acceso a qué calendario.",
      href: "/members",
    },
    {
      id: "invitations",
      label: "Invitaciones",
      hint: "Envía y revisa invitaciones pendientes.",
      href: "/invitations",
    },
    {
      id: "integrations",
      label: "Integraciones",
      hint: "Conecta Google Calendar y más.",
      href: "/settings",
    },
    {
      id: "settings",
      label: "Cuenta",
      hint: "Preferencias generales de tu cuenta.",
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

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);
  const normalizedTier = String(tier || "free").toLowerCase();

  let planLabel = "Free";
  let planTag = "Plan Free";
  let planDescription =
    "Todas las funciones básicas para organizar tu tiempo.";

  if (normalizedTier.startsWith("founder")) {
    planLabel = "Founder";
    planTag = "Plan Founder";
    planDescription =
      "Mantienes un precio preferencial por ser de los primeros en probar SyncPlans.";
  } else if (premiumActive && !trialActive) {
    planLabel = "Premium";
    planTag = "Plan Premium";
    planDescription =
      "Funciones avanzadas activas para coordinar mejor con tu pareja y familia.";
  } else if (trialActive) {
    planLabel = "Prueba Premium";
    planTag = "Prueba Premium";
    planDescription =
      "Estás probando todas las funciones Premium por tiempo limitado.";
  }

  const googleConnected = !!googleStatus?.connected;
  const googleEmail = googleStatus?.account?.email ?? null;
  const hasGoogleEvents =
    !!googleEvents && Array.isArray(googleEvents) && googleEvents.length > 0;

  const handleConnectClick = () => {
    router.push("/settings?tab=integrations");
  };

  const handleQuickLinkClick = (href: string) => {
    router.push(href);
  };

  const isLoadingAny = loading || googleLoading;

  return (
    <MobileScaffold>
      <PremiumHeader
        title="Panel"
        subtitle="Tu centro de control de SyncPlans: grupos, eventos y conflictos en un solo lugar."
      />

      <div style={sectionWrapperStyle}>
        {/* Plan actual */}
        <section style={planCardStyle}>
          <div style={planHeaderRowStyle}>
            <div style={planLabelColumnStyle}>
              <div style={planPillStyle}>
                <span style={planDotStyle} />
                <span style={planPillTextStyle}>{planTag}</span>
              </div>
              <h2 style={planTitleStyle}>{planLabel}</h2>
              <p style={planSubtitleStyle}>{planDescription}</p>
            </div>
            <div style={planActionsColumnStyle}>
              <button
                type="button"
                style={planPrimaryButtonStyle}
                onClick={() => router.push("/planes")}
              >
                Ver planes
              </button>
            </div>
          </div>
        </section>

        {/* Bloque principal de métricas */}
        <section style={metricsCardStyle}>
          <div style={metricsHeaderRowStyle}>
            <div>
              <h2 style={metricsTitleStyle}>Resumen rápido</h2>
              <p style={metricsSubtitleStyle}>
                Una foto rápida de cómo se está usando tu SyncPlans.
              </p>
            </div>

            <div style={metricsStatusPillStyle}>
              {isLoadingAny ? "Actualizando…" : "Al día"}
            </div>
          </div>

          {error && <div style={errorBannerStyle}>{error}</div>}

          <div style={metricsGridStyle}>
            <div style={metricItemStyle}>
              <div style={metricLabelRowStyle}>
                <span style={metricLabelStyle}>Eventos totales</span>
              </div>
              <div style={metricValueStyle}>{totalEvents}</div>
              <p style={metricHintStyle}>
                Contando tus eventos personales y de grupo.
              </p>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelRowStyle}>
                <span style={metricLabelStyle}>Últimos 7 días</span>
              </div>
              <div style={metricValueStyle}>{eventsLast7}</div>
              <p style={metricHintStyle}>
                Eventos creados o editados en la última semana.
              </p>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelRowStyle}>
                <span style={metricLabelStyle}>Grupos activos</span>
              </div>
              <div style={metricValueStyle}>{totalGroups}</div>
              <p style={metricHintStyle}>
                Entre Pareja, Familia y otros grupos que usas.
              </p>
            </div>

            <div style={metricItemStyle}>
              <div style={metricLabelRowStyle}>
                <span style={metricLabelStyle}>Conflictos abiertos</span>
              </div>
              <div style={metricValueStyle}>{conflictsNow}</div>
              <p style={metricHintStyle}>
                Choques de agenda detectados y aún no resueltos.
              </p>
            </div>
          </div>

          <div style={groupsBreakdownRowStyle}>
            <div style={groupsBreakdownItemStyle}>
              <span style={groupsBreakdownLabelStyle}>Pareja</span>
              <span style={groupsBreakdownValueStyle}>{pairGroups}</span>
            </div>
            <div style={groupsBreakdownItemStyle}>
              <span style={groupsBreakdownLabelStyle}>Familia</span>
              <span style={groupsBreakdownValueStyle}>{familyGroups}</span>
            </div>
            <div style={groupsBreakdownItemStyle}>
              <span style={groupsBreakdownLabelStyle}>Otros</span>
              <span style={groupsBreakdownValueStyle}>{otherGroups}</span>
            </div>
          </div>
        </section>

        {/* Bloque de integración con Google Calendar */}
        <section style={googleSectionStyle}>
          <div style={googleHeaderRowStyle}>
            <div>
              <h3 style={googleTitleStyle}>Google Calendar</h3>
              <p style={googleSubtitleStyle}>
                Conecta tu calendario de Google para que SyncPlans tenga una
                sola verdad en el centro.
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
                            <span style={googleEventBadgeStyle}>
                              Todo el día
                            </span>
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

              {!googleEventsLoading &&
                !hasGoogleEvents &&
                !googleEventsError && (
                  <p style={googleEventsEmptyStyle}>
                    Por ahora no vemos eventos próximos en tu calendario de
                    Google.
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
                style={quickLinkButtonStyle}
                onClick={() => handleQuickLinkClick(link.href)}
              >
                <div style={quickLinkMainRowStyle}>
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

// ===== Estilos =====

const sectionWrapperStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: `${spacing.lg}px ${spacing.md}px ${spacing.xl}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.lg,
};

const planCardStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const planHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: spacing.lg,
  flexWrap: "wrap",
};

const planLabelColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  flex: 1,
};

const planPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${colors.accentPrimary}`,
  background: "rgba(56,189,248,0.10)",
};

const planDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: colors.accentPrimary,
};

const planPillTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  color: colors.textSecondary,
};

const planTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: colors.textPrimary,
};

const planSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  color: colors.textSecondary,
};

const planActionsColumnStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  minWidth: 0,
};

const planPrimaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderStrong}`,
  background: colors.accentPrimary,
  color: "#0B0F19",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
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
  fontWeight: 800,
  color: colors.textPrimary,
};

const metricsSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  color: colors.textSecondary,
};

const metricsStatusPillStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  background: "rgba(148,163,184,0.08)",
  fontSize: 11,
  fontWeight: 700,
  color: colors.textSecondary,
};

const errorBannerStyle: CSSProperties = {
  marginTop: spacing.md,
  padding: "10px 12px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.accentDanger}`,
  background: "rgba(248,113,113,0.08)",
  fontSize: 12,
  color: colors.accentDanger,
  fontWeight: 500,
};

const metricsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: spacing.md,
};

const metricItemStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const metricLabelRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const metricLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: colors.textSecondary,
};

const metricValueStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: colors.textPrimary,
};

const metricHintStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: colors.textMuted,
};

const groupsBreakdownRowStyle: CSSProperties = {
  marginTop: spacing.md,
  borderTop: `1px solid ${colors.borderSubtle}`,
  paddingTop: spacing.md,
  display: "flex",
  gap: spacing.md,
  justifyContent: "space-between",
};

const groupsBreakdownItemStyle: CSSProperties = {
  flex: 1,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  color: colors.textSecondary,
};

const groupsBreakdownLabelStyle: CSSProperties = {
  fontWeight: 500,
};

const groupsBreakdownValueStyle: CSSProperties = {
  fontWeight: 800,
  color: colors.textPrimary,
};

const googleSectionStyle: CSSProperties = {
  borderRadius: radii.xl,
  background: colors.surfaceRaised,
  border: `1px solid ${colors.borderStrong}`,
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const googleHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: spacing.md,
  flexWrap: "wrap",
};

const googleTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: colors.textPrimary,
};

const googleSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  color: colors.textSecondary,
};

const googlePillStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "6px 10px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  background: "rgba(148,163,184,0.08)",
  fontSize: 11,
  fontWeight: 700,
  color: colors.textSecondary,
};

const googleBodyStyle: CSSProperties = {
  display: "flex",
  gap: spacing.lg,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const googleStatusColumnStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const googleStatusLineStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: colors.textPrimary,
};

const googleErrorTextStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: colors.accentDanger,
};

const googleActionsColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const googlePrimaryButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderStrong}`,
  background: colors.accentPrimary,
  color: "#0B0F19",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const googleSecondaryButtonStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: "transparent",
  color: colors.textSecondary,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const googleEventsWrapperStyle: CSSProperties = {
  marginTop: spacing.md,
  borderTop: `1px solid ${colors.borderSubtle}`,
  paddingTop: spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
};

const googleEventsHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: spacing.sm,
};

const googleEventsTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 700,
  color: colors.textPrimary,
};

const googleEventsMetaStyle: CSSProperties = {
  fontSize: 12,
  color: colors.textSecondary,
};

const googleEventsListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: spacing.sm,
};

const googleEventItemStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: spacing.sm,
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
  fontWeight: 600,
  color: colors.textPrimary,
};

const googleEventBadgeStyle: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 999,
  border: `1px solid ${colors.borderSubtle}`,
  fontSize: 10,
  fontWeight: 700,
  color: colors.textSecondary,
};

const googleEventRangeStyle: CSSProperties = {
  fontSize: 12,
  color: colors.textSecondary,
};

const googleEventLocationStyle: CSSProperties = {
  fontSize: 12,
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
  boxShadow: shadows.card,
  padding: `${spacing.lg}px ${spacing.lg}px ${spacing.lg}px`,
  display: "flex",
  flexDirection: "column",
  gap: spacing.md,
};

const quickLinksHeaderRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: spacing.sm,
};

const quickLinksTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: colors.textPrimary,
};

const quickLinksSubtitleStyle: CSSProperties = {
  margin: 0,
  marginTop: 4,
  fontSize: 13,
  color: colors.textSecondary,
};

const quickLinksGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: spacing.sm,
};

const quickLinkButtonStyle: CSSProperties = {
  borderRadius: radii.lg,
  border: `1px solid ${colors.borderSubtle}`,
  background: colors.surfaceLow,
  padding: spacing.md,
  display: "flex",
  flexDirection: "column",
  gap: 6,
  textAlign: "left",
  cursor: "pointer",
};

const quickLinkMainRowStyle: CSSProperties = {
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

// Helper para formato de rango de eventos externos
function formatExternalEventRange(ev: ExternalEvent): string {
  const start = new Date(ev.start);
  const end = new Date(ev.end);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const dayFormatter = new Intl.DateTimeFormat("es-PE", {
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

  if (ev.allDay && sameDay) {
    return `${dayFormatter.format(start)} · Todo el día`;
  }

  if (sameDay) {
    return `${dayFormatter.format(start)} · ${startTime} – ${endTime}`;
  }

  return `${dayFormatter.format(start)} ${startTime} → ${dayFormatter.format(
    end,
  )} ${endTime}`;
}