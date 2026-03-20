// src/app/panel/page.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { getMyConflictResolutionsMap } from "@/lib/conflictResolutionsDb";
import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";
import supabase from "@/lib/supabaseClient";
import { getMyDeclinedEventIds } from "@/lib/eventResponsesDb";
import { getMyEvents, type DbEventRow } from "@/lib/eventsDb";
import {
  getMyGroups,
  type GroupRow,
  getGroupTypeLabel,
} from "@/lib/groupsDb";
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

type QuickAction = {
  id: string;
  title: string;
  hint: string;
  href: string;
  badge?: string;
  featured?: boolean;
};

type ConnectionState = "connected" | "needs_reauth" | "disconnected";

type GoogleStatus = {
  ok: boolean;
  connected: boolean;
  connection_state?: ConnectionState;
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
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [googleEvents, setGoogleEvents] = useState<ExternalEvent[]>([]);
  const [googleEventsLoading, setGoogleEventsLoading] = useState(false);
  const [googleEventsError, setGoogleEventsError] = useState<string | null>(
    null
  );

  const loadCore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        events,
        fetchedGroups,
        fetchedProfile,
        resolvedConflictMap,
        declinedEventIds,
      ] = await Promise.all([
        getMyEvents().catch(() => [] as DbEventRow[]),
        getMyGroups().catch(() => [] as GroupRow[]),
        getMyProfile().catch(() => null as Profile | null),
        getMyConflictResolutionsMap().catch(
          () => ({} as Record<string, string>)
        ),
        getMyDeclinedEventIds().catch(() => new Set<string>()),
      ]);

      setStats(
        buildDashboardStats(events, fetchedGroups, {
          resolvedConflictMap,
          declinedEventIds,
        })
      );
      setGroups(fetchedGroups);
      setProfile(fetchedProfile);
    } catch (err: any) {
      console.error("Error cargando panel:", err);
      setError(
        err?.message ||
          "No se pudo cargar el Panel. Intenta recargar la página."
      );
    } finally {
      setLoading(false);
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
          connection_state: "disconnected",
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
        connection_state: "disconnected",
        error:
          err?.message ||
          "Error inesperado al consultar el estado de Google Calendar.",
      });
    } finally {
      setGoogleLoading(false);
    }
  }, []);

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
          json?.error || "No se pudieron leer los eventos de Google."
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
        err?.message || "Error inesperado al leer eventos de Google."
      );
    } finally {
      setGoogleEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCore();
    fetchGoogleStatus();
  }, [loadCore, fetchGoogleStatus]);

  const connectionState: ConnectionState =
    googleStatus?.connection_state ??
    (googleStatus?.connected ? "connected" : "disconnected");

  useEffect(() => {
    if (connectionState === "connected") {
      fetchGoogleEvents();
      return;
    }

    setGoogleEvents([]);
    setGoogleEventsError(null);
  }, [connectionState, fetchGoogleEvents]);

  const totalEvents = stats?.totalEvents ?? 0;
  const eventsLast7 = stats?.eventsLast7 ?? 0;
  const totalGroups = stats?.totalGroups ?? 0;
  const conflictsNow = stats?.conflictsNow ?? 0;

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);

  const planInfo = useMemo(() => {
    const normalizedTier = String(tier || "free").toLowerCase();

    if (normalizedTier.startsWith("founder")) {
      return {
        pill: "Founder",
        title: "Tu acceso fundador sigue activo",
        copy:
          "Mantienes una posición temprana en SyncPlans con beneficios preferenciales.",
        cta: "Ver planes",
      };
    }

    if (trialActive) {
      return {
        pill: "Prueba Premium",
        title: "Tienes Premium desbloqueado",
        copy:
          "Estás probando la experiencia completa para coordinar mejor con pareja, familia y grupos compartidos.",
        cta: "Ver planes",
      };
    }

    if (premiumActive) {
      return {
        pill: "Premium",
        title: "Tu experiencia completa está activa",
        copy:
          "Tus funciones avanzadas están listas para ayudarte a coordinar con menos fricción.",
        cta: "Gestionar plan",
      };
    }

    return {
      pill: "Free",
      title: "Tu base está lista para crecer",
      copy:
        "Ya puedes usar SyncPlans para organizarte. Cuando quieras, puedes pasar a Premium para coordinar mejor con otros.",
      cta: "Ver planes",
    };
  }, [premiumActive, tier, trialActive]);

 const quickActions: QuickAction[] = [
  {
    id: "calendar",
    title: "Abrir calendario",
    hint: "Tu vista principal para revisar agenda, contexto compartido y próximos movimientos.",
    href: "/calendar",
    featured: true,
  },
  {
    id: "conflicts",
    title: "Resolver conflictos",
    hint: "El flujo más diferencial de SyncPlans: detectar choques y decidir con claridad.",
    href: "/conflicts/detected",
    badge: conflictsNow > 0 ? `${conflictsNow}` : undefined,
    featured: true,
  },
  {
    id: "events",
    title: "Eventos",
    hint: "Crea, revisa y ordena tu agenda personal y compartida.",
    href: "/events",
    badge: totalEvents > 0 ? `${totalEvents}` : undefined,
  },
  {
    id: "groups",
    title: "Grupos",
    hint: "Gestiona pareja, familia y espacios compartidos desde un solo lugar.",
    href: "/groups",
    badge: totalGroups > 0 ? `${totalGroups}` : undefined,
  },
  {
    id: "invitations",
    title: "Invitaciones",
    hint: "Revisa pendientes y suma a alguien más sin salir del flujo operativo.",
    href: "/invitations",
  },
  {
    id: "settings",
    title: "Ajustes e integraciones",
    hint: "Configura el producto y conecta herramientas como Google Calendar.",
    href: "/settings",
  },
];

  const groupsPreview = useMemo(() => groups.slice(0, 3), [groups]);

  const googlePill = useMemo(() => {
    if (googleLoading) {
      return {
        label: "Revisando",
        tone: "neutral" as const,
      };
    }

    if (connectionState === "connected") {
      return {
        label: "Conectado",
        tone: "ok" as const,
      };
    }

    if (connectionState === "needs_reauth") {
      return {
        label: "Requiere reconexión",
        tone: "warn" as const,
      };
    }

    if (googleStatus && !googleStatus.ok) {
      return {
        label: "Error",
        tone: "bad" as const,
      };
    }

    return {
      label: "No conectado",
      tone: "neutral" as const,
    };
  }, [connectionState, googleLoading, googleStatus]);

  const googlePrimaryCta =
    connectionState === "connected"
      ? "Gestionar"
      : connectionState === "needs_reauth"
      ? "Reconectar"
      : "Conectar";

  const googleLine =
    connectionState === "connected"
      ? googleStatus?.account?.email
        ? `Conectado con ${googleStatus.account.email}.`
        : "Tu Google Calendar está conectado."
      : connectionState === "needs_reauth"
      ? googleStatus?.account?.email
        ? `La cuenta ${googleStatus.account.email} necesita reconexión.`
        : "La conexión existe, pero necesita reconexión."
      : "Todavía no has conectado Google Calendar.";

  const googleSupportCopy =
    connectionState === "connected"
      ? "La conexión está activa y lista para sumar contexto externo sin recargar la experiencia principal."
      : connectionState === "needs_reauth"
      ? "No está roto: solo falta renovar la conexión para que SyncPlans vuelva a leer Google con normalidad."
      : "Es una integración de apoyo. Te sirve para sumar contexto externo sin convertir el Panel en un dashboard pesado.";

  const heroNote =
    conflictsNow > 0
      ? `Tienes ${conflictsNow} conflicto${
          conflictsNow === 1 ? "" : "s"
        } visible${conflictsNow === 1 ? "" : "s"} para revisar.`
      : totalGroups > 0
      ? `Ya tienes ${totalGroups} espacio${
          totalGroups === 1 ? "" : "s"
        } compartido${totalGroups === 1 ? "" : "s"} activo${
          totalGroups === 1 ? "" : "s"
        }.`
      : "Tu base está lista para empezar a coordinar mejor.";

  return (
    <MobileScaffold maxWidth={1120}>
      <PremiumHeader
        title="Panel"
        subtitle="Tu hub premium para entrar rápido a lo importante y mantener una sola verdad en el centro."
      />

      <div style={styles.stack}>
        {error ? <div style={styles.errorBanner}>{error}</div> : null}

        <section style={styles.heroCard}>
          <div style={styles.heroTopRow}>
           <div style={styles.heroTextWrap}>
  <div style={styles.eyebrow}>Operación</div>
  <h1 style={styles.heroTitle}>
    Organiza tu tiempo sin choques ni malentendidos.
  </h1>
  <p style={styles.heroCopy}>
   Aquí tienes control total sobre tu calendario, tus grupos y tus decisiones.
  </p>
</div>

            <div style={styles.heroActionStack}>
              <button
                type="button"
                style={styles.primaryHeroCta}
                onClick={() => router.push("/calendar")}
              >
                Abrir calendario
              </button>
         <button
  type="button"
  style={styles.secondaryHeroCta}
  onClick={() => router.push("/conflicts/detected")}
>
  Ver conflictos
</button>
            </div>
          </div>

          <div style={styles.heroStrip}>
            <div style={styles.heroStripTitle}>Ahora mismo</div>
            <div style={styles.heroStripCopy}>{heroNote}</div>
          </div>

          <div style={styles.metricsGrid}>
            <MetricCard
              label="Eventos"
              value={loading ? "—" : String(totalEvents)}
              hint="Entre personal y grupos"
            />
            <MetricCard
              label="Últimos 7 días"
              value={loading ? "—" : String(eventsLast7)}
              hint="Actividad reciente"
            />
            <MetricCard
              label="Grupos"
              value={loading ? "—" : String(totalGroups)}
              hint="Espacios compartidos activos"
            />
            <MetricCard
              label="Conflictos"
              value={loading ? "—" : String(conflictsNow)}
              hint="Choques abiertos"
              danger={conflictsNow > 0}
            />
          </div>
        </section>

        <div style={styles.mainGrid}>
          <div style={styles.leftCol}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
  <div>
    <div style={styles.sectionEyebrow}>Operación</div>
    <h2 style={styles.sectionTitle}>Entradas rápidas al flujo real</h2>
  </div>
</div>

              <div style={styles.actionsGrid}>
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    style={{
                      ...styles.actionCard,
                      ...(action.featured
                        ? styles.actionCardFeatured
                        : undefined),
                    }}
                    onClick={() => router.push(action.href)}
                  >
                    <div style={styles.actionCardTop}>
                      <span style={styles.actionTitle}>{action.title}</span>
                      {action.badge ? (
                        <span style={styles.badge}>{action.badge}</span>
                      ) : null}
                    </div>
                    <p style={styles.actionHint}>{action.hint}</p>
                  </button>
                ))}
              </div>
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Tus grupos</div>
                  <h2 style={styles.sectionTitle}>Contexto compartido</h2>
                </div>

                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={() => router.push("/groups")}
                >
                  Ver todos
                </button>
              </div>

              {groupsPreview.length === 0 ? (
                <EmptyBlock copy="Todavía no tienes grupos creados. Cuando armes uno, este bloque empieza a darte contexto real." />
              ) : (
                <div style={styles.list}>
                  {groupsPreview.map((group) => (
                    <div key={group.id} style={styles.listItem}>
                      <div style={styles.listCopyWrap}>
                        <div style={styles.listTitle}>
                          {group.name || getGroupTypeLabel(group.type)}
                        </div>
                        <div style={styles.listMeta}>
                          {getGroupTypeLabel(group.type)}
                        </div>
                      </div>

                      <button
                        type="button"
                        style={styles.inlineLink}
                        onClick={() => router.push(`/groups/${group.id}`)}
                      >
                        Abrir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div style={styles.rightCol}>
            <section style={styles.planCard}>
              <div style={styles.planPill}>{planInfo.pill}</div>
              <h2 style={styles.planTitle}>{planInfo.title}</h2>
              <p style={styles.planCopy}>{planInfo.copy}</p>
              <button
                type="button"
                style={styles.primaryCta}
                onClick={() => router.push("/planes")}
              >
                {planInfo.cta}
              </button>
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Google Calendar</div>
                  <h2 style={styles.sectionTitle}>Integración de apoyo</h2>
                </div>

                <StatusPill label={googlePill.label} tone={googlePill.tone} />
              </div>

<p style={styles.bodyCopy}>
  Google Calendar complementa tu operación en SyncPlans, pero no
  reemplaza la lógica compartida ni el flujo de decisiones dentro de la app.
</p>

              <div style={styles.integrationBox}>
                <div style={styles.integrationCopyWrap}>
                  <div style={styles.integrationLine}>{googleLine}</div>

                  {googleStatus?.error ? (
                    <div style={styles.errorText}>{googleStatus.error}</div>
                  ) : null}
                </div>

                <div style={styles.integrationActions}>
                  <button
                    type="button"
                    style={styles.primarySmallButton}
                    onClick={() => router.push("/settings?tab=integrations")}
                  >
                    {googlePrimaryCta}
                  </button>
                  <button
                    type="button"
                    style={styles.secondarySmallButton}
                    onClick={fetchGoogleStatus}
                    disabled={googleLoading}
                  >
                    Actualizar
                  </button>
                </div>
              </div>

              {connectionState === "connected" ? (
                <div style={styles.googleEventsWrap}>
                  <div style={styles.miniSectionHead}>
                    <span style={styles.miniSectionTitle}>
                      Próximos eventos de Google
                    </span>
                    <button
                      type="button"
                      style={styles.inlineLink}
                      onClick={fetchGoogleEvents}
                    >
                      Recargar
                    </button>
                  </div>

                  {googleEventsError ? (
                    <div style={styles.errorText}>{googleEventsError}</div>
                  ) : null}

                  {googleEventsLoading ? (
                    <EmptyBlock copy="Cargando próximos eventos de Google…" />
                  ) : googleEvents.length === 0 ? (
                    <EmptyBlock copy="No encontramos eventos próximos en Google para mostrar aquí." />
                  ) : (
                    <div style={styles.list}>
                      {googleEvents.slice(0, 3).map((event) => (
                        <div key={event.id} style={styles.listItemColumn}>
                          <div style={styles.listTitle}>
                            {event.title || "Evento sin título"}
                          </div>
                          <div style={styles.listMeta}>
                            {formatExternalEventRange(event)}
                          </div>
                          {event.location ? (
                            <div style={styles.listMeta}>{event.location}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    </MobileScaffold>
  );
}

function MetricCard({
  label,
  value,
  hint,
  danger = false,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricLabel}>{label}</div>
      <div
        style={{
          ...styles.metricValue,
          color: danger ? colors.accentDanger : colors.textPrimary,
        }}
      >
        {value}
      </div>
      <div style={styles.metricHint}>{hint}</div>
    </div>
  );
}

function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneStyles =
    tone === "ok"
      ? {
          borderColor: "rgba(56,189,248,0.45)",
          color: colors.textPrimary,
          dot: colors.accentPrimary,
        }
      : tone === "warn"
      ? {
          borderColor: "rgba(251,191,36,0.38)",
          color: "#fde68a",
          dot: "#fbbf24",
        }
      : tone === "bad"
      ? {
          borderColor: "rgba(251,113,133,0.38)",
          color: "#fecdd3",
          dot: "#fb7185",
        }
      : {
          borderColor: "rgba(148,163,184,0.28)",
          color: colors.textSecondary,
          dot: "rgba(148,163,184,0.85)",
        };

  return (
    <span
      style={{
        ...styles.statusPill,
        borderColor: toneStyles.borderColor,
        color: toneStyles.color,
      }}
    >
      <span
        style={{
          ...styles.statusDot,
          background: toneStyles.dot,
        }}
      />
      {label}
    </span>
  );
}

function EmptyBlock({ copy }: { copy: string }) {
  return <div style={styles.emptyBlock}>{copy}</div>;
}

function formatExternalEventRange(event: ExternalEvent) {
  try {
    const start = new Date(event.start);
    const end = new Date(event.end);

    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    if (event.allDay) {
      return start.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }

    if (sameDay) {
      return `${start.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "short",
      })} · ${start.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      })} – ${end.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    return `${start.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    })} ${start.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    })} · ${end.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    })} ${end.toLocaleTimeString("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Fecha no disponible";
  }
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.lg,
  },

  heroCard: {
    borderRadius: radii.xl,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "radial-gradient(1200px 420px at 0% 0%, rgba(56,189,248,0.16), transparent 55%), radial-gradient(760px 320px at 100% 0%, rgba(168,85,247,0.13), transparent 55%), rgba(15,23,42,0.94)",
    padding: 22,
    boxShadow: shadows.card,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },

  heroTopRow: {
    display: "flex",
    gap: 18,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  heroTextWrap: {
    minWidth: 0,
    flex: "1 1 520px",
  },

  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: colors.accentPrimary,
    marginBottom: 8,
  },

  heroTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.02,
    fontWeight: 950,
    maxWidth: 760,
  },

  heroCopy: {
    margin: "10px 0 0",
    maxWidth: 700,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 1.62,
  },

  heroActionStack: {
    display: "grid",
    gap: 10,
    minWidth: 200,
    alignSelf: "flex-start",
    flex: "0 0 auto",
  },

  primaryHeroCta: {
    borderRadius: 999,
    padding: "12px 16px",
    border: "1px solid rgba(56,189,248,0.38)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.30), rgba(168,85,247,0.22))",
    color: colors.textPrimary,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryHeroCta: {
    borderRadius: 999,
    padding: "11px 16px",
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontWeight: 800,
    cursor: "pointer",
  },

  heroStrip: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.045)",
    padding: "13px 14px",
    display: "grid",
    gap: 4,
  },

  heroStripTitle: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    color: colors.textSecondary,
  },

  heroStripCopy: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
  },

  metricCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
  },

  metricLabel: {
    fontSize: 11,
    fontWeight: 900,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.55,
  },

  metricValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1,
  },

  metricHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 1.45,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: spacing.lg,
    alignItems: "start",
  },

  leftCol: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.lg,
    minWidth: 0,
  },

  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.lg,
    minWidth: 0,
  },

  sectionCard: {
    borderRadius: radii.xl,
    border: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceLow,
    boxShadow: shadows.card,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  sectionHead: {
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  sectionEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    fontWeight: 900,
    color: colors.textSecondary,
    marginBottom: 6,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    lineHeight: 1.05,
  },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  actionCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(15,23,42,0.96))",
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    color: colors.textPrimary,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  actionCardFeatured: {
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.12), rgba(15,23,42,0.96))",
    border: "1px solid rgba(56,189,248,0.18)",
    boxShadow: "0 10px 24px rgba(56,189,248,0.08)",
  },

  actionCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },

  actionTitle: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  actionHint: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 1.55,
  },

  badge: {
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(56,189,248,0.34)",
    background: "rgba(56,189,248,0.12)",
    color: colors.textPrimary,
    whiteSpace: "nowrap",
  },

  planCard: {
    borderRadius: radii.xl,
    border: "1px solid rgba(251,191,36,0.20)",
    background:
      "radial-gradient(900px 320px at 0% 0%, rgba(251,191,36,0.14), transparent 55%), rgba(15,23,42,0.96)",
    boxShadow: shadows.card,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  planPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(251,191,36,0.34)",
    background: "rgba(251,191,36,0.10)",
    color: colors.textPrimary,
  },

  planTitle: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.08,
    fontWeight: 950,
  },

  planCopy: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.6,
  },

  primaryCta: {
    borderRadius: 999,
    padding: "12px 16px",
    border: "1px solid rgba(56,189,248,0.38)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.28), rgba(168,85,247,0.22))",
    color: colors.textPrimary,
    fontWeight: 900,
    cursor: "pointer",
  },

  ghostButton: {
    borderRadius: 999,
    padding: "10px 14px",
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.03)",
    color: colors.textPrimary,
    fontWeight: 800,
    cursor: "pointer",
  },

  list: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  listItem: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  listCopyWrap: {
    minWidth: 0,
  },

  listItemColumn: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  listTitle: {
    fontSize: 15,
    fontWeight: 850,
    color: colors.textPrimary,
  },

  listMeta: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 1.5,
  },

  integrationBox: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },

  integrationCopyWrap: {
    minWidth: 0,
    flex: "1 1 240px",
  },

  integrationLine: {
    fontSize: 14,
    lineHeight: 1.55,
    color: colors.textPrimary,
  },

  integrationActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  primarySmallButton: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(56,189,248,0.38)",
    background: "rgba(56,189,248,0.14)",
    color: colors.textPrimary,
    fontWeight: 800,
    cursor: "pointer",
  },

  secondarySmallButton: {
    borderRadius: 999,
    padding: "10px 14px",
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.03)",
    color: colors.textPrimary,
    fontWeight: 800,
    cursor: "pointer",
  },

  bodyCopy: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.6,
  },

  googleEventsWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  miniSectionHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  miniSectionTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: colors.textPrimary,
  },

  inlineLink: {
    border: "none",
    background: "transparent",
    color: colors.accentPrimary,
    fontWeight: 800,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  },

  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "7px 10px",
    border: "1px solid rgba(148,163,184,0.28)",
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },

  emptyBlock: {
    borderRadius: radii.lg,
    border: "1px dashed rgba(148,163,184,0.28)",
    background: "rgba(255,255,255,0.02)",
    padding: 16,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.55,
  },

  errorBanner: {
    borderRadius: radii.lg,
    border: "1px solid rgba(251,113,133,0.35)",
    background: "rgba(127,29,29,0.18)",
    color: "#fecdd3",
    padding: 14,
    fontSize: 14,
    lineHeight: 1.5,
  },

  errorText: {
    color: "#fecdd3",
    fontSize: 12,
    lineHeight: 1.5,
  },
};