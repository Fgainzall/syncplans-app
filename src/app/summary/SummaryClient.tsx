// src/app/summary/SummaryClient.tsx
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PremiumHeader from "@/components/PremiumHeader";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import SummaryQuickCaptureCard, {
  type CaptureIntelligence,
} from "./SummaryQuickCaptureCard";
import { parseQuickCapture } from "@/lib/quickCaptureParser";
import { getDisplayName, getMyProfile, type Profile } from "@/lib/profilesDb";
import { filterOutDeclinedEvents } from "@/lib/eventResponsesDb";
import {
  getSuggestedTimeSlots,
  getSuggestionContextLabel,
} from "@/lib/timeSuggestions";
import supabase from "@/lib/supabaseClient";
import {
  findLearnedPlaceMatch,
  getLearningSignals,
  type PlaceMemoryEvent,
} from "@/lib/learningSignals";
import { buildLearnedTimeProfile } from "@/lib/learningProfile";
import type { LearnedTimeProfile } from "@/lib/learningTypes";
import { getEventStatusUi } from "@/lib/eventStatusUi";
import {
  getEventAudienceLabel,
  isGoogleEventWithExternalGuests,
} from "@/lib/naming";
import { trackEvent, trackScreenView } from "@/lib/analytics";
import {
  getPremiumContextCopy,
  hasPremiumAccess,
  type PremiumContextKey,
} from "@/lib/premium";
import {
  computeVisibleConflicts,
  filterIgnoredConflicts,
  type CalendarEvent,
  type GroupType,
} from "@/lib/conflicts";
import { useSummaryData } from "./useSummaryData";
import {
  getMyInvitations,
  getPendingPublicInviteCaptures,
} from "@/lib/invitationsDb";
const LocationPermissionPrompt = dynamic(
  () => import("@/components/location/LocationPermissionPrompt"),
  { ssr: false, loading: () => null }
);

const SmartMobilityCard = dynamic(() => import("./SmartMobilityCard"), {
  ssr: false,
  loading: () => null,
});
import {
  addDays,
  buildCaptureShareUrl,
  buildConflictAlert,
  buildProposalLine,
  buildShareToastLabel,
  buildSmartInterpretation,
  buildWhatsAppShareText,
  canUseClipboard,
  cleanTemporalNoise,
  eventOverlapsWindow,
  fmtDay,
  fmtTime,
  formatQuickCapturePreview,
  getQuickCaptureExamples,
  getSmartInterpretationLabel,
  getSummaryActivationState,
  getUnifiedEventStatus,
  getWeekMoodLabel,
  getWeekSubtitle,
  humanGroupName,
  humanizeRelativeDate,
  normalizeEvent,
  normalizeSummaryGroupType,
  proposalResponseLabel,
  proposalResponseTone,
  resolutionForConflict,
  startOfTodayLocal,
  type SummaryEvent,
} from "./summaryHelpers";

type Props = {
  highlightId: string | null;
  appliedToast: string | null;
};

type PrimaryAction = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel: string;
  secondaryAction: () => void;
};

type QuickAction = {
  key: string;
  title: string;
  subtitle: string;
  onClick: () => void;
};

type PremiumNudge = {
  context: PremiumContextKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel: string;
};

type ProposalBadge = {
  label: string;
  tone: "pending" | "accepted" | "adjusted" | "neutral";
};

type StatusBadge = {
  label: string;
  style: CSSProperties;
};

type NextMoveTone = "calm" | "info" | "warning" | "danger";

type NextMove = {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  tone: NextMoveTone;
  priorityLabel: string;
  rationale: string;
  onClick: () => void;
};

type DayStatus = {
  eyebrow: string;
  title: string;
  subtitle: string;
  pills: string[];
};

function formatMoveMinutes(totalMinutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(totalMinutes ?? 0)));

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

