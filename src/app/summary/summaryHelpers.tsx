import { parseQuickCapture } from "@/lib/quickCaptureParser";
import { learnedGroupMatch } from "@/lib/groupLearning";
import {
  computeVisibleConflicts,
  conflictKey,
  filterIgnoredConflicts,
  type CalendarEvent,
  type GroupType,
  type ConflictItem,
} from "@/lib/conflicts";
import { type Resolution } from "@/lib/conflictResolutionsDb";
import { type ConflictResolutionLogRow } from "@/lib/conflictResolutionsLogDb";
import { type ProposalResponseRow } from "@/lib/proposalResponsesDb";
import { type GroupRow } from "@/lib/groupsDb";
import { parseIsoLike, toDateMs } from "@/lib/dateUtils";
import { deriveEventStatus } from "@/lib/naming";
import { buildEventContext } from "@/lib/eventContext";

export type SummaryEvent = {
  id: string;
  title: string;
  start: Date | null;
  end: Date | null;
  startIso: string | null;
  endIso: string | null;
  groupId: string | null;
  isExternal: boolean;
  raw: any;
};

export type ConflictAlert = {
  count: number;
  latestEventId: string | null;
};

export type RecentDecision = {
  id: string;
  title: string;
  subtitle: string;
  whenLabel: string;
  isFallback: boolean;
};

export type QuickCaptureExample = {
  label: string;
  value: string;
};

export type SmartInterpretation = {
  intent: "personal" | "group";
  groupId: string | null;
  confidence: "low" | "medium" | "high";
  reason: "learned" | "name_match" | "social_hint" | "active_group" | "none";
};

