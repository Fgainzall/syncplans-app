
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
type PanelGroupLike = {
  id?: string | number | null;
  type?: string | null;
};

type GoogleStatusResponse = {
  ok: boolean;
  connected: boolean;
  connection_state?: GoogleStatus["connection_state"];
  error?: string;
};

type GoogleListResponse = {
  ok?: boolean;
  items?: Parameters<typeof normalizeGoogleCalendarItems>[0];
  error?: string;
};
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
    const current = (groups as PanelGroupLike[]).find(
  (g) => String(g.id) === String(existing)
);
    const currentType = String(current?.type ?? "").toLowerCase();
    if (current && currentType === wantType) {
      return String(existing);
    }
  }

  const match = groups.find(
  (g: PanelGroupLike) => String(g.type ?? "").toLowerCase() === wantType
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

function formatCaptureDate(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Sin fecha";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return date.toLocaleString([], {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatExternalEventRange(event: ExternalEvent) {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : null;

  if (Number.isNaN(start.getTime())) return "Sin fecha";

  const day = start.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });

  const startTime = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (!end || Number.isNaN(end.getTime())) {
    return `${day} · ${startTime}`;
  }

  const endTime = end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${day} · ${startTime}–${endTime}`;
}

function MetricCard({
  label,
  value,
  hint,
  danger = false,
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        ...styles.metricCard,
        ...(danger ? styles.metricCardDanger : null),
        ...(compact ? styles.metricCardCompact : null),
      }}
    >
      <div style={{ ...styles.metricLabel, ...(compact ? styles.metricLabelCompact : null) }}>
        {label}
      </div>
      <div style={{ ...styles.metricValue, ...(compact ? styles.metricValueCompact : null) }}>
        {value}
      </div>
      <div style={{ ...styles.metricHint, ...(compact ? styles.metricHintCompact : null) }}>
        {hint}
      </div>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "ok" | "warn" | "bad";
}) {
  return (
    <span
      style={{
        ...styles.statusPill,
        ...(tone === "ok"
          ? styles.statusPillOk
          : tone === "warn"
            ? styles.statusPillWarn
            : tone === "bad"
              ? styles.statusPillBad
              : styles.statusPillNeutral),
      }}
    >
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
    <div style={styles.emptyBlock}>
      <p style={styles.emptyCopy}>{copy}</p>

      {primaryLabel || secondaryLabel ? (
        <div style={styles.emptyActions}>
          {primaryLabel && onPrimary ? (
            <button type="button" style={styles.primarySmallButton} onClick={onPrimary}>
              {primaryLabel}
            </button>
          ) : null}

          {secondaryLabel && onSecondary ? (
            <button type="button" style={styles.secondarySmallButton} onClick={onSecondary}>
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
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
        Ver acceso
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

  const [contextState, setContextState] = useState<GroupState>(() => getGroupState());
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
        getMyConflictResolutionsMap().catch(() => ({} as Record<string, string>)),
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
  } catch (err: unknown) {
  console.error("Error cargando panel:", err);
  setError(
    err instanceof Error
      ? err.message
      : "No se pudo cargar el panel. Intenta recargar."
  );
}
    finally {
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

      const json = (await res.json().catch(() => null)) as GoogleStatusResponse | null;

      if (!res.ok || !json?.ok) {
        setGoogleStatus({
          ok: false,
          connected: false,
          connection_state: "disconnected",
          error: json?.error || "No se pudo leer el estado de Google Calendar conectado.",
        });
        return;
      }

setGoogleStatus({
  ok: Boolean(json.ok),
  connected: Boolean(json.connected),
connection_state:
  json.connection_state === "connected" ||
  json.connection_state === "disconnected"
    ? json.connection_state
    : "disconnected",
  error: json.error ?? undefined,
});
} catch (err: unknown) {
  console.error("Error leyendo estado de Google:", err);
  setGoogleStatus({
    ok: false,
    connected: false,
    connection_state: "disconnected",
    error:
      err instanceof Error
        ? err.message
        : "Error inesperado al consultar Google Calendar conectado.",
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
      | GoogleListResponse
        | null;

      if (!res.ok || !json?.ok) {
        setGoogleEvents([]);
        setGoogleEventsError(json?.error || "No se pudieron leer los eventos de Google.");
        return;
      }

    const normalized = normalizeGoogleCalendarItems(json.items ?? [], {
  calendarId: "primary",
});

      setGoogleEvents(normalized);
 } catch (err: unknown) {
  console.error("Error leyendo eventos de Google:", err);
  setGoogleEvents([]);
  setGoogleEventsError(
    err instanceof Error
      ? err.message
      : "Error inesperado al leer eventos de Google."
  );
}
    finally {
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

    const syncViewport = () => setIsMobile(window.innerWidth < 768);
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

  const currentContextOption =
    CONTEXT_OPTIONS.find((x) => x.key === contextState.mode) ?? CONTEXT_OPTIONS[0];

  const currentContextGroupName = normalizeGroupLabel(contextState.groupName ?? null);

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
      title: "Tu acceso actual",
      copy: "Tu base gratuita ya está activa. Premium entra cuando coordinar con otros ya pide más contexto, más visibilidad y menos desgaste.",
      cta: "Ver acceso",
      tone: "free" as PlanTone,
      supportingCopy: "Premium aparece cuando el sistema compartido crece.",
    };
  }, [premiumActive, tier, trialActive]);

  const adminActions: QuickAction[] = [
    {
      id: "groups",
      title: "Espacios compartidos",
      hint: isMobile ? "Crear y abrir espacios compartidos" : "Crear, abrir y ordenar espacios compartidos",
      href: "/groups",
      badge: totalGroups > 0 ? `${totalGroups}` : undefined,
      featured: true,
    },
    {
      id: "invitations",
      title: "Invitaciones activas",
      hint: isMobile ? "Aceptar y revisar accesos" : "Aceptar, revisar y destrabar accesos",
      href: "/invitations",
      badge: captures.length > 0 ? `${captures.length}` : undefined,
      featured: true,
    },
    {
      id: "settings",
      title: "Ajustes",
      hint: isMobile ? "Cuenta e integraciones" : "Cuenta, preferencias e integraciones",
      href: "/settings",
      featured: true,
    },
    {
      id: "plans",
      title: "Plan",
      hint: isMobile ? "Nivel y beneficios" : "Nivel actual y beneficios activos",
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

  const groupsPreview = useMemo(() => groups.slice(0, isMobile ? 2 : 4), [groups, isMobile]);

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
        : "Google Calendar conectado conectado"
      : connectionState === "needs_reauth"
        ? googleStatus?.account?.email
          ? `${googleStatus.account.email} necesita reconexión`
          : "La conexión necesita reconexión"
        : "Google Calendar conectado no conectado";

  let heroSummary =
    "Desde aquí administras la estructura que hace posible la coordinación: grupos, invitaciones, plan e integraciones.";
  const heroSummaryMobile =
    totalGroups === 0
      ? "Activa tu primer espacio compartido."
      : `${totalGroups} grupos activos. Gestiona estructura y accesos.`;

  if (!loading && totalGroups === 0) {
    heroSummary =
      "Crea tu primer grupo y trae a la otra persona dentro del sistema. Ese es el salto que convierte SyncPlans en coordinación compartida real.";
  }

  const heroPrimaryCtaLabel = totalGroups === 0 ? "Crear grupo" : "Abrir grupos";
  const heroPrimaryCtaHref = totalGroups === 0 ? "/groups/new" : "/groups";
  const heroSecondaryCtaLabel = totalGroups === 0 ? "Revisar invitaciones" : "Invitar a alguien";
  const showHeroConflictNote = conflictsNow > 0 && !isMobile;

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

  if (loading && !stats) {
    return (
      <MobileScaffold maxWidth={1120}>
        <PremiumHeader
          title="Panel"
          subtitle="Tu hub de grupos, invitaciones, plan e integraciones."
        />
        <div style={styles.stack}>
          <section style={styles.heroCard}>
            <div style={styles.loadingBlock}>
              <div style={styles.loadingDot} />
              <div>
                <div style={styles.loadingTitle}>Cargando panel…</div>
                <div style={styles.loadingSub}>Preparando tu estructura</div>
              </div>
            </div>
          </section>
        </div>
      </MobileScaffold>
    );
  }

  return (
    <MobileScaffold maxWidth={1120}>
      <PremiumHeader
        title="Panel"
        subtitle={
          isMobile
            ? "Tu hub de grupos, invitaciones, plan e integraciones."
            : "El lugar donde administras la estructura compartida sin confundirlo con la operación diaria."
        }
      />

      <div style={styles.stack}>
        {error ? <div style={styles.errorBanner}>{error}</div> : null}

        <section style={styles.heroCard}>
          <div style={styles.heroTopRow}>
            <div style={styles.heroTextWrap}>
              <div style={styles.eyebrow}>Panel</div>
              <h1 style={styles.heroTitle}>{isMobile ? "Hub administrativo" : "Centro de estructura"}</h1>
              <p style={styles.heroCopy}>{isMobile ? heroSummaryMobile : heroSummary}</p>

              {!isMobile ? (
                <div style={styles.heroMicroCopy}>
                  La operación diaria vive en <strong>Resumen</strong>, <strong>Calendario</strong>, <strong>Eventos</strong> y <strong>Conflictos</strong>. Aquí administras la base.
                </div>
              ) : null}
            </div>

            <div style={{ ...styles.heroActionStack, ...(isMobile ? styles.heroActionStackMobile : null) }}>
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

          {showHeroConflictNote ? (
            <div style={styles.heroAlert}>
              <div style={styles.heroAlertEyebrow}>Atención</div>
              <div style={styles.heroAlertText}>
                Hay {conflictsNow} conflicto{conflictsNow === 1 ? "" : "s"} activo{conflictsNow === 1 ? "" : "s"}. Resuélvelos desde Conflictos; aquí solo administras estructura.
              </div>
            </div>
          ) : null}

          <div
            style={{
              ...styles.metricsGrid,
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
            }}
          >
            <MetricCard label="Espacios compartidos" value={loading ? "—" : String(totalGroups)} hint="Espacios compartidos" compact={isMobile} />
            <MetricCard label="Eventos" value={loading ? "—" : String(totalEvents)} hint="Carga visible" compact={isMobile} />
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
              compact={isMobile}
            />
            <MetricCard
              label="Conflictos"
              value={loading ? "—" : String(conflictsNow)}
              hint="Pendientes"
              danger={conflictsNow > 0}
              compact={isMobile}
            />
          </div>
        </section>

        <section style={styles.sectionCardCompact}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionEyebrow}>Accesos principales</div>
              <h2 style={styles.sectionTitle}>Administra lo importante</h2>
            </div>
          </div>

          <div
            style={{
              ...styles.quickGrid,
              gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(4, minmax(0, 1fr))",
            }}
          >
            {adminActions.map((action) => (
              <button
                key={action.id}
                type="button"
                style={{
                  ...styles.quickCard,
                  ...(action.featured ? styles.quickCardFeatured : null),
                  ...(isMobile ? styles.quickCardCompact : null),
                }}
                onClick={() => router.push(action.href)}
              >
                <div style={{ ...styles.quickCardTop, ...(isMobile ? styles.quickCardTopCompact : null) }}>
                  <div style={{ ...styles.quickTitle, ...(isMobile ? styles.quickTitleCompact : null) }}>{action.title}</div>
                  {action.badge ? <span style={styles.quickBadge}>{action.badge}</span> : null}
                </div>
                <div style={{ ...styles.quickHint, ...(isMobile ? styles.quickHintCompact : null) }}>{action.hint}</div>
              </button>
            ))}
          </div>
        </section>

        <div
          style={{
            ...styles.mainGrid,
            gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.15fr) minmax(300px, 0.85fr)",
          }}
        >
          <div style={styles.leftCol}>
            <section style={styles.sectionCardCompact}>
              <div style={styles.sectionHead}>
                <div>
                  <div style={styles.sectionEyebrow}>Espacios compartidos</div>
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
                  copy="Aún no tienes grupos. Este es el mejor lugar para arrancar la coordinación compartida."
                  primaryLabel="Crear grupo"
                  onPrimary={() => router.push("/groups/new")}
                  secondaryLabel="Revisar invitaciones"
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
                  copy="Respuestas externas convertidas en acciones dentro del flujo."
                />
              ) : capturesLoading ? (
                <EmptyBlock copy="Buscando respuestas…" />
              ) : captures.length === 0 ? (
                <EmptyBlock copy="No hay respuestas pendientes." />
              ) : (
                <div style={styles.captureList}>
                  {captures.slice(0, isMobile ? 2 : 3).map((capture) => {
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
                            <div style={styles.listTitle}>{capture.event_title || "Evento"}</div>
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
                            <>
                              <button
                                type="button"
                                style={styles.primarySmallButton}
                                onClick={() => handleTakeCaptureProposal(capture)}
                              >
                                Aplicar
                              </button>
                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => openEventFromCapture(capture)}
                              >
                                Ver evento
                              </button>
                            </>
                          ) : hasProposal ? (
                            <>
                              <button
                                type="button"
                                style={styles.primarySmallButton}
                                onClick={() => handleReviewCapture(capture)}
                              >
                                Revisar
                              </button>
                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={() => handleRescheduleCapture(capture)}
                              >
                                Reprogramar
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

              {planInfo.tone === "free" ? (
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
                  <h2 style={styles.sectionTitle}>Conexiones</h2>
                </div>
              </div>

              {!canUseGoogleIntegration ? (
                <PremiumLock
                  title="Google Calendar conectado"
                  copy="Conecta calendarios externos cuando Premium ya tenga sentido para tu coordinación."
                />
              ) : (
                <>
                  <div style={styles.integrationCard}>
                    <div style={styles.integrationTop}>
                      <div>
                        <div style={styles.integrationTitle}>Google Calendar conectado</div>
                        <div style={styles.integrationLine}>{googleLine}</div>
                      </div>

                      <StatusPill label={googlePill.label} tone={googlePill.tone} />
                    </div>

                    {googleStatus?.error ? (
                      <div style={styles.integrationError}>{googleStatus.error}</div>
                    ) : null}

                    <div style={styles.integrationActions}>
                      <button
                        type="button"
                        style={styles.primarySmallButton}
                       onClick={() => router.push("/settings")}
                      >
                        {googlePrimaryCta}
                      </button>
                      {connectionState === "connected" ? (
                        <button
                          type="button"
                          style={styles.secondarySmallButton}
                          onClick={fetchGoogleEvents}
                        >
                          Actualizar snapshot
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div style={styles.googleSnapshot}>
                    <div style={styles.snapshotHead}>
                      <div style={styles.snapshotTitle}>Snapshot externo</div>
                      <div style={styles.snapshotMeta}>
                        {googleEventsLoading
                          ? "Cargando…"
                          : `${googleEvents.length} evento${googleEvents.length === 1 ? "" : "s"}`}
                      </div>
                    </div>

                    {googleEventsError ? (
                      <div style={styles.snapshotEmpty}>{googleEventsError}</div>
                    ) : googleEventsLoading ? (
                      <div style={styles.snapshotEmpty}>Leyendo eventos de Google…</div>
                    ) : googleEvents.length === 0 ? (
                      <div style={styles.snapshotEmpty}>Aún no hay eventos externos visibles.</div>
                    ) : (
                      <div style={styles.snapshotList}>
                        {googleEvents.slice(0, 3).map((event) => (
                          <div key={event.id} style={styles.snapshotItem}>
                            <div style={styles.snapshotItemTitle}>
                              {event.title || "Evento externo"}
                            </div>
                            <div style={styles.snapshotItemMeta}>
                              {formatExternalEventRange(event)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
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

              <div
                style={{
                  ...styles.contextGrid,
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                }}
              >
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
                        ...(active ? styles.contextCardActive : null),
                        ...(saving ? styles.contextCardBusy : null),
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
          </div>
        </div>
      </div>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    paddingBottom: 24,
  },
  errorBanner: {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(127,29,29,0.22)",
    color: "rgba(254,226,226,0.95)",
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 700,
  },
  heroCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "radial-gradient(1200px 620px at 20% -10%, rgba(56,189,248,0.10), transparent 60%), radial-gradient(900px 520px at 100% 0%, rgba(124,58,237,0.10), transparent 58%), rgba(10,15,30,0.78)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.28)",
    backdropFilter: "blur(16px)",
    padding: 16,
    display: "grid",
    gap: 14,
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  heroTextWrap: {
    minWidth: 0,
    flex: "1 1 420px",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
  },
  heroTitle: {
    margin: "8px 0 0",
    fontSize: "clamp(26px, 4vw, 38px)",
    lineHeight: 1.04,
    letterSpacing: "-0.04em",
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  heroCopy: {
    margin: "10px 0 0",
    maxWidth: 640,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  heroMicroCopy: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.66)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  heroActionStack: {
    display: "grid",
    gap: 10,
    minWidth: 220,
    flex: "0 0 220px",
  },
  heroActionStackMobile: {
    width: "100%",
    minWidth: 0,
    flex: "1 1 100%",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  primaryHeroCta: {
    minHeight: 48,
    borderRadius: 14,
    border: "1px solid rgba(96,165,250,0.30)",
    background: "rgba(59,130,246,0.18)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    padding: "0 16px",
  },
  secondaryHeroCta: {
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    padding: "0 16px",
  },
  heroAlert: {
    borderRadius: 16,
    border: "1px solid rgba(251,191,36,0.22)",
    background: "rgba(120,53,15,0.34)",
    padding: "12px 14px",
    display: "grid",
    gap: 4,
  },
  heroAlertEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(253,224,71,0.90)",
  },
  heroAlertText: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(255,247,205,0.92)",
    fontWeight: 700,
  },
  metricsGrid: {
    display: "grid",
    gap: 10,
  },
  metricCard: {
    display: "grid",
    gap: 6,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "14px 14px",
    minHeight: 90,
    minWidth: 0,
    overflow: "hidden",
  },
  metricCardCompact: {
    minHeight: 82,
    padding: "12px 12px",
  },
  metricLabelCompact: {
    fontSize: 11,
  },
  metricValueCompact: {
    fontSize: 21,
    lineHeight: 1.05,
  },
  metricHintCompact: {
    fontSize: 11,
    lineHeight: 1.35,
  },
  metricCardDanger: {
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(127,29,29,0.16)",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(255,255,255,0.72)",
    overflowWrap: "anywhere",
  },
  metricValue: {
    fontSize: 24,
    lineHeight: 1,
    fontWeight: 950,
    overflowWrap: "anywhere",
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  metricHint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.64)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  sectionCardCompact: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,15,30,0.76)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.24)",
    backdropFilter: "blur(14px)",
    padding: 16,
    display: "grid",
    gap: 14,
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.84)",
  },
  sectionTitle: {
    margin: "4px 0 0",
    fontSize: 20,
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.98)",
  },
  quickGrid: {
    display: "grid",
    gap: 10,
  },
  quickCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "grid",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
    minHeight: 110,
    minWidth: 0,
    overflow: "hidden",
  },
  quickCardCompact: {
    minHeight: 132,
    padding: 12,
  },
  quickCardFeatured: {
    border: "1px solid rgba(96,165,250,0.18)",
    background: "rgba(59,130,246,0.10)",
  },
  quickCardTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    alignItems: "flex-start",
  },
  quickCardTopCompact: {
    gap: 6,
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },
  quickTitleCompact: {
    fontSize: 14,
    lineHeight: 1.18,
  },
  quickHint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.70)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  quickHintCompact: {
    fontSize: 11,
    lineHeight: 1.35,
  },
  quickBadge: {
    minWidth: 22,
    maxWidth: "100%",
    height: 22,
    padding: "0 7px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 11,
    fontWeight: 900,
    flexShrink: 0,
  },
  mainGrid: {
    display: "grid",
    gap: 14,
    alignItems: "start",
  },
  leftCol: {
    display: "grid",
    gap: 14,
  },
  rightCol: {
    display: "grid",
    gap: 14,
  },
  ghostButton: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  listCompact: {
    display: "grid",
    gap: 10,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "12px 13px",
  },
  listCopyWrap: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  listTitle: {
    fontSize: 14,
    lineHeight: 1.35,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  listMeta: {
    fontSize: 12,
    lineHeight: 1.4,
    color: "rgba(226,232,240,0.66)",
    fontWeight: 700,
  },
  inlineLink: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },
  captureList: {
    display: "grid",
    gap: 10,
  },
  captureCardCompact: {
    display: "grid",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "12px 13px",
  },
  captureTopRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  captureHeaderCopy: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  captureSubline: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 700,
  },
  captureActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },
  statusPillNeutral: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
  },
  statusPillOk: {
    border: "1px solid rgba(74,222,128,0.22)",
    background: "rgba(20,83,45,0.84)",
    color: "rgba(220,252,231,0.98)",
  },
  statusPillWarn: {
    border: "1px solid rgba(251,191,36,0.22)",
    background: "rgba(120,53,15,0.84)",
    color: "rgba(254,243,199,0.98)",
  },
  statusPillBad: {
    border: "1px solid rgba(248,113,113,0.20)",
    background: "rgba(127,29,29,0.84)",
    color: "rgba(254,226,226,0.98)",
  },
  primarySmallButton: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.18)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  secondarySmallButton: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  pillActionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  pillAction: {
    minHeight: 40,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  pillBadge: {
    minWidth: 20,
    height: 20,
    padding: "0 6px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    fontSize: 10,
    fontWeight: 900,
  },
  contextHeroCompact: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
  contextHeroLeft: {
    minWidth: 0,
  },
  contextCurrentRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  contextCurrentDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    flexShrink: 0,
  },
  contextCurrentTextSmall: {
    fontSize: 18,
    fontWeight: 900,
    color: "rgba(255,255,255,0.97)",
  },
  contextInlineMeta: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.72)",
    fontSize: 11,
    fontWeight: 800,
  },
  contextGrid: {
    display: "grid",
    gap: 10,
  },
  contextCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 14,
    display: "grid",
    gap: 8,
    textAlign: "left",
    cursor: "pointer",
  },
  contextCardActive: {
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.10)",
    boxShadow: "0 0 0 1px rgba(59,130,246,0.18) inset",
  },
  contextCardBusy: {
    opacity: 0.7,
  },
  contextCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  contextCardDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  contextCardLabel: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  contextBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 8px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.24)",
    background: "rgba(59,130,246,0.16)",
    color: "rgba(219,234,254,0.98)",
    fontSize: 10,
    fontWeight: 900,
  },
  contextCardHint: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  planCard: {
    borderRadius: 22,
    background: "rgba(10,15,30,0.76)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.24)",
    backdropFilter: "blur(14px)",
    padding: 16,
    display: "grid",
    gap: 10,
  },
  planPill: {
    width: "fit-content",
    borderRadius: 999,
    padding: "6px 10px",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.94)",
    fontSize: 11,
    fontWeight: 900,
  },
  planTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  planCopy: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  planMiniNote: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 700,
  },
  primaryCta: {
    minHeight: 44,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    padding: "0 14px",
  },
  integrationCard: {
    display: "grid",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: "12px 13px",
  },
  integrationTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  integrationTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  integrationLine: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.70)",
    fontWeight: 700,
  },
  integrationError: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(254,226,226,0.96)",
    fontWeight: 700,
  },
  integrationActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  googleSnapshot: {
    display: "grid",
    gap: 10,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: "12px 13px",
  },
  snapshotHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  snapshotTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  snapshotMeta: {
    fontSize: 12,
    color: "rgba(226,232,240,0.66)",
    fontWeight: 700,
  },
  snapshotList: {
    display: "grid",
    gap: 8,
  },
  snapshotItem: {
    display: "grid",
    gap: 4,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.03)",
    padding: "10px 11px",
  },
  snapshotItemTitle: {
    fontSize: 13,
    fontWeight: 800,
    color: "rgba(255,255,255,0.94)",
  },
  snapshotItemMeta: {
    fontSize: 12,
    color: "rgba(226,232,240,0.64)",
    fontWeight: 700,
  },
  snapshotEmpty: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 700,
  },
  premiumLockCard: {
    borderRadius: 16,
    border: "1px solid rgba(196,181,253,0.18)",
    background: "rgba(76,29,149,0.18)",
    padding: "14px 14px",
    display: "grid",
    gap: 10,
  },
  premiumLockHeader: {
    display: "grid",
    gap: 8,
  },
  premiumLockBadge: {
    width: "fit-content",
    borderRadius: 999,
    padding: "5px 9px",
    border: "1px solid rgba(216,180,254,0.24)",
    background: "rgba(168,85,247,0.18)",
    color: "rgba(243,232,255,0.98)",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  premiumLockTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
  },
  premiumLockCopy: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(243,232,255,0.84)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  emptyBlock: {
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px 14px",
    display: "grid",
    gap: 12,
  },
  emptyCopy: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.70)",
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
  emptyActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  loadingBlock: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 12px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "rgba(56,189,248,0.95)",
    boxShadow: "0 0 0 8px rgba(56,189,248,0.10)",
    flexShrink: 0,
  },
  loadingTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.96)",
  },
  loadingSub: {
    fontSize: 12,
    color: "rgba(226,232,240,0.66)",
    marginTop: 2,
    fontWeight: 600,
    overflowWrap: "anywhere",
  },
};