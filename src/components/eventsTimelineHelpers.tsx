import type { CSSProperties } from "react";
import type {
  ConflictItem,
  GroupType,
  CalendarEvent,
} from "@/lib/conflicts";
import { computeVisibleConflicts } from "@/lib/conflicts";
import { normalizeGroupType as normalizeCanonicalGroupType } from "@/lib/naming";
import { buildEventContext } from "@/lib/eventContext";
import { getEventStatusUi } from "@/lib/eventStatusUi";
import type { ConflictTrustSignal } from "@/lib/conflictResolutionsLogDb";
import type { PublicInviteRow } from "@/lib/invitationsDb";
import type { ProposalResponseRow } from "@/lib/proposalResponsesDb";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export type TimelineEvent = {
  id: string;
  user_id?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
  title?: string | null;
  notes?: string | null;
  start: string;
  end: string;
  group_id?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  group?: {
    id?: string;
    name?: string | null;
    type?: string | null;
  } | null;
};

export type ConflictByEventId = Record<string, ConflictItem[]>;

export function normalizeTimelineGroupType(
  value: string | null | undefined
): GroupType {
  return normalizeCanonicalGroupType(value);
}

export function toConflictCalendarEvent(event: TimelineEvent): CalendarEvent {
  return {
    id: String(event.id),
    title: String(event.title ?? "Evento"),
    start: String(event.start),
    end: String(event.end),
    groupType: event.group_id
      ? normalizeTimelineGroupType(String(event.group?.type ?? "other"))
      : "personal",
    groupId: event.group_id ?? null,
    description: event.notes ?? undefined,
    notes: event.notes ?? undefined,
  };
}

export function buildConflictsByEventId(
  events: TimelineEvent[]
): ConflictByEventId {
  const nextConflicts: ConflictByEventId = {};
  const conflictCandidates = (Array.isArray(events) ? events : [])
    .filter((ev) => !!ev?.start && !!ev?.end)
    .map(toConflictCalendarEvent);

  if (conflictCandidates.length === 0) {
    return {};
  }

  const computed = computeVisibleConflicts(conflictCandidates);

  for (const conflict of computed) {
    const existingId = String(conflict.existingEventId ?? "").trim();
    const incomingId = String(conflict.incomingEventId ?? "").trim();

    if (existingId) {
      nextConflicts[existingId] = [...(nextConflicts[existingId] ?? []), conflict];
    }

    if (incomingId) {
      nextConflicts[incomingId] = [...(nextConflicts[incomingId] ?? []), conflict];
    }
  }

  return nextConflicts;
}

export function getTimelineEventStatusUi(input: {
  conflictsCount: number;
  responses: ProposalResponseRow[];
  trustSignal: ConflictTrustSignal | null;
  invite: PublicInviteRow | null;
  eventId?: string | null;
}) {
  const eventId = String(input.eventId ?? "").trim() || "timeline-event";
  const responses = Array.isArray(input.responses) ? input.responses : [];
  const conflictsCount = Number(input.conflictsCount ?? 0);

  const ctx = buildEventContext({
    eventId,
    conflictEventIds: conflictsCount > 0 ? new Set([eventId]) : new Set(),
    proposalResponses: responses,
    invite: input.invite
      ? {
          status: input.invite.status ?? null,
          proposed_date: input.invite.proposed_date ?? null,
        }
      : null,
    trustSignal: input.trustSignal ?? null,
  });

  return (
    ctx?.statusUi ??
    getEventStatusUi("scheduled", {
      conflictsCount,
    })
  );
}

export function getTimelinePrimaryAction(input: {
  eventId: string;
  status: ReturnType<typeof getTimelineEventStatusUi>["status"];
}) {
  const eventId = String(input.eventId ?? "").trim();
  if (!eventId) return null;

  if (input.status === "conflicted") {
    return {
      label: "Revisar cruce",
      href: `/conflicts/detected?eventId=${encodeURIComponent(eventId)}`,
    };
  }

  if (input.status === "pending") {
    return {
      label: "Ver pendiente",
      href: `/events/new/details?eventId=${encodeURIComponent(eventId)}`,
    };
  }

  if (input.status === "adjusted") {
    return {
      label: "Ver cambio",
      href: `/events/new/details?eventId=${encodeURIComponent(eventId)}`,
    };
  }

  return null;
}

