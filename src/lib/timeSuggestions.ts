// src/lib/timeSuggestions.ts

export type Suggestion = {
  date: Date;
  label: string;
  score: number;
};

export type SuggestionGroupType = "personal" | "pair" | "family" | "other";

type SuggestionIntent =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "coffee"
  | "sports"
  | "medical"
  | "meeting"
  | "generic";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function normalizeText(input: string) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function buildLabel(date: Date) {
  return date.toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function detectIntent(raw: string): SuggestionIntent {
  const text = ` ${normalizeText(raw)} `;

  if (text.includes(" familia ") || text.includes(" familiar ")) {
    return "lunch";
  }

  if (
    text.includes(" desayuno ") ||
    text.includes(" desayunar ") ||
    text.includes(" breakfast ")
  ) {
    return "breakfast";
  }

  if (
    text.includes(" almuerzo ") ||
    text.includes(" almorzar ") ||
    text.includes(" lunch ")
  ) {
    return "lunch";
  }

  if (
    text.includes(" cena ") ||
    text.includes(" cenar ") ||
    text.includes(" dinner ")
  ) {
    return "dinner";
  }

  if (
    text.includes(" cafe ") ||
    text.includes(" cafecito ") ||
    text.includes(" coffee ")
  ) {
    return "coffee";
  }

  if (
    text.includes(" fulbito ") ||
    text.includes(" futbol ") ||
    text.includes(" padel ") ||
    text.includes(" tenis ") ||
    text.includes(" gym ") ||
    text.includes(" deporte ") ||
    text.includes(" entrenamiento ")
  ) {
    return "sports";
  }

  if (
    text.includes(" medico ") ||
    text.includes(" doctor ") ||
    text.includes(" dentista ") ||
    text.includes(" cita medica ")
  ) {
    return "medical";
  }

  if (
    text.includes(" reunion ") ||
    text.includes(" meeting ") ||
    text.includes(" llamada ") ||
    text.includes(" zoom ") ||
    text.includes(" trabajo ")
  ) {
    return "meeting";
  }

  return "generic";
}

function getCandidateHours(
  intent: SuggestionIntent,
  groupType: SuggestionGroupType
): number[] {
  switch (intent) {
    case "breakfast":
      return [8, 9, 10];
    case "lunch":
      return [13, 14, 15];
    case "dinner":
      return [19, 20, 21];
    case "coffee":
      return [16, 17, 18];
    case "sports":
      return [18, 19, 20];
    case "medical":
      return [9, 11, 16];
    case "meeting":
      return [9, 11, 16];
    default:
      if (groupType === "pair") return [19, 20, 21];
      if (groupType === "family") return [13, 18, 19];
      if (groupType === "other") return [18, 19, 20];
      return [9, 13, 19];
  }
}

function getDurationMinutes(intent: SuggestionIntent) {
  switch (intent) {
    case "dinner":
      return 120;
    case "lunch":
    case "breakfast":
    case "sports":
      return 90;
    default:
      return 60;
  }
}

function getDayOffsets(intent: SuggestionIntent): number[] {
  if (intent === "medical" || intent === "meeting") {
    return [1, 2, 3, 4, 5];
  }

  return [1, 2, 3, 4, 5, 6];
}

function shouldSkipDay(date: Date, intent: SuggestionIntent) {
  if (intent === "medical" || intent === "meeting") {
    return isWeekend(date);
  }
  return false;
}

function getEventWindow(event: any) {
  const start = new Date(event?.start);
  const end = new Date(event?.end);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

function isSlotFree(events: any[], start: Date, durationMinutes = 60) {
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return !events.some((e) => {
    const window = getEventWindow(e);
    if (!window) return false;

    return start < window.end && end > window.start;
  });
}

function countEventsForDay(events: any[], day: Date) {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  return events.reduce((count, event) => {
    const window = getEventWindow(event);
    if (!window) return count;

    const overlapsDay = window.start < dayEnd && window.end > dayStart;
    return overlapsDay ? count + 1 : count;
  }, 0);
}

function getNearestGapMinutes(events: any[], slotStart: Date, durationMinutes: number) {
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);
  let nearestGap = Number.POSITIVE_INFINITY;

  for (const event of events) {
    const window = getEventWindow(event);
    if (!window) continue;

    const gapBefore = Math.abs(slotStart.getTime() - window.end.getTime()) / 60000;
    const gapAfter = Math.abs(window.start.getTime() - slotEnd.getTime()) / 60000;

    nearestGap = Math.min(nearestGap, gapBefore, gapAfter);
  }

  return nearestGap;
}

function getHourPreferenceBonus(intent: SuggestionIntent, hour: number) {
  if (intent === "breakfast") {
    if (hour === 9) return 16;
    if (hour === 8) return 12;
    if (hour === 10) return 8;
  }

  if (intent === "lunch") {
    if (hour === 13) return 16;
    if (hour === 14) return 12;
    if (hour === 15) return 6;
  }

  if (intent === "dinner") {
    if (hour === 20) return 16;
    if (hour === 19) return 12;
    if (hour === 21) return 8;
  }

  if (intent === "coffee") {
    if (hour === 17) return 14;
    if (hour === 16) return 10;
    if (hour === 18) return 8;
  }

  if (intent === "sports") {
    if (hour === 19) return 14;
    if (hour === 20) return 10;
    if (hour === 18) return 8;
  }

  if (intent === "medical" || intent === "meeting") {
    if (hour === 11) return 14;
    if (hour === 9) return 10;
    if (hour === 16) return 8;
  }

  return 0;
}


function getContextualBoost(
  intent: SuggestionIntent,
  groupType: SuggestionGroupType,
  day: Date,
  rawText: string
) {
  const text = ` ${normalizeText(rawText)} `;
  let score = 0;

  const weekend = isWeekend(day);
  const weekday = !weekend;
  const mentionsWeekend =
    text.includes(" fin de semana ") ||
    text.includes(" finde ") ||
    text.includes(" sabado ") ||
    text.includes(" sábado ") ||
    text.includes(" domingo ");
  const mentionsWeek =
    text.includes(" semana ") ||
    text.includes(" weekday ") ||
    text.includes(" entre semana ") ||
    text.includes(" lunes ") ||
    text.includes(" martes ") ||
    text.includes(" miercoles ") ||
    text.includes(" miércoles ") ||
    text.includes(" jueves ") ||
    text.includes(" viernes ");

  if (groupType === "family") {
    if (weekend) score += 18;
    if (intent === "lunch") score += 8;
  }

  if (groupType === "pair") {
    if (intent === "dinner") score += 10;
    if (weekday) score += 4;
  }

  if (groupType === "other") {
    if (weekend) score += 12;
    if (intent === "sports") score += 6;
  }

  if (intent === "breakfast" && weekday) score += 8;
  if (intent === "lunch" && weekend) score += 10;
  if (intent === "dinner" && weekend) score += 6;

  if (mentionsWeekend) {
    score += weekend ? 18 : -14;
  }

  if (mentionsWeek) {
    score += weekday ? 12 : -10;
  }

  return score;
}

function getRecencyPenalty(now: Date, slot: Date) {
  const diffMinutes = (slot.getTime() - now.getTime()) / 60000;

  if (diffMinutes < 180) return 80;
  if (diffMinutes < 360) return 36;
  if (diffMinutes < 720) return 16;
  return 0;
}

function scoreSlot(params: {
  events: any[];
  now: Date;
  slot: Date;
  day: Date;
  intent: SuggestionIntent;
  durationMinutes: number;
  groupType: SuggestionGroupType;
  rawText: string;
}) {
  const { events, now, slot, day, intent, durationMinutes, groupType, rawText } = params;

  let score = 100;

  score += getHourPreferenceBonus(intent, slot.getHours());
  score -= getRecencyPenalty(now, slot);

  const eventsCountForDay = countEventsForDay(events, day);
  score -= eventsCountForDay * 10;

  const nearestGap = getNearestGapMinutes(events, slot, durationMinutes);
  if (Number.isFinite(nearestGap)) {
    if (nearestGap < 45) score -= 28;
    else if (nearestGap < 90) score -= 14;
    else if (nearestGap >= 180) score += 10;
  } else {
    score += 12;
  }

  if (isWeekend(day)) {
    if (intent === "breakfast" || intent === "lunch" || intent === "dinner" || intent === "sports") {
      score += 6;
    }
  }

  score += getContextualBoost(intent, groupType, day, rawText);

  return score;
}

export function getSuggestedTimeSlots(
  events: any[],
  groupType: SuggestionGroupType,
  rawText: string
): Suggestion[] {
  const now = new Date();
  const intent = detectIntent(rawText);
  const hours = getCandidateHours(intent, groupType);
  const durationMinutes = getDurationMinutes(intent);
  const offsets = getDayOffsets(intent);

  const candidates: Suggestion[] = [];

  for (const offset of offsets) {
    const day = addDays(startOfDay(now), offset);

    if (shouldSkipDay(day, intent)) {
      continue;
    }

    let bestForDay: Suggestion | null = null;

    for (const hour of hours) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot.getTime() <= now.getTime()) continue;
      if (!isSlotFree(events, slot, durationMinutes)) continue;

      const score = scoreSlot({
        events,
        now,
        slot,
        day,
        intent,
        durationMinutes,
        groupType,
        rawText,
      });

      const candidate: Suggestion = {
        date: slot,
        label: buildLabel(slot),
        score,
      };

      if (!bestForDay || candidate.score > bestForDay.score) {
        bestForDay = candidate;
      }
    }

    if (bestForDay) {
      candidates.push(bestForDay);
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function getSuggestionContextLabel(
  rawText: string,
  groupType: SuggestionGroupType
): string | null {
  const intent = detectIntent(rawText);

  switch (intent) {
    case "breakfast":
      return "Opciones para desayunar";
    case "lunch":
      return "Opciones para almorzar";
    case "dinner":
      return "Opciones para cenar";
    case "coffee":
      return "Opciones para tomar café";
    case "sports":
      return "Horarios que podrían servir";
    case "medical":
      return "Bloques razonables para esta cita";
    case "meeting":
      return "Horarios que podrían servir";
    default:
      if (groupType === "pair") return "Tienen libre:";
      if (groupType === "family") return "Podría funcionar en:";
      return "Opciones disponibles:";
  }
}