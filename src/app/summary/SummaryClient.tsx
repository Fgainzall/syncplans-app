"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { parseQuickCapture } from "@/lib/quickCaptureParser";
import PremiumHeader from "@/components/PremiumHeader";
import Section from "@/components/ui/Section";
import Card from "@/components/ui/Card";
import { getDisplayName } from "@/lib/profilesDb";
import { filterOutDeclinedEvents } from "@/lib/eventResponsesDb";
import {
  getSuggestedTimeSlots,
  getSuggestionContextLabel,
} from "@/lib/timeSuggestions";
import supabase from "@/lib/supabaseClient";
import { getLearningSignals } from "@/lib/learningSignals";
import { buildLearnedTimeProfile } from "@/lib/learningProfile";
import type { LearnedTimeProfile } from "@/lib/learningTypes";
import SummaryQuickCaptureCard from "./SummaryQuickCaptureCard";
import { getEventStatusUi } from "@/lib/eventStatusUi";
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
import {
  addDays,
  buildCaptureShareUrl,
  buildConflictAlert,
  buildProposalLine,
  buildShareToastLabel,
  buildSmartInterpretation,
  buildWhatsAppShareText,
  canUseClipboard,
  canUseNativeShare,
  cleanTemporalNoise,
  eventOverlapsWindow,
  fmtDay,
  fmtTime,
  formatQuickCapturePreview,
  getQuickCaptureExamples,
  getSmartInterpretationLabel,
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

function useIsMobileWidth(maxWidth = 520) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setIsMobile(!!mq.matches);

    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }

    // @ts-ignore
    mq.addListener(apply);
    return () => {
      // @ts-ignore
      mq.removeListener(apply);
    };
  }, [maxWidth]);

  return isMobile;
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
    unreadConflictAlert,
    recentDecisions,
    proposalResponsesMap,
    proposalResponseGroupsMap,
    proposalProfilesMap,
    showToast,
  } = useSummaryData({ appliedToast });

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
    return groups.find((g) => String(g.id) === String(activeGroupId)) ?? null;
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
    groups.find((group) => String(group.id) === String(suggestedContextGroupId)) ??
    null
  );
}, [groups, suggestedContextGroupId]);

const suggestedContextGroupType = useMemo(() => {
  return normalizeSuggestionGroupType(
    String(suggestedContextGroup?.type ?? activeGroupType)
  );
}, [suggestedContextGroup, activeGroupType, normalizeSuggestionGroupType]);

