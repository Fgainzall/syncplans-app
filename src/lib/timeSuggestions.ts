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

type TemporalSignals = {
  mentionsWeekend: boolean;
  mentionsWeekday: boolean;
  mentionsSpecificWeekendDay: boolean;
  mentionsTwoWeekends: boolean;
  mentionsMorning: boolean;
  mentionsAfternoon: boolean;
  mentionsNight: boolean;
};

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

function paddedText(input: string) {
  return ` ${normalizeText(input)} `;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function buildLabel(date: Date) {
  return date.toLocaleString("es-PE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function cleanTemporalNoise(raw: string): string {
  let text = raw;

  // casos específicos primero (más largos → primero)
  text = text.replace(/en dos fines de semana/gi, "");
  text = text.replace(/dos fines de semana/gi, "");
  text = text.replace(/en dos fines/gi, "");
  text = text.replace(/en dos fines de/gi, "");

  // genéricos
  text = text.replace(/fin de semana/gi, "");
  text = text.replace(/finde/gi, "");

  // limpiar espacios
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
function detectIntent(raw: string): SuggestionIntent {
  const text = paddedText(raw);

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
    text.includes(" lunch ") ||
    text.includes(" familia ") ||
    text.includes(" familiar ")
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

function detectTemporalSignals(raw: string): TemporalSignals {
  const text = paddedText(raw);

  const mentionsWeekend =
    text.includes(" fin de semana ") ||
    text.includes(" finde ") ||
    text.includes(" finde semana ") ||
    text.includes(" sabado ") ||
    text.includes(" domingo ");

  const mentionsWeekday =
    text.includes(" entre semana ") ||
    text.includes(" durante la semana ") ||
    text.includes(" en semana ") ||
    text.includes(" lunes ") ||
    text.includes(" martes ") ||
    text.includes(" miercoles ") ||
    text.includes(" jueves ") ||
    text.includes(" viernes ");

  const mentionsSpecificWeekendDay =
    text.includes(" sabado ") || text.includes(" domingo ");

  const mentionsTwoWeekends =
    text.includes(" dos fines de semana ") ||
    text.includes(" dos findes ") ||
    text.includes(" proximos dos fines ") ||
    text.includes(" proximos dos fines de semana ") ||
    text.includes(" siguientes dos fines ") ||
    text.includes(" en dos fines ");

  const mentionsMorning =
    text.includes(" manana ") ||
    text.includes(" temprano ") ||
    text.includes(" morning ");

  const mentionsAfternoon =
    text.includes(" tarde ") || text.includes(" afternoon ");

  const mentionsNight =
    text.includes(" noche ") ||
    text.includes(" nocturno ") ||
    text.includes(" night ");

  return {
    mentionsWeekend,
    mentionsWeekday,
    mentionsSpecificWeekendDay,
    mentionsTwoWeekends,
    mentionsMorning,
    mentionsAfternoon,
    mentionsNight,
  };
}

function getCandidateHours(
  intent: SuggestionIntent,
  groupType: SuggestionGroupType,
  signals: TemporalSignals
): number[] {
  let hours: number[];

  switch (intent) {
    case "breakfast":
      hours = [8, 9, 10];
      break;
    case "lunch":
      hours = [13, 14, 15];
      break;
    case "dinner":
      hours = [19, 20, 21];
      break;
    case "coffee":
      hours = [16, 17, 18];
      break;
    case "sports":
      hours = [18, 19, 20, 21];
      break;
    case "medical":
      hours = [9, 11, 16];
      break;
    case "meeting":
      hours = [9, 11, 16];
      break;
    default:
      if (groupType === "pair") hours = [19, 20, 21];
      else if (groupType === "family") hours = [13, 18, 19];
      else if (groupType === "other") hours = [18, 19, 20];
      else hours = [9, 13, 19];
      break;
  }

  if (signals.mentionsMorning) {
    return hours.filter((hour) => hour <= 11);
  }

  if (signals.mentionsAfternoon) {
    return hours.filter((hour) => hour >= 13 && hour <= 18);
  }

  if (signals.mentionsNight) {
    return hours.filter((hour) => hour >= 18);
  }

  return hours;
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

function getDayOffsets(intent: SuggestionIntent, signals: TemporalSignals): number[] {
  if (signals.mentionsTwoWeekends) {
    return Array.from({ length: 14 }, (_, i) => i + 1);
  }

  if (signals.mentionsWeekend || signals.mentionsSpecificWeekendDay) {
    return Array.from({ length: 10 }, (_, i) => i + 1);
  }

  if (intent === "medical" || intent === "meeting") {
    return [1, 2, 3, 4, 5];
  }

  return [1, 2, 3, 4, 5, 6, 7];
}

function shouldSkipDay(
  date: Date,
  intent: SuggestionIntent,
  signals: TemporalSignals
) {
  const weekend = isWeekend(date);

  if (intent === "medical" || intent === "meeting") {
    return weekend;
  }

  if (signals.mentionsWeekend && !weekend) {
    return true;
  }

  if (signals.mentionsWeekday && weekend) {
    return true;
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
    if (hour === 13) return 18;
    if (hour === 14) return 12;
    if (hour === 15) return 4;
  }

  if (intent === "dinner") {
    if (hour === 20) return 18;
    if (hour === 19) return 12;
    if (hour === 21) return 8;
  }

  if (intent === "coffee") {
    if (hour === 17) return 14;
    if (hour === 16) return 10;
    if (hour === 18) return 8;
  }

  if (intent === "sports") {
    if (hour === 19) return 16;
    if (hour === 20) return 12;
    if (hour === 18) return 8;
    if (hour === 21) return 6;
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
  signals: TemporalSignals,
  rawText: string
) {
  const text = paddedText(rawText);
  const weekend = isWeekend(day);
  const weekday = !weekend;
  let score = 0;

  if (groupType === "family") {
    if (weekend) score += 26;
    else score -= 6;
    if (intent === "lunch") score += 10;
    if (intent === "breakfast" && weekend) score += 6;
  }

  if (groupType === "pair") {
    if (intent === "dinner") score += 10;
    if (weekday && (intent === "dinner" || intent === "coffee")) score += 4;
    if (weekend && intent === "dinner") score += 4;
  }

  if (groupType === "other") {
    if (weekend) score += 14;
    if (intent === "sports") score += 10;
    if (weekday && intent === "sports") score -= 2;
  }

  if (intent === "breakfast" && weekday) score += 8;
  if (intent === "lunch" && weekend) score += 12;
  if (intent === "dinner" && weekend) score += 6;
  if (intent === "medical" && weekend) score -= 30;
  if (intent === "meeting" && weekend) score -= 24;

  if (signals.mentionsWeekend) {
    score += weekend ? 30 : -24;
  }

  if (signals.mentionsWeekday) {
    score += weekday ? 18 : -20;
  }

  if (signals.mentionsSpecificWeekendDay && weekend) {
    score += 6;
  }

  if (signals.mentionsTwoWeekends) {
    const today = startOfDay(new Date());
    const diffDays = Math.floor((startOfDay(day).getTime() - today.getTime()) / 86400000);

    if (weekend) {
      if (diffDays <= 7) score += 10;
      else if (diffDays <= 14) score += 8;
      else score -= 8;
    }
  }

  if (text.includes(" familiar ") || text.includes(" familia ")) {
    if (weekend) score += 8;
    if (intent === "lunch") score += 6;
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

function getDistancePenaltyForExplicitTemporalSignal(
  slot: Date,
  signals: TemporalSignals
) {
  if (!(signals.mentionsWeekend || signals.mentionsWeekday || signals.mentionsTwoWeekends)) {
    return 0;
  }

  const today = startOfDay(new Date());
  const diffDays = Math.floor((startOfDay(slot).getTime() - today.getTime()) / 86400000);

  if (signals.mentionsTwoWeekends) {
    if (diffDays > 14) return 30;
    if (diffDays > 10) return 12;
    return 0;
  }

  if (diffDays > 10) return 12;
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
  signals: TemporalSignals;
}) {
  const {
    events,
    now,
    slot,
    day,
    intent,
    durationMinutes,
    groupType,
    rawText,
    signals,
  } = params;

  let score = 100;

  score += getHourPreferenceBonus(intent, slot.getHours());
  score -= getRecencyPenalty(now, slot);
  score -= getDistancePenaltyForExplicitTemporalSignal(slot, signals);

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
    if (
      intent === "breakfast" ||
      intent === "lunch" ||
      intent === "dinner" ||
      intent === "sports"
    ) {
      score += 6;
    }
  }

  score += getContextualBoost(intent, groupType, day, signals, rawText);

  return score;
}

export function getSuggestedTimeSlots(
  events: any[],
  groupType: SuggestionGroupType,
  rawText: string
): Suggestion[] {
  const now = new Date();
  const intent = detectIntent(rawText);
  const signals = detectTemporalSignals(rawText);
  const hours = getCandidateHours(intent, groupType, signals);
  const durationMinutes = getDurationMinutes(intent);
  const offsets = getDayOffsets(intent, signals);

  const candidates: Suggestion[] = [];

  for (const offset of offsets) {
    const day = addDays(startOfDay(now), offset);

    if (shouldSkipDay(day, intent, signals)) {
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
        signals,
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

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
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