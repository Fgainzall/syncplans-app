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
import {
  getPendingPublicInviteCaptures,
  markPublicInviteCaptureHandled,
  type PublicInviteCaptureItem,
} from "@/lib/invitationsDb";
import {
  hasPremiumAccess,
  isPremiumUser,
  isTrialActive,
  type PlanTier,
} from "@/lib/premium";
import {
  getGroupState,
  setMode,
  type GroupState,
  type UsageMode,
} from "@/lib/groups";
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

type ContextOption = {
  key: UsageMode;
  label: string;
  hint: string;
  dot: string;
};

const CONTEXT_OPTIONS: ContextOption[] = [
  {
    key: "solo",
    label: "Personal",
    hint: "Tu agenda individual",
    dot: "#FBBF24",
  },
  {
    key: "pair",
    label: "Pareja",
    hint: "Coordinación de dos",
    dot: "#F87171",
  },
  {
    key: "family",
    label: "Familia",
    hint: "Varios miembros",
    dot: "#60A5FA",
  },
];

async function ensureActiveGroupForMode(
  mode: UsageMode
): Promise<string | null> {
  if (mode === "solo") return null;

  const { getActiveGroupIdFromDb, setActiveGroupIdInDb } = await import(
    "@/lib/activeGroup"
  );
  const { getMyGroups } = await import("@/lib/groupsDb");

  const existing = await getActiveGroupIdFromDb().catch(() => null);
  const groups = await getMyGroups();
  if (!groups.length) return null;

  const wantType = String(mode).toLowerCase();

  if (existing) {
    const current = groups.find((g: any) => String(g.id) === String(existing));
    const currentType = String(current?.type ?? "").toLowerCase();
    if (current && currentType === wantType) {
      return String(existing);
    }
  }

  const match = groups.find(
    (g: any) => String(g.type ?? "").toLowerCase() === wantType
  );
  const pick = match?.id ?? groups[0]?.id ?? null;

  if (pick) {
    await setActiveGroupIdInDb(String(pick));
    return String(pick);
  }

  return null;
}

function normalizeGroupLabel(input?: string | null) {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  if (/^activo$/i.test(raw)) return "Grupo actual";
  if (/^activo\s*[:\-–]\s*/i.test(raw)) {
    const cleaned = raw.replace(/^activo\s*[:\-–]\s*/i, "").trim();
    return cleaned || "Grupo actual";
  }

  return raw;
}

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

  const [contextState, setContextState] = useState<GroupState>(() =>
    getGroupState()
  );
  const [contextSaving, setContextSaving] = useState<UsageMode | null>(null);
  const [captures, setCaptures] = useState<PublicInviteCaptureItem[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(true);

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

  const loadCaptures = useCallback(async () => {
    try {
      setCapturesLoading(true);
      const rows = await getPendingPublicInviteCaptures(6).catch(
        () => [] as PublicInviteCaptureItem[]
      );
      setCaptures(rows);
    } catch (err) {
      console.error("Error cargando capturas sugeridas:", err);
      setCaptures([]);
    } finally {
      setCapturesLoading(false);
    }
  }, []);
  const handleReviewCapture = useCallback(
    async (capture: PublicInviteCaptureItem) => {
      try {
        await markPublicInviteCaptureHandled(capture.token, "handled");
      } catch (err) {
        console.error("No se pudo marcar la captura como procesada:", err);
      }

      router.push(
        `/events/new/details?eventId=${capture.event_id}&proposalSource=public_invite&inviteToken=${encodeURIComponent(
          capture.token
        )}`
      );
    },
    [router]
  );
  const handleTakeCaptureProposal = useCallback(
    async (capture: PublicInviteCaptureItem) => {
      try {
        await markPublicInviteCaptureHandled(capture.token, "handled");
      } catch (err) {
        console.error("No se pudo marcar la captura como procesada:", err);
      }

      const proposedRaw = String(capture.proposed_date ?? "").trim();
      const eventStartRaw = String(capture.event_start ?? "").trim();
      const eventEndRaw = String(capture.event_end ?? "").trim();

      const proposedStart = new Date(proposedRaw);
      const eventStart = new Date(eventStartRaw);
      const eventEnd = new Date(eventEndRaw);

      if (
        Number.isNaN(proposedStart.getTime()) ||
        Number.isNaN(eventStart.getTime()) ||
        Number.isNaN(eventEnd.getTime())
      ) {
        router.push(`/events/new/details?eventId=${capture.event_id}`);
        return;
      }

      const durationMs = Math.max(
        15 * 60 * 1000,
        eventEnd.getTime() - eventStart.getTime()
      );

      const proposedEnd = new Date(proposedStart.getTime() + durationMs);

      const qp = new URLSearchParams();
      qp.set("eventId", String(capture.event_id));
      qp.set("proposedStart", proposedStart.toISOString());
      qp.set("proposedEnd", proposedEnd.toISOString());
      qp.set("proposalSource", "public_invite");
      qp.set("proposalIntent", "accept");

      router.push(`/events/new/details?${qp.toString()}`);
    },
    [router]
  );
  const handleRescheduleCapture = useCallback(
    async (capture: PublicInviteCaptureItem) => {
      try {
        await markPublicInviteCaptureHandled(capture.token, "handled");
      } catch (err) {
        console.error("No se pudo marcar la captura como procesada:", err);
      }

      router.push(`/events/new/details?eventId=${capture.event_id}`);
    },
    [router]
  );
  const openEventFromCapture = useCallback(
    (capture: PublicInviteCaptureItem) => {
      router.push(
        `/events?focusEventId=${encodeURIComponent(capture.event_id)}`
      );
    },
    [router]
  );

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
    loadCaptures();
    fetchGoogleStatus();
    setContextState(getGroupState());
  }, [loadCore, loadCaptures, fetchGoogleStatus]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === "syncplans.groupState.v3") {
        setContextState(getGroupState());
      }
    };

    const onModeChanged = () => {
      setContextState(getGroupState());
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("sp:mode-changed", onModeChanged);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("sp:mode-changed", onModeChanged);
    };
  }, []);

  useEffect(() => {
    const refreshSuggestedCaptures = () => {
      loadCaptures();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadCaptures();
      }
    };

    window.addEventListener("focus", refreshSuggestedCaptures);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshSuggestedCaptures);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadCaptures]);

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
  const totalGroups = stats?.totalGroups ?? 0;
  const conflictsNow = stats?.conflictsNow ?? 0;

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);
  const canUseCaptures = hasPremiumAccess(profile);
  const canUseGoogleIntegration = hasPremiumAccess(profile);