useEffect(() => {
  let cancelled = false;

  async function hydrateLearnedQuickCaptureProfile() {
    const raw = quickCaptureValue.trim();

    if (!raw) {
      if (!cancelled) setLearnedQuickCaptureProfile(null);
      return;
    }

    try {
      const signals = await getLearningSignals({ daysBack: 120 });

      if (cancelled) return;

      if (suggestedContextGroupId) {
        const profile = buildLearnedTimeProfile(signals, {
          scope: "group",
          groupId: suggestedContextGroupId,
        });

        setLearnedQuickCaptureProfile(profile);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      const userId = String(user?.id ?? "").trim();

      if (!userId) {
        setLearnedQuickCaptureProfile(null);
        return;
      }

      const profile = buildLearnedTimeProfile(signals, {
        scope: "user",
        userId,
      });

      setLearnedQuickCaptureProfile(profile);
    } catch {
      if (!cancelled) setLearnedQuickCaptureProfile(null);
    }
  }

  void hydrateLearnedQuickCaptureProfile();

  return () => {
    cancelled = true;
  };
}, [quickCaptureValue, suggestedContextGroupId]);

const timeSuggestions = useMemo(() => {
  const raw = quickCaptureValue.trim();
  if (!raw) return [];

  const parsed = parseQuickCapture(raw);

  if (parsed.date) return [];

  return getSuggestedTimeSlots(events, suggestedContextGroupType, raw, {
    learnedProfile: learnedQuickCaptureProfile,
  });
}, [
  quickCaptureValue,
  events,
  suggestedContextGroupType,
  learnedQuickCaptureProfile,
]);

const timeSuggestionsLabel = useMemo(() => {
  const raw = quickCaptureValue.trim();
  if (!raw || timeSuggestions.length === 0) return null;

  return getSuggestionContextLabel(raw, suggestedContextGroupType);
}, [quickCaptureValue, timeSuggestions, suggestedContextGroupType]);
  const quickCaptureHeadline = useMemo(() => {
    if (!activeGroupId) return "Escribe lo que tienes en mente";
    if (activeGroupType === "pair") return "Planéalo en una línea";
    if (activeGroupType === "family") return "Organiza lo importante en segundos";
    return "Dime qué quieres hacer";
  }, [activeGroupId, activeGroupType]);

  const quickCaptureSubcopy = useMemo(() => {
    if (!activeGroupId) {
      return "Escribe algo simple y te lo dejo listo para revisarlo sin dar vueltas.";
    }

    return `Lo prepararé con el contexto de ${activeLabel} para que entres directo a revisarlo.`;
  }, [activeGroupId, activeLabel]);

  const normalizedEvents = useMemo(() => {
    const mapped = (events ?? [])
      .map(normalizeEvent)
      .filter(Boolean) as SummaryEvent[];

    return filterOutDeclinedEvents(mapped, declinedEventIds);
  }, [events, declinedEventIds]);

  const visibleEvents = useMemo(() => {
    return [...normalizedEvents].sort((a, b) => {
      const aMs = a.start?.getTime() ?? 0;
      const bMs = b.start?.getTime() ?? 0;
      return aMs - bMs;
    });
  }, [normalizedEvents]);

  const conflictAlert = useMemo(() => {
    const baseAlert = buildConflictAlert(
      visibleEvents,
      groups,
      resMap,
      ignoredConflictKeys
    );

    return {
      count: Math.max(baseAlert.count, unreadConflictAlert.count),
      latestEventId:
        unreadConflictAlert.latestEventId ?? baseAlert.latestEventId ?? null,
    };
  }, [visibleEvents, groups, resMap, ignoredConflictKeys, unreadConflictAlert]);

  const upcomingAll = useMemo(() => {
    const today = startOfTodayLocal();
    const windowEnd = addDays(today, 7);

    return visibleEvents.filter((e) =>
      eventOverlapsWindow(e, today, windowEnd)
    );
  }, [visibleEvents]);

  const upcomingStats = useMemo(() => {
    let personal = 0;
    let group = 0;
    let external = 0;

    for (const e of upcomingAll) {
      if (e.isExternal) external += 1;
      if (e.groupId) group += 1;
      else personal += 1;
    }

    return {
      total: upcomingAll.length,
      personal,
      group,
      external,
    };
  }, [upcomingAll]);

  const UPCOMING_LIMIT = isMobile ? 3 : 6;

  const upcoming = useMemo(
    () => upcomingAll.slice(0, UPCOMING_LIMIT),
    [upcomingAll, UPCOMING_LIMIT]
  );

  const nextEvent = upcoming.length > 0 ? upcoming[0] : null;
  const remainingUpcoming =
    upcoming.length > 1 ? upcoming.slice(1) : ([] as SummaryEvent[]);

  const showSeeMore = !booting && upcomingAll.length > UPCOMING_LIMIT;

  const mood = useMemo(() => {
    if (booting) {
      return {
        title: "Cargando…",
        subtitle: "Preparando tu resumen",
        tone: "neutral" as const,
      };
    }

    const count = upcomingStats.total;

    if (count === 0) {
      return {
        title: getWeekMoodLabel(count),
        subtitle: getWeekSubtitle(count),
        tone: "clear" as const,
      };
    }

    if (count <= 3) {
      return {
        title: getWeekMoodLabel(count),
        subtitle: getWeekSubtitle(count),
        tone: "calm" as const,
      };
    }

    return {
      title: getWeekMoodLabel(count),
      subtitle: getWeekSubtitle(count),
      tone: "busy" as const,
    };
  }, [booting, upcomingStats]);

  const title = "Resumen";
  const summarySubtitle = activeGroupId ? `Hoy · ${activeLabel} · tu siguiente paso` : "Hoy · Personal · tu siguiente paso";
  const showCreateGroupNudge = groups.length === 0;
  const showInviteNudge = groups.length > 0 && upcomingStats.group === 0;

  const moodAccentBorder =
    mood.tone === "clear"
      ? "rgba(34,197,94,0.85)"
      : mood.tone === "busy"
        ? "rgba(251,191,36,0.9)"
        : "rgba(56,189,248,0.9)";

  const moodAccentGlow =
    mood.tone === "clear"
      ? "rgba(34,197,94,0.35)"
      : mood.tone === "busy"
        ? "rgba(251,191,36,0.35)"
        : "rgba(56,189,248,0.35)";

  const openConflictCenter = useCallback(() => {
    if (conflictAlert.latestEventId) {
      router.push(
        `/conflicts/detected?eventId=${encodeURIComponent(
          conflictAlert.latestEventId
        )}`
      );
      return;
    }

    router.push("/conflicts/detected");
  }, [router, conflictAlert]);

const navigateFromQuickCapture = useCallback(
  (value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return;

    const parsed = parseQuickCapture(raw);
    const params = new URLSearchParams();
const cleanedNotes = cleanTemporalNoise(String(parsed.notes || "").trim());
    const smart = buildSmartInterpretation({
      raw,
      groups,
      activeGroupId,
    });

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
    if (parsed.date) params.set("date", parsed.date.toISOString());
    if (parsed.durationMinutes) {
      params.set("duration", String(parsed.durationMinutes));
    }
    if (cleanedNotes) params.set("notes", cleanedNotes);

    router.push(`/events/new/details?${params.toString()}`);
  },
  [groups, activeGroupId, router]
);

const navigateFromSuggestedSlot = useCallback(
  (value: string, suggestedDate: Date) => {
    const raw = String(value || "").trim();
    if (!raw) return;

    const parsed = parseQuickCapture(raw);
    const params = new URLSearchParams();
const cleanedNotes = cleanTemporalNoise(String(parsed.notes || "").trim());
    const smart = buildSmartInterpretation({
      raw,
      groups,
      activeGroupId,
    });

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
if (cleanedNotes) params.set("notes", cleanedNotes);
    if (parsed.durationMinutes) {
      params.set("duration", String(parsed.durationMinutes));
    }

    params.set("date", suggestedDate.toISOString());

    router.push(`/events/new/details?${params.toString()}`);
  },
  [groups, activeGroupId, router]
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

  const handleQuickCaptureKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      handleQuickCaptureSubmit();
    },
    [handleQuickCaptureSubmit]
  );

  const handleOpenCapture = useCallback(() => {
    const raw = quickCaptureValue.trim();

    if (!raw) {
      router.push("/capture?source=summary");
      return;
    }

    const params = new URLSearchParams();
    params.set("text", raw);
    params.set("source", "summary");

    router.push(`/capture?${params.toString()}`);
  }, [router, quickCaptureValue]);

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

  const getProposalBadgeForEvent = useCallback(
    (eventId: string | null | undefined) => {
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

      const profile = proposalProfilesMap[String(row.user_id ?? "").trim()];
      const name = getDisplayName(profile);
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
          groups.find((group) => String(group.id) === String(event.groupId ?? ""))
            ?.type ?? "personal";

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

    const computed = filterIgnoredConflicts(
      computeVisibleConflicts(conflictEvents),
      ignoredConflictKeys
    ).filter((conflict) => !resolutionForConflict(conflict, resMap));

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

  const primaryAction = useMemo(() => {
    if (conflictAlert.count > 0) {
      return {
        eyebrow: "Lo más urgente ahora",
        title: `Resuelve ${conflictAlert.count} conflicto${conflictAlert.count === 1 ? "" : "s"} antes de que vuelva el ruido`,
        subtitle:
          "Este es el punto donde SyncPlans más valor devuelve: decidir una vez y dejarlo claro para todos.",
        primaryLabel: "Resolver conflictos",
        primaryAction: openConflictCenter,
        secondaryLabel: "Abrir calendario",
        secondaryAction: () => router.push("/calendar"),
      };
    }

    if (pendingInviteCount > 0) {
      return {
        eyebrow: "Lo más útil ahora",
        title: `Hay ${pendingInviteCount} invitación${pendingInviteCount === 1 ? "" : "es"} esperando una decisión`,
        subtitle:
          "Si alguien está por entrar, este es el siguiente paso que más ayuda a que la coordinación se vuelva compartida de verdad.",
        primaryLabel: "Revisar invitaciones",
        primaryAction: () => router.push("/invitations"),
        secondaryLabel: showInviteNudge ? "Abrir grupos" : "Abrir eventos",
        secondaryAction: () => router.push(showInviteNudge ? "/groups" : "/events"),
      };
    }

    if (pendingAttention.proposals > 0 || pendingAttention.captures > 0) {
      return {
        eyebrow: "Lo más útil ahora",
        title: "Hay respuestas y ajustes esperando que cierres el ciclo",
        subtitle:
          "Responder esto rápido mantiene a SyncPlans como referencia viva, no como una lista bonita que luego nadie mira.",
        primaryLabel: "Revisar pendientes",
        primaryAction: () => router.push("/events"),
        secondaryLabel: "Abrir calendario",
        secondaryAction: () => router.push("/calendar"),
      };
    }

    if (showCreateGroupNudge) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Abre tu primer espacio compartido",
        subtitle:
          "El producto cambia de categoría cuando dejas de coordinar solo y creas el primer grupo desde donde otros también ven lo mismo.",
        primaryLabel: "Crear grupo",
        primaryAction: () => router.push("/groups/new"),
        secondaryLabel: "Ver grupos",
        secondaryAction: () => router.push("/groups"),
      };
    }

    if (showInviteNudge) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Trae a la otra persona dentro del sistema",
        subtitle:
          "Ya tienes estructura. Ahora toca meter a alguien más para que respuestas, conflictos y decisiones también vivan aquí.",
        primaryLabel: "Traer a alguien",
        primaryAction: () => router.push("/groups"),
        secondaryLabel: "Abrir eventos",
        secondaryAction: () => router.push("/events"),
      };
    }

    if (!nextEvent) {
      return {
        eyebrow: "Siguiente mejor paso",
        title: "Crea el próximo plan para que la semana no se quede vacía",
        subtitle:
          "Si no hay nada cerca, conviene meter algo útil ya y seguir construyendo hábito desde aquí.",
        primaryLabel: "Crear plan",
        primaryAction: () => router.push("/events/new/details?type=personal"),
        secondaryLabel: "Abrir calendario",
        secondaryAction: () => router.push("/calendar"),
      };
    }

    return {
      eyebrow: "Tu base de esta semana",
      title: "Tu agenda ya tiene contexto. Elige dónde quieres actuar.",
      subtitle:
        "Cuando no hay nada urgente, lo mejor es revisar calendario o eventos sin perder el hilo compartido.",
      primaryLabel: "Abrir calendario",
      primaryAction: () => router.push("/calendar"),
      secondaryLabel: "Abrir eventos",
      secondaryAction: () => router.push("/events"),
    };
  }, [
    conflictAlert.count,
    nextEvent,
    openConflictCenter,
    pendingAttention.captures,
    pendingAttention.proposals,
    pendingInviteCount,
    router,
    showCreateGroupNudge,
    showInviteNudge,
  ]);

  const getStatusBadgeForEvent = useCallback(
    (eventId: string | null | undefined) => {
      const status = getUnifiedEventStatus({
        eventId,
        conflictEventIds,
        proposalResponseGroupsMap,
      });

      if (!status || status === "scheduled") return null;

      const conflictsCount = eventId
        ? conflictEventIds.has(String(eventId))
          ? 1
          : 0
        : 0;

      const statusUi = getEventStatusUi(status, { conflictsCount });

      return {
        label: statusUi.label,
        compactLabel: statusUi.compactLabel,
        subtitle: statusUi.subtitle,
        tone: statusUi.tone,
        priority: statusUi.priority,
        ctaLabel: statusUi.ctaLabel,
        style: statusUi.badgeStyle,
      };
    },
    [conflictEventIds, proposalResponseGroupsMap]
  );

  return (
    <div style={styles.page} className="spSum-page">
      {toast && (
        <div style={styles.toastWrap}>
          <div style={styles.toastCard}>
            <div style={styles.toastTitle}>{toast.title}</div>
            {toast.subtitle ? (
              <div style={styles.toastSub}>{toast.subtitle}</div>
            ) : null}
          </div>
        </div>
      )}

      <Section style={styles.shell} className="spSum-shell">
        <PremiumHeader title={title} subtitle={summarySubtitle} sticky={false} />

         <SummaryQuickCaptureCard
  value={quickCaptureValue}
  busy={quickCaptureBusy}
  preview={quickCapturePreview}
  interpretation={smartInterpretation}
  interpretationLabel={smartInterpretationLabel}
  examples={quickCaptureExamples}
  activeGroupName={activeLabel}
  activeGroupType={activeGroupType}
  groups={groups}
  onChange={setQuickCaptureValue}
  onSubmit={handleQuickCaptureSubmit}
  onShare={handleCopyCaptureLink}
  onWhatsApp={handleShareToWhatsApp}
  onExampleClick={handleQuickCaptureExample}
/>

          <Card style={styles.card} className="spSum-card">
            {conflictAlert.count > 0 ? (
              <button
                onClick={openConflictCenter}
                style={styles.conflictBanner}
                className="spSum-conflictBanner"
              >
                <div style={styles.conflictBannerLeft}>
                  <div style={styles.conflictBannerEyebrow}>Atención</div>
                  <div style={styles.conflictBannerTitle}>
                    Tienes {conflictAlert.count} conflicto{conflictAlert.count === 1 ? "" : "s"} pendiente{conflictAlert.count === 1 ? "" : "s"} por resolver
                  </div>
                  <div style={styles.conflictBannerSub}>Revísalo ahora y deja una sola versión clara para todos antes de que el ruido vuelva al chat.</div>
                </div>

                <div style={styles.conflictBannerCta}>Resolver</div>
              </button>
            ) : null}

            <div
              style={{
                ...styles.stateRow,
                boxShadow: `0 0 18px ${moodAccentGlow}`,
                borderColor: moodAccentBorder,
              }}
            >
              <div style={styles.stateLeft}>
                <div style={styles.stateLabelRow}>
                  <span style={styles.statePill}>{contextLabel}</span>
                  {loading && !booting ? (
                    <span style={styles.stateLoadingBadge}>Actualizando…</span>
                  ) : null}
                </div>

                <div style={styles.stateMoodTitle}>{mood.title}</div>
                <div style={styles.stateMoodSub}>{mood.subtitle}</div>

                <div style={styles.stateStatsRow}>
                  <span style={styles.stateStat}>{upcomingStats.total} total</span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>{upcomingStats.personal} personal</span>
                  <span style={styles.stateStatDot}>·</span>
                  <span style={styles.stateStat}>{upcomingStats.group} grupo</span>
                  {upcomingStats.external > 0 ? (
                    <>
                      <span style={styles.stateStatDot}>·</span>
                      <span style={styles.stateStat}>{upcomingStats.external} externo</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={styles.stateKpi}>
                <div style={styles.stateKpiLabel}>7 días</div>
                <div style={styles.stateKpiNumber}>{upcomingStats.total}</div>
                <div style={styles.stateKpiHint}>Eventos visibles</div>
              </div>
            </div>

            <div style={styles.returnRail}>
              <div style={styles.returnRailCopy}>
                <div style={styles.returnRailEyebrow}>{primaryAction.eyebrow}</div>
                <div style={styles.returnRailTitle}>{primaryAction.title}</div>
                <div style={styles.returnRailSub}>{primaryAction.subtitle}</div>
              </div>

              <div style={styles.returnRailActions}>
                <button
                  type="button"
                  style={styles.returnRailPrimary}
                  onClick={primaryAction.primaryAction}
                >
                  {primaryAction.primaryLabel}
                </button>
                <button
                  type="button"
                  style={styles.returnRailSecondary}
                  onClick={primaryAction.secondaryAction}
                >
                  {primaryAction.secondaryLabel}
                </button>
              </div>
            </div>

            {valueMoments.hasValue ? (
              <div style={styles.valueRail}>
                <div style={styles.valueRailCopy}>
                  <div style={styles.valueRailEyebrow}>Valor visible</div>
                  <div style={styles.valueRailTitle}>
                    SyncPlans ya está ordenando algo real por ti.
                  </div>
                  <div style={styles.valueRailSub}>
                    {valueMoments.resolvedDecisions > 0
                      ? `${valueMoments.resolvedDecisions} decisión${valueMoments.resolvedDecisions === 1 ? "" : "es"} reciente${valueMoments.resolvedDecisions === 1 ? "" : "s"} ya resuelta${valueMoments.resolvedDecisions === 1 ? "" : "s"}`
                      : null}
                    {valueMoments.resolvedDecisions > 0 && valueMoments.autoAdjusted > 0 ? " · " : ""}
                    {valueMoments.autoAdjusted > 0
                      ? `${valueMoments.autoAdjusted} ajuste${valueMoments.autoAdjusted === 1 ? "" : "s"} automático${valueMoments.autoAdjusted === 1 ? "" : "s"} aplicado${valueMoments.autoAdjusted === 1 ? "" : "s"}`
                      : null}
                    {(valueMoments.resolvedDecisions > 0 || valueMoments.autoAdjusted > 0) && valueMoments.agendaFeelsClear ? " · " : ""}
                    {valueMoments.agendaFeelsClear ? "tu agenda visible está clara en este momento" : null}
                    {(valueMoments.resolvedDecisions > 0 || valueMoments.autoAdjusted > 0 || valueMoments.agendaFeelsClear) && pendingAttention.captures > 0 ? " · " : ""}
                    {pendingAttention.captures > 0
                      ? `${pendingAttention.captures} respuesta${pendingAttention.captures === 1 ? "" : "s"} externa${pendingAttention.captures === 1 ? "" : "s"} ya entró${pendingAttention.captures === 1 ? "" : "aron"} al flujo`
                      : null}
                  </div>
                </div>

                <div style={styles.valueRailActions}>
                  <button
                    type="button"
                    style={styles.valueRailPrimary}
                    onClick={() => router.push(valueMoments.resolvedDecisions > 0 ? "/events" : "/calendar")}
                  >
                    {valueMoments.resolvedDecisions > 0 ? "Ver valor en eventos" : "Abrir calendario"}
                  </button>
                </div>
              </div>
            ) : null}

            {(decisionSummary.pendingProposals > 0 ||
              decisionSummary.adjustedProposals > 0) ? (
              <div style={styles.decisionChipsRow}>
                {decisionSummary.pendingProposals > 0 ? (
                  <button onClick={() => router.push("/events")} style={{ ...styles.decisionChip, ...styles.decisionChipPending }}>
                    {decisionSummary.pendingProposals} propuesta{decisionSummary.pendingProposals === 1 ? "" : "s"} esperando decisión
                  </button>
                ) : null}

                {decisionSummary.adjustedProposals > 0 ? (
                  <button onClick={() => router.push("/events")} style={{ ...styles.decisionChip, ...styles.decisionChipInfo }}>
                    {decisionSummary.adjustedProposals} ajuste{decisionSummary.adjustedProposals === 1 ? "" : "s"} pendiente{decisionSummary.adjustedProposals === 1 ? "" : "s"}
                  </button>
                ) : null}
              </div>
            ) : null}

            {booting ? (
              <div style={styles.loadingCard}>
                <div style={styles.loadingDot} />
                <div>
                  <div style={styles.loadingTitle}>Cargando…</div>
                  <div style={styles.loadingSub}>Resumen</div>
                </div>
              </div>
            ) : !nextEvent ? (
              <div style={styles.emptyBlock}>
                <div style={styles.emptyTitle}>{showCreateGroupNudge ? "Todavía no activaste el loop compartido" : "Sin coordinación cercana todavía"}</div>
                <div style={styles.emptySub}>{showCreateGroupNudge ? "Empieza creando tu primer grupo. Ese es el paso que convierte SyncPlans en una referencia compartida y no solo en una agenda ordenada." : "Todavía no tienes nada cerca dentro del sistema. Conviene meter el próximo plan aquí para que la semana no dependa de memoria, chat o improvisación."}</div>
                <button
                  onClick={primaryAction.primaryAction}
                  style={styles.emptyBtn}
                >
                  {showCreateGroupNudge ? "Crear grupo →" : "Crear plan →"}
                </button>
              </div>
            ) : (
              <>
                <div style={styles.nextBlock}>
                  <div style={styles.nextLabel}>Sigue</div>
                  <button
                    onClick={() => router.push("/calendar")}
                    style={{
                      ...styles.nextCard,
                      ...(highlightId &&
                      String(nextEvent?.id ?? "") === String(highlightId)
                        ? styles.eventRowHighlight
                        : {}),
                    }}
                    className="spSum-eventRow"
                  >
                    {(() => {
                      const start = nextEvent.start as Date;
                      const end = nextEvent.end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      return (
                        <>
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>{nextEvent.title}</div>
                            {(() => {
                              const proposalLine = getProposalLineForEvent(nextEvent.id);
                              return proposalLine ? (
                                <div style={styles.proposalContextLine}>{proposalLine}</div>
                              ) : null;
                            })()}
                          </div>

                          <div style={styles.eventMeta}>
                            {(() => {
                              const statusBadge = getStatusBadgeForEvent(nextEvent.id);
                              if (statusBadge) {
                                return (
                                  <span
                                    style={{
                                      ...styles.summaryStatusPill,
                                      ...statusBadge.style,
                                    }}
                                  >
                                    {statusBadge.label}
                                  </span>
                                );
                              }

                              const proposalBadge = getProposalBadgeForEvent(nextEvent.id);
                              return proposalBadge ? (
                                <span
                                  style={{
                                    ...styles.proposalPill,
                                    ...(proposalBadge.tone === "accepted"
                                      ? styles.proposalPillAccepted
                                      : proposalBadge.tone === "adjusted"
                                        ? styles.proposalPillAdjusted
                                        : styles.proposalPillPending),
                                  }}
                                >
                                  {proposalBadge.label}
                                </span>
                              ) : null;
                            })()}
                            {nextEvent.isExternal ? (
                              <span style={styles.pill}>Externo</span>
                            ) : null}
                            {nextEvent.groupId ? (
                              <span style={styles.pillSoft}>Grupo</span>
                            ) : (
                              <span style={styles.pillSoft}>Personal</span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </button>
                </div>

                {remainingUpcoming.length > 0 && (
                  <div style={styles.eventsList} className="spSum-eventsList">
                    {remainingUpcoming.map((e) => {
                      const start = e.start as Date;
                      const end = e.end as Date | null;

                      const when = end
                        ? `${fmtDay(start)} · ${fmtTime(start)}–${fmtTime(end)}`
                        : `${fmtDay(start)} · ${fmtTime(start)}`;

                      const isHighlighted =
                        highlightId && String(e.id ?? "") === String(highlightId);

                      return (
                        <button
                          key={e.id ?? `${e.title}-${start.toISOString()}`}
                          onClick={() => router.push("/calendar")}
                          style={{
                            ...styles.eventRow,
                            ...(isHighlighted ? styles.eventRowHighlight : {}),
                          }}
                          className="spSum-eventRow"
                        >
                          <div style={styles.eventLeft}>
                            <div style={styles.eventWhen}>{when}</div>
                            <div style={styles.eventTitle}>{e.title}</div>
                            {(() => {
                              const proposalLine = getProposalLineForEvent(e.id);
                              return proposalLine ? (
                                <div style={styles.proposalContextLine}>{proposalLine}</div>
                              ) : null;
                            })()}
                          </div>

                          <div style={styles.eventMeta}>
                            {(() => {
                              const statusBadge = getStatusBadgeForEvent(e.id);
                              if (statusBadge) {
                                return (
                                  <span
                                    style={{
                                      ...styles.summaryStatusPill,
                                      ...statusBadge.style,
                                    }}
                                  >
                                    {statusBadge.label}
                                  </span>
                                );
                              }

                              const proposalBadge = getProposalBadgeForEvent(e.id);
                              return proposalBadge ? (
                                <span
                                  style={{
                                    ...styles.proposalPill,
                                    ...(proposalBadge.tone === "accepted"
                                      ? styles.proposalPillAccepted
                                      : proposalBadge.tone === "adjusted"
                                        ? styles.proposalPillAdjusted
                                        : styles.proposalPillPending),
                                  }}
                                >
                                  {proposalBadge.label}
                                </span>
                              ) : null;
                            })()}
                            {e.isExternal ? <span style={styles.pill}>Externo</span> : null}
                            {e.groupId ? (
                              <span style={styles.pillSoft}>Grupo</span>
                            ) : (
                              <span style={styles.pillSoft}>Personal</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showSeeMore && (
                  <button
                    onClick={() => router.push("/calendar")}
                    style={styles.seeMoreBtn}
                    className="spSum-seeMore"
                  >
                    Ver calendario ({upcomingAll.length}) →
                  </button>
                )}
              </>
            )}
          </Card>

          <Card style={styles.card} className="spSum-card">
            <div style={styles.sectionHeadMini}>
              <div style={styles.sectionTitle}>Decisiones</div>
              <button
                onClick={() => router.push("/calendar")}
                style={styles.decisionsCta}
              >
                Calendario →
              </button>
            </div>

            {visibleDecisions.length === 0 ? (
              <div style={styles.decisionsEmpty}>
                <div style={styles.decisionsEmptyTitle}>Sin decisiones recientes</div>
                <div style={styles.decisionsEmptySub}>
                  Aquí aparecerán cuando resuelvas conflictos.
                </div>
              </div>
            ) : (
              <div style={styles.decisionsList}>
                {visibleDecisions.map((decision) => (
                  <div key={decision.id} style={styles.decisionRow}>
                    <div
                      style={{
                        ...styles.decisionIcon,
                        ...(decision.isFallback
                          ? styles.decisionIconFallback
                          : styles.decisionIconNormal),
                      }}
                    >
                      {decision.isFallback ? "⚠️" : "✓"}
                    </div>

                    <div style={styles.decisionContent}>
                      <div style={styles.decisionTopRow}>
                        <div style={styles.decisionTitle}>{decision.title}</div>
                        <div style={styles.decisionWhen}>{decision.whenLabel}</div>
                      </div>

                      <div style={styles.decisionSubtitle}>{decision.subtitle}</div>

                      <div
                        style={{
                          ...styles.decisionBadge,
                          ...(decision.isFallback
                            ? styles.decisionBadgeFallback
                            : styles.decisionBadgeManual),
                        }}
                      >
                        {decision.isFallback ? "Auto" : "Resuelto"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card style={styles.card} className="spSum-card">
            <div style={styles.sectionTitle}>Accesos rápidos</div>

            <div style={styles.quickGrid} className="spSum-quickGrid">
              <button
                onClick={primaryAction.primaryAction}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>{primaryAction.primaryLabel}</div>
                <div style={styles.quickSub}>{primaryAction.subtitle}</div>
              </button>

              <button
                onClick={() => router.push("/calendar")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>"Abrir calendario"</div>
                <div style={styles.quickSub}>"Ver semana y contexto compartido"</div>
              </button>

              <button
                onClick={() => router.push("/events")}
                style={styles.quickCard}
                className="spSum-quickCard"
              >
                <div style={styles.quickTitle}>"Abrir eventos"</div>
                <div style={styles.quickSub}>"Ver respuestas, estados y pendientes"</div>
              </button>
            </div>
          </Card>
      </Section>

      <style>{`
        @media (max-width: 720px) {
          .spSum-captureFootRow {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          .spSum-shell {
            padding-left: 14px !important;
            padding-right: 14px !important;
            padding-top: 14px !important;
            gap: 12px !important;
          }

          .spSum-card {
            border-radius: 18px !important;
            padding: 14px !important;
          }

          .spSum-captureCard {
            padding: 16px !important;
          }

          .spSum-eventsList {
            gap: 8px !important;
          }

          .spSum-eventRow {
            min-height: 70px !important;
            padding: 11px 12px !important;
          }

          .spSum-quickGrid {
            grid-template-columns: 1fr !important;
          }

          .spSum-captureFieldWrap {
            grid-template-columns: 1fr !important;
          }

          .spSum-captureInput {
            min-height: 52px !important;
          }

          .spSum-captureButton {
            width: 100% !important;
            min-height: 50px !important;
          }

          .spSum-captureDeepLinkButton {
            width: 100% !important;
            justify-content: center !important;
          }

          .spSum-quickCard {
            min-height: 88px !important;
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

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "18px 18px 0",
    display: "flex",
    flexDirection: "column",
    gap: 16,
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
    background: "rgba(7,11,22,0.72)",
    boxShadow: "0 24px 70px rgba(0,0,0,0.45)",
    backdropFilter: "blur(14px)",
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
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    padding: 16,
    boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
    backdropFilter: "blur(14px)",
  },
  captureCard: {
    borderRadius: 24,
    border: "1px solid rgba(125,211,252,0.14)",
    background:
      "linear-gradient(180deg, rgba(56,189,248,0.10), rgba(124,58,237,0.08) 42%, rgba(255,255,255,0.035) 100%)",
    padding: 18,
    boxShadow: "0 22px 72px rgba(0,0,0,0.24)",
    backdropFilter: "blur(16px)",
  },
  captureTopBand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  captureContextPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.16)",
    background: "rgba(56,189,248,0.10)",
    color: "rgba(226,242,255,0.92)",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  captureContextGhost: {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 11px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.74)",
    fontSize: 11,
    fontWeight: 850,
    whiteSpace: "nowrap",
  },
  captureHeaderRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  captureHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  captureCopyBlock: {
    maxWidth: 720,
  },
  captureDeepLinkButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.24)",
    background: "rgba(8,15,29,0.82)",
    color: "rgba(226,242,255,0.96)",
    padding: "0 16px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
    whiteSpace: "nowrap",
  },
  captureGhostButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(226,242,255,0.92)",
    padding: "0 16px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  captureWhatsappButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.30)",
    background: "rgba(34,197,94,0.14)",
    color: "rgba(233,255,240,0.96)",
    padding: "0 16px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 26px rgba(0,0,0,0.16)",
    whiteSpace: "nowrap",
  },
  captureShareHelperWrap: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    padding: "12px 14px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)",
  },
  captureShareHelperTitle: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(226,242,255,0.94)",
  },
  captureShareHelperText: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,242,255,0.72)",
    fontWeight: 650,
  },
  captureShareHelperExample: {
    fontSize: 12,
    lineHeight: 1.4,
    color: "rgba(125,211,252,0.92)",
    fontWeight: 800,
  },
  captureEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.86)",
  },
  captureTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  captureSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.55,
    opacity: 0.78,
    maxWidth: 640,
  },
  captureFieldWrap: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 10,
    alignItems: "stretch",
  },
  captureInput: {
    width: "100%",
    minHeight: 66,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,22,0.78)",
    color: "rgba(255,255,255,0.96)",
    padding: "0 16px",
    fontSize: 15,
    fontWeight: 700,
    outline: "none",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.03), 0 12px 28px rgba(0,0,0,0.16)",
  },
  captureButton: {
    minWidth: 124,
    minHeight: 66,
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.26), rgba(124,58,237,0.26))",
    color: "rgba(255,255,255,0.96)",
    fontSize: 14,
    fontWeight: 900,
    padding: "0 18px",
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(8,12,28,0.24)",
  },
  captureButtonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
    boxShadow: "none",
  },
  captureFootRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
    gap: 12,
    alignItems: "stretch",
  },
  captureExamplesBlock: {
    minWidth: 0,
  },
  captureExamplesLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.62,
    marginBottom: 8,
  },
  captureExamplesRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  captureExamplePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.035)",
    fontSize: 11,
    fontWeight: 800,
    opacity: 0.86,
  },
  capturePreviewCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(5,9,20,0.46)",
    padding: 12,
    display: "grid",
    alignContent: "start",
    gap: 8,
    minHeight: 100,
  },
  capturePreviewLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.82)",
  },
  capturePreviewValue: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(255,255,255,0.9)",
  },
  captureInterpretationHint: {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.4,
  color: "rgba(125,211,252,0.92)",
  fontWeight: 800,
},
  captureSuggestionsWrap: {
    marginTop: 10,
    display: "grid",
    gap: 8,
  },
  captureSuggestionsTitle: {
    fontSize: 12,
    lineHeight: 1.4,
    color: "rgba(226,242,255,0.78)",
    fontWeight: 800,
  },
  captureSuggestionsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  captureSuggestionChip: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.30)",
    background: "rgba(56,189,248,0.15)",
    color: "rgba(226,242,255,0.96)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  conflictBanner: {
    width: "100%",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: "13px 14px",
    borderRadius: 16,
    border: "1px solid rgba(251,191,36,0.20)",
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.10), rgba(239,68,68,0.06))",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
  },
  conflictBannerLeft: {
    display: "grid",
    gap: 4,
    textAlign: "left",
  },
  conflictBannerEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(255,230,160,0.9)",
  },
  conflictBannerTitle: {
    fontSize: 15,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  conflictBannerSub: {
    fontSize: 13,
    lineHeight: 1.45,
    color: "rgba(255,255,255,0.76)",
  },
  conflictBannerCta: {
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  stateRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 16,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.03))",
    flexWrap: "wrap",
  },
  stateLeft: {
    flex: 1,
    minWidth: 240,
  },
  stateLabelRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  statePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.9,
  },
  stateLoadingBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.10)",
    fontSize: 11,
    fontWeight: 900,
    opacity: 0.9,
  },
  stateMoodTitle: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.5px",
  },
  stateMoodSub: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.76,
    lineHeight: 1.45,
  },
  stateStatsRow: {
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  stateStat: {
    fontSize: 12,
    fontWeight: 850,
    opacity: 0.88,
  },
  stateStatDot: {
    opacity: 0.34,
    fontWeight: 900,
  },
  stateKpi: {
    minWidth: 140,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.18)",
    alignSelf: "stretch",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  stateKpiLabel: {
    fontSize: 11,
    opacity: 0.62,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },
  stateKpiNumber: {
    marginTop: 4,
    fontSize: 30,
    fontWeight: 950,
    letterSpacing: "-1px",
    lineHeight: 1,
  },
  stateKpiHint: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.68,
    lineHeight: 1.4,
  },
  loadingCard: {
    marginTop: 14,
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
  nextBlock: {
    marginTop: 16,
    display: "grid",
    gap: 8,
  },
  nextLabel: {
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.7,
  },
  nextCard: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
    color: "rgba(255,255,255,0.96)",
    cursor: "pointer",
    textAlign: "left",
  },
  eventsList: {
    marginTop: 12,
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
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(56,189,248,0.14)",
    border: "1px solid rgba(56,189,248,0.22)",
    fontSize: 11,
    fontWeight: 900,
  },
  pillSoft: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontSize: 11,
    fontWeight: 900,
  },
  proposalPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
  },
  proposalPillPending: {
    border: "1px solid rgba(251,191,36,0.25)",
    background: "rgba(251,191,36,0.12)",
    color: "rgba(255,236,179,0.95)",
  },
  proposalPillAccepted: {
    border: "1px solid rgba(52,211,153,0.24)",
    background: "rgba(52,211,153,0.12)",
    color: "rgba(209,250,229,0.96)",
  },
  proposalPillAdjusted: {
    border: "1px solid rgba(56,189,248,0.24)",
    background: "rgba(56,189,248,0.12)",
    color: "rgba(224,242,254,0.96)",
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
  sectionHeadMini: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  decisionsCta: {
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.95)",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
  },
  decisionsEmpty: {
    marginTop: 14,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px dashed rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.03)",
  },
  decisionsEmptyTitle: {
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  decisionsEmptySub: {
    marginTop: 8,
    fontSize: 13,
    opacity: 0.74,
    lineHeight: 1.5,
    maxWidth: 620,
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
  quickGrid: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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

  valueRail: {
    marginTop: 14,
    marginBottom: 2,
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
  valueRailCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  valueRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(134,239,172,0.90)",
  },
  valueRailTitle: {
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  valueRailSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(220,252,231,0.84)",
  },
  valueRailActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
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
  returnRail: {
    marginTop: 14,
    marginBottom: 2,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    padding: "14px 14px",
    borderRadius: 18,
    border: "1px solid rgba(96,165,250,0.22)",
    background:
      "linear-gradient(135deg, rgba(8,47,73,0.72), rgba(30,41,59,0.82))",
  },
  returnRailCopy: {
    minWidth: 0,
    flex: "1 1 360px",
    display: "grid",
    gap: 4,
  },
  returnRailEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.90)",
  },
  returnRailTitle: {
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: "-0.02em",
  },
  returnRailSub: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.82)",
  },
  returnRailActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  returnRailPrimary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(96,165,250,0.26)",
    background: "rgba(59,130,246,0.20)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },
  returnRailSecondary: {
    borderRadius: 999,
    padding: "10px 14px",
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  decisionChipsRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 10,
    marginTop: 14,
    marginBottom: 4,
  },
  decisionChip: {
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 999,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    background: "rgba(15,23,42,0.74)",
    color: "#e2e8f0",
  },
  decisionChipDanger: {
    background: "rgba(127,29,29,0.88)",
    borderColor: "rgba(252,165,165,0.24)",
    color: "rgba(254,226,226,0.98)",
  },
  decisionChipPending: {
    background: "rgba(120,53,15,0.88)",
    borderColor: "rgba(251,191,36,0.24)",
    color: "rgba(254,243,199,0.98)",
  },
  decisionChipInfo: {
    background: "rgba(22,78,99,0.88)",
    borderColor: "rgba(103,232,249,0.24)",
    color: "rgba(207,250,254,0.98)",
  },
  summaryStatusPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(148,163,184,0.18)",
  },
  summaryStatusDanger: {
    background: "rgba(127,29,29,0.88)",
    borderColor: "rgba(252,165,165,0.24)",
    color: "rgba(254,226,226,0.98)",
  },
  summaryStatusPending: {
    background: "rgba(120,53,15,0.88)",
    borderColor: "rgba(251,191,36,0.24)",
    color: "rgba(254,243,199,0.98)",
  },
  summaryStatusInfo: {
    background: "rgba(22,78,99,0.88)",
    borderColor: "rgba(103,232,249,0.24)",
    color: "rgba(207,250,254,0.98)",
  },
  summaryStatusOk: {
    background: "rgba(20,83,45,0.88)",
    borderColor: "rgba(74,222,128,0.24)",
    color: "rgba(220,252,231,0.98)",
  },
};