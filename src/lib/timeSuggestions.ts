// src/lib/timeSuggestions.ts

export type Suggestion = {
  date: Date;
  label: string;
};

type SuggestionGroupType = "personal" | "pair" | "family" | "other";

type SuggestionIntent =
  | "dinner"
  | "lunch"
  | "breakfast"
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
    text.includes(" cena ") ||
    text.includes(" cenar ") ||
    text.includes(" comida en la noche ") ||
    text.includes(" dinner ")
  ) {
    return "dinner";
  }

  if (
    text.includes(" almuerzo ") ||
    text.includes(" almorzar ") ||
    text.includes(" lunch ")
  ) {
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
    text.includes(" cafe ") ||
    text.includes(" café ") ||
    text.includes(" cafecito ") ||
    text.includes(" coffee ")
  ) {
    return "coffee";
  }

  if (
    text.includes(" fulbito ") ||
    text.includes(" futbol ") ||
    text.includes(" fútbol ") ||
    text.includes(" padel ") ||
    text.includes(" pádel ") ||
    text.includes(" tenis ") ||
    text.includes(" gym ") ||
    text.includes(" entrenamiento ") ||
    text.includes(" deporte ")
  ) {
    return "sports";
  }

  if (
    text.includes(" medico ") ||
    text.includes(" médico ") ||
    text.includes(" doctor ") ||
    text.includes(" dentista ") ||
    text.includes(" cita medica ") ||
    text.includes(" cita médica ")
  ) {
    return "medical";
  }

  if (
    text.includes(" reunion ") ||
    text.includes(" reunión ") ||
    text.includes(" meeting ") ||
    text.includes(" llamada ") ||
    text.includes(" call ") ||
    text.includes(" zoom ")
  ) {
    return "meeting";
  }

  return "generic";
}

function getHoursByIntent(
  intent: SuggestionIntent,
  groupType: SuggestionGroupType
): number[] {
  if (intent === "dinner") return [19, 20, 21];
  if (intent === "lunch") return [13, 14, 15];
  if (intent === "breakfast") return [8, 9, 10];
  if (intent === "coffee") return [16, 17, 18];
  if (intent === "sports") return [18, 19, 20];
  if (intent === "medical") return [9, 11, 16];
  if (intent === "meeting") return [9, 11, 16];

  if (groupType === "pair") return [19, 20, 21];
  if (groupType === "family") return [13, 18, 19];
  if (groupType === "other") return [18, 19, 20];

  return [9, 13, 19];
}

function getDayOffsetsByIntent(
  intent: SuggestionIntent,
  groupType: SuggestionGroupType
): number[] {
  if (intent === "lunch" && groupType === "family") {
    return [1, 2, 4, 5, 6];
  }

  if (intent === "dinner" && groupType === "pair") {
    return [1, 2, 3, 4, 5];
  }

  return [1, 2, 3, 4, 5];
}

function getDurationByIntent(intent: SuggestionIntent): number {
  if (intent === "medical") return 60;
  if (intent === "meeting") return 60;
  if (intent === "coffee") return 60;
  if (intent === "breakfast") return 90;
  if (intent === "lunch") return 90;
  if (intent === "sports") return 90;
  if (intent === "dinner") return 120;
  return 60;
}

function shouldSkipDay(
  day: Date,
  intent: SuggestionIntent,
  groupType: SuggestionGroupType
) {
  if (intent === "medical" || intent === "meeting") {
    return isWeekend(day);
  }

  if (intent === "lunch" && groupType === "family") {
    return false;
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
  const hours = getHoursByIntent(intent, groupType);
  const durationMinutes = getDurationByIntent(intent);
  const dayOffsets = getDayOffsetsByIntent(intent, groupType);

  const suggestions: Suggestion[] = [];

  for (const offset of dayOffsets) {
    const day = addDays(startOfDay(now), offset);

    if (shouldSkipDay(day, intent, groupType)) {
      continue;
    }

    for (const hour of hours) {
      const slot = new Date(day);
      slot.setHours(hour, 0, 0, 0);

      if (slot.getTime() <= now.getTime()) {
        continue;
      }

      if (isSlotFree(events, slot, durationMinutes)) {
        suggestions.push({
          date: slot,
          label: buildLabel(slot),
        });
        break;
      }
    }

    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

export function getSuggestionContextLabel(
  rawText: string,
  groupType: SuggestionGroupType
): string | null {
  const intent = detectIntent(rawText);

  if (intent === "dinner") return "Opciones para cenar";
  if (intent === "lunch") return "Opciones para almorzar";
  if (intent === "breakfast") return "Opciones para desayunar";
  if (intent === "coffee") return "Opciones para tomar café";
  if (intent === "sports") return "Horarios que podrían servir";
  if (intent === "medical") return "Bloques razonables para esta cita";
  if (intent === "meeting") return "Horarios que podrían servir";

  if (groupType === "pair") return "Tienen libre:";
  if (groupType === "family") return "Podría funcionar en:";
  if (groupType === "other") return "Opciones disponibles:";
  return "Podría funcionar en:";
}