const canUseAdvancedAnalytics = hasPremiumAccess(profile);
  const currentContextOption =
    CONTEXT_OPTIONS.find((x) => x.key === contextState.mode) ??
    CONTEXT_OPTIONS[0];

  const currentContextGroupName = normalizeGroupLabel(
    contextState.groupName ?? null
  );
  const showContextGroupName =
    currentContextGroupName &&
    currentContextGroupName !== currentContextOption.label
      ? currentContextGroupName
      : null;

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
      id: "groups",
      title: "Gestionar grupos",
      hint: "Organiza pareja, familia y espacios compartidos desde el centro administrativo.",
      href: "/groups",
      badge: totalGroups > 0 ? `${totalGroups}` : undefined,
      featured: true,
    },
    {
      id: "invitations",
      title: "Gestionar invitaciones",
      hint: "Invita, acepta y ordena quién entra al sistema sin mezclarlo con la operación diaria.",
      href: "/invitations",
      featured: true,
    },
    {
      id: "settings",
      title: "Ajustes e integraciones",
      hint: "Configura SyncPlans y conecta herramientas como Google Calendar.",
      href: "/settings",
    },
    {
      id: "plans",
      title: "Plan y acceso",
      hint: "Revisa tu nivel actual, beneficios y próximos pasos de crecimiento.",
      href: "/planes",
    },
    {
      id: "calendar",
      title: "Ir al calendario",
      hint: "Entrada secundaria para volver a la operación diaria cuando la necesites.",
      href: "/calendar",
    },
    {
      id: "events",
      title: "Ver eventos",
      hint: "Consulta los eventos registrados sin convertir el Panel en otra vista operativa.",
      href: "/events",
      badge: totalEvents > 0 ? `${totalEvents}` : undefined,
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

  const heroNote =
    totalGroups > 0 && connectionState === "connected"
      ? `Tu estructura ya está armada: ${totalGroups} grupo${
          totalGroups === 1 ? "" : "s"
        } activo${totalGroups === 1 ? "" : "s"} y Google Calendar conectado.`
      : totalGroups > 0
      ? `Tienes ${totalGroups} grupo${
          totalGroups === 1 ? "" : "s"
        } activo${totalGroups === 1 ? "" : "s"}.`
      : connectionState === "connected"
      ? "Tu base ya está conectada: ahora toca ordenar grupos, accesos e integraciones."
      : "Desde aquí defines la estructura que sostiene la coordinación compartida.";

  async function handleContextChange(nextMode: UsageMode) {
    if (contextSaving === nextMode || contextState.mode === nextMode) return;

    setContextSaving(nextMode);

    try {
      const nextState = setMode(nextMode);

      if (nextMode !== "solo") {
        await ensureActiveGroupForMode(nextMode).catch(() => null);
      }

      setContextState(nextState);
      window.dispatchEvent(new Event("sp:mode-changed"));
    } finally {
      setContextSaving(null);
    }
  }

  return (
    <MobileScaffold maxWidth={1120}>
      <PremiumHeader
        title="Panel"
        subtitle="Tu centro de gestión premium para ordenar grupos, invitaciones, integraciones y acceso."
      />

      <div style={styles.stack}>
        {error ? <div style={styles.errorBanner}>{error}</div> : null}

        <section style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <div style={styles.heroTextWrap}>
              <div style={styles.eyebrow}>Gestión</div>
              <h1 style={styles.heroTitle}>
                Administra la estructura que sostiene tu coordinación.
              </h1>
              <p style={styles.heroCopy}>
                El Panel no es otra agenda: es el lugar donde ordenas espacios,
                accesos e integraciones para que el resto de la app fluya mejor.
              </p>
            </div>

            <div style={styles.heroActionStack}>
              <button
                type="button"
                style={styles.primaryHeroCta}
                onClick={() => router.push("/groups")}
              >
                Gestionar grupos
              </button>
              <button
                type="button"
                style={styles.secondaryHeroCta}
                onClick={() => router.push("/invitations")}
              >
                Ver invitaciones
              </button>
            </div>
          </div>

          <div style={styles.heroStrip}>
            <div style={styles.heroStripTitle}>Estado del espacio</div>
            <div style={styles.heroStripCopy}>{heroNote}</div>
          </div>

          <div style={styles.metricsGrid}>
            <MetricCard
              label="Grupos"
              value={loading ? "—" : String(totalGroups)}
              hint="Pareja, familia y compartidos"
            />
            <MetricCard
              label="Eventos registrados"
              value={loading ? "—" : String(totalEvents)}
              hint="En el sistema"
            />
            <MetricCard
              label="Google"
              value={
                loading
                  ? "—"
                  : connectionState === "connected"
                  ? "Activo"
                  : connectionState === "needs_reauth"
                  ? "Revisar"
                  : "Pendiente"
              }
              hint="Estado de integración externa"
            />
            <MetricCard
              label="Conflictos"
              value={loading ? "—" : String(conflictsNow)}
              hint="Choques abiertos"
              danger={conflictsNow > 0}
            />
          </div>
        </section>
<section style={styles.sectionCard}>
  <div style={styles.sectionHead}>
    <div>
      <div style={styles.sectionEyebrow}>Insights</div>
      <h2 style={styles.sectionTitle}>
        Lectura de tu coordinación
      </h2>
    </div>
  </div>

  {!canUseAdvancedAnalytics ? (
    <div style={styles.premiumLockCard}>
      <div style={styles.premiumLockHeader}>
        <span style={styles.premiumLockBadge}>Premium</span>
        <h3 style={styles.premiumLockTitle}>
          Entiende cómo estás coordinando realmente
        </h3>
      </div>

      <p style={styles.premiumLockCopy}>
        SyncPlans puede analizar tu actividad para darte señales claras:
        carga de eventos, fricción en conflictos y patrones de coordinación.
      </p>

      <button
        type="button"
        style={styles.primarySmallButton}
        onClick={() => router.push("/planes")}
      >
        Ver insights en Premium
      </button>
    </div>
  ) : (
    <div style={styles.insightGrid}>
      <div style={styles.insightCard}>
        <div style={styles.insightTitle}>Carga semanal</div>
        <div style={styles.insightValue}>
          {totalEvents === 0
            ? "Ligera"
            : totalEvents < 5
            ? "Controlada"
            : totalEvents < 10
            ? "Activa"
            : "Intensa"}
        </div>
        <div style={styles.insightHint}>
          Basado en tus eventos recientes
        </div>
      </div>

      <div style={styles.insightCard}>
        <div style={styles.insightTitle}>Fricción</div>
        <div style={styles.insightValue}>
          {conflictsNow === 0
            ? "Baja"
            : conflictsNow < 3
            ? "Moderada"
            : "Alta"}
        </div>
        <div style={styles.insightHint}>
          Conflictos actuales en el sistema
        </div>
      </div>

      <div style={styles.insightCard}>
        <div style={styles.insightTitle}>Estructura</div>
        <div style={styles.insightValue}>
          {totalGroups === 0
            ? "Sin estructura"
            : totalGroups === 1
            ? "Simple"
            : "Distribuida"}
        </div>
        <div style={styles.insightHint}>
          Organización de tus espacios
        </div>
      </div>
    </div>
  )}
</section>
        <div style={styles.mainGrid}>
          <div style={styles.leftCol}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Contexto</div>
                  <h2 style={styles.sectionTitle}>Contexto activo</h2>
                </div>
              </div>

              <p style={styles.bodyCopy}>
                Esto define desde qué perspectiva principal estás trabajando la
                app. El header te informa; aquí decides el enfoque.
              </p>

              <div style={styles.contextHero}>
                <div style={styles.contextHeroLeft}>
                  <div style={styles.contextHeroLabel}>Actualmente</div>
                  <div style={styles.contextCurrentRow}>
                    <span
                      style={{
                        ...styles.contextCurrentDot,
                        background: currentContextOption.dot,
                      }}
                    />
                    <span style={styles.contextCurrentText}>
                      {currentContextOption.label}
                    </span>
                  </div>

                  {showContextGroupName ? (
                    <div style={styles.contextCurrentMeta}>
                      Grupo asociado: {showContextGroupName}
                    </div>
                  ) : null}
                </div>

                <div style={styles.contextHeroRight}>
                  <div style={styles.contextHeroHint}>
                    Cambia este contexto solo cuando quieras cambiar la mirada
                    principal de la app.
                  </div>
                </div>
              </div>

              <div style={styles.contextGrid}>
                {CONTEXT_OPTIONS.map((option) => {
                  const active = option.key === contextState.mode;
                  const saving = contextSaving === option.key;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => handleContextChange(option.key)}
                      disabled={saving}
                      style={{
                        ...styles.contextCard,
                        ...(active ? styles.contextCardActive : {}),
                        ...(saving ? styles.contextCardBusy : {}),
                      }}
                    >
                      <div style={styles.contextCardTop}>
                        <span
                          style={{
                            ...styles.contextCardDot,
                            background: option.dot,
                          }}
                        />
                        <span style={styles.contextCardLabel}>
                          {option.label}
                        </span>
                        {active ? (
                          <span style={styles.contextBadge}>Activo</span>
                        ) : null}
                      </div>

                      <div style={styles.contextCardHint}>{option.hint}</div>

                      <div style={styles.contextCardFoot}>
                        {saving
                          ? "Actualizando..."
                          : active
                          ? "Este es el contexto principal actual."
                          : "Cambiar a este contexto"}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Gestión</div>
                  <h2 style={styles.sectionTitle}>Centro de administración</h2>
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
                  <div style={styles.sectionEyebrow}>Estructura</div>
                  <h2 style={styles.sectionTitle}>Grupos activos</h2>
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
                <EmptyBlock copy="Todavía no tienes grupos creados. Este es el primer paso para que SyncPlans deje de ser solo personal." />
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
                  <div style={styles.sectionEyebrow}>Captura</div>
                  <h2 style={styles.sectionTitle}>Acciones sugeridas</h2>
                </div>

                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={loadCaptures}
                >
                  Actualizar
                </button>
              </div>

              <p style={styles.bodyCopy}>
                Cuando alguien responda desde un link público, aquí aparecerán
                sugerencias listas para revisar sin perder el hilo.
              </p>

              {!canUseCaptures ? (
                <div style={styles.premiumLockCard}>
                  <div style={styles.premiumLockHeader}>
                    <span style={styles.premiumLockBadge}>Premium</span>
                    <h3 style={styles.premiumLockTitle}>
                      Convierte respuestas externas en acciones reales
                    </h3>
                  </div>

                  <p style={styles.premiumLockCopy}>
                    Cuando alguien responde desde un link, SyncPlans puede convertir eso en
                    decisiones dentro del sistema: aceptar, reprogramar o ajustar sin perder
                    contexto.
                  </p>

                  <button
                    type="button"
                    style={styles.primarySmallButton}
                    onClick={() => router.push("/planes")}
                  >
                    Ver cómo funciona en Premium
                  </button>
                </div>
              ) : capturesLoading ? (
                <EmptyBlock copy="Buscando respuestas externas recientes…" />
              ) : captures.length === 0 ? (
                <EmptyBlock copy="Todavía no hay respuestas externas pendientes por revisar." />
              ) : (
                <div style={styles.list}>
                  {captures.slice(0, 3).map((capture) => {
                    const hasProposal = Boolean(capture.proposed_date);
                    const statusTone =
                      capture.status === "accepted"
                        ? "ok"
                        : hasProposal
                        ? "warn"
                        : "bad";
                    const actorLabel = getCaptureActorLabel(capture);
                    const receivedLabel = formatRelativeCaptureTime(
                      capture.created_at
                    );

                    return (
                      <div key={capture.invite_id} style={styles.captureCard}>
                        <div style={styles.captureTopRow}>
                          <div style={styles.captureHeaderCopy}>
                            <div style={styles.listTitle}>
                              {capture.event_title || "Evento"}
                            </div>
                            <div style={styles.captureSubline}>
                              {capture.status === "accepted"
                                ? `${actorLabel} confirmó este plan`
                                : hasProposal
                                ? `${actorLabel} sugirió mover este plan`
                                : `${actorLabel} rechazó este plan`}
                            </div>
                          </div>

                          <StatusPill
                            label={
                              capture.status === "accepted"
                                ? "Aceptado"
                                : hasProposal
                                ? "Propuso cambio"
                                : "Rechazado"
                            }
                            tone={statusTone}
                          />
                        </div>

                        <div style={styles.captureMetaRow}>
                          <span style={styles.captureMetaPill}>
                            Recibido {receivedLabel}
                          </span>

                          {capture.contact ? (
                            <span style={styles.captureMetaPill}>
                              Respuesta de {capture.contact}
                            </span>
                          ) : null}
                        </div>

                        <div style={styles.captureMeta}>
                          {capture.status === "accepted"
                            ? "La respuesta externa ya confirmó este plan y puedes abrirlo directamente."
                            : hasProposal
                            ? `Nueva fecha sugerida: ${formatCaptureDate(
                                capture.proposed_date
                              )}`
                            : "La invitación fue rechazada sin nueva fecha sugerida. Puedes reprogramarla o revisar el evento original."}
                        </div>

                        {capture.message ? (
                          <div style={styles.captureMessage}>
                            “{capture.message}”
                          </div>
                        ) : null}

                        <div style={styles.captureActions}>
                          {capture.status === "accepted" ? (
                            <button
                              type="button"
                              style={styles.primarySmallButton}
                              onClick={() => openEventFromCapture(capture)}
                            >
                              Ver evento
                            </button>
                          ) : hasProposal ? (
                            <>
                              <button
                                type="button"
                                style={styles.primarySmallButton}
                                onClick={() =>
                                  handleTakeCaptureProposal(capture)
                                }
                              >
                                Tomar esta fecha
                              </button>

                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => handleReviewCapture(capture)}
                              >
                                Revisar propuesta
                              </button>

                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => openEventFromCapture(capture)}
                              >
                                Ver evento
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                style={styles.primarySmallButton}
                                onClick={() => handleRescheduleCapture(capture)}
                              >
                                Reprogramar
                              </button>

                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => openEventFromCapture(capture)}
                              >
                                Ver evento
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Google Calendar</div>
                  <h2 style={styles.sectionTitle}>Integración de apoyo</h2>
                </div>

                {!canUseGoogleIntegration ? (
                  <span style={styles.googlePremiumBadge}>Premium</span>
                ) : (
                  <StatusPill label={googlePill.label} tone={googlePill.tone} />
                )}
              </div>

              <p style={styles.bodyCopy}>
                Google Calendar suma contexto externo, pero la verdad compartida
                sigue viviendo dentro de SyncPlans. Desde aquí gestionas esa
                conexión sin mezclarla con la vista diaria.
              </p>

              {!canUseGoogleIntegration ? (
                <div style={styles.premiumLockCard}>
                  <div style={styles.premiumLockHeader}>
                    <span style={styles.premiumLockBadge}>Premium</span>
                    <h3 style={styles.premiumLockTitle}>
                      Añade contexto externo sin salir de SyncPlans
                    </h3>
                  </div>

                  <p style={styles.premiumLockCopy}>
                    Conecta Google Calendar para traer visibilidad adicional a tu
                    tiempo compartido, revisar eventos próximos y decidir mejor
                    sin depender de varias ventanas o chats.
                  </p>

                  <button
                    type="button"
                    style={styles.primarySmallButton}
                    onClick={() => router.push("/planes")}
                  >
                    Desbloquear integración en Premium
                  </button>
                </div>
              ) : (
                <>
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
                        onClick={() =>
                          router.push("/settings?tab=integrations")
                        }
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
                          Vista previa de Google
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
                                <div style={styles.listMeta}>
                                  {event.location}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
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

function formatCaptureDate(value: string | null) {
  if (!value) return "Fecha no disponible";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Fecha no disponible";

    return date.toLocaleString("es-PE", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Fecha no disponible";
  }
}

function formatRelativeCaptureTime(value: string | null) {
  if (!value) return "Recientemente";

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Recientemente";

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

    if (diffMinutes < 1) return "Ahora mismo";
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;

    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;

    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7)
      return `Hace ${diffDays} día${diffDays === 1 ? "" : "s"}`;

    return date.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "Recientemente";
  }
}

function getCaptureActorLabel(capture: PublicInviteCaptureItem) {
  const contact = String(capture.contact ?? "").trim();
  if (contact) return contact;
  return "Alguien";
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

  bodyCopy: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.6,
  },

  contextHero: {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1.2fr) minmax(220px, 1fr)",
    gap: 14,
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "radial-gradient(700px 220px at 0% 0%, rgba(56,189,248,0.10), transparent 55%), rgba(255,255,255,0.03)",
    padding: 16,
  },

  contextHeroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
  },

  contextHeroRight: {
    display: "flex",
    alignItems: "center",
    minWidth: 0,
  },

  contextHeroLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: 0.65,
    color: colors.textSecondary,
  },

  contextCurrentRow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },

  contextCurrentDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.05)",
    flexShrink: 0,
  },

  contextCurrentText: {
    fontSize: 24,
    lineHeight: 1.05,
    fontWeight: 950,
    color: colors.textPrimary,
  },

  contextCurrentMeta: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  contextHeroHint: {
    fontSize: 13,
    lineHeight: 1.6,
    color: colors.textMuted,
  },

  contextGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  },

  contextCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(15,23,42,0.98))",
    padding: 16,
    textAlign: "left",
    cursor: "pointer",
    color: colors.textPrimary,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    transition: "transform 160ms ease, border-color 160ms ease",
  },

  contextCardActive: {
    border: "1px solid rgba(56,189,248,0.24)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(15,23,42,0.98))",
    boxShadow: "0 12px 28px rgba(56,189,248,0.08)",
  },

  contextCardBusy: {
    opacity: 0.78,
    cursor: "wait",
  },

  contextCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    flexWrap: "wrap",
  },

  contextCardDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },

  contextCardLabel: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
    color: colors.textPrimary,
  },

  contextBadge: {
    marginLeft: "auto",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(56,189,248,0.34)",
    background: "rgba(56,189,248,0.12)",
    color: colors.textPrimary,
    whiteSpace: "nowrap",
  },

  contextCardHint: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 1.55,
  },

  contextCardFoot: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 1.5,
    fontWeight: 700,
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

  captureCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 10,
  },

  captureTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  captureHeaderCopy: {
    minWidth: 0,
    flex: "1 1 220px",
    display: "grid",
    gap: 4,
  },

  captureSubline: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  captureMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  captureMetaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: 800,
  },

  captureMeta: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 1.5,
  },

  captureMessage: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 1.5,
    padding: "10px 12px",
    borderRadius: radii.md,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  captureActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  premiumLockCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(56,189,248,0.25)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08))",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  premiumLockHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },

  premiumLockBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: 900,
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.4)",
    background: "rgba(56,189,248,0.12)",
    color: colors.textPrimary,
  },

  premiumLockTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: colors.textPrimary,
  },

  premiumLockCopy: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textMuted,
  },

  googlePremiumBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.38)",
    background: "rgba(56,189,248,0.10)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: "nowrap",
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
  insightGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
},

insightCard: {
  borderRadius: radii.lg,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 6,
},

insightTitle: {
  fontSize: 11,
  fontWeight: 900,
  color: colors.textSecondary,
  textTransform: "uppercase",
},

insightValue: {
  fontSize: 18,
  fontWeight: 900,
  color: colors.textPrimary,
},

insightHint: {
  fontSize: 12,
  color: colors.textMuted,
},
};
