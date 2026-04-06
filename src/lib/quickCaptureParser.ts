type ParsedQuickCapture = {
  title: string;
  notes: string;
  date: Date | null;
  durationMinutes: number;
};

const DAYS_MAP: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  sábado: 6,
};

const CONTEXT_CONNECTORS = [
  " en ",
  " con ",
  " para ",
  " por ",
  " cerca de ",
  " junto a ",
  " donde ",
];

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatching(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseSpaces(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function capitalizeFirst(input: string) {
  const text = collapseSpaces(input);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toSentenceCase(input: string) {
  return capitalizeFirst(input.toLowerCase());
}

function capitalizeLikelyProperNames(input: string) {
  const smallWords = new Set([
    "de",
    "del",
    "la",
    "las",
    "el",
    "los",
    "y",
    "o",
    "a",
    "al",
    "en",
    "con",
    "para",
    "por",
  ]);

  const triggerPatterns = [
    /\bcon\s+([a-záéíóúñ]+)/gi,
    /\ben casa de\s+([a-záéíóúñ]+)/gi,
    /\bde\s+([a-záéíóúñ]+)$/gi,
  ];

  let result = input;

  for (const pattern of triggerPatterns) {
    result = result.replace(pattern, (match, name: string) => {
      const cleanName = String(name || "").trim();
      if (!cleanName || smallWords.has(cleanName.toLowerCase())) {
        return match;
      }

      const capitalizedName =
        cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();

      return match.replace(name, capitalizedName);
    });
  }

  return result;
}

function formatTitle(input: string) {
  const cleaned = collapseSpaces(input);
  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatNotes(input: string) {
  const cleaned = collapseSpaces(input);
  if (!cleaned) return "";

  const sentence = toSentenceCase(cleaned);
  return capitalizeLikelyProperNames(sentence);
}

function addDays(base: Date, days: number) {
  const copy = new Date(base);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nextWeekday(base: Date, dayIndex: number, extraWeeks = 0) {
  const copy = new Date(base);
  const currentDay = copy.getDay();
  let diff = dayIndex - currentDay;

  if (diff <= 0) diff += 7;
  diff += extraWeeks * 7;

  copy.setDate(copy.getDate() + diff);
  return copy;
}

function extractHour(text: string): { hour: number | null; minutes: number } {
  const match = text.match(/(\d{1,2})(?:[:h](\d{2}))?\s?(am|pm)?/i);
  if (!match) return { hour: null, minutes: 0 };

  let hour = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = (match[3] || "").toLowerCase();

  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  if (!period && hour >= 1 && hour <= 7) {
    hour += 12;
  }

  if (hour > 23 || minutes > 59) {
    return { hour: null, minutes: 0 };
  }

  return { hour, minutes };
}

function extractDay(text: string): Date | null {
  const today = new Date();
  const normalized = normalizeForMatching(text);

  if (normalized.includes("pasado manana")) {
    return addDays(today, 2);
  }

  if (normalized.includes("hoy")) return today;

  if (normalized.includes("manana")) {
    return addDays(today, 1);
  }

  const refersToNextWeek =
    /\b(siguiente|proxima|la otra)\s+semana\b/.test(normalized) ||
    /\bsemana\s+(que viene|siguiente)\b/.test(normalized) ||
    /\bel otro\s+(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/.test(normalized);

  for (const [word, dayIndex] of Object.entries(DAYS_MAP)) {
    const normalizedWord = normalizeForMatching(word);
    const mentionsDay = new RegExp(`\b${normalizedWord}\b`).test(normalized);

    if (!mentionsDay) continue;

    const extraWeeks = refersToNextWeek ? 1 : 0;
    return nextWeekday(today, dayIndex, extraWeeks);
  }

  return null;
}

function extractDuration(text: string): number {
  const match = text.match(/(\d+)\s?(min|mins|m)\b/i);
  if (match) return Math.max(15, parseInt(match[1], 10));

  const hourMatch = text.match(/(\d+)\s?(h|hora|horas)\b/i);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60;

  return 60;
}

function removeDateAndTimeTokens(text: string): string {
  return text
    .replace(
      /\b(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
    .replace(/\b(el otro|la otra)\b/gi, " ")
    .replace(/\b(de la|de|la)?\s*(siguiente|próxima|proxima)\s+semana\b/gi, " ")
    .replace(/\bsemana\s+(que viene|siguiente)\b/gi, " ")
    .replace(/\ba las\b/gi, " ")
    .replace(/\b(\d{1,2}(?::\d{2})?\s?(am|pm)?)\b/gi, " ")
    .replace(/\b(\d+)\s?(min|mins|m|h|hora|horas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTitleAndNotes(original: string): { title: string; notes: string } {
  const cleaned = collapseSpaces(removeDateAndTimeTokens(original));
  const normalizedCleaned = ` ${normalizeForMatching(cleaned)} `;

  for (const connector of CONTEXT_CONNECTORS) {
    const normalizedConnector = normalizeForMatching(connector).trim();
    const marker = ` ${normalizedConnector} `;
    const idx = normalizedCleaned.indexOf(marker);

    if (idx >= 0) {
      const rawIndex = findConnectorIndex(cleaned, normalizedConnector);
      if (rawIndex >= 0) {
        const title = collapseSpaces(cleaned.slice(0, rawIndex));
        const notes = collapseSpaces(cleaned.slice(rawIndex));

        return {
          title: title || cleaned || original.trim(),
          notes,
        };
      }
    }
  }

  return {
    title: cleaned || original.trim().slice(0, 40),
    notes: "",
  };
}

function findConnectorIndex(cleaned: string, normalizedConnector: string) {
  const lowered = normalizeForMatching(cleaned);
  const idx = lowered.indexOf(normalizedConnector);
  if (idx < 0) return -1;

  const rawWords = collapseSpaces(cleaned).split(" ");
  let built = "";
  let rawIndex = 0;

  for (const word of rawWords) {
    const normalizedWord = normalizeForMatching(word);
    const nextBuilt = built ? `${built} ${normalizedWord}` : normalizedWord;

    if (nextBuilt.includes(normalizedConnector)) {
      return rawIndex;
    }

    rawIndex += word.length + 1;
    built = nextBuilt;
  }

  return cleaned.toLowerCase().indexOf(normalizedConnector);
}

export function parseQuickCapture(input: string): ParsedQuickCapture {
  const raw = String(input || "").trim();
  const normalized = normalizeText(raw);

  const date = extractDay(normalized);
  const time = extractHour(normalized);
  const duration = extractDuration(normalized);

  let finalDate: Date | null = null;

  if (date) {
    finalDate = new Date(date);

    if (time.hour !== null) {
      finalDate.setHours(time.hour, time.minutes, 0, 0);
    } else {
      finalDate.setHours(12, 0, 0, 0);
    }
  }

  const split = splitTitleAndNotes(raw);

  return {
    title: formatTitle(split.title || raw.slice(0, 40)),
    notes: formatNotes(split.notes),
    date: finalDate,
    durationMinutes: duration,
  };
}