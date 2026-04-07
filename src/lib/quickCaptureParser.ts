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
  " con ",
  " en ",
  " para ",
  " por ",
  " cerca de ",
  " junto a ",
  " donde ",
  " en casa de ",
];

function normalizeText(input: string) {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatching(input: string) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collapseSpaces(input: string) {
  return String(input ?? "").replace(/\s+/g, " ").trim();
}

function capitalizeFirst(input: string) {
  const text = collapseSpaces(input);
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toSentenceCase(input: string) {
  return capitalizeFirst(String(input ?? "").toLowerCase());
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
    /\bjunto a\s+([a-záéíóúñ]+)/gi,
    /\bcerca de\s+([a-záéíóúñ]+)/gi,
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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
}

function nextOccurrenceOfDay(base: Date, targetDay: number) {
  const result = new Date(base);
  const currentDay = result.getDay();
  let diff = targetDay - currentDay;
  if (diff <= 0) diff += 7;
  result.setDate(result.getDate() + diff);
  return result;
}

function extractHour(text: string): { hour: number | null; minutes: number } {
  const match = text.match(
    /(?:a\s+las\s+|alas\s+)?(\d{1,2})(?:[:h](\d{2}))?\s?(am|pm)?/i
  );

  if (!match) return { hour: null, minutes: 0 };

  let hour = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = (match[3] || "").toLowerCase();

  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  // Heurística premium:
  // si pone 1-11 sin am/pm, asumimos tarde/noche
  if (!period && hour >= 1 && hour <= 11) {
    hour += 12;
  }

  if (hour > 23 || minutes > 59) {
    return { hour: null, minutes: 0 };
  }

  return { hour, minutes };
}

function extractDuration(text: string): number {
  const minMatch = text.match(/(\d+)\s?(min|mins|m)\b/i);
  if (minMatch) return Math.max(15, parseInt(minMatch[1], 10));

  const hourMatch = text.match(/(\d+)\s?(h|hora|horas)\b/i);
  if (hourMatch) return Math.max(30, parseInt(hourMatch[1], 10) * 60);

  return 60;
}

function extractDay(text: string): Date | null {
  const today = startOfToday();
  const normalized = normalizeForMatching(text);

  if (normalized.includes("pasado manana")) {
    return addDays(today, 2);
  }

  if (normalized.includes("hoy")) {
    return today;
  }

  if (normalized.includes("manana")) {
    return addDays(today, 1);
  }

  const hasNextWeekIntent =
    normalized.includes("siguiente semana") ||
    normalized.includes("proxima semana") ||
    normalized.includes("semana que viene") ||
    normalized.includes("la otra semana") ||
    normalized.includes("de la otra semana") ||
    normalized.includes("de la siguiente semana") ||
    normalized.includes("de la proxima semana");

  const hasTwoWeeksIntent =
    normalized.includes("en dos semanas") ||
    normalized.includes("dentro de dos semanas");

  const hasOtherDayIntent =
    /\bel otro\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    ) ||
    /\bla otra\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    );

  const hasNextDayIntent =
    /\bproximo\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    ) ||
    /\bproxima\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    ) ||
    /\bsiguiente\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    );

  for (const [word, dayIndex] of Object.entries(DAYS_MAP)) {
    const regex = new RegExp(`\\b${normalizeForMatching(word)}\\b`, "i");
    if (!regex.test(normalized)) continue;

    let result = nextOccurrenceOfDay(today, dayIndex);

    if (hasNextWeekIntent || hasOtherDayIntent) {
      result = addDays(result, 7);
    }

    if (hasTwoWeeksIntent) {
      result = addDays(result, 14);
    } else if (hasNextDayIntent && !hasNextWeekIntent && !hasOtherDayIntent) {
      result = nextOccurrenceOfDay(addDays(today, 1), dayIndex);
    }

    return result;
  }

  if (
    normalized.includes("proxima semana") ||
    normalized.includes("siguiente semana") ||
    normalized.includes("semana que viene")
  ) {
    return addDays(today, 7);
  }

  if (normalized.includes("en dos semanas")) {
    return addDays(today, 14);
  }

  return null;
}

function removeDateAndTimeTokens(text: string): string {
  return String(text ?? "")
    .replace(
      /\b(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
    .replace(/\b(proximo|próximo|proxima|próxima|siguiente|otro|otra)\b/gi, " ")
    .replace(/\b(semana|que|viene)\b/gi, " ")
    .replace(/\b(dentro de)\b/gi, " ")
    .replace(/\b(a\s+las|alas)\b/gi, " ")
    .replace(/\b(\d{1,2})(?::\d{2})?\s?(am|pm)?\b/gi, " ")
    .replace(/\b(\d+)\s?(min|mins|m|h|hora|horas)\b/gi, " ")
    .replace(/\b(en dos semanas)\b/gi, " ")
    .replace(/\b(el|la|los|las)\b(?=\s*$)/gi, " ")
    .replace(
      /\b(el|la)\b(?=\s+(jueves|viernes|martes|miercoles|miércoles|lunes|domingo|sabado|sábado)\b)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
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

function cleanFallbackTitle(raw: string): string {
  const cleaned = collapseSpaces(removeDateAndTimeTokens(raw));
  if (!cleaned) return collapseSpaces(raw).slice(0, 40);
  return cleaned.slice(0, 60);
}

export function parseQuickCapture(input: string): ParsedQuickCapture {
  const raw = String(input || "").trim();
  const normalized = normalizeText(raw);

  const date = extractDay(raw);
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
    title: formatTitle(split.title || cleanFallbackTitle(raw)),
    notes: formatNotes(split.notes),
    date: finalDate,
    durationMinutes: duration,
  };
}