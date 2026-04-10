
export type ParsedQuickCaptureSignals = {
  hasExplicitDate: boolean;
  hasExplicitTime: boolean;
  mentionsWeekend: boolean;
  mentionsWeekday: boolean;
  mentionsPeople: boolean;
  mentionsPluralGroup: boolean;
  mentionsLocation: boolean;
  mentionsUrgency: boolean;
  mentionsLooseFuture: boolean;
  mentionsRoutine: boolean;
  mentionsCelebration: boolean;
  mentionsHealth: boolean;
  mentionsWork: boolean;
  mentionsSports: boolean;
  mentionsFood: boolean;
  mentionsCouple: boolean;
  mentionsFamily: boolean;
  confidence: "low" | "medium" | "high";
};

export type ParsedQuickCapture = {
  title: string;
  notes: string;
  date: Date | null;
  durationMinutes: number;
  participants: string[];
  signals: ParsedQuickCaptureSignals;
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
  " en casa de ",
  " cerca de ",
  " junto a ",
  " en ",
  " para ",
  " por ",
  " donde ",
];

const NAME_STOPWORDS = new Set([
  "mi",
  "mis",
  "con",
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
  "para",
  "por",
  "tipo",
  "desde",
  "hasta",
  "manana",
  "mañana",
  "hoy",
  "viernes",
  "jueves",
  "miercoles",
  "miércoles",
  "martes",
  "lunes",
  "sabado",
  "sábado",
  "domingo",
  "tarde",
  "noche",
  "mediodia",
  "mediodía",
  "medianoche",
  "semana",
  "finde",
  "fin",
  "casa",
]);

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
    .trim()
    .replace(/\s+/g, " ");
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
      if (!cleanName || smallWords.has(cleanName.toLowerCase())) return match;

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
  return capitalizeLikelyProperNames(toSentenceCase(cleaned));
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

function normalizePossibleName(value: string) {
  const cleaned = normalizeForMatching(value).replace(/[^a-zñáéíóúü\s]/gi, " ");
  const words = collapseSpaces(cleaned).split(" ").filter(Boolean);

  if (words.length === 0 || words.length > 3) return null;
  if (words.some((word) => NAME_STOPWORDS.has(word))) return null;
  if (words.some((word) => /\d/.test(word))) return null;

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function extractParticipants(raw: string): string[] {
  const normalizedRaw = normalizeForMatching(raw);
  const seen = new Set<string>();
  const participants: string[] = [];

  const patterns = [
    /\bcon\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+){0,2})\b/gi,
    /\bjunto a\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+){0,2})\b/gi,
    /\ben casa de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+){0,2})\b/gi,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalizedRaw)) !== null) {
      const chunk = String(match[1] ?? "").trim();
      if (!chunk) continue;

      const rawNames = chunk
        .split(/\s+y\s+/i)
        .map((part) => normalizePossibleName(part))
        .filter(Boolean) as string[];

      for (const name of rawNames) {
        const key = normalizeForMatching(name);
        if (seen.has(key)) continue;
        seen.add(key);
        participants.push(name);
      }
    }
  }

  const roleBased: Array<[RegExp, string]> = [
    [/\bmi novia\b/i, "Novia"],
    [/\bmi novio\b/i, "Novio"],
    [/\bmi pareja\b/i, "Pareja"],
    [/\bmi esposa\b/i, "Esposa"],
    [/\bmi esposo\b/i, "Esposo"],
    [/\bmi mama\b|\bmi mamá\b/i, "Mamá"],
    [/\bmi papa\b|\bmi papá\b/i, "Papá"],
    [/\bmi familia\b/i, "Familia"],
  ];

  for (const [regex, label] of roleBased) {
    if (!regex.test(normalizedRaw)) continue;
    const key = normalizeForMatching(label);
    if (seen.has(key)) continue;
    seen.add(key);
    participants.push(label);
  }

  return participants;
}