const QC_MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function formatCaptureDateLabel(date: Date): string {
  const day = date.getDate();
  const month = QC_MONTHS_SHORT[date.getMonth()] ?? "";
  return `${day} ${month}`.trim();
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatCaptureDateRangeLabel(start: Date, end: Date): string {
  const startLabel = formatCaptureDateLabel(start);
  const endLabel = formatCaptureDateLabel(end);
  return `${startLabel} – ${endLabel}`;
}

function formatCaptureTimeLabel(hour: number, minutes: number): string {
  const date = new Date();
  date.setHours(hour, minutes, 0, 0);

  return date.toLocaleTimeString("es-PE", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCaptureDurationLabel(minutes: number): string {
  const safeMinutes = Math.max(1, Math.round(minutes));

  if (safeMinutes >= 1440) {
    const days = Math.max(1, Math.round(safeMinutes / 1440));
    return days === 1 ? "1 día" : `${days} días`;
  }

  if (safeMinutes < 60) return `${safeMinutes} min`;

  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;

  if (remaining === 0) return `${hours} h`;
  return `${hours} h ${remaining} min`;
}

function compactList(items: string[], limit = 2): string {
  const cleaned = items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  if (cleaned.length <= limit) return cleaned.join(", ");

  return `${cleaned.slice(0, limit).join(", ")} +${cleaned.length - limit}`;
}

function useIsMobileWidth(maxWidth = 520) {
  const query = `(max-width: ${maxWidth}px)`;

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => undefined;

      const mq = window.matchMedia(query);

      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onStoreChange);
        return () => mq.removeEventListener("change", onStoreChange);
      }

      mq.addListener(onStoreChange);
      return () => mq.removeListener(onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function toneBadgeStyle(tone: "pending" | "accepted" | "adjusted" | "neutral"): CSSProperties {
  if (tone === "accepted") {
    return {
      border: "1px solid rgba(52,211,153,0.24)",
      background: "rgba(52,211,153,0.12)",
      color: "rgba(209,250,229,0.96)",
    };
  }

  if (tone === "adjusted") {
    return {
      border: "1px solid rgba(56,189,248,0.24)",
      background: "rgba(56,189,248,0.12)",
      color: "rgba(224,242,254,0.96)",
    };
  }

  if (tone === "neutral") {
    return {
      border: "1px solid rgba(148,163,184,0.22)",
      background: "rgba(148,163,184,0.10)",
      color: "rgba(226,232,240,0.92)",
    };
  }

  return {
    border: "1px solid rgba(251,191,36,0.25)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.95)",
  };
}

function SummaryToast({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div style={styles.toastWrap}>
      <div style={styles.toastCard}>
        <div style={styles.toastTitle}>{title}</div>
        {subtitle ? <div style={styles.toastSub}>{subtitle}</div> : null}
      </div>
    </div>
  );
}

function SummaryHero({
  compact,
  contextLabel,
  moodTitle,
  moodSubtitle,
  upcomingTotal,
  upcomingPersonal,
  upcomingGroup,
  upcomingExternal,
  conflictCount,
  pendingInviteCount,
  loading,
  primaryAction,
  onOpenConflicts,
  onOpenInvitations,
}: {
  compact: boolean;
  contextLabel: string;
  moodTitle: string;
  moodSubtitle: string;
  upcomingTotal: number;
  upcomingPersonal: number;
  upcomingGroup: number;
  upcomingExternal: number;
  conflictCount: number;
  pendingInviteCount: number;
  loading: boolean;
  primaryAction: PrimaryAction;
  onOpenConflicts: () => void;
  onOpenInvitations: () => void;
}) {
  return (
    <Card style={styles.heroCard}>
      <div style={styles.heroTopRow}>
        <div style={{ minWidth: 0, flex: "1 1 440px" }}>
          <div style={styles.heroEyebrow}>Hoy en SyncPlans</div>
          <div style={styles.heroTitle}>{primaryAction.title}</div>
          <div style={styles.heroSubtitle}>{primaryAction.subtitle}</div>
        </div>

        <div style={styles.heroActions}>
          <button type="button" onClick={primaryAction.primaryAction} style={styles.heroPrimaryBtn}>
            {primaryAction.primaryLabel}
          </button>
          <button
            type="button"
            onClick={primaryAction.secondaryAction}
            style={styles.heroSecondaryBtn}
          >
            {primaryAction.secondaryLabel}
          </button>
        </div>
      </div>

      <div style={styles.heroMetaRow}>
        <span style={styles.metaPill}>{contextLabel}</span>
        <span style={styles.metaPillSoft}>
          {upcomingTotal} evento{upcomingTotal === 1 ? "" : "s"} en 7 días
        </span>

        {conflictCount > 0 ? (
          <button type="button" onClick={onOpenConflicts} style={styles.metaPillWarning}>
            {conflictCount} conflicto{conflictCount === 1 ? "" : "s"}
          </button>
        ) : null}

        {pendingInviteCount > 0 ? (
          <button type="button" onClick={onOpenInvitations} style={styles.metaPillInfo}>
            {pendingInviteCount} invitación{pendingInviteCount === 1 ? "" : "es"}
          </button>
        ) : null}

        {loading ? <span style={styles.metaPillInfo}>Actualizando…</span> : null}
      </div>

      <div style={styles.heroBottomRow}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.heroMoodTitle}>{moodTitle}</div>
          <div style={styles.heroMoodSubtitle}>{moodSubtitle}</div>
          {!compact ? (
            <div style={styles.heroStatsRow}>
              <span style={styles.heroStat}>{upcomingTotal} total</span>
              <span style={styles.heroStatDot}>·</span>
              <span style={styles.heroStat}>{upcomingPersonal} personal</span>
              <span style={styles.heroStatDot}>·</span>
              <span style={styles.heroStat}>{upcomingGroup} grupo</span>
              {upcomingExternal > 0 ? (
                <>
                  <span style={styles.heroStatDot}>·</span>
                  <span style={styles.heroStat}>{upcomingExternal} externo</span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {!compact ? (
          <div style={styles.heroKpi}>
            <div style={styles.heroKpiLabel}>Próximos 7 días</div>
            <div style={styles.heroKpiNumber}>{upcomingTotal}</div>
            <div style={styles.heroKpiHint}>Con contexto real</div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function StatusPill({ badge }: { badge: StatusBadge }) {
  return <span style={{ ...styles.statusPill, ...badge.style }}>{badge.label}</span>;
}


function PremiumContextRail({
  nudge,
  onPrimary,
}: {
  nudge: PremiumNudge;
  onPrimary: () => void;
}) {
  const context = getPremiumContextCopy(nudge.context);

  return (
    <Card style={styles.premiumRail}>
      <div style={styles.railCopy}>
        <div style={styles.premiumRailEyebrow}>{nudge.eyebrow}</div>
        <div style={styles.railTitle}>{context.title}</div>
        <div style={styles.premiumRailSub}>{context.copy}</div>
        <div style={styles.premiumRailProof}>
          <span style={styles.premiumRailProofLabel}>{context.label}</span>
          <span>{context.outcome}</span>
        </div>
      </div>

      <div style={styles.railActions}>
        <button type="button" onClick={onPrimary} style={styles.premiumRailPrimary}>
          {nudge.primaryLabel}
        </button>
      </div>
    </Card>
  );
}


function NextMoveCard({ move }: { move: NextMove }) {
  const toneStyle =
    move.tone === "danger"
      ? styles.nextMoveDanger
      : move.tone === "warning"
        ? styles.nextMoveWarning
        : move.tone === "info"
          ? styles.nextMoveInfo
          : styles.nextMoveCalm;

  return (
    <Card style={{ ...styles.nextMoveCard, ...toneStyle }}>
      <div style={styles.nextMoveCopy}>
        <div style={styles.nextMoveTopLine}>
          <div style={styles.nextMoveEyebrow}>{move.eyebrow}</div>
          <span style={styles.nextMovePriorityPill}>{move.priorityLabel}</span>
        </div>
        <div style={styles.nextMoveTitle}>{move.title}</div>
        <div style={styles.nextMoveSubtitle}>{move.subtitle}</div>
        <div style={styles.nextMoveRationale}>{move.rationale}</div>
      </div>

      <button type="button" onClick={move.onClick} style={styles.nextMoveBtn}>
        {move.cta}
      </button>
    </Card>
  );
}

function DayStatusCard({ status }: { status: DayStatus }) {
  return (
    <Card style={styles.dayStatusCard}>
      <div style={styles.dayStatusCopy}>
        <div style={styles.dayStatusEyebrow}>{status.eyebrow}</div>
        <div style={styles.dayStatusTitle}>{status.title}</div>
        <div style={styles.dayStatusSubtitle}>{status.subtitle}</div>
      </div>

      <div style={styles.dayStatusPills}>
        {status.pills.map((pill) => (
          <span key={pill} style={styles.dayStatusPill}>
            {pill}
          </span>
        ))}
      </div>
    </Card>
  );
}

function FirstGroupActivationCard({
  onCreateGroup,
  onCreatePersonalEvent,
}: {
  onCreateGroup: () => void;
  onCreatePersonalEvent: () => void;
}) {
  return (
    <Card style={styles.firstActivationCard}>
      <div style={styles.firstActivationCopy}>
        <div style={styles.firstActivationEyebrow}>Empieza aquí</div>
        <h1 style={styles.firstActivationTitle}>Crea tu primer grupo compartido</h1>
        <p style={styles.firstActivationSubtitle}>
          SyncPlans se entiende mejor cuando lo usas con alguien más: crea un grupo,
          invita a una persona y luego guarda el primer evento compartido.
        </p>

        <div style={styles.firstActivationSteps}>
          <span style={styles.firstActivationStep}>1. Crear grupo</span>
          <span style={styles.firstActivationStep}>2. Invitar</span>
          <span style={styles.firstActivationStep}>3. Crear evento</span>
        </div>
      </div>

      <div style={styles.firstActivationActions}>
        <button type="button" onClick={onCreateGroup} style={styles.firstActivationPrimary}>
          Crear grupo
        </button>
        <button type="button" onClick={onCreatePersonalEvent} style={styles.firstActivationSecondary}>
          Crear evento personal
        </button>
      </div>
    </Card>
  );
}

function SummaryBootCard() {
  return (
    <Card style={styles.summaryBootCard}>
      <div style={styles.summaryBootPulse} />
      <div style={styles.summaryBootCopy}>
        <div style={styles.summaryBootEyebrow}>Abriendo SyncPlans</div>
        <div style={styles.summaryBootTitle}>Estamos cargando tu resumen real</div>
        <div style={styles.summaryBootSubtitle}>
          Un momento: estamos revisando tus grupos, eventos, invitaciones y conflictos antes de mostrarte el siguiente paso.
        </div>
      </div>
    </Card>
  );
}

function ProposalPill({ badge }: { badge: ProposalBadge }) {
  return <span style={{ ...styles.statusPill, ...toneBadgeStyle(badge.tone) }}>{badge.label}</span>;
}

function EventRow({
  event,
  highlight,
  proposalLine,
  proposalBadge,
  statusBadge,
  onClick,
  featured = false,
}: {
  event: SummaryEvent;
  highlight: boolean;
  proposalLine: string | null;
  proposalBadge: ProposalBadge | null;
  statusBadge: StatusBadge | null;
  onClick: () => void;
  featured?: boolean;
}) {
  const start = event.start as Date;
  const end = event.end as Date | null;

  const when = end
    ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
    : `${fmtDay(start)} · ${fmtTime(start)}`;

  const audienceLabel = getEventAudienceLabel(event.raw ?? event, {
    groupLabel: event.groupId ? "Grupo" : null,
  });

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...(featured ? styles.featuredEventRow : styles.eventRow),
        ...(highlight ? styles.eventRowHighlight : null),
      }}
      className="spSum-eventRow"
    >
      <div style={styles.eventLeft}>
        {featured ? <div style={styles.featuredEventEyebrow}>Próximo evento</div> : null}
        <div style={styles.eventWhen}>{when}</div>
        <div style={styles.eventTitle}>{event.title}</div>
        {proposalLine ? <div style={styles.proposalContextLine}>{proposalLine}</div> : null}
      </div>

      <div style={styles.eventMeta}>
        {statusBadge ? <StatusPill badge={statusBadge} /> : null}
        {!statusBadge && proposalBadge ? <ProposalPill badge={proposalBadge} /> : null}
        <span style={styles.softPill}>{audienceLabel}</span>
      </div>
    </button>
  );
}

function UpcomingSection({
  booting,
  nextEvent,
  remainingUpcoming,
  showSeeMore,
  upcomingAllCount,
  highlightId,
  getProposalLineForEvent,
  getProposalBadgeForEvent,
  getStatusBadgeForEvent,
  onOpenCalendar,
  showCreateGroupNudge,
  onPrimaryEmptyAction,
}: {
  booting: boolean;
  nextEvent: SummaryEvent | null;
  remainingUpcoming: SummaryEvent[];
  showSeeMore: boolean;
  upcomingAllCount: number;
  highlightId: string | null;
  getProposalLineForEvent: (eventId: string | null | undefined) => string | null;
  getProposalBadgeForEvent: (eventId: string | null | undefined) => ProposalBadge | null;
  getStatusBadgeForEvent: (eventId: string | null | undefined) => StatusBadge | null;
  onOpenCalendar: () => void;
  showCreateGroupNudge: boolean;
  onPrimaryEmptyAction: () => void;
}) {
  if (booting) {
    return (
      <Card style={styles.sectionCard}>
        <div style={styles.loadingCard}>
          <div style={styles.loadingDot} />
          <div>
            <div style={styles.loadingTitle}>Cargando…</div>
            <div style={styles.loadingSub}>Sincronizando lo esencial</div>
          </div>
        </div>
      </Card>
    );
  }

  if (!nextEvent) {
    return (
      <Card style={styles.sectionCard}>
        <div style={styles.sectionHeadMini}>
          <div>
            <div style={styles.sectionEyebrow}>Próximo plan</div>
            <div style={styles.sectionTitle}>Todavía no hay nada cerca</div>
          </div>
        </div>

        <div style={styles.emptyBlock}>
          <div style={styles.emptyTitle}>
            {showCreateGroupNudge
              ? "Aquí aparecerán tus próximos planes"
              : "Crea el próximo plan para que la semana no dependa de memoria"}
          </div>
          <div style={styles.emptySub}>
            {showCreateGroupNudge
              ? "Cuando actives tu primer grupo o captures un plan, esta sección mostrará lo que viene sin repetir acciones."
              : "Si metes el siguiente plan aquí, la coordinación ya no se reparte entre mensajes, recuerdos y supuestos."}
          </div>
          {!showCreateGroupNudge ? (
            <button type="button" onClick={onPrimaryEmptyAction} style={styles.emptyBtn}>
              Crear plan
            </button>
          ) : null}
        </div>
      </Card>
    );
  }

  const nextHighlighted = highlightId && String(nextEvent.id ?? "") === String(highlightId);

  return (
    <Card style={styles.sectionCard}>
      <div style={styles.sectionHeadMini}>
        <div>
          <div style={styles.sectionEyebrow}>Próximo plan</div>
          <div style={styles.sectionTitle}>Lo siguiente en tu agenda</div>
        </div>

        <button type="button" onClick={onOpenCalendar} style={styles.sectionLinkBtn}>
          Abrir calendario
        </button>
      </div>

      <div style={styles.eventsList}>
        <EventRow
          event={nextEvent}
          highlight={Boolean(nextHighlighted)}
          proposalLine={getProposalLineForEvent(nextEvent.id)}
          proposalBadge={getProposalBadgeForEvent(nextEvent.id)}
          statusBadge={getStatusBadgeForEvent(nextEvent.id)}
          onClick={onOpenCalendar}
          featured
        />

        {remainingUpcoming.map((event) => (
          <EventRow
            key={event.id ?? `${event.title}-${event.startIso}`}
            event={event}
            highlight={Boolean(highlightId && String(event.id ?? "") === String(highlightId))}
            proposalLine={getProposalLineForEvent(event.id)}
            proposalBadge={getProposalBadgeForEvent(event.id)}
            statusBadge={getStatusBadgeForEvent(event.id)}
            onClick={onOpenCalendar}
          />
        ))}
      </div>

      {showSeeMore ? (
        <button type="button" onClick={onOpenCalendar} style={styles.seeMoreBtn} className="spSum-seeMore">
          Ver calendario ({upcomingAllCount})
        </button>
      ) : null}
    </Card>
  );
}

function QuickActionsSection({
  actions,
}: {
  actions: QuickAction[];
}) {
  if (actions.length === 0) return null;

  return (
    <Card style={styles.sectionCard}>
      <div style={styles.sectionHeadMini}>
        <div>
          <div style={styles.sectionEyebrow}>Acciones rápidas</div>
          <div style={styles.sectionTitle}>Lo siguiente, sin dar vueltas</div>
        </div>
      </div>

      <div style={styles.quickGrid} className="spSum-quickGrid">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            style={styles.quickCard}
            className="spSum-quickCard"
          >
            <div style={styles.quickTitle}>{action.title}</div>
            <div style={styles.quickSub}>{action.subtitle}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

export default function SummaryClient({ highlightId, appliedToast }: Props) {
  const router = useRouter();
  const isMobile = useIsMobileWidth(520);

  const [quickCaptureValue, setQuickCaptureValue] = useState("");
  const [quickCaptureBusy, setQuickCaptureBusy] = useState(false);
  const [learnedQuickCaptureProfile, setLearnedQuickCaptureProfile] =
    useState<LearnedTimeProfile | null>(null);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [pendingCaptureCount, setPendingCaptureCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dismissedPremiumNudge] = useState(false);
  const [summaryNow, setSummaryNow] = useState(() => new Date());
  const [showDeferredLaunchPanels, setShowDeferredLaunchPanels] = useState(false);
  const premiumNudgeTrackedRef = useRef(false);
  const quickCaptureLearningCacheRef = useRef<{
    key: string;
    at: number;
    signals: Awaited<ReturnType<typeof getLearningSignals>>;
  } | null>(null);

  const {
    booting,
    loading,
    toast,
    groups,
    activeGroupId,
    events,
    declinedEventIds,
    ignoredConflictKeys,
    resMap,
    recentDecisions,
    proposalResponsesMap,
    proposalResponseGroupsMap,
    proposalProfilesMap,
    smartMobility,
    showToast,
  } = useSummaryData({ appliedToast });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setShowDeferredLaunchPanels(true);
    }, 900);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const refreshSummaryNow = () => setSummaryNow(new Date());

    refreshSummaryNow();

    const intervalId = window.setInterval(refreshSummaryNow, 60_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshSummaryNow();
      }
    };

    window.addEventListener("focus", refreshSummaryNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSummaryNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateCurrentUser() {
      try {
        const [
          {
            data: { user },
          },
          fetchedProfile,
        ] = await Promise.all([
          supabase.auth.getUser(),
          getMyProfile().catch(() => null),
        ]);

        if (cancelled) return;
        setCurrentUserId(String(user?.id ?? "").trim() || null);
        setProfile(fetchedProfile ?? null);
      } catch {
        if (!cancelled) {
          setCurrentUserId(null);
          setProfile(null);
        }
      }
    }

    void hydrateCurrentUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydratePendingAttention = async () => {
      try {
        const [invites, captures] = await Promise.all([
          getMyInvitations().catch(() => []),
          getPendingPublicInviteCaptures(6).catch(() => []),
        ]);

        if (cancelled) return;

        setPendingInviteCount(Array.isArray(invites) ? invites.length : 0);
        setPendingCaptureCount(Array.isArray(captures) ? captures.length : 0);
      } catch {
        if (cancelled) return;
        setPendingInviteCount(0);
        setPendingCaptureCount(0);
      }
    };

    void hydratePendingAttention();

    const onFocus = () => {
      void hydratePendingAttention();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find((group) => String(group.id) === String(activeGroupId)) ?? null;
  }, [groups, activeGroupId]);

  const activeLabel = useMemo(() => {
    if (!activeGroupId) return "Personal";
    return activeGroup ? humanGroupName(activeGroup) : "Grupo";
  }, [activeGroupId, activeGroup]);

  const activeGroupType = useMemo(() => {
    return normalizeSummaryGroupType(String(activeGroup?.type ?? ""));
  }, [activeGroup]);

  const contextLabel = useMemo(() => {
    if (!activeGroupId) return "Personal";
    return activeLabel;
  }, [activeGroupId, activeLabel]);

  const inviteTarget = useMemo(() => {
    const groupId = String(activeGroupId ?? groups[0]?.id ?? "").trim();
    return groupId ? `/groups/invite?groupId=${encodeURIComponent(groupId)}` : "/groups";
  }, [activeGroupId, groups]);

  const quickCaptureExamples = useMemo(
    () => getQuickCaptureExamples(activeGroupType, activeLabel, !!activeGroupId),
    [activeGroupType, activeLabel, activeGroupId]
  );

  const quickCapturePreview = useMemo(
    () => formatQuickCapturePreview(quickCaptureValue),
    [quickCaptureValue]
  );

  const smartInterpretation = useMemo(() => {
    const raw = quickCaptureValue.trim();
    if (!raw) return null;

    return buildSmartInterpretation({
      raw,
      groups,
      activeGroupId,
    });
  }, [quickCaptureValue, groups, activeGroupId]);

  const smartInterpretationLabel = useMemo(() => {
    return getSmartInterpretationLabel(smartInterpretation, groups);
  }, [smartInterpretation, groups]);

  const normalizeSuggestionGroupType = useCallback(
    (value: string | null | undefined): "personal" | "pair" | "family" | "other" => {
      if (value === "pair" || value === "couple") return "pair";
      if (value === "family") return "family";
      if (value === "other" || value === "shared") return "other";
      return "personal";
    },
    []
  );

  const suggestedContextGroupId = useMemo(() => {
    if (smartInterpretation?.intent === "group" && smartInterpretation.groupId) {
      return String(smartInterpretation.groupId);
    }

    if (activeGroupId) {
      return String(activeGroupId);
    }

    return null;
  }, [smartInterpretation, activeGroupId]);

  const suggestedContextGroup = useMemo(() => {
    if (!suggestedContextGroupId) return null;

    return (
      groups.find((group) => String(group.id) === String(suggestedContextGroupId)) ?? null
    );
  }, [groups, suggestedContextGroupId]);

  const suggestedContextGroupType = useMemo(() => {
    return normalizeSuggestionGroupType(String(suggestedContextGroup?.type ?? activeGroupType));
  }, [suggestedContextGroup, activeGroupType, normalizeSuggestionGroupType]);

  useEffect(() => {
    let cancelled = false;

    let timer: number | null = null;

    async function hydrateLearnedQuickCaptureProfile() {
      const raw = quickCaptureValue.trim();

      if (!raw || raw.length < 4) {
        if (!cancelled) setLearnedQuickCaptureProfile(null);
        return;
      }

      try {
        const cacheKey = "quick-capture-learning:120d";
        const now = Date.now();
        const cached = quickCaptureLearningCacheRef.current;
        const shouldUseCached =
          Boolean(cached) &&
          cached?.key === cacheKey &&
          now - cached.at < 5 * 60 * 1000;

        const signals = shouldUseCached && cached
          ? cached.signals
          : await getLearningSignals({
              daysBack: 120,
              futureDays: 120,
              limitConflictLogs: 120,
            });

        if (cancelled) return;

        if (!shouldUseCached) {
          quickCaptureLearningCacheRef.current = {
            key: cacheKey,
            at: Date.now(),
            signals,
          };
        }

        if (suggestedContextGroupId) {
          const groupProfile = buildLearnedTimeProfile(signals, {
            scope: "group",
            groupId: suggestedContextGroupId,
          });

          setLearnedQuickCaptureProfile(groupProfile);
          return;
        }

        const userId = String(currentUserId ?? "").trim();

        if (!userId) {
          setLearnedQuickCaptureProfile(null);
          return;
        }

        const userProfile = buildLearnedTimeProfile(signals, {
          scope: "user",
          userId,
        });

        setLearnedQuickCaptureProfile(userProfile);
      } catch {
        if (!cancelled) setLearnedQuickCaptureProfile(null);
      }
    }

    if (typeof window === "undefined") {
      void hydrateLearnedQuickCaptureProfile();
    } else {
      timer = window.setTimeout(() => {
        void hydrateLearnedQuickCaptureProfile();
      }, 650);
    }

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [quickCaptureValue, suggestedContextGroupId, currentUserId]);

  const timeSuggestions = useMemo(() => {
    const raw = quickCaptureValue.trim();
    if (!raw) return [];

    const parsed = parseQuickCapture(raw);
    if (parsed.date) return [];

    return getSuggestedTimeSlots(events, suggestedContextGroupType, raw, {
      learnedProfile: learnedQuickCaptureProfile,
    });
  }, [quickCaptureValue, events, suggestedContextGroupType, learnedQuickCaptureProfile]);

  const timeSuggestionsLabel = useMemo(() => {
    const raw = quickCaptureValue.trim();
    if (!raw || timeSuggestions.length === 0) return null;

    return getSuggestionContextLabel(raw, suggestedContextGroupType);
  }, [quickCaptureValue, timeSuggestions, suggestedContextGroupType]);

  const quickCaptureHeadline = useMemo(() => {
    if (!activeGroupId) return "Crear evento rápido";
    if (activeGroupType === "pair") return "Crear evento rápido";
    if (activeGroupType === "family") return "Organizar evento rápido";
    return "Crear evento rápido";
  }, [activeGroupId, activeGroupType]);

  const quickCaptureSubcopy = useMemo(() => {
    return "Escribe algo como: cena viernes 8 con Ara. SyncPlans lo ordena antes de guardar.";
  }, []);

  const normalizedEvents = useMemo(() => {
    const mapped = (events ?? []).map(normalizeEvent).filter(Boolean) as SummaryEvent[];
    return filterOutDeclinedEvents(mapped, declinedEventIds);
  }, [events, declinedEventIds]);

  const visibleEvents = useMemo(() => {
    return [...normalizedEvents].sort((a, b) => {
      const aMs = a.start?.getTime() ?? 0;
      const bMs = b.start?.getTime() ?? 0;
      return aMs - bMs;
    });
  }, [normalizedEvents]);

  const quickCapturePlaceMemoryEvents = useMemo(
    () => visibleEvents.map((event) => event.raw as unknown as PlaceMemoryEvent),
    [visibleEvents]
  );

  const learnedQuickCapturePlaceMatch = useMemo(() => {
    const raw = quickCaptureValue.trim();
    if (raw.length < 4) return null;

    const parsed = parseQuickCapture(raw);
    return findLearnedPlaceMatch({
      rawText: raw,
      locationQuery: parsed.locationQuery,
      events: quickCapturePlaceMemoryEvents,
    });
  }, [quickCaptureValue, quickCapturePlaceMemoryEvents]);

  const quickCaptureIntelligence = useMemo<CaptureIntelligence | null>(() => {
    const raw = quickCaptureValue.trim();
    if (raw.length < 3) return null;

    const parsed = parseQuickCapture(raw);
    const title = String(parsed.title || "Nuevo plan").trim();
    const facts: string[] = [];
    const missing: string[] = [];
    const risks: string[] = [];

    const hasDate = !!parsed.date;
    const hasTime = parsed.startHour !== null;
    const durationMinutes = Math.max(1, Number(parsed.durationMinutes || 60));
    const parsedEndDate = parsed.endDate ?? null;
    const isMultiDay = !!(
      parsed.date &&
      parsedEndDate &&
      Number.isFinite(parsedEndDate.getTime()) &&
      !isSameCalendarDay(parsed.date, parsedEndDate)
    );
    const location = String(parsed.locationQuery ?? "").trim();
    const learnedPlace = learnedQuickCapturePlaceMatch;
    const effectiveLocation = learnedPlace?.locationLabel || location;
    const participants = parsed.participants
      .map((participant) => String(participant ?? "").trim())
      .filter(Boolean);

    if (parsed.date && isMultiDay && parsedEndDate) {
      facts.push(`Evento de varios días: ${formatCaptureDateRangeLabel(parsed.date, parsedEndDate)}`);
      if (hasTime) {
        facts.push(`Hora de inicio: ${fmtTime(parsed.date)}`);
      }
    } else if (parsed.date) {
      facts.push(`Fecha: ${formatCaptureDateLabel(parsed.date)}`);
      facts.push(`Hora: ${fmtTime(parsed.date)}`);
    } else if (hasTime && parsed.startHour !== null) {
      facts.push(`Hora: ${formatCaptureTimeLabel(parsed.startHour, parsed.startMinutes)}`);
      missing.push("fecha");
    } else {
      missing.push("fecha y hora");
    }

    facts.push(`Duración: ${formatCaptureDurationLabel(durationMinutes)}`);

    if (participants.length > 0) {
      facts.push(`Con: ${compactList(participants, 2)}`);
    }

    if (effectiveLocation) {
      facts.push(`Lugar: ${effectiveLocation}`);
      if (learnedPlace?.locationAddress) {
        facts.push(`Dirección recordada: ${learnedPlace.locationAddress}`);
      }
    } else if (isMultiDay) {
      missing.push("ubicación de referencia");
    } else {
      missing.push("ubicación para calcular salida");
    }

    const suggestedGroupId = String(smartInterpretation?.groupId ?? "").trim();
    const suggestedGroup = suggestedGroupId
      ? groups.find((group) => String(group.id) === suggestedGroupId) ?? null
      : null;
    const groupLabel = suggestedGroup ? humanGroupName(suggestedGroup) : null;

    if (smartInterpretation?.intent === "group") {
      facts.push(`Contexto: ${groupLabel ?? "plan compartido"}`);

      if (!suggestedGroupId) {
        missing.push("elegir grupo antes de compartir");
      }
    } else {
      facts.push("Contexto: personal");
    }

    let overlappingTitle: string | null = null;

    if (parsed.date) {
      const candidateStart = new Date(parsed.date);
      const candidateEnd = parsedEndDate
        ? new Date(parsedEndDate)
        : new Date(candidateStart.getTime() + durationMinutes * 60 * 1000);

      const overlap = visibleEvents.find((event) => {
        if (!event.id || !event.start) return false;
        return eventOverlapsWindow(event, candidateStart, candidateEnd);
      });

      overlappingTitle = overlap ? String(overlap.title || "otro plan").trim() : null;

      if (overlappingTitle) {
        risks.push(`Podría cruzarse con “${overlappingTitle}”.`);
      }
    }

    const score = [
      title.length > 0,
      hasDate,
      hasTime,
      smartInterpretation?.confidence === "high" ||
        smartInterpretation?.confidence === "medium",
      effectiveLocation.length > 0,
    ].filter(Boolean).length;

    const confidenceTone: CaptureIntelligence["confidenceTone"] =
      score >= 4 ? "high" : score >= 2 ? "medium" : "low";
    const confidenceLabel =
      confidenceTone === "high"
        ? "Confianza alta"
        : confidenceTone === "medium"
        ? "Confianza media"
        : "Faltan datos";

    const whenLabel = parsed.date && isMultiDay && parsedEndDate
      ? formatCaptureDateRangeLabel(parsed.date, parsedEndDate)
      : parsed.date
      ? `${formatCaptureDateLabel(parsed.date)} a las ${fmtTime(parsed.date)}`
      : hasTime && parsed.startHour !== null
      ? `a las ${formatCaptureTimeLabel(parsed.startHour, parsed.startMinutes)}`
      : "sin horario cerrado";
    const placeLabel = effectiveLocation ? ` · ${effectiveLocation}` : "";
    const naturalSummary = isMultiDay
      ? `Evento de varios días · ${whenLabel}${placeLabel}`
      : `Quieres crear “${title}” ${whenLabel}${effectiveLocation ? ` en ${effectiveLocation}` : ""}.`;

    let recommendation = isMultiDay
      ? "Se tratará como un bloque de disponibilidad. Smart Mobility quedará pausado para este rango."
      : "Listo para revisar y guardar.";

    if (overlappingTitle) {
      recommendation = "Revisa el posible choque antes de guardar.";
    } else if (!hasDate || !hasTime) {
      recommendation = "Completa fecha y hora para que pueda coordinarlo bien.";
    } else if (learnedPlace) {
      recommendation = `Encontré una dirección usada antes para “${learnedPlace.alias}”. Revísala antes de guardar.`;
    } else if (!effectiveLocation && !isMultiDay) {
      recommendation = "Agrega ubicación si quieres calcular a qué hora salir.";
    } else if (isMultiDay) {
      recommendation = "Se verá durante todo el rango. Smart Mobility quedará pausado salvo que agregues una ruta puntual.";
    } else if (smartInterpretation?.intent === "group" && !suggestedGroupId) {
      recommendation = "Elige el grupo correcto antes de compartirlo.";
    }

    return {
      confidenceLabel,
      confidenceTone,
      naturalSummary,
      facts,
      missing: Array.from(new Set(missing)),
      risks,
      recommendation,
      placeMemory: learnedPlace
        ? {
            alias: learnedPlace.alias,
            locationLabel: learnedPlace.locationLabel,
            locationAddress: learnedPlace.locationAddress,
          }
        : null,
    };
  }, [
    quickCaptureValue,
    smartInterpretation,
    groups,
    visibleEvents,
    learnedQuickCapturePlaceMatch,
  ]);

  const conflictAlert = useMemo(() => {
    const baseAlert = buildConflictAlert(visibleEvents, groups, resMap, ignoredConflictKeys);

    return {
      count: baseAlert.count,
      latestEventId: baseAlert.latestEventId ?? null,
    };
  }, [visibleEvents, groups, resMap, ignoredConflictKeys]);

  const summaryAnalyticsBase = useMemo(
    () => ({
      screen: "summary",
      activeGroupId: activeGroupId ?? null,
      pendingInviteCount,
      pendingCaptureCount,
      unreadConflictCount: conflictAlert.count,
    }),
    [activeGroupId, pendingInviteCount, pendingCaptureCount, conflictAlert.count]
  );

  useEffect(() => {
    void trackScreenView({
      screen: "summary",
      userId: currentUserId,
      metadata: summaryAnalyticsBase,
    });
  }, [currentUserId, summaryAnalyticsBase]);

  const upcomingAll = useMemo(() => {
    const windowStart = summaryNow;
    const windowEnd = addDays(windowStart, 7);

    return visibleEvents.filter((event) => eventOverlapsWindow(event, windowStart, windowEnd));
  }, [visibleEvents, summaryNow]);

  const upcomingStats = useMemo(() => {
    let personal = 0;
    let group = 0;
    let external = 0;

    for (const event of upcomingAll) {
      const hasGoogleGuests = isGoogleEventWithExternalGuests(event.raw ?? event);
      if (hasGoogleGuests) external += 1;
      if (event.groupId) group += 1;
      else if (!hasGoogleGuests) personal += 1;
    }

    return {
      total: upcomingAll.length,
      personal,
      group,
      external,
    };
  }, [upcomingAll]);

  const upcomingLimit = isMobile ? 3 : 6;

  const upcoming = useMemo(
    () => upcomingAll.slice(0, upcomingLimit),
    [upcomingAll, upcomingLimit]
  );

  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;
  const remainingUpcoming = upcoming.length > 1 ? upcoming.slice(1) : ([] as SummaryEvent[]);
  const showSeeMore = !booting && upcomingAll.length > upcomingLimit;

  const mood = useMemo(() => {
    if (booting) {
      return {
        title: "Sincronizando…",
        subtitle: "Cargando lo esencial",
      };
    }

    const count = upcomingStats.total;

    return {
      title: getWeekMoodLabel(count),
      subtitle: getWeekSubtitle(count),
    };
  }, [booting, upcomingStats]);

  // Evita un flash engañoso: si el resumen todavía está refrescando y no hay
  // datos locales, no debemos mostrar “Crea tu primer grupo” como si fuera el
  // estado final. Primero cargamos el resumen real; luego decidimos el CTA.
  const isResolvingInitialSummary = booting || (loading && groups.length === 0 && events.length === 0);
  const showCreateGroupNudge = !isResolvingInitialSummary && groups.length === 0;
  const showInviteNudge = !isResolvingInitialSummary && groups.length > 0 && upcomingStats.group === 0;

  const trackSummaryCta = useCallback(
    (cta: string, target: string, metadata?: Record<string, unknown>) => {
      void trackEvent({
        event: "summary_cta_clicked",
        userId: currentUserId,
        entityId: activeGroupId ? String(activeGroupId) : null,
        metadata: {
          ...summaryAnalyticsBase,
          cta,
          target,
          ...(metadata ?? {}),
        },
      });
    },
    [activeGroupId, currentUserId, summaryAnalyticsBase]
  );

  const navigateFromSummary = useCallback(
    (cta: string, target: string, metadata?: Record<string, unknown>) => {
      trackSummaryCta(cta, target, metadata);
      router.push(target);
    },
    [router, trackSummaryCta]
  );

  const openConflictCenter = useCallback(() => {
    if (conflictAlert.latestEventId) {
      const target = `/conflicts/detected?eventId=${encodeURIComponent(conflictAlert.latestEventId)}`;
      trackSummaryCta("resolve_conflicts", target, {
        conflictCount: conflictAlert.count,
        latestEventId: conflictAlert.latestEventId,
      });
      router.push(target);
      return;
    }

    trackSummaryCta("resolve_conflicts", "/conflicts/detected", {
      conflictCount: conflictAlert.count,
    });
    router.push("/conflicts/detected");
  }, [router, conflictAlert, trackSummaryCta]);

  const buildQuickCaptureParams = useCallback(
    (value: string, suggestedDate?: Date) => {
      const raw = String(value || "").trim();
      if (!raw) return null;

      const parsed = parseQuickCapture(raw);
      const cleanedNotes = cleanTemporalNoise(String(parsed.notes || "").trim());
      const smart = buildSmartInterpretation({
        raw,
        groups,
        activeGroupId,
      });

      const params = new URLSearchParams();
      params.set("qc", "1");
      params.set("capture_source", "summary");
      params.set("raw_text", raw);

      if (smart.intent === "group" && smart.groupId) {
        params.set("type", "group");
        params.set("groupId", smart.groupId);
      } else {
        params.set("type", "personal");
      }

      if (parsed.title) params.set("title", parsed.title);
      if (parsed.durationMinutes) params.set("duration", String(parsed.durationMinutes));
      if (cleanedNotes) params.set("notes", cleanedNotes);

      const learnedPlace = findLearnedPlaceMatch({
        rawText: raw,
        locationQuery: parsed.locationQuery,
        events: quickCapturePlaceMemoryEvents,
      });

      if (learnedPlace) {
        params.set("location_query", learnedPlace.alias);
        params.set("location_label", learnedPlace.locationLabel);
        params.set("location_address", learnedPlace.locationAddress);
        params.set("location_lat", String(learnedPlace.locationLat));
        params.set("location_lng", String(learnedPlace.locationLng));
        params.set("location_provider", learnedPlace.locationProvider);
        if (learnedPlace.locationPlaceId) {
          params.set("location_place_id", learnedPlace.locationPlaceId);
        }
        params.set("location_memory", "1");
      } else if (parsed.locationQuery) {
        params.set("location_query", parsed.locationQuery);
      }

      if (parsed.startHour !== null) {
        params.set(
          "time",
          `${String(parsed.startHour).padStart(2, "0")}:${String(parsed.startMinutes).padStart(2, "0")}`
        );
      }

      const resolvedDate = suggestedDate ?? parsed.date ?? null;
      if (resolvedDate) params.set("date", resolvedDate.toISOString());
      if (!suggestedDate && parsed.endDate) {
        params.set("end_date", parsed.endDate.toISOString());
      }

      return params;
    },
    [groups, activeGroupId, quickCapturePlaceMemoryEvents]
  );

  const navigateFromQuickCapture = useCallback(
    (value: string) => {
      const params = buildQuickCaptureParams(value);
      if (!params) return;

      const target = `/events/new/details?${params.toString()}`;
      trackSummaryCta("quick_capture_submit", target, { hasRawText: true });
      router.push(target);
    },
    [buildQuickCaptureParams, router, trackSummaryCta]
  );

  const navigateFromSuggestedSlot = useCallback(
    (value: string, suggestedDate: Date) => {
      const params = buildQuickCaptureParams(value, suggestedDate);
      if (!params) return;

      const target = `/events/new/details?${params.toString()}`;
      trackSummaryCta("suggested_slot_selected", target, {
        suggestedDate: suggestedDate.toISOString(),
      });
      router.push(target);
    },
    [buildQuickCaptureParams, router, trackSummaryCta]
  );

  const handleQuickCaptureSubmit = useCallback(() => {
    const raw = quickCaptureValue.trim();
    if (!raw || quickCaptureBusy) return;

    setQuickCaptureBusy(true);

    try {
      navigateFromQuickCapture(raw);
    } finally {
      window.setTimeout(() => setQuickCaptureBusy(false), 180);
    }
  }, [quickCaptureValue, quickCaptureBusy, navigateFromQuickCapture]);

  const handleQuickCaptureExample = useCallback(
    (value: string) => {
      setQuickCaptureValue(value);

      if (quickCaptureBusy) return;

      window.setTimeout(() => {
        navigateFromQuickCapture(value);
      }, 0);
    },
    [quickCaptureBusy, navigateFromQuickCapture]
  );

  const handleOpenCapture = useCallback(() => {
    const raw = quickCaptureValue.trim();

    if (!raw) {
      navigateFromSummary("open_capture", "/capture?source=summary", {
        hasDraftText: false,
      });
      return;
    }

    const params = new URLSearchParams();
    params.set("text", raw);
    params.set("source", "summary");

    navigateFromSummary("open_capture", `/capture?${params.toString()}`, {
      hasDraftText: true,
    });
  }, [navigateFromSummary, quickCaptureValue]);

  const handleCopyCaptureLink = useCallback(async () => {
    const raw = quickCaptureValue.trim();

    if (!raw) {
      showToast("Escribe algo primero", "Necesito un texto para generar el link.");
      return;
    }

    if (!canUseClipboard()) {
      showToast(
        "No se pudo copiar",
        "Tu navegador o contexto actual no permite copiar automáticamente."
      );
      return;
    }

    try {
      const fullUrl = buildCaptureShareUrl(raw, "copy_link");
      await navigator.clipboard.writeText(fullUrl);
      showToast("Link copiado ✅", "Ya puedes pegarlo donde quieras.");
    } catch {
      showToast("No se pudo copiar", "Intenta nuevamente.");
    }
  }, [quickCaptureValue, showToast]);

  const handleShareToWhatsApp = useCallback(() => {
    const raw = quickCaptureValue.trim();

    if (!raw) {
      showToast("Escribe algo primero", "Necesito un texto para compartir por WhatsApp.");
      return;
    }

    const fullUrl = buildCaptureShareUrl(raw, "whatsapp");
    const message = buildWhatsAppShareText(raw, fullUrl);
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    if (typeof window !== "undefined") {
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      showToast("WhatsApp listo ✅", buildShareToastLabel(raw));
    }
  }, [quickCaptureValue, showToast]);

  const visibleDecisions = useMemo(() => recentDecisions.slice(0, 3), [recentDecisions]);

  const summaryActivation = useMemo(
    () =>
      getSummaryActivationState({
        groups,
        upcomingTotal: upcomingStats.total,
        pendingInviteCount,
        pendingCaptureCount,
        recentDecisions: visibleDecisions,
        hasConflicts: conflictAlert.count > 0,
      }),
    [
      groups,
      upcomingStats.total,
      pendingInviteCount,
      pendingCaptureCount,
      visibleDecisions,
      conflictAlert.count,
    ]
  );

  const isFirstTimeMode = summaryActivation.shouldUseSimpleSummary;

  const summarySubtitle = isFirstTimeMode
    ? isMobile
      ? "Tu primer paso en SyncPlans"
      : "Empieza con una sola versión clara de tu tiempo"
    : isMobile
      ? activeGroupId
        ? `Hoy · ${activeLabel}`
        : "Hoy · Personal"
      : activeGroupId
        ? `Hoy · ${activeLabel} · tu siguiente paso`
        : "Hoy · Personal · tu siguiente paso";

  const getProposalBadgeForEvent = useCallback(
    (eventId: string | null | undefined): ProposalBadge | null => {
      const key = String(eventId ?? "").trim();
      if (!key) return null;

      const row = proposalResponsesMap[key];
      const label = proposalResponseLabel(row?.response);
      if (!label) return null;

      return {
        label,
        tone: proposalResponseTone(row?.response),
      };
    },
    [proposalResponsesMap]
  );

  const getProposalLineForEvent = useCallback(
    (eventId: string | null | undefined) => {
      const key = String(eventId ?? "").trim();
      if (!key) return null;

      const row = proposalResponsesMap[key];
      if (!row) return null;

      const proposalProfile = proposalProfilesMap[String(row.user_id ?? "").trim()];
      const name = getDisplayName(proposalProfile);
      const time = humanizeRelativeDate(row.updated_at);

      return buildProposalLine({
        response: row.response,
        name,
        time,
      });
    },
    [proposalProfilesMap, proposalResponsesMap]
  );

  const conflictEventIds = useMemo(() => {
    const next = new Set<string>();

    const conflictEvents: CalendarEvent[] = visibleEvents
      .map((event) => {
        const start = event.startIso;
        const end = event.endIso;
        if (!start || !end) return null;

        const rawGroup =
          groups.find((group) => String(group.id) === String(event.groupId ?? ""))?.type ??
          "personal";

        return {
          id: String(event.id),
          title: String(event.title ?? "Evento"),
          start,
          end,
          groupType: normalizeSummaryGroupType(String(rawGroup ?? "personal")) as GroupType,
          groupId: event.groupId ?? null,
        } satisfies CalendarEvent;
      })
      .filter(Boolean) as CalendarEvent[];

    const computed = filterIgnoredConflicts(computeVisibleConflicts(conflictEvents), ignoredConflictKeys)
      .filter((conflict) => !resolutionForConflict(conflict, resMap));

    for (const conflict of computed) {
      next.add(String(conflict.existingEventId));
      next.add(String(conflict.incomingEventId));
    }

    return next;
  }, [groups, resMap, visibleEvents, ignoredConflictKeys]);

  const decisionSummary = useMemo(() => {
    let pendingProposals = 0;
    let adjustedProposals = 0;

    for (const rows of Object.values(proposalResponseGroupsMap)) {
      if ((rows ?? []).some((row) => row?.response === "pending")) {
        pendingProposals += 1;
      }
      if ((rows ?? []).some((row) => row?.response === "adjusted")) {
        adjustedProposals += 1;
      }
    }

    return {
      pendingProposals,
      adjustedProposals,
      conflicts: conflictEventIds.size,
    };
  }, [conflictEventIds, proposalResponseGroupsMap]);

  const pendingAttention = useMemo(() => {
    return {
      invites: pendingInviteCount,
      captures: pendingCaptureCount,
      proposals: decisionSummary.pendingProposals + decisionSummary.adjustedProposals,
      conflicts: conflictAlert.count,
      total:
        pendingInviteCount +
        pendingCaptureCount +
        decisionSummary.pendingProposals +
        decisionSummary.adjustedProposals +
        conflictAlert.count,
    };
  }, [
    pendingInviteCount,
    pendingCaptureCount,
    decisionSummary.pendingProposals,
    decisionSummary.adjustedProposals,
    conflictAlert.count,
  ]);

  const valueMoments = useMemo(() => {
    const resolvedDecisions = visibleDecisions.filter((decision) => !decision.isFallback).length;
    const autoAdjusted = visibleDecisions.filter((decision) => decision.isFallback).length;
    const agendaFeelsClear = conflictAlert.count === 0 && upcomingStats.total > 0;

    return {
      resolvedDecisions,
      autoAdjusted,
      agendaFeelsClear,
      hasValue:
        resolvedDecisions > 0 ||
        autoAdjusted > 0 ||
        agendaFeelsClear ||
        pendingAttention.captures > 0,
    };
  }, [visibleDecisions, conflictAlert.count, upcomingStats.total, pendingAttention.captures]);

  const hasPremium = useMemo(() => hasPremiumAccess(profile), [profile]);

  const premiumNudge = useMemo<PremiumNudge | null>(() => {
    if (hasPremium || dismissedPremiumNudge) return null;

    if (conflictAlert.count > 0) {
      return {
        context: "conflicts",
        eyebrow: "Premium encaja aquí",
        title: "Anticípate mejor cuando la coordinación ya se volvió sensible",
        subtitle:
          "Si SyncPlans ya te está ayudando a bajar ruido, Premium suma más contexto para decidir antes, con menos idas y vueltas y más claridad compartida.",
        primaryLabel: "Ver ventajas Premium",
        secondaryLabel: "Seguir resolviendo",
      };
    }

    if (groups.length > 0 && (upcomingStats.group > 0 || pendingInviteCount > 0)) {
      return {
        context: "shared_coordination",
        eyebrow: "Premium en contexto",
        title: "Cuando ya coordinas con otros, Premium se vuelve más lógico",
        subtitle:
          "La versión gratis ya te mostró valor. Premium empuja más claridad entre personas, mejor lectura del contexto y menos fricción cuando la agenda compartida empieza a crecer.",
        primaryLabel: "Explorar Premium",
        secondaryLabel: "Seguir así por ahora",
      };
    }

    if (smartMobility.reason === "ready" && smartMobility.eventId) {
      return {
        context: "smart_mobility",
        eyebrow: "Premium en contexto",
        title: "Cuando el plan ya tiene ruta, Premium se vuelve más tangible",
        subtitle:
          "El valor no es otro botón de mapa. Es que SyncPlans conecte plan, lugar y salida para evitar llegar tarde por falta de contexto.",
        primaryLabel: "Ver Premium",
        secondaryLabel: "Seguir así por ahora",
      };
    }

    if (upcomingStats.total >= 4 || valueMoments.hasValue) {
      return {
        context: "weekly_density",
        eyebrow: "Más valor sobre una base real",
        title: "Ya estás usando SyncPlans de verdad: ahora toca subir el nivel",
        subtitle:
          "Premium no se trata de meter más funciones porque sí. Se trata de darte más claridad, menos desgaste y una coordinación que se sienta todavía más liviana.",
        primaryLabel: "Ver cómo mejora Premium",
        secondaryLabel: "Después lo veo",
      };
    }

    return null;
  }, [
    hasPremium,
    dismissedPremiumNudge,
    conflictAlert.count,
    groups.length,
    upcomingStats.group,
    upcomingStats.total,
    pendingInviteCount,
    smartMobility.reason,
    smartMobility.eventId,
    valueMoments.hasValue,
  ]);

  useEffect(() => {
    if (!premiumNudge || premiumNudgeTrackedRef.current) return;

    premiumNudgeTrackedRef.current = true;
    void trackEvent({
      event: "premium_viewed",
      userId: currentUserId,
      entityId: activeGroupId ? String(activeGroupId) : null,
      metadata: {
        ...summaryAnalyticsBase,
        placement: "summary",
        context: premiumNudge.context,
      },
    });
  }, [premiumNudge, currentUserId, activeGroupId, summaryAnalyticsBase]);

  const primaryAction = useMemo<PrimaryAction>(() => {
    if (conflictAlert.count > 0) {
      return {
        eyebrow: "Lo más urgente ahora",
        title: `Resuelve ${conflictAlert.count} conflicto${conflictAlert.count === 1 ? "" : "s"} antes de que vuelva el ruido`,
        subtitle: "Decide una vez y deja una versión clara para todos.",
        primaryLabel: "Resolver conflictos",
        primaryAction: openConflictCenter,
        secondaryLabel: "Abrir calendario",
        secondaryAction: () =>
          navigateFromSummary("primary_secondary_calendar", "/calendar", {
            block: "primary_action",
          }),
      };
    }

    if (pendingInviteCount > 0) {
      return {
        eyebrow: "Lo más útil ahora",
        title: `Hay ${pendingInviteCount} invitación${pendingInviteCount === 1 ? "" : "es"} esperando una decisión`,
        subtitle: "Responder esto desbloquea coordinación compartida.",
        primaryLabel: "Revisar invitaciones",
        primaryAction: () =>
          navigateFromSummary("review_invitations", "/invitations", {
            block: "primary_action",
          }),
        secondaryLabel: showInviteNudge ? "Abrir grupos" : "Abrir eventos",
        secondaryAction: () =>
          navigateFromSummary(
            showInviteNudge ? "open_groups" : "open_events",
            showInviteNudge ? "/groups" : "/events",
            { block: "primary_action" }
          ),
      };
    }

    if (pendingAttention.proposals > 0 || pendingAttention.captures > 0) {
      return {
        eyebrow: "Lo más útil ahora",
        title: "Hay respuestas y ajustes esperando que cierres el ciclo",
        subtitle: "Ciérralo ahora y mantén la agenda como referencia viva.",
        primaryLabel: "Revisar pendientes",
        primaryAction: () =>
          navigateFromSummary("review_pending", "/events", {
            block: "primary_action",
          }),
        secondaryLabel: "Abrir calendario",
        secondaryAction: () =>
          navigateFromSummary("primary_secondary_calendar", "/calendar", {
            block: "primary_action",
          }),
      };
    }

    if (isFirstTimeMode) {
      return {
        eyebrow: "Empieza aquí",
        title: "Coordina mejor tu tiempo compartido",
        subtitle:
          "Evita cruces, alinea agendas y deja una sola versión clara desde el inicio.",
        primaryLabel: showCreateGroupNudge ? "Crear grupo" : "Crear primer plan",
        primaryAction: () =>
          showCreateGroupNudge
            ? navigateFromSummary("create_group", "/groups/new", {
                block: "primary_action",
              })
            : navigateFromSummary("create_plan", "/events/new/details?type=personal", {
                block: "primary_action",
              }),
        secondaryLabel: "Conectar Google",
        secondaryAction: () =>
          navigateFromSummary("connect_google", "/settings", {
            block: "primary_action",
          }),
      };
    }

    if (showCreateGroupNudge) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Crea tu primer grupo compartido",
        subtitle: "Crear tu primer grupo activa la coordinación compartida.",
        primaryLabel: "Crear grupo",
        primaryAction: () =>
          navigateFromSummary("create_group", "/groups/new", {
            block: "primary_action",
          }),
        secondaryLabel: "Ver grupos",
        secondaryAction: () =>
          navigateFromSummary("open_groups", "/groups", {
            block: "primary_action",
          }),
      };
    }

    if (showInviteNudge) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Invita a la otra persona",
        subtitle:
          "Coordinen en un solo lugar y eviten cruces, dudas y mensajes perdidos.",
        primaryLabel: "Invitar ahora",
        primaryAction: () =>
          navigateFromSummary("invite_someone", inviteTarget, {
            block: "primary_action",
          }),
        secondaryLabel: "Abrir eventos",
        secondaryAction: () =>
          navigateFromSummary("open_events", "/events", {
            block: "primary_action",
          }),
      };
    }

    if (!nextEvent) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Crea el próximo plan para que la semana no se quede vacía",
        subtitle: "Si no hay nada cerca, crea un plan y mantén el hábito.",
        primaryLabel: "Crear plan",
        primaryAction: () =>
          navigateFromSummary("create_plan", "/events/new/details?type=personal", {
            block: "primary_action",
          }),
        secondaryLabel: "Abrir calendario",
        secondaryAction: () =>
          navigateFromSummary("primary_secondary_calendar", "/calendar", {
            block: "primary_action",
          }),
      };
    }

    return {
      eyebrow: "Tu base de esta semana",
      title: nextEvent ? `Lo próximo: ${nextEvent.title}` : "Tu agenda está clara por ahora.",
      subtitle: nextEvent
        ? "Revisa lo que viene o crea un nuevo plan sin salir del flujo."
        : "No hay urgencias pendientes. Mantén el hábito creando o revisando tu siguiente plan.",
      primaryLabel: "Abrir calendario",
      primaryAction: () =>
        navigateFromSummary("open_calendar", "/calendar", {
          block: "primary_action",
        }),
      secondaryLabel: "Abrir eventos",
      secondaryAction: () =>
        navigateFromSummary("open_events", "/events", {
          block: "primary_action",
        }),
    };
  }, [
    conflictAlert.count,
    pendingInviteCount,
    pendingAttention.proposals,
    pendingAttention.captures,
    isFirstTimeMode,
    showCreateGroupNudge,
    showInviteNudge,
    nextEvent,
    openConflictCenter,
    navigateFromSummary,
    inviteTarget,
  ]);

  const nextMove = useMemo<NextMove>(() => {
    const leaveInMinutes = smartMobility.leaveInMinutes;
    const hasRelevantLeaveSignal =
      smartMobility.reason === "ready" &&
      leaveInMinutes !== null &&
      Number.isFinite(leaveInMinutes) &&
      leaveInMinutes <= 180;

    // Prioridad real de la home: primero decisiones que bloquean coordinación,
    // luego movilidad solo cuando ya afecta llegar a tiempo.
    if (conflictAlert.count > 0) {
      return {
        eyebrow: "Lo más importante ahora",
        title: `Resuelve ${conflictAlert.count} conflicto${conflictAlert.count === 1 ? "" : "s"}`,
        subtitle: "Hay dos versiones compitiendo por el mismo tiempo. Decide qué queda antes de seguir creando planes encima.",
        cta: "Resolver ahora",
        tone: "warning",
        priorityLabel: "Prioridad 1 · Decisión",
        rationale: "SyncPlans lo pone arriba porque un conflicto abierto rompe la promesa de una sola verdad compartida.",
        onClick: openConflictCenter,
      };
    }

    if (pendingInviteCount > 0) {
      return {
        eyebrow: "Lo más importante ahora",
        title: `Responde ${pendingInviteCount} invitación${pendingInviteCount === 1 ? "" : "es"}`,
        subtitle: "Aceptar o rechazar esto desbloquea coordinación compartida y evita que el plan quede flotando.",
        cta: "Ver invitaciones",
        tone: "info",
        priorityLabel: "Prioridad 2 · Compartido",
        rationale: "La app prioriza invitaciones porque sin respuesta no hay sincronización real entre personas.",
        onClick: () =>
          navigateFromSummary("next_move_invitations", "/invitations", {
            block: "next_move",
          }),
      };
    }

    if (pendingAttention.proposals > 0 || pendingAttention.captures > 0) {
      const totalPending = pendingAttention.proposals + pendingAttention.captures;
      return {
        eyebrow: "Lo más importante ahora",
        title: `Cierra ${totalPending} pendiente${totalPending === 1 ? "" : "s"} de coordinación`,
        subtitle: "Hay respuestas o capturas esperando una decisión. Cerrarlas mantiene la agenda limpia y confiable.",
        cta: "Revisar pendientes",
        tone: "info",
        priorityLabel: "Prioridad 3 · Cerrar ciclo",
        rationale: "SyncPlans no solo informa; te empuja a cerrar lo que puede generar ida y vuelta por chat.",
        onClick: () =>
          navigateFromSummary("next_move_pending", "/events", {
            block: "next_move",
          }),
      };
    }

    if (hasRelevantLeaveSignal) {
      const eventTitle = smartMobility.eventTitle || "tu próximo plan";

      if (leaveInMinutes <= -5) {
        return {
          eyebrow: "Lo más importante ahora",
          title: `Vas tarde para ${eventTitle}`,
          subtitle: "Abre la ruta y sal cuanto antes. Este aviso sube porque ya afecta tu llegada, no solo tu agenda.",
          cta: "Abrir ruta",
          tone: "danger",
          priorityLabel: "Prioridad 4 · Salida",
          rationale: "La coordinación también es llegar a tiempo; por eso movilidad aparece solo cuando ya es accionable.",
          onClick: () => {
            trackSummaryCta("next_move_open_route_late", smartMobility.mapsUrl || "/calendar", {
              block: "next_move",
              eventId: smartMobility.eventId,
              leaveInMinutes,
            });

            if (smartMobility.mapsUrl && typeof window !== "undefined") {
              window.open(smartMobility.mapsUrl, "_blank", "noopener,noreferrer");
              return;
            }

            router.push("/calendar");
          },
        };
      }

      if (leaveInMinutes <= 0) {
        return {
          eyebrow: "Lo más importante ahora",
          title: `Sal ahora para ${eventTitle}`,
          subtitle: "La salida sugerida ya llegó. Abre la ruta y evita llegar justo.",
          cta: "Abrir ruta",
          tone: "warning",
          priorityLabel: "Prioridad 4 · Salida",
          rationale: "La app lo sube arriba porque ya no es información; es una acción inmediata.",
          onClick: () => {
            trackSummaryCta("next_move_open_route_now", smartMobility.mapsUrl || "/calendar", {
              block: "next_move",
              eventId: smartMobility.eventId,
              leaveInMinutes,
            });

            if (smartMobility.mapsUrl && typeof window !== "undefined") {
              window.open(smartMobility.mapsUrl, "_blank", "noopener,noreferrer");
              return;
            }

            router.push("/calendar");
          },
        };
      }

      return {
        eyebrow: "Lo más importante ahora",
        title: `Prepárate: sales en ${formatMoveMinutes(leaveInMinutes)}`,
        subtitle: `Para ${eventTitle}. El aviso aparece porque ya estás dentro de la ventana útil de salida.`,
        cta: "Ver ruta",
        tone: "info",
        priorityLabel: "Prioridad 4 · Salida",
        rationale: "Smart Mobility no ocupa la home todo el día: aparece cuando realmente puede ayudarte a llegar mejor.",
        onClick: () => {
          trackSummaryCta("next_move_open_route_soon", smartMobility.mapsUrl || "/calendar", {
            block: "next_move",
            eventId: smartMobility.eventId,
            leaveInMinutes,
          });

          if (smartMobility.mapsUrl && typeof window !== "undefined") {
            window.open(smartMobility.mapsUrl, "_blank", "noopener,noreferrer");
            return;
          }

          router.push("/calendar");
        },
      };
    }

    if (showInviteNudge) {
      return {
        eyebrow: "Lo más importante ahora",
        title: "Invita a la otra persona",
        subtitle: "El valor compartido aparece cuando ambos ven lo mismo en el mismo lugar.",
        cta: "Invitar ahora",
        tone: "info",
        priorityLabel: "Prioridad 5 · Activación",
        rationale: "Sin otra persona, SyncPlans funciona; con otra persona, empieza a resolver el problema real.",
        onClick: () =>
          navigateFromSummary("next_move_invite_now", inviteTarget, {
            block: "next_move",
          }),
      };
    }

    if (showCreateGroupNudge) {
      return {
        eyebrow: "Lo más importante ahora",
        title: "Crea tu primer grupo compartido",
        subtitle: "Ese paso convierte SyncPlans en una referencia real de coordinación, no solo en una agenda personal.",
        cta: "Crear grupo",
        tone: "info",
        priorityLabel: "Prioridad 5 · Activación",
        rationale: "La home prioriza el grupo porque ahí aparece el valor compartido de SyncPlans.",
        onClick: () =>
          navigateFromSummary("next_move_create_group", "/groups/new", {
            block: "next_move",
          }),
      };
    }

    if (!nextEvent) {
      return {
        eyebrow: "Lo más importante ahora",
        title: "Captura el próximo plan",
        subtitle: "Escribe una idea rápida y SyncPlans la convierte en algo revisable.",
        cta: "Crear plan",
        tone: "calm",
        priorityLabel: "Prioridad 6 · Hábito",
        rationale: "Cuando no hay urgencias, la mejor acción es alimentar la agenda con el próximo plan real.",
        onClick: () =>
          navigateFromSummary("next_move_create_plan", "/events/new/details?type=personal", {
            block: "next_move",
          }),
      };
    }

    return {
      eyebrow: "Lo más importante ahora",
      title: `Revisa lo próximo: ${nextEvent.title}`,
      subtitle: "Tu agenda está clara por ahora. Mantén el hábito revisando lo siguiente o creando un nuevo plan.",
      cta: "Abrir calendario",
      tone: "calm",
      priorityLabel: "Agenda clara",
      rationale: "No hay bloqueos visibles; SyncPlans baja el ruido y te deja solo el siguiente contexto útil.",
      onClick: () =>
        navigateFromSummary("next_move_calendar", "/calendar", {
          block: "next_move",
          eventId: nextEvent.id ?? null,
        }),
    };
  }, [
    smartMobility.reason,
    smartMobility.leaveInMinutes,
    smartMobility.eventTitle,
    smartMobility.eventId,
    smartMobility.mapsUrl,
    conflictAlert.count,
    openConflictCenter,
    pendingInviteCount,
    pendingAttention.proposals,
    pendingAttention.captures,
    showCreateGroupNudge,
    showInviteNudge,
    nextEvent,
    navigateFromSummary,
    inviteTarget,
    router,
    trackSummaryCta,
  ]);

  const dayStatus = useMemo<DayStatus>(() => {
    const todayStart = startOfTodayLocal();
    const tomorrowStart = addDays(todayStart, 1);

    const todayEvents = visibleEvents.filter((event) =>
      eventOverlapsWindow(event, summaryNow, tomorrowStart)
    );

    const todayTotal = todayEvents.length;
    const todayShared = todayEvents.filter((event) => Boolean(event.groupId)).length;
    const todayExternal = todayEvents.filter((event) =>
      isGoogleEventWithExternalGuests(event.raw ?? event)
    ).length;
    const nextToday = todayEvents[0] ?? null;

    const pendingTotal =
      pendingInviteCount +
      pendingCaptureCount +
      decisionSummary.pendingProposals +
      decisionSummary.adjustedProposals +
      conflictAlert.count;

    const pills: string[] = [];

    if (todayTotal > 0) {
      pills.push(`${todayTotal} plan${todayTotal === 1 ? "" : "es"} hoy`);
    } else {
      pills.push("Sin planes hoy");
    }

    if (todayShared > 0) {
      pills.push(`${todayShared} compartido${todayShared === 1 ? "" : "s"}`);
    }

    if (pendingTotal > 0) {
      pills.push(`${pendingTotal} pendiente${pendingTotal === 1 ? "" : "s"}`);
    } else {
      pills.push("Nada urgente");
    }

    if (todayExternal > 0) {
      pills.push(`${todayExternal} externo${todayExternal === 1 ? "" : "s"}`);
    }

    if (conflictAlert.count > 0) {
      return {
        eyebrow: "Estado del día",
        title: `Hoy hay ${conflictAlert.count} conflicto${conflictAlert.count === 1 ? "" : "s"} que resolver`,
        subtitle: "Tu día necesita una decisión clara antes de seguir acumulando coordinación por fuera.",
        pills,
      };
    }

    if (pendingTotal > 0) {
      return {
        eyebrow: "Estado del día",
        title: `Tienes ${pendingTotal} pendiente${pendingTotal === 1 ? "" : "s"} por cerrar`,
        subtitle: "Cerrar esto mantiene SyncPlans como una sola verdad compartida, no como otra lista más.",
        pills,
      };
    }

    if (nextToday?.start) {
      return {
        eyebrow: "Estado del día",
        title: `Tu próximo plan es a las ${fmtTime(nextToday.start)}`,
        subtitle: `${nextToday.title}. Por ahora no hay urgencias abiertas; solo mantén claro lo que viene.`,
        pills,
      };
    }

    if (todayTotal > 0) {
      return {
        eyebrow: "Estado del día",
        title: `Hoy tienes ${todayTotal} plan${todayTotal === 1 ? "" : "es"}`,
        subtitle: "Todo se ve ordenado por ahora. SyncPlans queda como referencia para cualquier cambio.",
        pills,
      };
    }

    return {
      eyebrow: "Estado del día",
      title: "Día tranquilo por ahora",
      subtitle: "Buen momento para capturar un plan o dejar algo compartido listo antes de que se pierda en el chat.",
      pills,
    };
  }, [
    visibleEvents,
    summaryNow,
    pendingInviteCount,
    pendingCaptureCount,
    decisionSummary.pendingProposals,
    decisionSummary.adjustedProposals,
    conflictAlert.count,
  ]);

  const summaryQuickActions = useMemo<QuickAction[]>(() => {
    if (showCreateGroupNudge) {
      return [
        {
          key: "calendar",
          title: "Abrir calendario",
          subtitle: "Ver tu semana de un vistazo.",
          onClick: () =>
            navigateFromSummary("open_calendar", "/calendar", {
              block: "summary_calendar",
            }),
        },
        {
          key: "create_plan",
          title: "Crear evento",
          subtitle: "Guarda un plan personal mientras activas tu espacio.",
          onClick: () =>
            navigateFromSummary("create_plan", "/events/new/details?type=personal", {
              block: "summary_quick_actions",
            }),
        },
        {
          key: "groups",
          title: "Ver grupos",
          subtitle: "Revisa tus espacios compartidos desde un solo lugar.",
          onClick: () =>
            navigateFromSummary("open_groups", "/groups", {
              block: "summary_quick_actions",
            }),
        },
      ];
    }

    if (isFirstTimeMode) {
      return [
        {
          key: "create_plan",
          title: "Crear primer plan",
          subtitle: "Prueba SyncPlans con algo simple y veloz.",
          onClick: () =>
            navigateFromSummary("create_plan", "/events/new/details?type=personal", {
              block: "summary_quick_actions",
            }),
        },
        {
          key: "connect_google",
          title: "Conectar Google",
          subtitle: "Trae tu agenda actual para tener más contexto.",
          onClick: () =>
            navigateFromSummary("connect_google", "/settings", {
              block: "summary_quick_actions",
            }),
        },
        {
          key: "calendar",
          title: "Abrir calendario",
          subtitle: "Ver tu semana de un vistazo.",
          onClick: () =>
            navigateFromSummary("open_calendar", "/calendar", {
              block: "summary_calendar",
            }),
        },
      ];
    }

    const items: QuickAction[] = [
      {
        key: "primary",
        title: primaryAction.primaryLabel,
        subtitle: primaryAction.subtitle,
        onClick: primaryAction.primaryAction,
      },
      {
        key: "calendar",
        title: "Abrir calendario",
        subtitle: "Ver tu semana de un vistazo.",
        onClick: () =>
          navigateFromSummary("open_calendar", "/calendar", {
            block: "summary_calendar",
          }),
      },
    ];

    if (showInviteNudge) {
      items.push({
        key: "groups",
        title: "Abrir grupos",
        subtitle: "Invita a la otra persona y empiecen a coordinar mejor.",
        onClick: () =>
          navigateFromSummary("open_groups", "/groups", {
            block: "summary_quick_actions",
          }),
      });
    } else {
      items.push({
        key: "events",
        title: "Abrir eventos",
        subtitle: "Ver respuestas, estados y pendientes en un solo lugar.",
        onClick: () =>
          navigateFromSummary("open_events", "/events", {
            block: "summary_events",
          }),
      });
    }

    return items;
  }, [
    isFirstTimeMode,
    navigateFromSummary,
    primaryAction.primaryAction,
    primaryAction.primaryLabel,
    primaryAction.subtitle,
    showCreateGroupNudge,
    showInviteNudge,
  ]);

  const getStatusBadgeForEvent = useCallback(
  (eventId: string | null | undefined): StatusBadge | null => {
    const key = String(eventId ?? "").trim();
    if (!key) return null;

    const event = visibleEvents.find((item) => String(item.id ?? "") === key) ?? null;

    const status = getUnifiedEventStatus({
      eventId,
      conflictEventIds,
      proposalResponseGroupsMap,
    });

    if (!status || status === "scheduled") return null;

    // Un evento personal creado por el usuario no necesita badge de confirmación.
    // Si no pertenece a grupo, no hay nadie más que lo tenga que aceptar.
    if (status === "pending" && !event?.groupId) {
      return null;
    }

    const conflictsCount = conflictEventIds.has(key) ? 1 : 0;
    const statusUi = getEventStatusUi(status, { conflictsCount });

    return {
      label: statusUi.label,
      style: statusUi.badgeStyle,
    };
  },
  [conflictEventIds, proposalResponseGroupsMap, visibleEvents]
);

  const compactSummaryMobile = isMobile;
  const hasUrgentSummaryState =
    conflictAlert.count > 0 ||
    pendingInviteCount > 0 ||
    pendingAttention.proposals > 0 ||
    pendingAttention.captures > 0;

  const showFirstGroupActivation = showCreateGroupNudge && !hasUrgentSummaryState;

  const showQuickActions =
    !showFirstGroupActivation &&
    (isFirstTimeMode || (!hasUrgentSummaryState && !nextEvent && !showInviteNudge));

  const shouldShowSummaryHero =
    !(showInviteNudge && !hasUrgentSummaryState) &&
    !(showCreateGroupNudge && !hasUrgentSummaryState);

  const openPremiumFromSummary = useCallback(
    (context: PremiumContextKey) => {
      void trackEvent({
        event: "premium_cta_clicked",
        userId: currentUserId,
        entityId: activeGroupId ? String(activeGroupId) : null,
        metadata: {
          ...summaryAnalyticsBase,
          placement: "summary",
          context,
        },
      });

      router.push(`/planes?source=summary&context=${context}`);
    },
    [activeGroupId, currentUserId, router, summaryAnalyticsBase]
  );

  return (
  <div style={styles.page} className="spSum-page">
    {showDeferredLaunchPanels && !showFirstGroupActivation ? <LocationPermissionPrompt /> : null}
      {toast ? <SummaryToast title={toast.title} subtitle={toast.subtitle} /> : null}

      <Section style={styles.shell} className="spSum-shell">
        <PremiumHeader
          hideUpgradeCta
          title="Resumen"
          subtitle={summarySubtitle}
          sticky={false}
        />

        {isResolvingInitialSummary ? (
          <SummaryBootCard />
        ) : showFirstGroupActivation ? (
          <FirstGroupActivationCard
            onCreateGroup={() =>
              navigateFromSummary("first_activation_create_group", "/groups/new", {
                block: "first_activation",
              })
            }
            onCreatePersonalEvent={() =>
              navigateFromSummary("first_activation_create_personal_event", "/events/new/details?type=personal", {
                block: "first_activation",
              })
            }
          />
        ) : (
          <div style={styles.summaryGrid} className="spSum-summaryGrid">
            <div style={styles.summaryMainColumn} className="spSum-mainColumn">
              <NextMoveCard move={nextMove} />

              <SummaryQuickCaptureCard
                value={quickCaptureValue}
                busy={quickCaptureBusy}
                preview={quickCapturePreview}
                interpretation={smartInterpretation}
                interpretationLabel={smartInterpretationLabel}
                intelligence={quickCaptureIntelligence}
                examples={isFirstTimeMode ? quickCaptureExamples.slice(0, 2) : quickCaptureExamples}
                activeGroupName={activeLabel}
                activeGroupType={activeGroupType}
                groups={groups}
                onChange={setQuickCaptureValue}
                onSubmit={handleQuickCaptureSubmit}
                onShare={handleCopyCaptureLink}
                onWhatsApp={handleShareToWhatsApp}
                onExampleClick={handleQuickCaptureExample}
                headline={isFirstTimeMode ? "Prueba con una idea simple" : quickCaptureHeadline}
                subcopy={
                  isFirstTimeMode
                    ? "Escribe algo como lo dirías por WhatsApp. SyncPlans lo convierte en un evento claro antes de guardar."
                    : quickCaptureSubcopy
                }
                onOpenCapture={isFirstTimeMode ? undefined : handleOpenCapture}
                timeSuggestionsLabel={isFirstTimeMode ? null : timeSuggestionsLabel}
                timeSuggestions={isFirstTimeMode ? [] : timeSuggestions}
                onSuggestedSlotClick={
                  isFirstTimeMode
                    ? undefined
                    : (date: Date) => navigateFromSuggestedSlot(quickCaptureValue, date)
                }
              />
            </div>

            <div style={styles.summarySideColumn} className="spSum-sideColumn">
              <DayStatusCard status={dayStatus} />

              {showDeferredLaunchPanels ? (
                <SmartMobilityCard smartMobility={smartMobility} />
              ) : null}

              {shouldShowSummaryHero ? (
                <SummaryHero
                  compact={compactSummaryMobile}
                  contextLabel={contextLabel}
                  moodTitle={mood.title}
                  moodSubtitle={mood.subtitle}
                  upcomingTotal={upcomingStats.total}
                  upcomingPersonal={upcomingStats.personal}
                  upcomingGroup={upcomingStats.group}
                  upcomingExternal={upcomingStats.external}
                  conflictCount={conflictAlert.count}
                  pendingInviteCount={pendingInviteCount}
                  loading={loading && !booting}
                  primaryAction={primaryAction}
                  onOpenConflicts={openConflictCenter}
                  onOpenInvitations={() =>
                    navigateFromSummary("hero_invites", "/invitations", {
                      block: "summary_hero",
                    })
                  }
                />
              ) : null}

              {premiumNudge ? (
                <PremiumContextRail
                  nudge={premiumNudge}
                  onPrimary={() => openPremiumFromSummary(premiumNudge.context)}
                />
              ) : null}

              <UpcomingSection
                booting={booting}
                nextEvent={nextEvent}
                remainingUpcoming={remainingUpcoming}
                showSeeMore={showSeeMore}
                upcomingAllCount={upcomingAll.length}
                highlightId={highlightId}
                getProposalLineForEvent={getProposalLineForEvent}
                getProposalBadgeForEvent={getProposalBadgeForEvent}
                getStatusBadgeForEvent={getStatusBadgeForEvent}
                onOpenCalendar={() =>
                  navigateFromSummary("open_calendar", "/calendar", {
                    block: "summary_calendar",
                  })
                }
                showCreateGroupNudge={showCreateGroupNudge}
                onPrimaryEmptyAction={primaryAction.primaryAction}
              />
            </div>

            {showQuickActions ? (
              <div style={styles.summaryFullWidth} className="spSum-fullWidth">
                <QuickActionsSection actions={summaryQuickActions} />
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <style>{`
        @media (max-width: 960px) {
          .spSum-summaryGrid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 720px) {
          .spSum-shell {
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-top: 14px !important;
            gap: 12px !important;
          }
        }

        @media (max-width: 520px) {
          .spSum-shell {
            gap: 10px !important;
          }

          .spSum-page button {
            -webkit-tap-highlight-color: transparent;
          }

          .spSum-eventRow {
            min-height: 72px !important;
            padding: 12px !important;
          }

          .spSum-quickGrid {
            grid-template-columns: 1fr !important;
          }

          .spSum-quickCard {
            min-height: 92px !important;
            padding: 14px !important;
          }

          .spSum-seeMore {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    scrollPaddingBottom: "calc(var(--sp-bottom-safe, 110px) + 64px)",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: "20px 22px calc(var(--sp-bottom-safe, 110px) + 64px)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.16fr) minmax(340px, 0.84fr)",
    gap: 16,
    alignItems: "start",
  },
  summaryMainColumn: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
  summarySideColumn: {
    display: "grid",
    gap: 16,
    minWidth: 0,
  },
  summaryFullWidth: {
    gridColumn: "1 / -1",
    minWidth: 0,
  },
  toastWrap: {
    position: "fixed",
    top: 18,
    right: 18,
    zIndex: 50,
    pointerEvents: "none",
  },
  toastCard: {
    pointerEvents: "auto",
    minWidth: 260,
    maxWidth: 360,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.92)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(12px)",
    padding: "12px 14px",
  },
  toastTitle: {
    fontWeight: 900,
    fontSize: 13,
  },
  toastSub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  nextMoveCard: {
    borderRadius: 26,
    border: "1px solid rgba(125,211,252,0.20)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.80))",
    boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  nextMoveCalm: {
    border: "1px solid rgba(148,163,184,0.16)",
  },
  nextMoveInfo: {
    border: "1px solid rgba(56,189,248,0.24)",
    background:
      "linear-gradient(135deg, rgba(8,47,73,0.66), rgba(15,23,42,0.86))",
  },
  nextMoveWarning: {
    border: "1px solid rgba(251,191,36,0.30)",
    background:
      "linear-gradient(135deg, rgba(120,53,15,0.62), rgba(15,23,42,0.88))",
  },
  nextMoveDanger: {
    border: "1px solid rgba(248,113,113,0.34)",
    background:
      "linear-gradient(135deg, rgba(127,29,29,0.66), rgba(15,23,42,0.90))",
  },
  nextMoveCopy: {
    minWidth: 0,
    flex: "1 1 420px",
  },
  nextMoveTopLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 6,
  },
  nextMovePriorityPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 22,
    padding: "0 9px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  nextMoveEyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.90)",
  },
  nextMoveTitle: {
    fontSize: 28,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  nextMoveSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.48,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 650,
    maxWidth: 760,
  },
  nextMoveRationale: {
    marginTop: 10,
    padding: "8px 10px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.24)",
    color: "rgba(226,232,240,0.72)",
    fontSize: 12,
    lineHeight: 1.42,
    fontWeight: 700,
    maxWidth: 820,
  },
  nextMoveBtn: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.26)",
    background: "rgba(56,189,248,0.16)",
    color: "rgba(240,249,255,0.98)",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dayStatusCard: {
    borderRadius: 20,
    border: "1px solid rgba(148,163,184,0.14)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.80), rgba(2,6,23,0.54))",
    padding: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    boxShadow: "0 14px 42px rgba(0,0,0,0.18)",
  },
  dayStatusCopy: {
    minWidth: 0,
    flex: "1 1 420px",
  },
  dayStatusEyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.88)",
    marginBottom: 5,
  },
  dayStatusTitle: {
    fontSize: 17,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.96)",
  },
  dayStatusSubtitle: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.72)",
    fontWeight: 650,
    maxWidth: 760,
  },
  dayStatusPills: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  dayStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.045)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  heroCard: {
    borderRadius: 24,
    border: "1px solid rgba(125,211,252,0.14)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.08), rgba(124,58,237,0.06) 38%, rgba(255,255,255,0.035) 100%)",
    boxShadow: "0 24px 72px rgba(0,0,0,0.24)",
    backdropFilter: "blur(12px)",
    padding: 18,
  },
  heroTopRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  heroSubtitle: {
    marginTop: 8,
    maxWidth: 760,
    fontSize: 14,
    lineHeight: 1.58,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 650,
  },
  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  heroPrimaryBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.24)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.24), rgba(124,58,237,0.24))",
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(8,12,28,0.20)",
  },
  heroSecondaryBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  heroMetaRow: {
    marginTop: 14,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    fontSize: 12,
    fontWeight: 900,
  },
  metaPillSoft: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(226,232,240,0.84)",
    fontSize: 12,
    fontWeight: 800,
  },
  metaPillWarning: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(251,191,36,0.24)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,243,205,0.98)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  metaPillInfo: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "7px 11px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(224,242,254,0.98)",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  heroBottomRow: {
    marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  heroMoodTitle: {
    fontSize: 26,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  heroMoodSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.82)",
    maxWidth: 720,
  },
  heroStatsRow: {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  heroStat: {
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.88,
  },
  heroStatDot: {
    opacity: 0.34,
    fontWeight: 900,
  },
  heroKpi: {
    minWidth: 140,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  heroKpiLabel: {
    fontSize: 11,
    opacity: 0.62,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  heroKpiNumber: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-1px",
    lineHeight: 1,
  },
  heroKpiHint: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.68,
    lineHeight: 1.4,
  },
  sectionCard: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(10,14,28,0.72)",
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(12px)",
  },
  railCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  railTitle: {
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.98)",
  },
  railActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  railSecondary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  premiumRail: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(196,181,253,0.26)",
    background:
      "linear-gradient(135deg, rgba(76,29,149,0.74), rgba(15,23,42,0.88))",
    boxShadow: "0 18px 40px rgba(76,29,149,0.20)",
  },
  premiumRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(233,213,255,0.92)",
  },
  premiumRailSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(243,232,255,0.84)",
  },
  premiumRailPrimary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(216,180,254,0.34)",
    background: "rgba(168,85,247,0.24)",
    color: "rgba(255,255,255,0.98)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  premiumRailProof: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(233,213,255,0.76)",
    fontWeight: 750,
  },
  premiumRailProofLabel: {
    padding: "4px 8px",
    borderRadius: 999,
    border: "1px solid rgba(216,180,254,0.24)",
    background: "rgba(168,85,247,0.16)",
    color: "rgba(250,245,255,0.94)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  valueRail: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(52,211,153,0.22)",
    background:
      "linear-gradient(135deg, rgba(20,83,45,0.76), rgba(15,23,42,0.84))",
  },
  valueRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(134,239,172,0.90)",
  },
  valueRailSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(220,252,231,0.84)",
  },
  valueRailPrimary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(74,222,128,0.26)",
    background: "rgba(34,197,94,0.20)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  urgentRail: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(245,158,11,0.26)",
    background:
      "linear-gradient(135deg, rgba(120,53,15,0.62), rgba(30,41,59,0.76))",
  },
  urgentRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(254,243,199,0.92)",
  },
  urgentRailSub: {
    fontSize: 13,
    lineHeight: 1.48,
    color: "rgba(255,237,213,0.86)",
  },
  urgentRailPrimary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(251,191,36,0.30)",
    background: "rgba(245,158,11,0.26)",
    color: "rgba(255,251,235,0.98)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  loadingCard: {
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
  },
  loadingSub: {
    fontSize: 12,
    opacity: 0.68,
    marginTop: 2,
  },
  sectionHeadMini: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.82)",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  sectionLinkBtn: {
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
  },
  emptyBlock: {
    marginTop: 14,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  emptySub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.55,
    maxWidth: 640,
  },
  emptyBtn: {
    marginTop: 14,
    padding: "11px 14px",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(124,58,237,0.18))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  eventsList: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  },
  eventRow: {
    width: "100%",
    minHeight: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    textAlign: "left",
  },
  featuredEventRow: {
    width: "100%",
    minHeight: 74,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "16px 16px",
    borderRadius: 18,
    border: "1px solid rgba(96,165,250,0.30)",
    background:
      "linear-gradient(180deg, rgba(59,130,246,0.18), rgba(30,41,59,0.40))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 18px 42px rgba(37,99,235,0.18)",
  },
  eventRowHighlight: {
    border: "1px solid rgba(56,189,248,0.45)",
    boxShadow: "0 0 0 1px rgba(56,189,248,0.22) inset",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(124,58,237,0.10))",
  },
  eventLeft: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  featuredEventEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(191,219,254,0.94)",
    marginBottom: 2,
  },
  eventWhen: {
    fontSize: 11,
    fontWeight: 850,
    opacity: 0.72,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: 900,
    lineHeight: 1.35,
    letterSpacing: "-0.01em",
  },
  eventMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  statusPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
  },
  softPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 11,
    fontWeight: 900,
  },
  proposalContextLine: {
    fontSize: 11,
    lineHeight: 1.4,
    color: "rgba(203,213,225,0.72)",
    fontWeight: 700,
  },
  seeMoreBtn: {
    marginTop: 12,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "11px 14px",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 13,
  },
  decisionsList: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  },
  decisionRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
  },
  decisionIcon: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 15,
    fontWeight: 900,
  },
  decisionIconNormal: {
    border: "1px solid rgba(52,211,153,0.28)",
    background: "rgba(52,211,153,0.12)",
  },
  decisionIconFallback: {
    border: "1px solid rgba(251,191,36,0.28)",
    background: "rgba(251,191,36,0.14)",
  },
  decisionContent: {
    minWidth: 0,
    flex: 1,
    display: "grid",
    gap: 6,
  },
  decisionTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  decisionTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  decisionWhen: {
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.68,
    whiteSpace: "nowrap",
  },
  decisionSubtitle: {
    fontSize: 13,
    opacity: 0.76,
    lineHeight: 1.5,
  },
  decisionBadge: {
    display: "inline-flex",
    alignItems: "center",
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },
  decisionBadgeManual: {
    border: "1px solid rgba(52,211,153,0.25)",
    background: "rgba(52,211,153,0.12)",
    color: "rgba(187,247,208,0.95)",
  },
  decisionBadgeFallback: {
    border: "1px solid rgba(251,191,36,0.25)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.95)",
  },
  summaryBootCard: {
    borderRadius: 26,
    border: "1px solid rgba(125,211,252,0.18)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.74))",
    padding: 22,
    display: "flex",
    alignItems: "center",
    gap: 14,
    boxShadow: "0 22px 70px rgba(2,6,23,0.30)",
  },
  summaryBootPulse: {
    width: 13,
    height: 13,
    borderRadius: 999,
    background: "rgba(96,165,250,0.96)",
    boxShadow: "0 0 0 9px rgba(96,165,250,0.10)",
    flexShrink: 0,
  },
  summaryBootCopy: {
    minWidth: 0,
    display: "grid",
    gap: 4,
  },
  summaryBootEyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
    color: "rgba(125,211,252,0.92)",
  },
  summaryBootTitle: {
    fontSize: 22,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(248,250,252,0.98)",
  },
  summaryBootSubtitle: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.76)",
    maxWidth: 680,
  },
  firstActivationCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    border: "1px solid rgba(96,165,250,0.22)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.82))",
    padding: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    boxShadow: "0 28px 80px rgba(2,6,23,0.34)",
  },
  firstActivationCopy: {
    minWidth: 0,
    flex: "1 1 460px",
    display: "grid",
    gap: 10,
  },
  firstActivationEyebrow: {
    width: "fit-content",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.22)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(186,230,253,0.96)",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.10em",
  },
  firstActivationTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    color: "rgba(248,250,252,0.98)",
  },
  firstActivationSubtitle: {
    margin: 0,
    maxWidth: 700,
    fontSize: 15,
    lineHeight: 1.6,
    color: "rgba(226,232,240,0.82)",
  },
  firstActivationSteps: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  firstActivationStep: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.58)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 12,
    fontWeight: 850,
  },
  firstActivationActions: {
    flex: "0 1 260px",
    display: "grid",
    gap: 10,
    minWidth: 220,
  },
  firstActivationPrimary: {
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.30)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.96), rgba(37,99,235,0.92))",
    color: "white",
    fontSize: 14,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 16px 34px rgba(30,64,175,0.28)",
  },
  firstActivationSecondary: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.62)",
    color: "rgba(226,242,255,0.92)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  quickGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  quickCard: {
    minHeight: 100,
    display: "grid",
    alignContent: "start",
    gap: 8,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.025))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    textAlign: "left",
    boxShadow: "0 12px 34px rgba(0,0,0,0.16)",
  },
  quickTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.01em",
  },
  quickSub: {
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.5,
  },
  focusRailCard: {
    borderRadius: 20,
    border: "1px solid rgba(96,165,250,0.18)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(30,41,59,0.76))",
    padding: 16,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "center",
    flexWrap: "wrap",
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  },
  focusRailCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  focusRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
  },
  focusRailTitle: {
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.18,
    letterSpacing: "-0.02em",
    color: "rgba(255,255,255,0.98)",
  },
  focusRailSubtitle: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.78)",
    maxWidth: 680,
  },
  focusRailBtn: {
    minHeight: 44,
    padding: "0 16px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.24)",
    background: "rgba(56,189,248,0.12)",
    color: "rgba(240,249,255,0.98)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
}