export function buildConflictSummary(conflicts: ConflictItem[]) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) return null;

  if (conflicts.length === 1) {
    return "Este plan choca con otro evento visible.";
  }

  return `Este plan choca con ${conflicts.length} eventos visibles.`;
}

export function humanizeShareError(
  err: unknown,
  fallback = "No se pudo completar esta acción."
) {
  const message =
    err instanceof Error ? err.message.trim() : String(err ?? "").trim();

  if (!message) return fallback;

  const lowered = message.toLowerCase();

  if (
    lowered.includes("fetch") ||
    lowered.includes("network") ||
    lowered.includes("failed to fetch")
  ) {
    return "Parece un problema de red. Revisa tu conexión e inténtalo otra vez.";
  }

  return message;
}

export function localDateKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfTomorrow() {
  const today = startOfToday();
  const next = new Date(today);
  next.setDate(today.getDate() + 1);
  return next;
}

function startOfNextWeekBoundary() {
  const today = startOfToday();
  const next = new Date(today);
  next.setDate(today.getDate() + 7);
  return next;
}

export function getDayHeaderLabel(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  const nextWeek = startOfNextWeekBoundary();

  if (dateOnly.getTime() === today.getTime()) return "Hoy";
  if (dateOnly.getTime() === tomorrow.getTime()) return "Mañana";
  if (dateOnly > tomorrow && dateOnly < nextWeek) return "Esta semana";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function getGroupSignal(ev: TimelineEvent) {
  const rawType = String(ev.group?.type ?? "").toLowerCase();

  if (!ev.group_id) {
    return {
      label: "Personal",
      dot: "rgba(56,189,248,0.98)",
      badgeBg: "rgba(8,47,73,0.9)",
      badgeBorder: "rgba(56,189,248,0.28)",
      badgeText: "rgba(186,230,253,0.98)",
    };
  }

  if (rawType === "pair" || rawType === "couple") {
    return {
      label: "Pareja",
      dot: "rgba(244,114,182,0.98)",
      badgeBg: "rgba(80,7,36,0.9)",
      badgeBorder: "rgba(244,114,182,0.28)",
      badgeText: "rgba(251,207,232,0.98)",
    };
  }

  if (rawType === "family") {
    return {
      label: "Familia",
      dot: "rgba(56,189,248,0.98)",
      badgeBg: "rgba(8,47,73,0.9)",
      badgeBorder: "rgba(56,189,248,0.28)",
      badgeText: "rgba(186,230,253,0.98)",
    };
  }

  return {
    label: "Compartido",
    dot: "rgba(167,139,250,0.98)",
    badgeBg: "rgba(46,16,101,0.9)",
    badgeBorder: "rgba(167,139,250,0.28)",
    badgeText: "rgba(221,214,254,0.98)",
  };
}

export function getExternalLabel(ev: TimelineEvent) {
  if (!ev.external_source) return null;
  if (ev.external_source.toLowerCase() === "google") return "Google";
  return "Externo";
}

export function getProposalInsight(response: string | null | undefined) {
  const safe = String(response ?? "").trim().toLowerCase();

  if (safe === "pending") {
    return {
      kicker: "Propuesta abierta",
      title: "Esta propuesta sigue por confirmar",
      subtitle:
        "Todavía no quedó cerrada. Vale la pena revisarla para decidir cómo seguir.",
      tone: "pending" as const,
    };
  }

  if (safe === "accepted") {
    return {
      kicker: "Propuesta aceptada",
      title: "Esta propuesta ya quedó confirmada",
      subtitle:
        "La otra parte dijo que este horario le funciona como está.",
      tone: "accepted" as const,
    };
  }

  if (safe === "adjusted") {
    return {
      kicker: "Propuesta ajustada",
      title: "Esta propuesta llegó con cambios",
      subtitle:
        "La otra parte movió algo antes de dejarla lista para revisar.",
      tone: "adjusted" as const,
    };
  }

  return null;
}

export function getProposalInsightStyle(
  tone: "pending" | "accepted" | "adjusted"
): CSSProperties {
  if (tone === "pending") {
    return {
      border: "1px solid rgba(251,191,36,0.24)",
      background:
        "linear-gradient(180deg, rgba(120,53,15,0.18), rgba(30,41,59,0.38))",
    };
  }

  if (tone === "accepted") {
    return {
      border: "1px solid rgba(74,222,128,0.22)",
      background:
        "linear-gradient(180deg, rgba(20,83,45,0.18), rgba(30,41,59,0.38))",
    };
  }

  return {
    border: "1px solid rgba(103,232,249,0.22)",
    background:
      "linear-gradient(180deg, rgba(22,78,99,0.18), rgba(30,41,59,0.38))",
  };
}

export function humanizeRelativeDate(dateString?: string | null) {
  if (!dateString) return null;

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;

  return date.toLocaleDateString();
}

export function buildProposalContextLine(input: {
  response: string | null | undefined;
  displayName: string | null | undefined;
  relativeDate: string | null | undefined;
}) {
  const safeResponse = String(input.response ?? "").trim().toLowerCase();
  const safeName = String(input.displayName ?? "").trim() || "Alguien";
  const safeDate = String(input.relativeDate ?? "").trim();

  if (!safeResponse) return null;

  const verb =
    safeResponse === "accepted"
      ? "la confirmó"
      : safeResponse === "adjusted"
      ? "la ajustó"
      : "la dejó por confirmar";

  return safeDate ? `${safeName} ${verb} ${safeDate}` : `${safeName} ${verb}`;
}

export function buildWhatsAppText(ev: TimelineEvent, link: string) {
  return `Oye, pensé esto 👇

${ev.title || "Evento"}

Lo vemos aquí:
${link}`;
}

export function formatProposedDate(value: string | null | undefined) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInvitePresentation(invite: PublicInviteRow | null) {
  if (!invite) {
    return {
      label: "Sin respuesta",
      tone: "neutral" as const,
      detail: "Todavía no hay una respuesta registrada para este link.",
    };
  }

  if (invite.status === "pending") {
    return {
      label: "Por responder",
      tone: "pending" as const,
      detail: "El link ya fue compartido, pero todavía no hubo respuesta.",
    };
  }

  if (invite.status === "accepted") {
    return {
      label: "Confirmado",
      tone: "accepted" as const,
      detail: "La persona externa confirmó este plan.",
    };
  }

  if (invite.status === "rejected" && invite.proposed_date) {
    return {
      label: "Propuso otro horario",
      tone: "proposed" as const,
      detail: "La persona no puede en este horario y sugirió una alternativa.",
    };
  }

  return {
    label: "No puede en este horario",
    tone: "rejected" as const,
    detail: "La persona externa rechazó este horario.",
  };
}

export function getInviteBadgeStyle(
  tone: "neutral" | "pending" | "accepted" | "rejected" | "proposed"
): CSSProperties {
  switch (tone) {
    case "pending":
      return {
        background: "rgba(120,53,15,0.85)",
        borderColor: "rgba(251,191,36,0.24)",
        color: "rgba(254,243,199,0.98)",
      };
    case "accepted":
      return {
        background: "rgba(20,83,45,0.9)",
        borderColor: "rgba(74,222,128,0.24)",
        color: "rgba(220,252,231,0.98)",
      };
    case "rejected":
      return {
        background: "rgba(127,29,29,0.9)",
        borderColor: "rgba(252,165,165,0.24)",
        color: "rgba(254,226,226,0.98)",
      };
    case "proposed":
      return {
        background: "rgba(49,46,129,0.9)",
        borderColor: "rgba(165,180,252,0.24)",
        color: "rgba(224,231,255,0.98)",
      };
    default:
      return {
        background: "rgba(15,23,42,0.72)",
        borderColor: "rgba(148,163,184,0.18)",
        color: "rgba(226,232,240,0.94)",
      };
  }
}

export function resolveEventOwnerId(event: TimelineEvent | null | undefined): string {
  return String(
    event?.owner_id ?? event?.user_id ?? event?.created_by ?? ""
  ).trim();
}

export function getSafeDurationMs(startIso?: string | null, endIso?: string | null) {
  const startMs = new Date(String(startIso ?? "")).getTime();
  const endMs = new Date(String(endIso ?? "")).getTime();
  const diff = endMs - startMs;

  if (!Number.isFinite(diff) || diff <= 0) {
    return 60 * 60 * 1000;
  }

  return diff;
}

export function openEventFromCaptureFallback(
  router: AppRouterInstance,
  ev: TimelineEvent
) {
  router.push(`/events?focusEventId=${encodeURIComponent(String(ev.id))}`);
}