function removeParticipantPhrases(raw: string): string {
  return collapseSpaces(
    String(raw ?? "")
      .replace(
        /\b(con|junto a|en casa de)\s+[a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+){0,2}\b/gi,
        " "
      )
      .replace(/\b(mi novia|mi novio|mi pareja|mi esposa|mi esposo|mi familia)\b/gi, " ")
  );
}

function detectSignals(raw: string, participants: string[]): ParsedQuickCaptureSignals {
  const normalized = normalizeForMatching(raw);

  const hasExplicitDate =
    /\b(hoy|manana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    ) ||
    /\b(proxima semana|proximo|próximo|proxima|próxima|siguiente|en dos semanas|la otra semana|semana que viene|este fin de semana|el otro finde)\b/.test(
      normalized
    );

  const hasExplicitTime =
    /\bde\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\s+a\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\b/i.test(raw) ||
    /\b(a\s+las|alas)?\s*\d{1,2}(?::\d{2})?\s?(am|pm)?\b/i.test(raw) ||
    /\b(mediodia|medianoche)\b/i.test(raw);

  const mentionsWeekend =
    /\b(fin de semana|finde|sabado|sábado|domingo)\b/.test(normalized);

  const mentionsWeekday =
    /\b(entre semana|durante la semana|lunes|martes|miercoles|miércoles|jueves|viernes)\b/.test(
      normalized
    );

  const mentionsPeople =
    participants.length > 0 ||
    /\b(novia|novio|pareja|esposa|esposo|mama|mamá|papa|papá|familia|amigos|primos|tios|tíos)\b/.test(
      normalized
    );

  const mentionsPluralGroup =
    /\b(amigos|familia|primos|tios|tíos|equipo|grupo|todos|nosotros|ustedes)\b/.test(
      normalized
    );

  const mentionsLocation =
    /\b(en|por|cerca de|en casa de|donde)\s+[a-záéíóúñ0-9]+\b/i.test(raw);

  const mentionsUrgency =
    /\b(hoy|esta tarde|esta noche|mañana|manana|urgente|antes de|si o si|sí o sí|cuanto antes)\b/.test(
      normalized
    );

  const mentionsLooseFuture =
    /\b(algun dia|algún día|uno de estos dias|uno de estos días|cuando puedan|cuando se pueda|esta semana|el otro finde|otro dia|otro día|mas adelante|más adelante)\b/.test(
      normalized
    );

  const mentionsRoutine =
    /\b(como siempre|de siempre|otra vez|de nuevo|semanal|mensual|cada)\b/.test(
      normalized
    );

  const mentionsCelebration =
    /\b(cumple|cumpleanos|cumpleaños|aniversario|celebracion|celebración|brunch)\b/.test(
      normalized
    );

  const mentionsHealth = /\b(medico|doctor|dentista|clinica|clínica|cita medica)\b/.test(normalized);
  const mentionsWork = /\b(reunion|meeting|llamada|zoom|trabajo|oficina)\b/.test(normalized);
  const mentionsSports = /\b(fulbito|futbol|fútbol|padel|pádel|tenis|gym|entrenamiento)\b/.test(normalized);
  const mentionsFood = /\b(desayuno|almuerzo|cena|cafe|cafecito|comer|cenar|almorzar)\b/.test(normalized);
  const mentionsCouple = /\b(novia|novio|pareja|esposa|esposo|aniversario)\b/.test(normalized);
  const mentionsFamily = /\b(familia|familiar|mama|mamá|papa|papá|hijos|abuelos|primos|tios|tíos)\b/.test(normalized);

  let confidenceScore = 0;
  if (hasExplicitDate) confidenceScore += 1;
  if (hasExplicitTime) confidenceScore += 1;
  if (mentionsPeople || mentionsLocation) confidenceScore += 1;
  if (mentionsCelebration || mentionsHealth || mentionsWork || mentionsSports || mentionsFood) {
    confidenceScore += 1;
  }

  const confidence: "low" | "medium" | "high" =
    confidenceScore >= 3 ? "high" : confidenceScore === 2 ? "medium" : "low";

  return {
    hasExplicitDate,
    hasExplicitTime,
    mentionsWeekend,
    mentionsWeekday,
    mentionsPeople,
    mentionsPluralGroup,
    mentionsLocation,
    mentionsUrgency,
    mentionsLooseFuture,
    mentionsRoutine,
    mentionsCelebration,
    mentionsHealth,
    mentionsWork,
    mentionsSports,
    mentionsFood,
    mentionsCouple,
    mentionsFamily,
    confidence,
  };
}

