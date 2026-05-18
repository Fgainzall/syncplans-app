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
import { getMyEventsInRange, type DbEventRow } from "@/lib/eventsDb";
import { getMyGroups, type GroupRow, getGroupTypeLabel } from "@/lib/groupsDb";
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

type RecommendedAction = {
  eyebrow: string;
  title: string;
  copy: string;
  label: string;
  href: string;
  tone: "default" | "warning" | "success";
};

type ControlArea = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  href: string;
  cta: string;
  meta: string;
  status?: {
    label: string;
    tone: "neutral" | "ok" | "warn" | "bad";
  };
};

type ActivationStep = {
  id: string;
  title: string;
  copy: string;
  href: string;
  cta: string;
  done: boolean;
  status: {
    label: string;
    tone: "neutral" | "ok" | "warn" | "bad";
  };
};

type DetailLink = {
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
  account?: {
    provider?: string | null;
    email?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
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
  {
    key: "solo",
    label: "Personal",
    hint: "Tu agenda individual",
    dot: "#FBBF24",
  },
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
  mode: UsageMode,
): Promise<string | null> {
  if (mode === "solo") return null;

  const { getActiveGroupIdFromDb, setActiveGroupIdInDb } =
    await import("@/lib/activeGroup");
  const { getMyGroups } = await import("@/lib/groupsDb");

  const existing = await getActiveGroupIdFromDb().catch(() => null);
  const groups = await getMyGroups();
  if (!groups.length) return null;

  const wantType = String(mode).toLowerCase();

  if (existing) {
    const current = (groups as PanelGroupLike[]).find(
      (g) => String(g.id) === String(existing),
    );
    const currentType = String(current?.type ?? "").toLowerCase();
    if (current && currentType === wantType) {
      return String(existing);
    }
  }

  const match = groups.find(
    (g: PanelGroupLike) => String(g.type ?? "").toLowerCase() === wantType,
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
            <button
              type="button"
              style={styles.primarySmallButton}
              onClick={onPrimary}
            >
              {primaryLabel}
            </button>
          ) : null}

          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              style={styles.secondarySmallButton}
              onClick={onSecondary}
            >
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


function buildPanelStatsWindow(): { startIso: string; endIso: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 30);

  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 90);

  return { startIso: start.toISOString(), endIso: end.toISOString() };
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
    null,
  );

  const [contextState, setContextState] = useState<GroupState>(() =>
    getGroupState(),
  );
  const [contextSaving, setContextSaving] = useState<UsageMode | null>(null);
  const [captures, setCaptures] = useState<PublicInviteCaptureItem[]>([]);
  const [capturesLoading, setCapturesLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const loadCore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const statsWindow = buildPanelStatsWindow();

      const [
        events,
        fetchedGroups,
        fetchedProfile,
        resolvedConflictMap,
        declinedEventIds,
      ] = await Promise.all([
        getMyEventsInRange(statsWindow.startIso, statsWindow.endIso).catch(
          () => [] as DbEventRow[]
        ),
        getMyGroups().catch(() => [] as GroupRow[]),
        getMyProfile().catch(() => null as Profile | null),
        getMyConflictResolutionsMap().catch(
          () => ({}) as Record<string, string>
        ),
        getMyDeclinedEventIds().catch(() => new Set<string>()),
      ]);

      setStats(
        buildDashboardStats(events, fetchedGroups, {
          resolvedConflictMap,
          declinedEventIds,
        }),
      );
      setGroups(fetchedGroups);
      setProfile(fetchedProfile);
    } catch (err: unknown) {
      console.error("Error cargando panel:", err);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar el panel. Intenta recargar.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCaptures = useCallback(async () => {
    try {
      setCapturesLoading(true);
      const rows = await getPendingPublicInviteCaptures(6).catch(
        () => [] as PublicInviteCaptureItem[],
      );
      setCaptures(rows.filter((capture) => capture.status === "rejected"));
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
          capture.token,
        )}`,
      );
    },
    [router],
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
        eventEnd.getTime() - eventStart.getTime(),
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
    [router],
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
    [router],
  );

  const openEventFromCapture = useCallback(
    (capture: PublicInviteCaptureItem) => {
      const params = new URLSearchParams();
      params.set("focus", "pending-responses");
      params.set("focusEventId", String(capture.event_id));

      router.push(`/events?${params.toString()}`);
    },
    [router],
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

      const json = (await res
        .json()
        .catch(() => null)) as GoogleStatusResponse | null;

      if (!res.ok || !json?.ok) {
        setGoogleStatus({
          ok: false,
          connected: false,
          connection_state: "disconnected",
          error:
            json?.error ||
            "No se pudo leer el estado de Google Calendar conectado.",
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

      const json = (await res
        .json()
        .catch(() => null)) as GoogleListResponse | null;

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
    } catch (err: unknown) {
      console.error("Error leyendo eventos de Google:", err);
      setGoogleEvents([]);
      setGoogleEventsError(
        err instanceof Error
          ? err.message
          : "Error inesperado al leer eventos de Google.",
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
  const tier = (profile?.plan_tier ?? "free") as PlanTier;
  const trialActive = isTrialActive(profile);
  const premiumActive = isPremiumUser(profile);
  const canUseCaptures = hasPremiumAccess(profile);
  const actionableCaptures = useMemo(
    () => captures.filter((capture) => capture.status === "rejected"),
    [captures],
  );
  const canUseGoogleIntegration = hasPremiumAccess(profile);

  const currentContextOption =
    CONTEXT_OPTIONS.find((x) => x.key === contextState.mode) ??
    CONTEXT_OPTIONS[0];

  const currentContextGroupName = normalizeGroupLabel(
    contextState.groupName ?? null,
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
      title: "Tu acceso actual",
      copy: "Tu base gratuita ya está activa. Premium entra cuando coordinar con otros ya pide más contexto, más visibilidad y menos desgaste.",
      cta: "Ver acceso",
      tone: "free" as PlanTone,
      supportingCopy: "Premium aparece cuando el sistema compartido crece.",
    };
  }, [premiumActive, tier, trialActive]);

  const groupsPreview = useMemo(
    () => groups.slice(0, isMobile ? 2 : 4),
    [groups, isMobile],
  );

  const googlePill = useMemo(() => {
    if (googleLoading) return { label: "Revisando", tone: "neutral" as const };
    if (connectionState === "connected")
      return { label: "Conectado", tone: "ok" as const };
    if (connectionState === "needs_reauth")
      return { label: "Reconectar", tone: "warn" as const };
    if (googleStatus && !googleStatus.ok)
      return { label: "Error", tone: "bad" as const };
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

  const pendingResponseFocusHref = useMemo(() => {
    const firstPendingCapture = actionableCaptures[0];
    const params = new URLSearchParams();

    params.set("focus", "pending-responses");

    if (firstPendingCapture?.event_id) {
      params.set("focusEventId", String(firstPendingCapture.event_id));
    }

    return `/events?${params.toString()}`;
  }, [actionableCaptures]);

  const recommendedAction = useMemo<RecommendedAction>(() => {
    if (conflictsNow > 0) {
      return {
        eyebrow: "Necesita decisión",
        title: `${conflictsNow} conflicto${conflictsNow === 1 ? "" : "s"} activo${conflictsNow === 1 ? "" : "s"}`,
        copy: "Resuelve los choques pendientes para mantener una sola versión clara de la agenda.",
        label: "Resolver conflictos",
        href: "/conflicts/detected",
        tone: "warning",
      };
    }

    if (totalGroups === 0) {
      return {
        eyebrow: "Primer salto de valor",
        title: "Crea tu primer espacio compartido",
        copy: "Crea un espacio para coordinar con otra persona sin depender del chat.",
        label: "Crear grupo",
        href: "/groups/new",
        tone: "default",
      };
    }

    if (actionableCaptures.length > 0 && canUseCaptures) {
      const firstPendingCapture = actionableCaptures[0];
      const planLabel = firstPendingCapture?.event_title
        ? `“${firstPendingCapture.event_title}”`
        : "un plan compartido";

      return {
        eyebrow: "Decisión pendiente",
        title: `${actionableCaptures.length} plan${actionableCaptures.length === 1 ? "" : "es"} necesita${actionableCaptures.length === 1 ? "" : "n"} revisión`,
        copy: `${planLabel} recibió una respuesta externa. Entra directo al plan para revisar qué pasó y decidir.`,
        label: "Revisar plan",
        href: pendingResponseFocusHref,
        tone: "warning",
      };
    }

    if (canUseGoogleIntegration && connectionState !== "connected") {
      return {
        eyebrow: "Más contexto real",
        title: "Conecta tu calendario externo",
        copy: "Conectar Google Calendar ayuda a detectar disponibilidad, choques y contexto antes de coordinar.",
        label: googlePrimaryCta,
        href: "/settings#integrations",
        tone: "default",
      };
    }

    return {
      eyebrow: "Todo listo",
      title: "Todo listo para coordinar",
      copy: "Tu estructura está configurada. Vuelve a Resumen para operar tu día o ajusta un área cuando haga falta.",
      label: "Abrir resumen",
      href: "/summary",
      tone: "success",
    };
  }, [
    actionableCaptures,
    canUseCaptures,
    canUseGoogleIntegration,
    conflictsNow,
    connectionState,
    googlePrimaryCta,
    pendingResponseFocusHref,
    totalGroups,
  ]);

  const activationSteps = useMemo<ActivationStep[]>(() => {
    const hasGroups = totalGroups > 0;
    const hasEvents = totalEvents > 0;
    const googleConnected = connectionState === "connected";
    const hasOpenConflicts = conflictsNow > 0;

    return [
      {
        id: "space",
        title: "Espacio compartido",
        copy: hasGroups
          ? "Ya tienes una base para coordinar con otras personas."
          : "Crea un espacio para que SyncPlans deje de ser solo tu calendario y empiece a coordinar contigo.",
        href: hasGroups ? "/groups" : "/groups/new",
        cta: hasGroups ? "Gestionar" : "Crear grupo",
        done: hasGroups,
        status: {
          label: hasGroups ? "Listo" : "Pendiente",
          tone: hasGroups ? "ok" : "warn",
        },
      },
      {
        id: "plan",
        title: "Primer plan real",
        copy: hasEvents
          ? "Ya hay planes para que el sistema detecte contexto, prioridades y posibles choques."
          : "Crea un plan concreto desde Resumen para que el valor se vea en menos de un minuto.",
        href: "/summary",
        cta: hasEvents ? "Abrir resumen" : "Crear plan",
        done: hasEvents,
        status: {
          label: hasEvents ? "Activo" : "Siguiente",
          tone: hasEvents ? "ok" : "neutral",
        },
      },
      {
        id: "calendar",
        title: "Contexto externo",
        copy: googleConnected
          ? "Google Calendar ya aporta contexto para detectar choques y disponibilidad con menos trabajo manual."
          : "Conectar Google ayuda a que SyncPlans detecte más contexto sin pedirte que dupliques tu agenda.",
        href: "/settings#integrations",
        cta: googleConnected ? "Gestionar" : googlePrimaryCta,
        done: googleConnected,
        status: {
          label: googleConnected ? "Conectado" : "Opcional",
          tone: googleConnected ? "ok" : "neutral",
        },
      },
      {
        id: "clarity",
        title: "Choques bajo control",
        copy: hasOpenConflicts
          ? "Hay decisiones abiertas. Resolverlas mantiene una sola verdad compartida."
          : "No hay choques activos en la ventana principal. La coordinación está clara por ahora.",
        href: hasOpenConflicts ? "/conflicts/detected" : "/calendar",
        cta: hasOpenConflicts ? "Resolver" : "Ver calendario",
        done: !hasOpenConflicts,
        status: {
          label: hasOpenConflicts ? "Revisar" : "Claro",
          tone: hasOpenConflicts ? "warn" : "ok",
        },
      },
    ];
  }, [
    conflictsNow,
    connectionState,
    googlePrimaryCta,
    totalEvents,
    totalGroups,
  ]);

  const activationCompleted = activationSteps.filter((step) => step.done).length;
  const activationReady = activationCompleted === activationSteps.length;
  const showRecommendedAction = recommendedAction.tone !== "success";
  const activationCopy = activationReady
    ? "4/4 bases activas. El setup ya no compite con la operación diaria."
    : "Completa estas bases para que SyncPlans tenga más contexto y pueda ayudarte con menos fricción.";

  const statusChips = useMemo(
    () => [
      {
        label: `${activationCompleted}/${activationSteps.length} bases`,
        tone: activationReady ? ("ok" as const) : ("warn" as const),
      },
      {
        label: showContextGroupName
          ? `${currentContextOption.label} · ${showContextGroupName}`
          : currentContextOption.label,
        tone: "neutral" as const,
      },
      {
        label: `${totalGroups} espacio${totalGroups === 1 ? "" : "s"}`,
        tone: totalGroups > 0 ? ("ok" as const) : ("neutral" as const),
      },
      googlePill,
      {
        label: planInfo.pill,
        tone:
          planInfo.tone === "free"
            ? ("neutral" as const)
            : planInfo.tone === "trial"
              ? ("warn" as const)
              : ("ok" as const),
      },
    ],
    [
      activationCompleted,
      activationReady,
      activationSteps.length,
      currentContextOption.label,
      googlePill,
      planInfo.pill,
      planInfo.tone,
      showContextGroupName,
      totalGroups,
    ],
  );

  const controlAreas = useMemo<ControlArea[]>(
    () => [
      {
        id: "people",
        eyebrow: "Personas",
        title: "Personas y grupos",
        copy: "Espacios, miembros e invitaciones.",
        href: "/groups",
        cta: totalGroups === 0 ? "Crear espacio" : "Gestionar",
        meta:
          totalGroups === 0
            ? "Sin grupos"
            : `${totalGroups} activo${totalGroups === 1 ? "" : "s"}`,
        status: {
          label: totalGroups === 0 ? "Pendiente" : "Activo",
          tone: totalGroups === 0 ? "neutral" : "ok",
        },
      },
      {
        id: "calendar",
        eyebrow: "Contexto",
        title: "Calendarios e integraciones",
        copy: "Google Calendar y contexto externo.",
        href: "/settings#integrations",
        cta: googlePrimaryCta,
        meta:
          connectionState === "connected"
            ? "Google conectado"
            : connectionState === "needs_reauth"
              ? "Requiere reconexión"
              : "Por conectar",
        status: googlePill,
      },
      {
        id: "mobility",
        eyebrow: "Llegada",
        title: "Movilidad inteligente",
        copy: "Rutas, Maps/Waze y alertas de salida.",
        href: "/settings#mobility",
        cta: "Configurar",
        meta: "Rutas y alertas",
        status: { label: "Opcional", tone: "neutral" },
      },
      {
        id: "account",
        eyebrow: "Perfil",
        title: "Perfil y plan",
        copy: "Perfil, preferencias y acceso Premium.",
        href: "/profile",
        cta: "Ver perfil",
        meta: planInfo.pill === "Free" ? "Acceso Free" : `${planInfo.pill} activo`,
        status: {
          label: planInfo.pill,
          tone:
            planInfo.tone === "free"
              ? "neutral"
              : planInfo.tone === "trial"
                ? "warn"
                : "ok",
        },
      },
    ],
    [
      connectionState,
      googlePill,
      googlePrimaryCta,
      planInfo.pill,
      planInfo.tone,
      totalGroups,
    ],
  );

  const detailLinks = useMemo<DetailLink[]>(
    () => [
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
      { id: "members", label: "Miembros", href: "/members" },
      {
        id: "invitations",
        label: "Invitaciones",
        href: "/invitations",
        badge: actionableCaptures.length > 0 ? `${actionableCaptures.length}` : undefined,
      },
      { id: "settings", label: "Ajustes", href: "/settings" },
      { id: "plans", label: "Planes", href: "/planes" },
      { id: "operations", label: "Operaciones", href: "/panel/operations" },
    ],
    [actionableCaptures.length, conflictsNow, totalEvents],
  );

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
      <MobileScaffold maxWidth={1180}>
        <PremiumHeader
          title="Panel"
          subtitle="Preparando tu Panel."
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
    <MobileScaffold maxWidth={1180}>
      <PremiumHeader
        title="Panel"
        subtitle={
          isMobile
            ? "Gestiona lo importante sin ruido."
            : "Grupos, calendarios, movilidad y perfil en un solo lugar."
        }
      />

      <div style={styles.stack}>
        {error ? <div style={styles.errorBanner}>{error}</div> : null}

        <section style={styles.commandCard}>
          <div
            style={{
              ...styles.commandTopRow,
              gridTemplateColumns: isMobile || !showRecommendedAction
                ? "1fr"
                : "minmax(0, 1fr) minmax(260px, 340px)",
            }}
          >
            <div style={styles.commandTextWrap}>
              <div style={styles.eyebrow}>Panel</div>
              <h1 style={styles.commandTitle}>Administra SyncPlans</h1>
              <p style={styles.commandCopy}>
                Personas, calendarios, movilidad y perfil en un solo lugar.
                Lo operativo vive en Resumen, Calendario y Eventos.
              </p>
            </div>

            {showRecommendedAction ? (
              <div
                style={{
                  ...styles.recommendedCard,
                  ...(recommendedAction.tone === "warning"
                    ? styles.recommendedCardWarning
                    : null),
                }}
              >
                <div style={styles.recommendedEyebrow}>
                  {recommendedAction.eyebrow}
                </div>
                <div style={styles.recommendedTitle}>
                  {recommendedAction.title}
                </div>
                <div style={styles.recommendedCopy}>{recommendedAction.copy}</div>
                <button
                  type="button"
                  style={styles.primaryHeroCta}
                  onClick={() => router.push(recommendedAction.href)}
                >
                  {recommendedAction.label}
                </button>
              </div>
            ) : null}
          </div>

          <div style={styles.statusStrip}>
            {statusChips.map((chip) => (
              <StatusPill
                key={`${chip.label}-${chip.tone}`}
                label={chip.label}
                tone={chip.tone}
              />
            ))}
          </div>

          {activationReady ? (
            <div style={styles.readyStrip}>
              <div style={styles.readyStripCopy}>
                <strong>✓ Todo listo</strong>
                <span>4/4 bases activas. Usa Resumen para operar el día y vuelve aquí solo para ajustar.</span>
              </div>
              <button
                type="button"
                style={styles.readyStripButton}
                onClick={() => router.push("/summary")}
              >
                Resumen
              </button>
            </div>
          ) : null}
        </section>

        {!activationReady ? (
          <section style={styles.sectionCardCompact}>
          <div style={styles.activationHead}>
            <div style={styles.activationSummary}>
              <div style={styles.sectionEyebrow}>Activación inteligente</div>
              <h2 style={styles.sectionTitle}>Completa la base mínima</h2>
              <p style={styles.detailsIntro}>{activationCopy}</p>
            </div>

            <div style={styles.activationScoreWrap}>
              <StatusPill
                label={`${activationCompleted}/${activationSteps.length} listo${activationCompleted === 1 ? "" : "s"}`}
                tone={activationReady ? "ok" : "warn"}
              />
            </div>
          </div>

          <div
            style={{
              ...styles.activationGrid,
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(4, minmax(0, 1fr))",
            }}
          >
            {activationSteps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                style={{
                  ...styles.activationStepCard,
                  ...(step.done ? styles.activationStepCardDone : null),
                }}
                onClick={() => router.push(step.href)}
              >
                <div style={styles.activationStepTop}>
                  <span
                    style={{
                      ...styles.activationStepIndex,
                      ...(step.done ? styles.activationStepIndexDone : null),
                    }}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <StatusPill
                    label={step.status.label}
                    tone={step.status.tone}
                  />
                </div>

                <div style={styles.activationStepTitle}>{step.title}</div>
                <div style={styles.activationStepCopy}>{step.copy}</div>

                <div style={styles.activationStepCta}>{step.cta}</div>
              </button>
            ))}
          </div>
        </section>
        ) : null}

        <section style={styles.sectionCardCompact}>
          <div style={styles.sectionHead}>
            <div>
              <div style={styles.sectionEyebrow}>Áreas principales</div>
              <h2 style={styles.sectionTitle}>Cuatro puertas, sin ruido</h2>
            </div>
          </div>

          <div
            style={{
              ...styles.controlGrid,
              gridTemplateColumns: isMobile
                ? "1fr"
                : "repeat(2, minmax(0, 1fr))",
            }}
          >
            {controlAreas.map((area) => (
              <button
                key={area.id}
                type="button"
                style={styles.controlCard}
                onClick={() => router.push(area.href)}
              >
                <div style={styles.controlCardTop}>
                  <div>
                    <div style={styles.controlEyebrow}>{area.eyebrow}</div>
                    <div style={styles.controlTitle}>{area.title}</div>
                  </div>
                  {area.status ? (
                    <StatusPill
                      label={area.status.label}
                      tone={area.status.tone}
                    />
                  ) : null}
                </div>

                <div style={styles.controlCopy}>{area.copy}</div>

                <div style={styles.controlFooter}>
                  <span style={styles.controlMeta}>{area.meta}</span>
                  <span style={styles.controlCta}>{area.cta}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={styles.sectionCardCompact}>
          <div style={styles.detailsHeadRow}>
            <div>
              <div style={styles.sectionEyebrow}>Más opciones</div>
              <h2 style={styles.sectionTitle}>Detalles avanzados</h2>
              <p style={styles.detailsIntro}>
                Operaciones, respuestas, integraciones y contexto activo quedan plegados para no ensuciar el Panel.
              </p>
            </div>

            <button
              type="button"
              style={styles.ghostButton}
              onClick={() => setShowDetails((value) => !value)}
            >
              {showDetails ? "Ocultar" : "Ver detalles"}
            </button>
          </div>

          {showDetails ? (
            <div style={styles.detailsStack}>
              <div style={styles.detailLinksGrid}>
                {detailLinks.map((link) => (
                  <button
                    key={link.id}
                    type="button"
                    style={styles.pillAction}
                    onClick={() => router.push(link.href)}
                  >
                    <span>{link.label}</span>
                    {link.badge ? (
                      <span style={styles.pillBadge}>{link.badge}</span>
                    ) : null}
                  </button>
                ))}
              </div>

              <div
                style={{
                  ...styles.mainGrid,
                  gridTemplateColumns: isMobile
                    ? "1fr"
                    : "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
                }}
              >
                <div style={styles.leftCol}>
                  <section style={styles.subPanelCard}>
                    <div style={styles.sectionHead}>
                      <div>
                        <div style={styles.sectionEyebrow}>Personas</div>
                        <h3 style={styles.subPanelTitle}>Espacios recientes</h3>
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
                        copy="Aún no tienes grupos. Empieza por crear uno o revisar si tienes invitaciones pendientes."
                        primaryLabel="Crear grupo"
                        onPrimary={() => router.push("/groups/new")}
                        secondaryLabel="Invitaciones"
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

                  <section style={styles.subPanelCard}>
                    <div style={styles.sectionHead}>
                      <div>
                        <div style={styles.sectionEyebrow}>Respuestas</div>
                        <h3 style={styles.subPanelTitle}>
                          Bandeja de coordinación
                        </h3>
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
                    ) : actionableCaptures.length === 0 ? (
                      <EmptyBlock copy="No hay respuestas pendientes." />
                    ) : (
                      <div style={styles.captureList}>
                        {actionableCaptures.slice(0, isMobile ? 2 : 3).map((capture) => {
                          const hasProposal = Boolean(capture.proposed_date);
                          const statusTone =
                            capture.status === "accepted"
                              ? "ok"
                              : hasProposal
                                ? "warn"
                                : "bad";

                          return (
                            <div
                              key={capture.invite_id}
                              style={styles.captureCardCompact}
                            >
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
                                  <>
                                    <button
                                      type="button"
                                      style={styles.primarySmallButton}
                                      onClick={() =>
                                        handleTakeCaptureProposal(capture)
                                      }
                                    >
                                      Aplicar
                                    </button>
                                    <button
                                      type="button"
                                      style={styles.secondarySmallButton}
                                      onClick={() =>
                                        openEventFromCapture(capture)
                                      }
                                    >
                                      Ver evento
                                    </button>
                                  </>
                                ) : hasProposal ? (
                                  <>
                                    <button
                                      type="button"
                                      style={styles.primarySmallButton}
                                      onClick={() =>
                                        handleReviewCapture(capture)
                                      }
                                    >
                                      Revisar
                                    </button>
                                    <button
                                      type="button"
                                      style={styles.secondarySmallButton}
                                      onClick={() =>
                                        handleRescheduleCapture(capture)
                                      }
                                    >
                                      Reprogramar
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    style={styles.primarySmallButton}
                                    onClick={() =>
                                      handleRescheduleCapture(capture)
                                    }
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
                  <section style={styles.subPanelCard}>
                    <div style={styles.sectionHead}>
                      <div>
                        <div style={styles.sectionEyebrow}>Integraciones</div>
                        <h3 style={styles.subPanelTitle}>Google Calendar</h3>
                      </div>
                    </div>

                    {!canUseGoogleIntegration ? (
                      <PremiumLock
                        title="Google Calendar"
                        copy="Conecta calendarios externos cuando Premium ya tenga sentido para tu coordinación."
                      />
                    ) : (
                      <>
                        <div style={styles.integrationCard}>
                          <div style={styles.integrationTop}>
                            <div>
                              <div style={styles.integrationTitle}>
                                Estado de conexión
                              </div>
                              <div style={styles.integrationLine}>
                                {googleLine}
                              </div>
                            </div>

                            <StatusPill
                              label={googlePill.label}
                              tone={googlePill.tone}
                            />
                          </div>

                          {googleStatus?.error ? (
                            <div style={styles.integrationError}>
                              {googleStatus.error}
                            </div>
                          ) : null}

                          <div style={styles.integrationActions}>
                            <button
                              type="button"
                              style={styles.primarySmallButton}
                              onClick={() => router.push("/settings#integrations")}
                            >
                              {googlePrimaryCta}
                            </button>
                            {connectionState === "connected" ? (
                              <button
                                type="button"
                                style={styles.secondarySmallButton}
                                onClick={fetchGoogleEvents}
                              >
                                Actualizar
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div style={styles.googleSnapshot}>
                          <div style={styles.snapshotHead}>
                            <div style={styles.snapshotTitle}>
                              Eventos externos
                            </div>
                            <div style={styles.snapshotMeta}>
                              {googleEventsLoading
                                ? "Cargando…"
                                : `${googleEvents.length} evento${googleEvents.length === 1 ? "" : "s"}`}
                            </div>
                          </div>

                          {googleEventsError ? (
                            <div style={styles.snapshotEmpty}>
                              {googleEventsError}
                            </div>
                          ) : googleEventsLoading ? (
                            <div style={styles.snapshotEmpty}>
                              Leyendo eventos externos…
                            </div>
                          ) : googleEvents.length === 0 ? (
                            <div style={styles.snapshotEmpty}>
                              No hay eventos externos visibles por ahora.
                            </div>
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

                  <section style={styles.subPanelCard}>
                    <div style={styles.sectionHead}>
                      <div>
                        <div style={styles.sectionEyebrow}>Modo</div>
                        <h3 style={styles.subPanelTitle}>Contexto activo</h3>
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
                            <span style={styles.contextInlineMeta}>
                              {showContextGroupName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        ...styles.contextGrid,
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : "repeat(3, minmax(0, 1fr))",
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
                              <span style={styles.contextCardLabel}>
                                {option.label}
                              </span>
                              {active ? (
                                <span style={styles.contextBadge}>Activo</span>
                              ) : null}
                            </div>

                            <div style={styles.contextCardHint}>
                              {option.hint}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </MobileScaffold>
  );
}

const styles: Record<string, CSSProperties> = {
  commandCard: {
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.08)",
    background:
      "radial-gradient(1000px 520px at 18% -14%, rgba(56,189,248,0.12), transparent 62%), radial-gradient(720px 420px at 100% 0%, rgba(124,58,237,0.12), transparent 58%), rgba(10,15,30,0.80)",
    boxShadow: "0 22px 70px rgba(0,0,0,0.30)",
    backdropFilter: "blur(16px)",
    padding: 14,
    display: "grid",
    gap: 8,
  },
  commandTopRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 340px)",
    gap: 14,
    alignItems: "stretch",
  },
  commandTextWrap: {
    minWidth: 0,
    display: "grid",
    alignContent: "center",
  },
  commandTitle: {
    margin: "6px 0 0",
    fontSize: "clamp(28px, 3.5vw, 38px)",
    lineHeight: 1.02,
    letterSpacing: "-0.045em",
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
  },
  commandCopy: {
    margin: "8px 0 0",
    maxWidth: 560,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 650,
    overflowWrap: "anywhere",
  },
  recommendedCard: {
    borderRadius: 22,
    border: "1px solid rgba(96,165,250,0.22)",
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.22), rgba(15,23,42,0.68))",
    padding: 13,
    display: "grid",
    gap: 8,
    alignContent: "start",
    boxShadow: "0 18px 46px rgba(0,0,0,0.22)",
  },
  recommendedCardWarning: {
    border: "1px solid rgba(251,191,36,0.26)",
    background:
      "linear-gradient(135deg, rgba(120,53,15,0.42), rgba(15,23,42,0.74))",
  },
  recommendedCardSuccess: {
    border: "1px solid rgba(34,197,94,0.24)",
    background:
      "linear-gradient(135deg, rgba(20,83,45,0.38), rgba(15,23,42,0.74))",
  },
  recommendedEyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(191,219,254,0.92)",
  },
  recommendedTitle: {
    fontSize: 18,
    lineHeight: 1.14,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  recommendedCopy: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.76)",
    fontWeight: 650,
  },
  statusStrip: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  readyStrip: {
    borderRadius: 18,
    border: "1px solid rgba(34,197,94,0.20)",
    background: "linear-gradient(135deg, rgba(20,83,45,0.26), rgba(15,23,42,0.58))",
    padding: "10px 12px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  readyStripCopy: {
    minWidth: 0,
    display: "grid",
    gap: 2,
    color: "rgba(220,252,231,0.94)",
    fontSize: 12,
    lineHeight: 1.35,
    fontWeight: 700,
  },
  readyStripButton: {
    minHeight: 32,
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.20)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(240,249,255,0.98)",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    padding: "0 12px",
  },
  activationHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  activationSummary: {
    minWidth: 0,
    flex: "1 1 520px",
  },
  activationScoreWrap: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  activationGrid: {
    display: "grid",
    gap: 10,
  },
  activationStepCard: {
    minHeight: 126,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.085)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.052), rgba(255,255,255,0.026))",
    padding: 12,
    display: "grid",
    gap: 8,
    textAlign: "left",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    boxShadow: "0 14px 38px rgba(0,0,0,0.16)",
  },
  activationStepCardDone: {
    border: "1px solid rgba(34,197,94,0.20)",
    background:
      "linear-gradient(180deg, rgba(34,197,94,0.09), rgba(255,255,255,0.026))",
  },
  activationStepTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  activationStepIndex: {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(125,211,252,0.24)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(224,242,254,0.98)",
    fontSize: 12,
    fontWeight: 950,
  },
  activationStepIndexDone: {
    border: "1px solid rgba(34,197,94,0.28)",
    background: "rgba(34,197,94,0.12)",
    color: "rgba(220,252,231,0.98)",
  },
  activationStepTitle: {
    fontSize: 15,
    lineHeight: 1.14,
    fontWeight: 950,
    letterSpacing: "-0.025em",
    color: "rgba(255,255,255,0.98)",
  },
  activationStepCopy: {
    fontSize: 11,
    lineHeight: 1.42,
    color: "rgba(226,232,240,0.68)",
    fontWeight: 650,
    overflowWrap: "anywhere",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  activationStepCta: {
    alignSelf: "end",
    justifySelf: "start",
    display: "inline-flex",
    minHeight: 32,
    alignItems: "center",
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.18)",
    background: "rgba(56,189,248,0.09)",
    color: "rgba(240,249,255,0.96)",
    fontSize: 12,
    fontWeight: 950,
  },
  controlGrid: {
    display: "grid",
    gap: 12,
  },
  controlCard: {
    minHeight: 118,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.026))",
    padding: 16,
    display: "grid",
    gap: 12,
    textAlign: "left",
    cursor: "pointer",
    color: "rgba(255,255,255,0.94)",
    boxShadow: "0 16px 46px rgba(0,0,0,0.18)",
  },
  controlCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  controlEyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.84)",
  },
  controlTitle: {
    marginTop: 4,
    fontSize: 18,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  controlCopy: {
    fontSize: 12,
    lineHeight: 1.4,
    color: "rgba(226,232,240,0.72)",
    fontWeight: 650,
  },
  controlFooter: {
    alignSelf: "end",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  controlMeta: {
    minWidth: 0,
    fontSize: 12,
    lineHeight: 1.4,
    color: "rgba(226,232,240,0.62)",
    fontWeight: 750,
    overflowWrap: "anywhere",
  },
  controlCta: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.20)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(240,249,255,0.98)",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  detailsHeadRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  detailsIntro: {
    margin: "7px 0 0",
    maxWidth: 660,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.66)",
    fontWeight: 650,
  },
  detailsStack: {
    display: "grid",
    gap: 14,
  },
  detailLinksGrid: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  subPanelCard: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.032)",
    padding: 14,
    display: "grid",
    gap: 13,
  },
  subPanelTitle: {
    margin: "4px 0 0",
    fontSize: 18,
    lineHeight: 1.16,
    fontWeight: 930,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.98)",
  },

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
    gap: 13,
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
    padding: 14,
    display: "grid",
    gap: 12,
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