export function safeDate(iso?: string | null) {
  return parseIsoLike(iso ?? null);
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

export function buildProposalLine({
  response,
  name,
  time,
}: {
  response?: string | null;
  name?: string | null;
  time?: string | null;
}) {
  const r = String(response ?? "").toLowerCase();
  const n = name || "Alguien";

  if (!r) return null;

  const verb =
    r === "accepted"
      ? "la aceptó"
      : r === "adjusted"
      ? "la ajustó"
      : "la dejó pendiente";

  return time ? `${n} ${verb} ${time}` : `${n} ${verb}`;
}

export function fmtDay(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function fmtTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function humanGroupName(g: GroupRow) {
  const n = String(g.name ?? "").trim();
  if (n) return n;

  const t = String(g.type ?? "").toLowerCase();
  if (t === "pair" || t === "couple") return "Pareja";
  if (t === "family") return "Familia";
  if (t === "solo" || t === "personal") return "Personal";
  if (t === "other" || t === "shared") return "Compartido";

  return "Grupo";
}

export function normalizeSummaryGroupType(
  raw: string | null | undefined
): GroupType {
  const value = String(raw ?? "").trim().toLowerCase();

  if (value === "pair" || value === "couple") return "pair";
  if (value === "family") return "family";
  if (value === "other" || value === "shared") return "other";
  return "personal";
}

export function resolutionForConflict(
  conflict: ConflictItem,
  resMap: Record<string, Resolution>
): Resolution | undefined {
  const exact = resMap[String(conflict.id)];
  if (exact) return exact;

  const a = String(conflict.existingEventId ?? "");
  const b = String(conflict.incomingEventId ?? "");
  if (!a || !b) return undefined;

  const stableKey = conflictKey(a, b);
  if (resMap[stableKey]) return resMap[stableKey];

  const [x, y] = [a, b].sort();
  const legacyPrefix = `cx::${x}::${y}::`;

  for (const key of Object.keys(resMap)) {
    if (key.startsWith(legacyPrefix)) return resMap[key];
  }

  return undefined;
}

export function buildConflictAlert(
  events: SummaryEvent[],
  groups: GroupRow[],
  resMap: Record<string, Resolution>,
  ignoredConflictKeys: Set<string>
): ConflictAlert {
  if (!Array.isArray(events) || events.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const groupTypeById = new Map<string, string>();
  for (const group of groups ?? []) {
    const id = String(group?.id ?? "").trim();
    if (!id) continue;
    groupTypeById.set(id, String(group?.type ?? ""));
  }

  const conflictEvents: CalendarEvent[] = events
    .map((event) => {
      if (!event.startIso) return null;

      const derivedGroupType = event.groupId
        ? normalizeSummaryGroupType(groupTypeById.get(String(event.groupId)))
        : ("personal" as GroupType);

      return {
        id: event.id,
        title: event.title,
        start: event.startIso,
        end: event.endIso ?? event.startIso,
        groupId: event.groupId,
        groupType: derivedGroupType,
        description:
          typeof event.raw?.notes === "string" ? event.raw.notes : undefined,
      } satisfies CalendarEvent;
    })
    .filter(Boolean) as CalendarEvent[];

  if (conflictEvents.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const allConflicts = computeVisibleConflicts(conflictEvents);
  const visibleConflicts = filterIgnoredConflicts(
    allConflicts,
    ignoredConflictKeys
  );

  const pendingConflicts = visibleConflicts.filter(
    (conflict) => !resolutionForConflict(conflict, resMap)
  );

  if (pendingConflicts.length === 0) {
    return { count: 0, latestEventId: null };
  }

  const eventsById = new Map(
    conflictEvents.map((event) => [String(event.id), event])
  );

  let latestEventId: string | null = null;
  let latestStartMs = -1;

  for (const conflict of pendingConflicts) {
    const candidates = [
      eventsById.get(String(conflict.existingEventId)),
      eventsById.get(String(conflict.incomingEventId)),
    ].filter(Boolean) as CalendarEvent[];

    for (const event of candidates) {
      const ms = toDateMs(event.start);
      if (Number.isNaN(ms)) continue;

      if (ms > latestStartMs) {
        latestStartMs = ms;
        latestEventId = String(event.id);
      }
    }
  }

  return {
    count: pendingConflicts.length,
    latestEventId,
  };
}

export function startOfTodayLocal() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function getWeekMoodLabel(count: number): string {
  if (count === 0) return "Semana libre";
  if (count <= 3) return "Semana ligera";
  if (count <= 6) return "Semana activa";
  return "Semana movida";
}

export function getWeekSubtitle(count: number): string {
  if (count === 0) return "Sin eventos próximos";
  if (count === 1) return "1 evento en 7 días";
  return `${count} eventos en 7 días`;
}

export function buildAppliedToastMessage(raw: string | null): string | null {
  const safe = String(raw ?? "").trim();
  if (!safe) return null;
  return safe;
}

export function formatDecisionTitle(log: ConflictResolutionLogRow): string {
  const finalAction = String(log.final_action ?? "").trim().toLowerCase();
  const decisionType = String(log.decision_type ?? "").trim().toLowerCase();

  if (finalAction === "fallback_keep_both") return "Ajuste automático";
  if (finalAction === "replace_with_new") return "Evento reemplazado";
  if (finalAction === "keep_existing") return "Se mantuvo el original";
  if (finalAction === "keep_both") return "Se conservaron ambos";
  if (decisionType === "replace_with_new") return "Evento reemplazado";
  if (decisionType === "keep_existing") return "Se mantuvo el original";
  return "Decisión aplicada";
}

export function formatDecisionSubtitle(log: ConflictResolutionLogRow): string {
  const metadata =
    log.metadata && typeof log.metadata === "object" ? log.metadata : {};

  const source = String((metadata as Record<string, unknown>).source ?? "")
    .trim()
    .toLowerCase();

  const finalAction = String(log.final_action ?? "").trim().toLowerCase();

  if (finalAction === "fallback_keep_both") {
    return "No se pudo editar el otro evento.";
  }

  if (source === "preflight") return "Resuelto antes de guardar.";
  if (source === "actions") return "Resuelto desde conflictos.";
  return "Guardado en el historial.";
}

export function formatRelativeDateLabel(iso: string | null | undefined): string {
  if (!iso) return "Reciente";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Reciente";

  const now = new Date();
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startTarget = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  const diffDays = Math.round(
    (startNow.getTime() - startTarget.getTime()) / 86400000
  );

  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const timeLabel = `${hh}:${mm}`;

  if (diffDays === 0) return `Hoy · ${timeLabel}`;
  if (diffDays === 1) return `Ayer · ${timeLabel}`;
  if (diffDays > 1 && diffDays <= 6) return `Hace ${diffDays} días · ${timeLabel}`;

  const dd = String(date.getDate()).padStart(2, "0");
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mo} · ${timeLabel}`;
}

export function mapRecentDecision(log: ConflictResolutionLogRow): RecentDecision {
  const finalAction = String(log.final_action ?? "").trim().toLowerCase();

  return {
    id: String(log.id),
    title: formatDecisionTitle(log),
    subtitle: formatDecisionSubtitle(log),
    whenLabel: formatRelativeDateLabel(log.created_at),
    isFallback: finalAction === "fallback_keep_both",
  };
}

export function normalizeEvent(e: any): SummaryEvent | null {
  const id = String(e?.id ?? "").trim();
  if (!id) return null;

  const startIso = (e?.start ?? e?.start_at ?? null) as string | null;
  const endIso = (e?.end ?? e?.end_at ?? null) as string | null;

  const start = safeDate(startIso);
  const end = safeDate(endIso);

  if (!start) return null;

  const groupIdRaw = e?.group_id ?? e?.groupId ?? null;
  const groupId = groupIdRaw ? String(groupIdRaw) : null;

  const title = e?.title ?? e?.name ?? e?.summary ?? "Evento";

  const isExternal =
    !!e?.is_external ||
    String(e?.source ?? "").toLowerCase() === "google" ||
    String(e?.provider ?? "").toLowerCase() === "google";

  return {
    id,
    title,
    start,
    end,
    startIso: startIso ? String(startIso) : null,
    endIso: endIso ? String(endIso) : null,
    groupId,
    isExternal,
    raw: e,
  };
}

export function eventOverlapsWindow(
  event: SummaryEvent,
  windowStart: Date,
  windowEndExclusive: Date
) {
  const start = event.start;
  const end = event.end ?? event.start;

  if (!start || !end) return false;

  return (
    start.getTime() < windowEndExclusive.getTime() &&
    end.getTime() >= windowStart.getTime()
  );
}

export function getQuickCaptureExamples(
  activeGroupType: GroupType,
  activeLabel: string,
  hasActiveGroup: boolean
): QuickCaptureExample[] {
  if (!hasActiveGroup) {
    return [
      { label: "Gym mañana 7", value: "gym mañana 7" },
      { label: "Doctor martes 10", value: "doctor martes 10" },
      { label: "Café jueves 4pm", value: "café jueves 4pm" },
    ];
  }

  if (activeGroupType === "pair") {
    return [
      { label: "Cena viernes 8pm", value: "cena viernes 8pm" },
      { label: "Pádel sábado 10", value: "pádel sábado 10" },
      { label: "Almuerzo domingo 1 con Fer", value: "almuerzo domingo 1 con Fer" },
    ];
  }

  if (activeGroupType === "family") {
    return [
      { label: "Almuerzo domingo 1", value: "almuerzo domingo 1" },
      { label: "Cole martes 7am", value: "cole martes 7am" },
      { label: `Salida sábado 11 con ${activeLabel}`, value: "salida sábado 11" },
    ];
  }

  return [
    { label: "Reunión lunes 9", value: "reunión lunes 9" },
    { label: "Fulbito sábado 6", value: "fulbito sábado 6" },
    { label: "Asado domingo 2 en casa", value: "asado domingo 2 en casa" },
  ];
}

export function cleanTemporalNoise(raw: string): string {
  let text = String(raw || "").trim();

  text = text.replace(/en dos fines de semana/gi, "");
  text = text.replace(/dos fines de semana/gi, "");
  text = text.replace(/en dos fines de/gi, "en dos fines");
  text = text.replace(/en dos fines/gi, "en dos fines");
  text = text.replace(/fin de semana/gi, "");
  text = text.replace(/finde/gi, "");

  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^[-–—,:;\s]+/, "").replace(/[-–—,:;\s]+$/, "");

  return text;
}

export function formatQuickCapturePreview(input: string): string | null {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const parsed = parseQuickCapture(raw);
  const title = String(parsed.title || "").trim();
  if (!title) return null;

  const parts: string[] = [title];

  if (parsed.date) {
    const dateLabel = parsed.date.toLocaleDateString([], {
      weekday: "short",
      day: "2-digit",
      month: "short",
    });
    const timeLabel = parsed.date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    parts.push(`${dateLabel} · ${timeLabel}`);
  }

  const cleanedNotes = cleanTemporalNoise(String(parsed.notes || "").trim());

  if (cleanedNotes) {
    parts.push(cleanedNotes);
  }

  return parts.join(" — ");
}

export function buildCaptureShareUrl(input: string, source: string): string {
  const raw = String(input || "").trim();
  const params = new URLSearchParams();

  if (raw) params.set("text", raw);
  if (source) params.set("source", source);

  params.set("intent", "shared");

  const path = `/capture${params.toString() ? `?${params.toString()}` : ""}`;

  if (typeof window === "undefined") {
    return `https://syncplansapp.com${path}`;
  }

  return `${window.location.origin}${path}`;
}

export function buildWhatsAppShareText(input: string, url: string): string {
  const raw = String(input || "").trim();
  const preview = formatQuickCapturePreview(raw);
  const cleanTitle = preview || raw;

  if (cleanTitle) {
    return `¿Lo vemos en SyncPlans?\n\nIdea: ${cleanTitle}\n\nÁbrelo aquí para revisarlo y decidir juntos:\n${url}`;
  }

  return `¿Lo vemos en SyncPlans?\n\nÁbrelo aquí para revisarlo y decidir juntos:\n${url}`;
}

export function buildShareToastLabel(input: string): string {
  const preview = formatQuickCapturePreview(input);
  if (!preview) return "Listo para compartir.";
  if (preview.length <= 72) return preview;
  return `${preview.slice(0, 69)}...`;
}

export function proposalResponseLabel(
  response: string | null | undefined
): string | null {
  const safe = String(response ?? "").trim().toLowerCase();
  if (!safe) return null;
  if (safe === "pending") return "Pendiente";
  if (safe === "accepted") return "Aceptada";
  if (safe === "adjusted") return "Ajustada";
  return null;
}

export function proposalResponseTone(
  response: string | null | undefined
): "pending" | "accepted" | "adjusted" | "neutral" {
  const safe = String(response ?? "").trim().toLowerCase();
  if (safe === "pending") return "pending";
  if (safe === "accepted") return "accepted";
  if (safe === "adjusted") return "adjusted";
  return "neutral";
}

export function getUnifiedEventStatus(input: {
  eventId: string | null | undefined;
  conflictEventIds: Set<string>;
  proposalResponseGroupsMap: Record<string, ProposalResponseRow[]>;
}): ReturnType<typeof deriveEventStatus> | null {
  const key = String(input.eventId ?? "").trim();
  if (!key) return null;

  const ctx = buildEventContext({
    eventId: key,
    conflictEventIds: input.conflictEventIds,
    proposalResponses: input.proposalResponseGroupsMap[key] ?? [],
  });

  return ctx?.status ?? null;
}

export function textSuggestsSharedPlan(raw: string) {
  const normalized = String(raw ?? "").toLowerCase();

  return (
    normalized.includes(" con ") ||
    normalized.includes(" juntos") ||
    normalized.includes(" juntas") ||
    normalized.includes(" en casa de ") ||
    normalized.includes(" junto a ")
  );
}

export function extractPersonFromText(raw: string): string | null {
  const match = raw.toLowerCase().match(/con\s+([a-záéíóúñ]+)/i);
  return match ? match[1] : null;
}

export function findGroupByName(
  name: string,
  groups: GroupRow[]
): string | null {
  const normalized = name.toLowerCase();

  for (const group of groups) {
    const groupName = String(group.name ?? "").toLowerCase();

    if (groupName.includes(normalized)) {
      return group.id;
    }
  }

  return null;
}

export function detectGroupTypeHint(
  raw: string
): "pair" | "family" | "other" | null {
  const text = String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (
    text.includes("familia") ||
    text.includes("familiar") ||
    text.includes("hijos") ||
    text.includes("casa")
  ) {
    return "family";
  }

  if (
    text.includes("pareja") ||
    text.includes("novia") ||
    text.includes("novio") ||
    text.includes("esposa") ||
    text.includes("esposo")
  ) {
    return "pair";
  }

  if (
    text.includes("amigos") ||
    text.includes("fulbito") ||
    text.includes("padel") ||
    text.includes("pádel") ||
    text.includes("equipo") ||
    text.includes("grupo")
  ) {
    return "other";
  }

  return null;
}

export function findGroupByType(
  groupType: "pair" | "family" | "other",
  groups: GroupRow[]
): string | null {
  const match =
    groups.find(
      (group) =>
        normalizeSummaryGroupType(String(group.type ?? "")) === groupType
    ) ?? null;

  return match ? String(match.id) : null;
}

export function buildSmartInterpretation(input: {
  raw: string;
  groups: GroupRow[];
  activeGroupId: string | null;
}): SmartInterpretation {
  const raw = String(input.raw ?? "").trim();
  const groups = Array.isArray(input.groups) ? input.groups : [];
  const activeGroupId = String(input.activeGroupId ?? "").trim() || null;

  if (!raw) {
    if (activeGroupId) {
      return {
        intent: "group",
        groupId: activeGroupId,
        confidence: "low",
        reason: "active_group",
      };
    }

    return {
      intent: "personal",
      groupId: null,
      confidence: "low",
      reason: "none",
    };
  }

  const person = extractPersonFromText(raw);

  if (person) {
    const matchedGroupId = findGroupByName(person, groups);

    if (matchedGroupId) {
      return {
        intent: "group",
        groupId: matchedGroupId,
        confidence: "high",
        reason: "name_match",
      };
    }
  }

  const typeHint = detectGroupTypeHint(raw);

  if (typeHint) {
    const hintedGroupId = findGroupByType(typeHint, groups);

    if (hintedGroupId) {
      return {
        intent: "group",
        groupId: hintedGroupId,
        confidence: "high",
        reason: "social_hint",
      };
    }
  }

  if (textSuggestsSharedPlan(raw)) {
    const fallbackGroupId =
      activeGroupId ||
      (groups.length === 1 ? String(groups[0]?.id ?? "").trim() || null : null);

    if (fallbackGroupId) {
      return {
        intent: "group",
        groupId: fallbackGroupId,
        confidence: "medium",
        reason: "social_hint",
      };
    }
  }

  const learned = learnedGroupMatch(raw);
  const learnedGroupId = String(learned?.groupId ?? "").trim();
  const learnedGroupStillExists =
    !!learnedGroupId &&
    groups.some((group) => String(group.id) === learnedGroupId);

  if (learnedGroupStillExists) {
    return {
      intent: "group",
      groupId: learnedGroupId,
      confidence: learned?.shouldAutoApply ? "medium" : "low",
      reason: "learned",
    };
  }

  if (activeGroupId) {
    return {
      intent: "group",
      groupId: activeGroupId,
      confidence: "low",
      reason: "active_group",
    };
  }

  return {
    intent: "personal",
    groupId: null,
    confidence: "low",
    reason: "none",
  };
}

export function getSmartInterpretationLabel(
  interpretation: SmartInterpretation | null,
  groups: GroupRow[]
) {
  if (!interpretation) return null;

  if (interpretation.intent === "personal") {
    return "→ Esto quedará como plan personal";
  }

  const group =
    groups.find(
      (candidate) =>
        String(candidate.id) === String(interpretation.groupId ?? "")
    ) ?? null;

  const groupLabel = group ? humanGroupName(group) : "grupo";

  if (interpretation.reason === "learned") {
    return interpretation.confidence === "high"
      ? `→ Normalmente esto termina en ${groupLabel}`
      : `→ Esto probablemente encaja en ${groupLabel}`;
  }

  if (interpretation.reason === "social_hint") {
    return `→ Suena a plan compartido · lo prepararé en ${groupLabel}`;
  }

  if (interpretation.reason === "active_group") {
    return `→ Tomaré ${groupLabel} como punto de partida`;
  }

  return `→ Esto quedará como plan compartido`;
}

export function canUseNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

export function canUseClipboard() {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  );
}