function normalizeHourFromCapture(hour: number, period?: string | null) {
  let safeHour = hour;
  const safePeriod = String(period ?? "").toLowerCase();

  if (safePeriod === "pm" && safeHour < 12) safeHour += 12;
  if (safePeriod === "am" && safeHour === 12) safeHour = 0;

  if (!safePeriod && safeHour >= 1 && safeHour <= 11) {
    safeHour += 12;
  }

  return safeHour;
}

function extractTimeRange(text: string): {
  startHour: number | null;
  startMinutes: number;
  endHour: number | null;
  endMinutes: number;
} {
  const normalized = normalizeForMatching(text);

  if (/\bmediodia\b/.test(normalized)) {
    return { startHour: 12, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  if (/\bmedianoche\b/.test(normalized)) {
    return { startHour: 0, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  const rangeMatch = text.match(
    /\bde\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\s+a\s+(\d{1,2})(?::(\d{2}))?\s?(am|pm)?\b/i
  );

  if (rangeMatch) {
    const startHour = normalizeHourFromCapture(
      parseInt(rangeMatch[1], 10),
      rangeMatch[3]
    );
    const startMinutes = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const endHour = normalizeHourFromCapture(
      parseInt(rangeMatch[4], 10),
      rangeMatch[6] || rangeMatch[3]
    );
    const endMinutes = rangeMatch[5] ? parseInt(rangeMatch[5], 10) : 0;

    if (
      startHour <= 23 &&
      endHour <= 23 &&
      startMinutes <= 59 &&
      endMinutes <= 59
    ) {
      return { startHour, startMinutes, endHour, endMinutes };
    }
  }

  const singleMatch = text.match(
    /(?:a\s+las\s+|alas\s+)?(\d{1,2})(?:[:h](\d{2}))?\s?(am|pm)?/i
  );

  if (!singleMatch) {
    return { startHour: null, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  const startHour = normalizeHourFromCapture(
    parseInt(singleMatch[1], 10),
    singleMatch[3]
  );
  const startMinutes = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;

  if (startHour > 23 || startMinutes > 59) {
    return { startHour: null, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  return { startHour, startMinutes, endHour: null, endMinutes: 0 };
}

function extractDuration(text: string): number {
  const range = extractTimeRange(text);
  if (range.startHour !== null && range.endHour !== null) {
    const start = range.startHour * 60 + range.startMinutes;
    const end = range.endHour * 60 + range.endMinutes;
    if (end > start) return Math.max(30, end - start);
  }

  const minMatch = text.match(/(\d+)\s?(min|mins|m)\b/i);
  if (minMatch) return Math.max(15, parseInt(minMatch[1], 10));

  const hourMatch = text.match(/(\d+)\s?(h|hora|horas)\b/i);
  if (hourMatch) return Math.max(30, parseInt(hourMatch[1], 10) * 60);

  const normalized = normalizeForMatching(text);

  if (/\bdesayuno\b/.test(normalized)) return 60;
  if (/\bcafe|cafecito\b/.test(normalized)) return 60;
  if (/\balmuerzo|lunch\b/.test(normalized)) return 90;
  if (/\bcena|dinner\b/.test(normalized)) return 120;
  if (/\bpadel|pádel|fulbito|futbol|fútbol|tenis|gym\b/.test(normalized)) return 90;
  if (/\breunion|meeting|llamada|zoom\b/.test(normalized)) return 60;
  if (/\bdoctor|medico|médico|dentista\b/.test(normalized)) return 60;
  if (/\bcumple|cumpleanos|cumpleaños|aniversario\b/.test(normalized)) return 120;

  return 60;
}

function extractDay(text: string): Date | null {
  const today = startOfToday();
  const normalized = normalizeForMatching(text);

  if (normalized.includes("pasado manana")) return addDays(today, 2);
  if (normalized.includes("hoy")) return today;
  if (normalized.includes("manana")) return addDays(today, 1);

  if (
    normalized.includes("este fin de semana") ||
    normalized.includes("este finde")
  ) {
    return nextOccurrenceOfDay(today, 6);
  }

  if (
    normalized.includes("el otro finde") ||
    normalized.includes("el otro fin de semana") ||
    normalized.includes("proximo fin de semana") ||
    normalized.includes("próximo fin de semana")
  ) {
    return addDays(nextOccurrenceOfDay(today, 6), 7);
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

    if (hasNextWeekIntent || hasOtherDayIntent) result = addDays(result, 7);
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
    .replace(
      /\b(fin de semana|finde|este finde|este fin de semana|el otro finde|el otro fin de semana)\b/gi,
      " "
    )
    .replace(/\b(proximo|próximo|proxima|próxima|siguiente|otro|otra|este|esta)\b/gi, " ")
    .replace(/\b(semana|que|viene)\b/gi, " ")
    .replace(/\b(dentro de)\b/gi, " ")
    .replace(/\bde\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\s+a\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\b/gi, " ")
    .replace(/\b(a\s+las|alas)\b/gi, " ")
    .replace(/\b(mediodia|medianoche)\b/gi, " ")
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
  const cleaned = collapseSpaces(removeDateAndTimeTokens(removeParticipantPhrases(original)));
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
  const cleaned = collapseSpaces(removeDateAndTimeTokens(removeParticipantPhrases(raw)));
  if (!cleaned) return collapseSpaces(raw).slice(0, 40);
  return cleaned.slice(0, 60);
}

function buildSemanticTitle(baseTitle: string, participants: string[]): string {
  const safeBase = formatTitle(baseTitle);
  if (!safeBase) return "";

  if (participants.length === 0) return safeBase;
  if (participants.length === 1) return `${safeBase} con ${participants[0]}`;
  if (participants.length === 2) return `${safeBase} con ${participants[0]} y ${participants[1]}`;

  return `${safeBase} con ${participants[0]} y ${participants.length - 1} más`;
}

export function parseQuickCapture(input: string): ParsedQuickCapture {
  const raw = String(input || "").trim();
  const normalized = normalizeText(raw);

  const participants = extractParticipants(raw);
  const signals = detectSignals(raw, participants);
  const date = extractDay(raw);
  const timeRange = extractTimeRange(normalized);
  const duration = extractDuration(normalized);

  let finalDate: Date | null = null;

  if (date) {
    finalDate = new Date(date);

    if (timeRange.startHour !== null) {
      finalDate.setHours(timeRange.startHour, timeRange.startMinutes, 0, 0);
    } else {
      finalDate.setHours(12, 0, 0, 0);
    }
  }

  const split = splitTitleAndNotes(raw);
  const titleBase = split.title || cleanFallbackTitle(raw);
  const title = buildSemanticTitle(titleBase, participants);

  return {
    title: title || formatTitle(cleanFallbackTitle(raw)),
    notes: formatNotes(split.notes),
    date: finalDate,
    durationMinutes: duration,
    participants,
    signals: {
      ...signals,
      hasExplicitDate: signals.hasExplicitDate || !!date,
      hasExplicitTime: signals.hasExplicitTime || timeRange.startHour !== null,
      confidence:
        date && timeRange.startHour !== null
          ? "high"
          : date || timeRange.startHour !== null || participants.length > 0
          ? "medium"
          : signals.confidence,
    },
  };
}