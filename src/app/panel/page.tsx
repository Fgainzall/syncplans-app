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

import MobileScaffold from "@/components/MobileScaffold";
import PremiumHeader from "@/components/PremiumHeader";

import supabase from "@/lib/supabaseClient";
import { getMyConflictResolutionsMap } from "@/lib/conflictResolutionsDb";
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
  getGroupLimitState,
  type PlanTier,
} from "@/lib/premium";
import {
  getGroupState,
  setMode,
  type GroupState,
  type UsageMode,
} from "@/lib/groups";
import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

/* SYNCPLANS: reinforce coordination narrative in panel */


type QuickAction = {
  id: string;
  title: string;
  hint: string;
  href: string;
  badge?: string;
  featured?: boolean;
};

type CompactAction = {
  id: string;
  label: string;
  href: string;
  badge?: string;
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

type PremiumLockProps = {
  title: string;
  copy: string;
};

type PlanTone = "free" | "trial" | "premium" | "founder";

const CONTEXT_OPTIONS: ContextOption[] = [
  { key: "solo", label: "Personal", hint: "Tu agenda individual", dot: "#FBBF24" },
  { key: "pair", label: "Pareja", hint: "Coordinación de dos", dot: "#F87171" },
  { key: "family", label: "Familia", hint: "Varios miembros", dot: "#60A5FA" },
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

function PremiumLock({ title, copy }: PremiumLockProps) {
  const router = useRouter();

  return (
    <div style={styles.premiumLockCard}>
      <div style={styles.premiumLockHeader}>
        <span style={styles.premiumLockBadge}>Premium</span>
        <h3 style={styles.premiumLockTitle}>{title}</h3>
      </div>

      <p style={styles.premiumLockCopy}>{copy}</p>

      <button
        type="button"
        style={styles.primarySmallButton}
        onClick={() => router.push("/planes")}
      >
        Ver planes
      </button>
    </div>
  );
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
  const [googleEventsError, setGoogleEventsError] = useState<string | null>(null);

  const [contextState, setContextState] = useState<GroupState>(() =>
    getGroupState()
  );
  const [contextSaving, setContextSaving] = useState<UsageMode | null>(null);
  const [captures, setCaptures] = useState<PublicInviteCaptureItem[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

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
        err?.message || "No se pudo cargar el panel. Intenta recargar."
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
      router.push(`/events?focusEventId=${encodeURIComponent(capture.event_id)}`);
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
          error: json?.error || "No se pudo leer el estado de Google Calendar.",
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
        error: err?.message || "Error inesperado al consultar Google Calendar.",
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
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      setIsMobile(window.innerWidth < 768);
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

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
    const refreshSuggestedCaptures = () => loadCaptures();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") loadCaptures();
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
  const groupLimitState = getGroupLimitState(profile, totalGroups);

  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);
  const canUseCaptures = hasPremiumAccess(profile);
  const canUseGoogleIntegration = hasPremiumAccess(profile);
  const canUseAdvancedAnalytics = hasPremiumAccess(profile);

  const currentContextOption =
    CONTEXT_OPTIONS.find((x) => x.key === contextState.mode) ?? CONTEXT_OPTIONS[0];

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
        title: "Founder activo",
        copy: "Entraste antes y conservas una capa preferencial dentro del valor premium.",
        cta: "Ver beneficios",
        tone: "founder" as PlanTone,
        supportingCopy: "Tu acceso reconoce esa ventaja temprana.",
      };
    }

    if (trialActive) {
      return {
        pill: "Trial",
        title: "Premium en prueba",
        copy: "Ya estás probando una coordinación con más claridad, menos fricción y más control sobre lo compartido.",
        cta: "Mantener Premium",
        tone: "trial" as PlanTone,
        supportingCopy: "Evita volver al modo improvisado.",
      };
    }

    if (premiumActive) {
      return {
        pill: "Premium",
        title: "Premium activo",
        copy: "Tu coordinación premium ya está funcionando con más claridad compartida, menos desgaste y mejor visibilidad.",
        cta: "Gestionar plan",
        tone: "premium" as PlanTone,
        supportingCopy: "Más claridad. Menos fricción. Más control.",
      };
    }

    return {
      pill: "Free",
      title: "Plan actual",
      copy: "Tu base gratuita ya está activa. Premium entra cuando coordinar con otros ya pide más contexto, más visibilidad y menos desgaste.",
      cta: "Ver planes",
      tone: "free" as PlanTone,
      supportingCopy: "Premium aparece cuando el sistema compartido crece.",
    };
  }, [premiumActive, tier, trialActive]);

  const adminActions: QuickAction[] = [
    {
      id: "groups",
      title: "Grupos",
      hint: "Crear, abrir y ordenar espacios compartidos",
      href: "/groups",
      badge: totalGroups > 0 ? `${totalGroups}` : undefined,
      featured: true,
    },
    {
      id: "invitations",
      title: "Invitaciones",
      hint: "Aceptar, revisar y destrabar accesos",
      href: "/invitations",
      featured: true,
    },
    {
      id: "settings",
      title: "Ajustes",
      hint: "Cuenta, preferencias e integraciones",
      href: "/settings",
      featured: true,
    },
    {
      id: "plans",
      title: "Plan",
      hint: "Nivel actual y beneficios activos",
      href: "/planes",
    },
  ];

  const operationActions: CompactAction[] = [
    { id: "summary", label: "Resumen", href: "/summary" },
    { id: "calendar", label: "Calendario", href: "/calendar" },
    {
      id: "conflicts",
      label: "Conflictos",
      href: "/conflicts/detected",
      badge: conflictsNow > 0 ? `${conflictsNow}` : undefined,
    },
    {
      id: "events",
      label: "Eventos",
      href: "/events",
      badge: totalEvents > 0 ? `${totalEvents}` : undefined,
    },
  ];

  const groupsPreview = useMemo(() => groups.slice(0, 2), [groups]);

  const googlePill = useMemo(() => {
    if (googleLoading) return { label: "Revisando", tone: "neutral" as const };
    if (connectionState === "connected") return { label: "Conectado", tone: "ok" as const };
    if (connectionState === "needs_reauth") return { label: "Reconectar", tone: "warn" as const };
    if (googleStatus && !googleStatus.ok) return { label: "Error", tone: "bad" as const };
    return { label: "No conectado", tone: "neutral" as const };
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
        ? `Conectado con ${googleStatus.account.email}`
        : "Google Calendar conectado"
      : connectionState === "needs_reauth"
      ? googleStatus?.account?.email
        ? `${googleStatus.account.email} necesita reconexión`
        : "La conexión necesita reconexión"
      : "Google Calendar no conectado";

  let heroSummary =
    "Desde aquí administras la estructura que hace posible la coordinación: grupos, invitaciones, plan e integraciones. También es donde conviertes una cuenta individual en un sistema compartido que puede crecer mejor.";
  let heroSummaryMobile =
    "Administra grupos, invitaciones, plan e integraciones sin salir del hub.";

  if (!loading) {
    if (totalGroups === 0) {
      heroSummary =
        "El siguiente salto de SyncPlans no es llenar más pantallas, sino crear tu primer grupo, traer a la otra persona y mover la coordinación fuera del chat y dentro del sistema.";
    } else if (conflictsNow > 0) {
      heroSummary = `Tu sistema hoy tiene ${conflictsNow} conflicto${
        conflictsNow === 1 ? "" : "s"
      } pendiente${conflictsNow === 1 ? "" : "s"}, ${totalGroups} grupo${
        totalGroups === 1 ? "" : "s"
      } y ${totalEvents} evento${totalEvents === 1 ? "" : "s"} visibles.`;
      heroSummaryMobile = `${conflictsNow} conflicto${conflictsNow === 1 ? "" : "s"} pendiente${conflictsNow === 1 ? "" : "s"} · ${totalGroups} grupo${totalGroups === 1 ? "" : "s"}`;
    } else if (totalGroups > 0) {
      heroSummary = `Ya tienes ${totalGroups} grupo${
        totalGroups === 1 ? "" : "s"
      } creado${totalGroups === 1 ? "" : "s"}. Desde aquí decides cómo escala tu coordinación, a quién conviene meter dentro ahora y dónde el valor compartido todavía está incompleto.`;
      heroSummaryMobile = `${totalGroups} grupo${totalGroups === 1 ? "" : "s"} activo${totalGroups === 1 ? "" : "s"}. Usa el panel para gestionar estructura y accesos.`;
    }
  }

  const heroPrimaryCtaLabel = totalGroups === 0 ? "Crear grupo" : "Abrir grupos";
  const heroPrimaryCtaHref = totalGroups === 0 ? "/groups/new" : "/groups";
  const heroSecondaryCtaLabel = totalGroups === 0 ? "Ver invitaciones" : "Traer a alguien";


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
        subtitle={
          isMobile
            ? "Tu hub de grupos, invitaciones, plan e integraciones."
            : "El lugar donde conviertes SyncPlans en un sistema que suma gente, ordena decisiones y hace crecer la coordinación desde dentro."
        }
      />

      <div style={styles.stack}>
        {error ? <div style={styles.errorBanner}>{error}</div> : null}

        <section style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <div style={styles.heroTextWrap}>
              <div style={styles.eyebrow}>Panel</div>
              <h1 style={styles.heroTitle}>Centro de estructura</h1>
              <p style={styles.heroCopy}>{isMobile ? heroSummaryMobile : heroSummary}</p>
              {!isMobile ? (
                <div style={styles.heroMicroCopy}>
                  {totalGroups === 0 ? (
                    <>
                      Crea la estructura primero. Cuando entra otra persona, SyncPlans deja de ser una herramienta ordenada y empieza a convertirse en coordinación real.
                    </>
                  ) : (
                    <>
                      La operación diaria sigue viviendo en <strong>Resumen</strong>, <strong>Calendario</strong>, <strong>Eventos</strong> y <strong>Conflictos</strong>. Aquí solo administras la base sobre la que todo eso funciona.
                    </>
                  )}
                </div>
              ) : null}
            </div>

            <div style={styles.heroActionStack}>
              <button
                type="button"
                style={styles.primaryHeroCta}
                onClick={() => router.push(heroPrimaryCtaHref)}
              >
                {heroPrimaryCtaLabel}
              </button>
              <button
                type="button"
                style={styles.secondaryHeroCta}
                onClick={() => router.push("/invitations")}
              >
                {heroSecondaryCtaLabel}
              </button>
            </div>
          </div>

          <div style={styles.metricsGrid}>
            <MetricCard
              label="Grupos"
              value={loading ? "—" : String(totalGroups)}
              hint="Espacios compartidos"
            />
            <MetricCard
              label="Eventos"
              value={loading ? "—" : String(totalEvents)}
              hint="Carga visible"
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
              hint="Estado externo"
            />
            <MetricCard
              label="Conflictos"
              value={loading ? "—" : String(conflictsNow)}
              hint="Pendientes"
              danger={conflictsNow > 0}
            />
          </div>
        </section>

        <section style={styles.sectionCardCompact}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionEyebrow}>Contexto</div>
              <h2 style={styles.sectionTitle}>Modo activo</h2>
            </div>
          </div>

          <div style={styles.contextHeroCompact}>
            <div style={styles.contextHeroLeft}>
              <div style={styles.contextCurrentRow}>
                <span
                  style={{
                    ...styles.contextCurrentDot,
                    background: currentContextOption.dot,
                  }}
                />
                <span style={styles.contextCurrentTextSmall}>
                  {currentContextOption.label}
                </span>
                {showContextGroupName ? (
                  <span style={styles.contextInlineMeta}>{showContextGroupName}</span>
                ) : null}
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
                    <span style={styles.contextCardLabel}>{option.label}</span>
                    {active ? <span style={styles.contextBadge}>Activo</span> : null}
                  </div>

                  <div style={styles.contextCardHint}>{option.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        <div style={styles.mainGrid}>
          <div style={styles.leftCol}>
            <section style={styles.sectionCard}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Administración</div>
                  <h2 style={styles.sectionTitle}>Accesos prioritarios</h2>
                  {!isMobile ? (
                    <div style={styles.sectionSubtleCopy}>
                      Las piezas que convierten a SyncPlans en una capa de coordinación compartida y no en otro calendario.
                    </div>
                  ) : null}
                </div>
              </div>

              <div style={styles.actionsGrid}>
                {adminActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    style={{
                      ...styles.actionCard,
                      ...(action.featured ? styles.actionCardFeatured : undefined),
                    }}
                    onClick={() => router.push(action.href)}
                  >
                    <div style={styles.actionCardTop}>
                      <span style={styles.actionTitle}>{action.title}</span>
                      {action.badge ? <span style={styles.badge}>{action.badge}</span> : null}
                    </div>
                    {!isMobile ? <p style={styles.actionHint}>{action.hint}</p> : null}
                  </button>
                ))}
              </div>
            </section>

            {!isMobile ? (
            <>
            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Grupos</div>
                  <h2 style={styles.sectionTitle}>Espacios recientes</h2>
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
                <EmptyBlock
                  copy="Aún no tienes grupos. Este es el mejor lugar para arrancar la coordinación compartida y darle a otra persona una razón real para entrar y quedarse."
                  primaryLabel="Crear grupo"
                  onPrimary={() => router.push("/groups/new")}
                  secondaryLabel="Ver invitaciones"
                  onSecondary={() => router.push("/invitations")}
                />
              ) : (
                <div style={styles.listCompact}>
                  {groupsPreview.map((group) => (
                    <div key={group.id} style={styles.listItem}>
                      <div style={styles.listCopyWrap}>
                        <div style={styles.listTitle}>
                          {group.name || getGroupTypeLabel(group.type)}
                        </div>
                        <div style={styles.listMeta}>{getGroupTypeLabel(group.type)}</div>
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

            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Capturas</div>
                  <h2 style={styles.sectionTitle}>Bandeja de respuestas</h2>
                </div>

                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={loadCaptures}
                >
                  Actualizar
                </button>
              </div>

              {!canUseCaptures ? (
                <PremiumLock
                  title="Capturas premium"
                  copy="Respuestas externas convertidas en acciones."
                />
              ) : capturesLoading ? (
                <EmptyBlock copy="Buscando respuestas…" />
              ) : captures.length === 0 ? (
                <EmptyBlock copy="No hay respuestas pendientes." />
              ) : (
                <div style={styles.listCompact}>
                  {captures.slice(0, 2).map((capture) => {
                    const hasProposal = Boolean(capture.proposed_date);
                    const statusTone =
                      capture.status === "accepted"
                        ? "ok"
                        : hasProposal
                        ? "warn"
                        : "bad";

                    return (
                      <div key={capture.invite_id} style={styles.captureCardCompact}>
                        <div style={styles.captureTopRow}>
                          <div style={styles.captureHeaderCopy}>
                            <div style={styles.listTitle}>
                              {capture.event_title || "Evento"}
                            </div>
                            <div style={styles.captureSubline}>
                              {capture.status === "accepted"
                                ? "Aceptado"
                                : hasProposal
                                ? `Propuso: ${formatCaptureDate(capture.proposed_date)}`
                                : "Rechazado"}
                            </div>
                          </div>

                          <StatusPill
                            label={
                              capture.status === "accepted"
                                ? "Aceptado"
                                : hasProposal
                                ? "Cambio"
                                : "Rechazado"
                            }
                            tone={statusTone}
                          />
                        </div>

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
                                onClick={() => handleTakeCaptureProposal(capture)}
                              >
                                Tomar fecha
                              </button>
                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => handleReviewCapture(capture)}
                              >
                                Revisar
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              style={styles.primarySmallButton}
                              onClick={() => handleRescheduleCapture(capture)}
                            >
                              Reprogramar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Operación diaria</div>
                  <h2 style={styles.sectionTitle}>Volver al flujo principal</h2>
                </div>
              </div>

              <div style={styles.pillActionsRow}>
                {operationActions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    style={styles.pillAction}
                    onClick={() => router.push(action.href)}
                  >
                    <span>{action.label}</span>
                    {action.badge ? <span style={styles.pillBadge}>{action.badge}</span> : null}
                  </button>
                ))}
              </div>
            </section>
            </>
            ) : null}
          </div>

          <div style={styles.rightCol}>
            <section
              style={{
                ...styles.planCard,
                border:
                  planInfo.tone === "free"
                    ? "1px solid rgba(56,189,248,0.25)"
                    : planInfo.tone === "trial"
                    ? "1px solid rgba(168,85,247,0.35)"
                    : planInfo.tone === "premium"
                    ? "1px solid rgba(34,197,94,0.35)"
                    : "1px solid rgba(251,191,36,0.35)",
              }}
            >
              <div style={styles.planPill}>{planInfo.pill}</div>
              <h2 style={styles.planTitle}>{planInfo.title}</h2>
              <p style={styles.planCopy}>{isMobile ? planInfo.supportingCopy : planInfo.copy}</p>
              {!isMobile ? <div style={styles.planSupportCopy}>{planInfo.supportingCopy}</div> : null}

              {!planInfo.tone || planInfo.tone === "free" ? (
                <div style={styles.planMiniNote}>
                  {groupLimitState.reached
                    ? "Premium abre más grupos y más control cuando la coordinación crece."
                    : `Free incluye hasta ${groupLimitState.limit ?? "1"} grupo antes de que Premium empiece a tener sentido.`}
                </div>
              ) : null}

              <button
                type="button"
                style={styles.primaryCta}
                onClick={() => router.push("/planes")}
              >
                {planInfo.cta}
              </button>
            </section>

            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Sistema</div>
                  <h2 style={styles.sectionTitle}>Integraciones</h2>
                  {!isMobile ? (
                    <div style={styles.sectionSubtleCopy}>
                      Estado y acceso rápido a Google Calendar sin salir de SyncPlans.
                    </div>
                  ) : null}
                </div>

                {!canUseGoogleIntegration ? (
                  <span style={styles.googlePremiumBadge}>Premium</span>
                ) : (
                  <StatusPill label={googlePill.label} tone={googlePill.tone} />
                )}
              </div>

              {!canUseGoogleIntegration ? (
                <PremiumLock
                  title="Google premium"
                  copy="Contexto externo sin salir de SyncPlans."
                />
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
                      {googleEventsError ? (
                        <div style={styles.errorText}>{googleEventsError}</div>
                      ) : null}

                      {googleEventsLoading ? (
                        <EmptyBlock copy="Cargando eventos…" />
                      ) : googleEvents.length === 0 ? (
                        <EmptyBlock copy="No encontramos eventos próximos." />
                      ) : (
                        <div style={styles.listCompact}>
                          {googleEvents.slice(0, 2).map((event) => (
                            <div key={event.id} style={styles.listItemColumn}>
                              <div style={styles.listTitle}>
                                {event.title || "Evento sin título"}
                              </div>
                              <div style={styles.listMeta}>
                                {formatExternalEventRange(event)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </section>

{!isMobile ? (
            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Insights</div>
                  <h2 style={styles.sectionTitle}>Lectura operativa</h2>
                </div>
              </div>

              {!canUseAdvancedAnalytics ? (
                <PremiumLock
                  title="Insights premium"
                  copy="Carga, fricción y lectura avanzada."
                />
              ) : (
                <div style={styles.insightGrid}>
                  <div style={styles.insightCardCompact}>
                    <div style={styles.insightTitle}>Carga</div>
                    <div style={styles.insightValue}>
                      {totalEvents === 0
                        ? "Ligera"
                        : totalEvents < 5
                        ? "Controlada"
                        : totalEvents < 10
                        ? "Activa"
                        : "Intensa"}
                    </div>
                  </div>

                  <div style={styles.insightCardCompact}>
                    <div style={styles.insightTitle}>Fricción</div>
                    <div style={styles.insightValue}>
                      {conflictsNow === 0
                        ? "Baja"
                        : conflictsNow < 3
                        ? "Moderada"
                        : "Alta"}
                    </div>
                  </div>

                  <div style={styles.insightCardCompact}>
                    <div style={styles.insightTitle}>Estructura</div>
                    <div style={styles.insightValue}>
                      {totalGroups === 0
                        ? "Vacía"
                        : totalGroups === 1
                        ? "Simple"
                        : "Distribuida"}
                    </div>
                  </div>
                </div>
              )}
            </section>
            ) : null}
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

function EmptyBlock({
  copy,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  copy: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div style={styles.emptyBlockWrap}>
      <div style={styles.emptyBlock}>{copy}</div>
      {primaryLabel && onPrimary ? (
        <div style={styles.emptyActionsRow}>
          <button type="button" style={styles.emptyPrimaryBtn} onClick={onPrimary}>
            {primaryLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button type="button" style={styles.emptySecondaryBtn} onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
    padding: 20,
    boxShadow: shadows.card,
    display: "flex",
    flexDirection: "column",
    gap: 16,
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
    fontSize: "clamp(28px, 4vw, 40px)",
    lineHeight: 1.02,
    fontWeight: 950,
    maxWidth: 760,
  },

  heroCopy: {
    margin: "10px 0 0",
    maxWidth: 700,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 1.55,
  },

  heroMicroCopy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textSecondary,
  },

  heroActionStack: {
    display: "grid",
    gap: 10,
    minWidth: 180,
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

  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 10,
  },

  metricCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
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
    fontSize: 24,
    fontWeight: 950,
    lineHeight: 1,
  },

  metricHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 1.4,
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
    gap: spacing.md,
    minWidth: 0,
  },

  rightCol: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.md,
    minWidth: 0,
  },

  sectionCard: {
    borderRadius: radii.xl,
    border: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceLow,
    boxShadow: shadows.card,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  sectionCardCompact: {
    borderRadius: radii.xl,
    border: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceLow,
    boxShadow: shadows.card,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
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
    marginBottom: 4,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.08,
  },

  sectionSubtleCopy: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textMuted,
  },

  contextHeroCompact: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "radial-gradient(700px 220px at 0% 0%, rgba(56,189,248,0.10), transparent 55%), rgba(255,255,255,0.03)",
    padding: 12,
  },

  contextHeroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 0,
    width: "100%",
  },

  contextCurrentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    minWidth: 0,
  },

  contextCurrentDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.05)",
    flexShrink: 0,
  },

  contextCurrentTextSmall: {
    fontSize: 20,
    lineHeight: 1.05,
    fontWeight: 950,
    color: colors.textPrimary,
    minWidth: 0,
  },

  contextInlineMeta: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 1.4,
    fontWeight: 700,
  },

  contextGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },

  contextCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(15,23,42,0.98))",
    padding: 14,
    textAlign: "left",
    cursor: "pointer",
    color: colors.textPrimary,
    display: "flex",
    flexDirection: "column",
    gap: 8,
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
    fontSize: 15,
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
    fontSize: 12,
    lineHeight: 1.45,
  },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 8,
  },

  actionCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(15,23,42,0.96))",
    padding: 12,
    textAlign: "left",
    cursor: "pointer",
    color: colors.textPrimary,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 78,
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
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  actionHint: {
    margin: 0,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 1.45,
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

  pillActionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  pillAction: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontWeight: 800,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },

  pillBadge: {
    borderRadius: 999,
    padding: "2px 7px",
    fontSize: 11,
    fontWeight: 900,
    border: "1px solid rgba(56,189,248,0.34)",
    background: "rgba(56,189,248,0.12)",
    color: colors.textPrimary,
  },

  planCard: {
    borderRadius: radii.xl,
    border: "1px solid rgba(251,191,36,0.20)",
    background:
      "radial-gradient(900px 320px at 0% 0%, rgba(251,191,36,0.14), transparent 55%), rgba(15,23,42,0.96)",
    boxShadow: shadows.card,
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
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
    lineHeight: 1.55,
  },

  planSupportCopy: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: colors.textSecondary,
  },

  planMiniNote: {
    marginTop: 6,
    borderRadius: 14,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.08)",
    padding: "10px 12px",
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.84)",
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

  listCompact: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  listItem: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
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
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },

  listTitle: {
    fontSize: 14,
    fontWeight: 850,
    color: colors.textPrimary,
  },

  listMeta: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 1.45,
  },

  integrationBox: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  integrationCopyWrap: {
    minWidth: 0,
    flex: "1 1 220px",
  },

  integrationLine: {
    fontSize: 14,
    lineHeight: 1.5,
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

  captureCardCompact: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
    display: "grid",
    gap: 8,
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

  captureActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  premiumLockCard: {
    borderRadius: radii.lg,
    border: "1px solid rgba(56,189,248,0.25)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(168,85,247,0.08))",
    padding: 14,
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
    gap: 8,
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

  emptyBlockWrap: {
    display: "grid",
    gap: 12,
  },
  emptyActionsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  emptyPrimaryBtn: {
    border: `1px solid ${colors.borderStrong}`,
    background: colors.accentPrimary,
    color: colors.textPrimary,
    borderRadius: radii.md,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  emptySecondaryBtn: {
    border: `1px solid ${colors.borderSubtle}`,
    background: colors.surfaceLow,
    color: colors.textSecondary,
    borderRadius: radii.md,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  emptyBlock: {
    borderRadius: radii.lg,
    border: "1px dashed rgba(148,163,184,0.28)",
    background: "rgba(255,255,255,0.02)",
    padding: 14,
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 1.5,
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
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  insightCardCompact: {
    borderRadius: radii.lg,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 84,
  },

  insightTitle: {
    fontSize: 11,
    fontWeight: 900,
    color: colors.textSecondary,
    textTransform: "uppercase",
  },

  insightValue: {
    fontSize: 17,
    fontWeight: 900,
    color: colors.textPrimary,
  },
};