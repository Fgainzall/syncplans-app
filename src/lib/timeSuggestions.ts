// src/lib/timeSuggestions.ts

export type Suggestion = {
  date: Date;
  label: string;
};

type SuggestionGroupType = "personal" | "pair" | "family" | "other";

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

function isSlotFree(events: any[], start: Date, durationMinutes = 60) {
  const end = new Date(start.getTime() + durationMinutes * 60000);

  return !events.some((e) => {
    const evStart = new Date(e?.start);
    const evEnd = new Date(e?.end);

    if (Number.isNaN(evStart.getTime()) || Number.isNaN(evEnd.getTime())) {
      return false;
    }

    return start < evEnd && end > evStart;
  });
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

  const suggestions: Suggestion[] = [];

  for (const offset of offsets) {
    const day = addDays(startOfDay(now), offset);

    if (shouldSkipDay(day, intent)) {
      continue;
    }

    // 🔥 IMPORTANTE:
    // solo tomamos el PRIMER horario bueno de cada día
    for (const hour of hours) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot.getTime() <= now.getTime()) continue;

      if (isSlotFree(events, slot, durationMinutes)) {
        suggestions.push({
          date: slot,
          label: buildLabel(slot),
        });
        break;
      }
    }

    if (suggestions.length >= 3) {
      break;
    }
  }

  return suggestions;
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