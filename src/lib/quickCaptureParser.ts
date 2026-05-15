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
  mentionsAtSymbolLocation: boolean;
  mentionsHouseOfLocation: boolean;
  confidence: "low" | "medium" | "high";
};

export type ParsedQuickCapture = {
  title: string;
  notes: string;
  date: Date | null;
  endDate: Date | null;
  durationMinutes: number;
  participants: string[];
  startHour: number | null;
  startMinutes: number;
  locationQuery: string | null;
  locationConfidence: "low" | "medium" | "high";
  locationSource: "connector" | "at_symbol" | "house_of" | null;
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

const MONTHS_MAP: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const MONTH_WORD_PATTERN =
  "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

const EXPLICIT_DATE_RANGE_REGEX = new RegExp(
  String.raw`\b(?:del|desde\s+el|desde)\s+` +
    String.raw`\d{1,2}(?:(?:\s+de)?\s+(?:${MONTH_WORD_PATTERN})|[/-]\d{1,2}(?:[/-]\d{2,4})?)?(?:\s+de\s+\d{4})?` +
    String.raw`\s+(?:al|a|hasta|hasta\s+el)\s+` +
    String.raw`\d{1,2}(?:(?:\s+de)?\s+(?:${MONTH_WORD_PATTERN})|[/-]\d{1,2}(?:[/-]\d{2,4})?)?(?:\s+de\s+\d{4})?`,
  "gi",
);

const EXPLICIT_SINGLE_DATE_REGEX = new RegExp(
  String.raw`\b\d{1,2}(?:(?:\s+de)?\s+(?:${MONTH_WORD_PATTERN})|[/-]\d{1,2}(?:[/-]\d{2,4})?)(?:\s+de\s+\d{4})?\b`,
  "gi",
);

const TITLE_NOTES_CONNECTORS = [
  " en casa de ",
  " cerca de ",
  " junto a ",
  " donde ",
  " en ",
  " para ",
  " por ",
];

const LOCATION_INVALID_SINGLE_TOKENS = new Set([
  "hoy",
  "manana",
  "mañana",
  "tarde",
  "noche",
  "pareja",
  "grupo",
  "familia",
  "semana",
  "finde",
  "casa",
]);

const LOCATION_INVALID_PHRASES = [
  "la noche",
  "la tarde",
  "la manana",
  "la mañana",
  "en familia",
  "en pareja",
  "en grupo",
];

const LOCATION_TIME_WORDS = new Set([
  "hoy",
  "mañana",
  "manana",
  "pasado",
  "lunes",
  "martes",
  "miercoles",
  "miércoles",
  "jueves",
  "viernes",
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
  "hora",
  "horas",
  "min",
  "mins",
  "am",
  "pm",
]);

const LOCATION_BREAK_TOKENS = [
  " con ",
  " para ",
  " a las ",
  " a la ",
  " al ",
  " del ",
  " desde ",
  " hasta ",
  " alas ",
  " hoy",
  " mañana",
  " manana",
  " pasado mañana",
  " pasado manana",
  " lunes",
  " martes",
  " miercoles",
  " miércoles",
  " jueves",
  " viernes",
  " sabado",
  " sábado",
  " domingo",
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
  "chicos",
  "amigos",
  "familia",
  "equipo",
  "grupo",
  "todos",
  "nosotros",
  "ustedes",
]);

const GENERIC_GROUP_PHRASES = [
  "los chicos",
  "las chicas",
  "los amigos",
  "las amigas",
  "amigos",
  "amigas",
  "familia",
  "mi familia",
  "equipo",
  "grupo",
  "todos",
  "nosotros",
  "ustedes",
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

function capitalizeNameLikeText(input: string) {
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

  return String(input ?? "")
    .split(/(\s+|,\s*)/)
    .map((part, index) => {
      if (!part || /^\s+$/.test(part) || /,\s*/.test(part)) return part;
      const clean = normalizeForMatching(part);
      if (!clean) return part;
      if (smallWords.has(clean) && index !== 0) return clean;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join("");
}

function formatTitle(input: string) {
  const cleaned = collapseSpaces(input);
  if (!cleaned) return "";
  const lower = cleaned.toLowerCase();
  return capitalizeNameLikeText(lower.charAt(0).toUpperCase() + lower.slice(1));
}

function formatNotes(input: string) {
  const cleaned = collapseSpaces(input);
  if (!cleaned) return "";
  return capitalizeNameLikeText(toSentenceCase(cleaned));
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfToday() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    12,
    0,
    0,
    0
  );
}


function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function monthIndexFromFragment(fragment: string): number | null {
  const normalized = normalizeForMatching(fragment);
  for (const [monthName, monthIndex] of Object.entries(MONTHS_MAP)) {
    if (new RegExp(`\\b${monthName}\\b`, "i").test(normalized)) {
      return monthIndex;
    }
  }
  return null;
}

function yearFromFragment(fragment: string): number | null {
  const match = normalizeForMatching(fragment).match(/\b(20\d{2}|19\d{2})\b/);
  if (!match) return null;
  const rawYear = Number(match[1]);
  if (!Number.isFinite(rawYear)) return null;
  return rawYear;
}
function normalizeMissingYear(date: Date, yearWasExplicit: boolean) {
  if (yearWasExplicit) return date;

  const today = startOfLocalDay(new Date());
  const candidate = new Date(date);
  if (candidate.getTime() < today.getTime()) {
    candidate.setFullYear(candidate.getFullYear() + 1);
  }
  return candidate;
}

function buildLocalDate(
  day: number,
  month: number,
  year: number,
  yearWasExplicit: boolean,
): Date | null {
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
    return null;
  }
  if (day < 1 || day > 31 || month < 0 || month > 11) return null;

  const date = new Date(year, month, day, 12, 0, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }

  return normalizeMissingYear(date, yearWasExplicit);
}

function parseExplicitDateFragment(
  fragment: string,
  options: { defaultMonth?: number | null; defaultYear?: number | null } = {},
): Date | null {
  const raw = String(fragment ?? "").trim();
  if (!raw) return null;

  const today = new Date();
  const numeric = raw.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const rawYear = numeric[3] ? Number(numeric[3]) : options.defaultYear ?? today.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return buildLocalDate(day, month, year, Boolean(numeric[3]));
  }

  const normalized = normalizeForMatching(raw);
  const longMatch = normalized.match(
    new RegExp(`\\b(\\d{1,2})(?:\\s+de)?\\s+(${MONTH_WORD_PATTERN})(?:\\s+de\\s+(\\d{4}|\\d{2}))?\\b`, "i"),
  );
  if (longMatch) {
    const day = Number(longMatch[1]);
    const month = MONTHS_MAP[longMatch[2]];
    const rawYear = longMatch[3]
      ? Number(longMatch[3])
      : options.defaultYear ?? today.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    return buildLocalDate(day, month, year, Boolean(longMatch[3]));
  }

  const dayOnly = normalized.match(/^\s*(\d{1,2})\s*$/);
  if (dayOnly && options.defaultMonth !== undefined && options.defaultMonth !== null) {
    const day = Number(dayOnly[1]);
    const year = options.defaultYear ?? today.getFullYear();
    return buildLocalDate(day, options.defaultMonth, year, Boolean(options.defaultYear));
  }

  return null;
}

function extractExplicitDateRange(text: string): { start: Date; end: Date } | null {
  const raw = String(text ?? "");
  const match = raw.match(
    /\b(?:del|desde\s+el|desde)\s+(.{1,48}?)\s+(?:al|a|hasta|hasta\s+el)\s+(.{1,48}?)(?=\s+(?:en|con|para|por|a\s+las|a\s+la|alas)\b|[.,;!?]|$)/i,
  );

  if (!match) return null;

  const startFragment = collapseSpaces(match[1] ?? "");
  const endFragment = collapseSpaces(match[2] ?? "");
  const endMonth = monthIndexFromFragment(endFragment);
  const startYear = yearFromFragment(startFragment);
  const endYear = yearFromFragment(endFragment);
  const fallbackYear = startYear ?? endYear ?? null;

  const start = parseExplicitDateFragment(startFragment, {
    defaultMonth: endMonth,
    defaultYear: fallbackYear,
  });
  const end = parseExplicitDateFragment(endFragment, {
    defaultYear: start?.getFullYear() ?? fallbackYear,
  });

  if (!start || !end) return null;

  const normalizedEnd = new Date(end);
  if (normalizedEnd.getTime() < start.getTime()) {
    normalizedEnd.setFullYear(normalizedEnd.getFullYear() + 1);
  }

  return { start, end: normalizedEnd };
}

function extractExplicitSingleDate(text: string): Date | null {
  const raw = String(text ?? "");
  const match = raw.match(EXPLICIT_SINGLE_DATE_REGEX);
  if (!match?.[0]) return null;
  return parseExplicitDateFragment(match[0]);
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
  const cleaned = normalizeForMatching(value).replace(
    /[^a-zñáéíóúü\s]/gi,
    " "
  );
  const words = collapseSpaces(cleaned).split(" ").filter(Boolean);

  if (words.length === 0 || words.length > 3) return null;
  if (words.some((word) => NAME_STOPWORDS.has(word))) return null;
  if (words.some((word) => /\d/.test(word))) return null;

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function normalizeGenericGroupLabel(rawChunk: string): string | null {
  const value = normalizeForMatching(rawChunk);

  if (!value) return null;
  if (value === "los chicos" || value === "las chicas") return "Amigos";
  if (value === "los amigos" || value === "las amigas") return "Amigos";
  if (value === "amigos" || value === "amigas") return "Amigos";
  if (value === "familia" || value === "mi familia") return "Familia";
  if (value === "equipo" || value === "grupo") return "Equipo";
  if (value === "todos" || value === "nosotros" || value === "ustedes") {
    return "Grupo";
  }

  return null;
}

function splitParticipantChunk(chunk: string): string[] {
  return String(chunk ?? "")
    .split(/,|\s+y\s+|\s+e\s+/i)
    .map((part) => normalizePossibleName(part))
    .filter(Boolean) as string[];
}

function stripTrailingTimeAndDate(chunk: string) {
  return String(chunk ?? "")
    .replace(/\b(el|la|los|las)?\s*(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/i, "")
    .replace(/\b(a\s+las|a\s+la|al|alas|de)\s+\d{1,2}(?::\d{2})?\s?(a\.?m\.?|p\.?m\.?|am|pm)?\b.*$/i, "")
    .replace(/\b(en casa de|en|por|cerca de|donde|junto a)\b.*$/i, "")
    .replace(/\b(el|la|los|las)\b\s*$/i, "")
    .replace(/[.,;:!?]+$/g, "")
    .trim();
}

function extractParticipants(raw: string): string[] {
  const sourceRaw = String(raw ?? "");
  const normalizedRaw = normalizeForMatching(sourceRaw);
  const seen = new Set<string>();
  const participants: string[] = [];

  const patterns = [/\bcon\s+([^.;:!?]+)/gi, /\bjunto a\s+([^.;:!?]+)/gi];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sourceRaw)) !== null) {
      const chunk = stripTrailingTimeAndDate(String(match[1] ?? "").trim());
      if (!chunk) continue;

      const genericLabel = normalizeGenericGroupLabel(chunk);
      if (genericLabel) {
        const key = normalizeForMatching(genericLabel);
        if (!seen.has(key)) {
          seen.add(key);
          participants.push(genericLabel);
        }
        continue;
      }

      const rawNames = splitParticipantChunk(chunk);
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
  let text = String(raw ?? "");

  text = text.replace(
    /\b(con|junto a|en casa de)\s+(los chicos|las chicas|los amigos|las amigas|amigos|amigas|familia|mi familia|equipo|grupo|todos|nosotros|ustedes)\b/gi,
    " "
  );

  text = text.replace(
    /\b(mi novia|mi novio|mi pareja|mi esposa|mi esposo|mi familia)\b/gi,
    " "
  );

  return collapseSpaces(text);
}

function cutAtBreakToken(value: string): string {
  let result = String(value ?? "");

  for (const token of LOCATION_BREAK_TOKENS) {
    const idx = normalizeForMatching(result).indexOf(normalizeForMatching(token));
    if (idx > 0) {
      result = result.slice(0, idx);
      break;
    }
  }

  return collapseSpaces(result);
}

function sanitizeLocationFragment(raw: string): string {
  let value = String(raw ?? "")
    .replace(/^[\s,.;:!?-]+/, "")
    .replace(/[\s,.;:!?-]+$/, "");

  value = value
    .replace(
      /\b(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b.*$/i,
      ""
    )
    .replace(/\b(a\s+las|a\s+la|al|alas|de)\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\b.*$/i, "")
    .replace(/\b(\d+)\s?(min|mins|m|h|hora|horas)\b.*$/i, "")
    .trim();

  value = cutAtBreakToken(value);

  return collapseSpaces(value.replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, ""));
}

function isProbablyValidLocationFragment(value: string): boolean {
  const normalized = normalizeForMatching(value);
  if (!normalized) return false;

  if (LOCATION_INVALID_PHRASES.includes(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (/^\d+\s?(min|mins|m|h|hora|horas)$/.test(normalized)) return false;
  if (/^(la|el|los|las)\s+(noche|tarde|manana|mañana)$/.test(normalized)) {
    return false;
  }

  const words = normalized.split(" ").filter(Boolean);
  if (!words.length) return false;

  if (
    words.every(
      (word) => LOCATION_TIME_WORDS.has(word) || /\d/.test(word)
    )
  ) {
    return false;
  }

  if (
    words.length === 1 &&
    (LOCATION_INVALID_SINGLE_TOKENS.has(words[0]) || /\d/.test(words[0]))
  ) {
    return false;
  }

  return true;
}

function detectLocationIntent(raw: string): {
  locationQuery: string | null;
  locationSource: "connector" | "at_symbol" | "house_of" | null;
  locationConfidence: "low" | "medium" | "high";
} {
  const text = String(raw ?? "");

  const houseMatch = text.match(
    /\ben\s+casa\s+de\s+([^.;:!?]+(?:\s+[^.;:!?]+){0,5})/i
  );
  if (houseMatch) {
    const cleaned = sanitizeLocationFragment(`Casa de ${houseMatch[1] ?? ""}`);
    if (isProbablyValidLocationFragment(cleaned)) {
      return {
        locationQuery: capitalizeNameLikeText(cleaned),
        locationSource: "house_of",
        locationConfidence: "high",
      };
    }
  }

  const atSymbolMatch = text.match(/@([^\s,.;:!?]+(?:\s+[^\s,.;:!?]+){0,4})/);
  if (atSymbolMatch) {
    const cleaned = sanitizeLocationFragment(String(atSymbolMatch[1] ?? ""));
    if (isProbablyValidLocationFragment(cleaned)) {
      return {
        locationQuery: capitalizeNameLikeText(cleaned),
        locationSource: "at_symbol",
        locationConfidence: "high",
      };
    }
  }

  const connectorPatterns: Array<{
    regex: RegExp;
    confidence: "medium" | "high";
  }> = [
    { regex: /\bdonde\s+([^.;:!?]+)/i, confidence: "high" },
    { regex: /\bjunto a\s+([^.;:!?]+)/i, confidence: "high" },
    { regex: /\bcerca de\s+([^.;:!?]+)/i, confidence: "medium" },
    { regex: /\bpor\s+([^.;:!?]+)/i, confidence: "medium" },
    { regex: /\ben\s+([^.;:!?]+)/i, confidence: "medium" },
  ];

  for (const pattern of connectorPatterns) {
    const match = text.match(pattern.regex);
    if (!match) continue;

    const cleaned = sanitizeLocationFragment(String(match[1] ?? ""));
    if (!isProbablyValidLocationFragment(cleaned)) continue;

    if (/\b(con|junto)\s+[a-záéíóúñ]/i.test(cleaned)) continue;

    return {
      locationQuery: capitalizeNameLikeText(cleaned),
      locationSource: "connector",
      locationConfidence: pattern.confidence,
    };
  }

  return {
    locationQuery: null,
    locationSource: null,
    locationConfidence: "low",
  };
}

function detectSignals(
  raw: string,
  participants: string[]
): ParsedQuickCaptureSignals {
  const normalized = normalizeForMatching(raw);

  const hasExplicitDate =
    /\b(hoy|manana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/.test(
      normalized
    ) ||
    /\b(proxima semana|proximo|próximo|proxima|próxima|siguiente|en dos semanas|la otra semana|semana que viene|este fin de semana|el otro finde)\b/.test(
      normalized
    ) ||
    /\b(?:del|desde)\s+\d{1,2}\b/i.test(raw) ||
    EXPLICIT_SINGLE_DATE_REGEX.test(raw);
  EXPLICIT_SINGLE_DATE_REGEX.lastIndex = 0;

  const hasExplicitTime =
    /\bde\s+\d{1,2}(?::\d{2})?\s?(am|pm)?\s+a\s+\d{1,2}(?::(\d{2}))?\s?(am|pm)?\b/i.test(
      raw
    ) ||
    /\b(a\s+las|a\s+la|al|alas)?\s*\d{1,2}(?::\d{2})?\s?(am|pm)?\b/i.test(raw) ||
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
    /\b(amigos|familia|primos|tios|tíos|equipo|grupo|todos|nosotros|ustedes|chicos|chicas)\b/.test(
      normalized
    );
  const mentionsLocation =
    /\b(en|por|cerca de|en casa de|donde|junto a)\s+[a-záéíóúñ0-9]+\b/i.test(raw);
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
  const mentionsHealth =
    /\b(medico|doctor|dentista|clinica|clínica|cita medica)\b/.test(normalized);
  const mentionsWork =
    /\b(reunion|meeting|llamada|zoom|trabajo|oficina)\b/.test(normalized);
  const mentionsSports =
    /\b(fulbito|futbol|fútbol|padel|pádel|tenis|gym|entrenamiento)\b/.test(
      normalized
    );
  const mentionsFood =
    /\b(desayuno|almuerzo|cena|cafe|cafecito|comer|cenar|almorzar|parrilla|asado)\b/.test(
      normalized
    );
  const mentionsCouple =
    /\b(novia|novio|pareja|esposa|esposo|aniversario)\b/.test(normalized);
  const mentionsFamily =
    /\b(familia|familiar|mama|mamá|papa|papá|hijos|abuelos|primos|tios|tíos)\b/.test(
      normalized
    );
  const mentionsAtSymbolLocation = /@[^\s,.;:!?]+/.test(raw);
  const mentionsHouseOfLocation = /\ben\s+casa\s+de\s+[a-záéíóúñ]/i.test(raw);

  let confidenceScore = 0;
  if (hasExplicitDate) confidenceScore += 1;
  if (hasExplicitTime) confidenceScore += 1;
  if (mentionsPeople || mentionsLocation) confidenceScore += 1;
  if (
    mentionsCelebration ||
    mentionsHealth ||
    mentionsWork ||
    mentionsSports ||
    mentionsFood
  ) {
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
    mentionsAtSymbolLocation,
    mentionsHouseOfLocation,
    confidence,
  };
}

function normalizeHourFromCapture(hour: number, period?: string | null) {
  let safeHour = hour;
  const safePeriod = String(period ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim();

  if (safePeriod === "pm" && safeHour < 12) safeHour += 12;
  if (safePeriod === "am" && safeHour === 12) safeHour = 0;

  return safeHour;
}

function inferAmbiguousSingleTimePeriod(
  text: string,
  anchor: string,
  hour: number
): "am" | "pm" | null {
  if (hour < 1 || hour > 11) return null;

  const normalizedText = normalizeForMatching(text);
  const normalizedAnchor = normalizeForMatching(anchor);

  const idx = normalizedText.indexOf(normalizedAnchor);
  const contextStart = idx >= 0 ? Math.max(0, idx - 64) : 0;
  const contextEnd =
    idx >= 0
      ? Math.min(normalizedText.length, idx + normalizedAnchor.length + 64)
      : Math.min(normalizedText.length, 128);
  const context = normalizedText.slice(contextStart, contextEnd);

  if (
    /\b(desayuno|brunch|manana|por la manana|de la manana|temprano|amanecer)\b/.test(
      context
    )
  ) {
    return "am";
  }

  if (/\b(am|a m)\b/.test(context)) return "am";
  if (/\b(pm|p m)\b/.test(context)) return "pm";

  if (
    /\b(cena|cenar|cine|pelicula|peliculas|teatro|concierto|bar|tragos|drinks|fiesta|discoteca|previa|after|parrilla|asado)\b/.test(
      context
    )
  ) {
    return "pm";
  }

  if (/\b(almuerzo|lunch|comer)\b/.test(context)) return "pm";

  return null;
}


function inferPeriodFromContext(
  text: string,
  anchor: string
): "am" | "pm" | null {
  const normalizedText = normalizeForMatching(text);
  const normalizedAnchor = normalizeForMatching(anchor);

  const idx = normalizedText.indexOf(normalizedAnchor);
  const contextStart = idx >= 0 ? Math.max(0, idx - 42) : 0;
  const contextEnd =
    idx >= 0
      ? Math.min(normalizedText.length, idx + normalizedAnchor.length + 42)
      : Math.min(normalizedText.length, 84);
  const context = normalizedText.slice(contextStart, contextEnd);

  if (/\b(desayuno|brunch|manana|por la manana|temprano)\b/.test(context)) {
    return "am";
  }
  if (/\b(almuerzo|lunch|comer)\b/.test(context)) return "pm";
  if (/\b(de la|por la)\s+(noche|tarde)\b/.test(context)) return "pm";
  if (
    /\b(cena|cenar|cine|pelicula|peliculas|teatro|concierto|bar|tragos|drinks|fiesta|discoteca|previa|parrilla|fulbito|futbol|asado|after)\b/.test(
      context
    )
  ) {
    return "pm";
  }
  if (/\b(de la|por la)\s+manana\b/.test(context)) return "am";
  return null;
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

  const rangeMatch = String(text ?? "").match(
    /\bde\s+(\d{1,2})(?::(\d{2}))?\s?(a\.?m\.?|p\.?m\.?)?\s+a\s+(\d{1,2})(?::(\d{2}))?\s?(a\.?m\.?|p\.?m\.?)?\b/i
  );

  if (rangeMatch) {
    const inferredRangePeriod = inferPeriodFromContext(text, rangeMatch[0] ?? "");
    const startPeriod = rangeMatch[3] || inferredRangePeriod;
    const endPeriod = rangeMatch[6] || rangeMatch[3] || inferredRangePeriod;
    const startHour = normalizeHourFromCapture(
      parseInt(rangeMatch[1], 10),
      startPeriod
    );
    const startMinutes = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const endHour = normalizeHourFromCapture(
      parseInt(rangeMatch[4], 10),
      endPeriod
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

  const singleMatch = String(text ?? "").match(
    /(?:a\s+las\s+|a\s+la\s+|al\s+|alas\s+)?(\d{1,2})(?:[:h](\d{2}))?\s?(a\.?m\.?|p\.?m\.?)?\b/i
  );

  if (!singleMatch) {
    return { startHour: null, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  const rawSinglePeriod = singleMatch[3] || null;
  const numericSingleHour = parseInt(singleMatch[1], 10);
  const inferredSinglePeriod =
    rawSinglePeriod ||
    inferPeriodFromContext(text, singleMatch[0] ?? "") ||
    inferAmbiguousSingleTimePeriod(
      text,
      singleMatch[0] ?? "",
      numericSingleHour
    );
  const startHour = normalizeHourFromCapture(
    numericSingleHour,
    inferredSinglePeriod
  );
  const startMinutes = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;

  if (startHour > 23 || startMinutes > 59) {
    return { startHour: null, startMinutes: 0, endHour: null, endMinutes: 0 };
  }

  return { startHour, startMinutes, endHour: null, endMinutes: 0 };
}

function extractExplicitSingleClock(text: string): {
  startHour: number | null;
  startMinutes: number;
  endHour: number | null;
  endMinutes: number;
} | null {
  const match = String(text ?? "").match(
    /\b(?:a\s+las|a\s+la|alas)\s+(\d{1,2})(?::(\d{2}))?\s?(a\.?m\.?|p\.?m\.?|am|pm)?\b/i,
  );

  if (!match) return null;

  const rawHour = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const hour = normalizeHourFromCapture(rawHour, match[3] ?? null);

  if (hour > 23 || minutes > 59) return null;
  return { startHour: hour, startMinutes: minutes, endHour: null, endMinutes: 0 };
}

function extractDuration(text: string): number {
  const range = extractTimeRange(text);
  if (range.startHour !== null && range.endHour !== null) {
    const start = range.startHour * 60 + range.startMinutes;
    const end = range.endHour * 60 + range.endMinutes;
    if (end > start) return Math.max(30, end - start);
  }

  const minMatch = String(text ?? "").match(/(\d+)\s?(min|mins|m)\b/i);
  if (minMatch) return Math.max(1, parseInt(minMatch[1], 10));

  const hourMatch = String(text ?? "").match(/(\d+)\s?(h|hora|horas)\b/i);
  if (hourMatch) return Math.max(30, parseInt(hourMatch[1], 10) * 60);

  const normalized = normalizeForMatching(text);
  if (/\bdesayuno\b/.test(normalized)) return 60;
  if (/\bcafe|cafecito\b/.test(normalized)) return 60;
  if (/\balmuerzo|lunch\b/.test(normalized)) return 90;
  if (/\bcena|dinner|parrilla|asado\b/.test(normalized)) return 120;
  if (/\bpadel|pádel|fulbito|futbol|fútbol|tenis|gym\b/.test(normalized)) {
    return 90;
  }
  if (/\breunion|meeting|llamada|zoom\b/.test(normalized)) return 60;
  if (/\bdoctor|medico|médico|dentista\b/.test(normalized)) return 60;
  if (/\bcumple|cumpleanos|cumpleaños|aniversario\b/.test(normalized)) {
    return 120;
  }
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
    if (hasTwoWeeksIntent) result = addDays(result, 14);
    else if (
      hasNextDayIntent &&
      !hasNextWeekIntent &&
      !hasOtherDayIntent
    ) {
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
  if (normalized.includes("en dos semanas")) return addDays(today, 14);
  return null;
}

function removeDateAndTimeTokens(text: string): string {
  return String(text ?? "")
    .replace(EXPLICIT_DATE_RANGE_REGEX, " ")
    .replace(EXPLICIT_SINGLE_DATE_REGEX, " ")
    .replace(
      /\b(el|la|los|las)\s+(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
    .replace(
      /\b(el|la|los|las)\s+(proximo|próximo|proxima|próxima|siguiente|otro|otra|este|esta)\s+(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|fin de semana|finde|semana)\b/gi,
      " "
    )
    .replace(
      /\b(hoy|mañana|manana|pasado mañana|pasado manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
    .replace(
      /\b(fin de semana|finde|este finde|este fin de semana|el otro finde|el otro fin de semana|proximo fin de semana|próximo fin de semana)\b/gi,
      " "
    )
    .replace(/\b(proximo|próximo|proxima|próxima|siguiente|otro|otra|este|esta)\b/gi, " ")
    .replace(/\b(semana|que|viene)\b/gi, " ")
    .replace(/\b(dentro de)\b/gi, " ")
    .replace(
      /\bde\s+\d{1,2}(?::\d{2})?\s?(a\.?m\.?|p\.?m\.?|am|pm)?\s+a\s+\d{1,2}(?::\d{2})?\s?(a\.?m\.?|p\.?m\.?|am|pm)?\b/gi,
      " "
    )
    .replace(/\b(a\s+las|a\s+la|al|alas)\b/gi, " ")
    .replace(/\b(mediodia|medianoche)\b/gi, " ")
    .replace(
      /\b(\d{1,2})(?::\d{2})?\s?(a\.?m\.?|p\.?m\.?|am|pm)?\b(?!\s?(min|mins|m|h|hora|horas)\b)/gi,
      " "
    )
    .replace(/\b(\d+)\s?(min|mins|m|h|hora|horas)\b/gi, " ")
    .replace(/\b(en dos semanas)\b/gi, " ")
    .replace(/\b(el|la|los|las)\b(?=\s+(en casa de|en|donde|por|cerca de|junto a)\b)/gi, " ")
    .replace(/\b(el|la|los|las)\b(?=\s*$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function connectorToRegex(connector: string) {
  const parts = collapseSpaces(connector).split(" ").filter(Boolean);
  const body = parts.map(escapeRegExp).join("\\s+");
  return new RegExp(`(^|\\s)${body}(?=\\s|$)`, "i");
}

function findConnectorIndex(cleaned: string, connector: string) {
  const match = connectorToRegex(connector).exec(cleaned);
  if (!match) return -1;
  return match.index + String(match[1] ?? "").length;
}

function splitTitleAndNotes(original: string): { title: string; notes: string } {
  const cleaned = collapseSpaces(removeDateAndTimeTokens(original));

  for (const connector of TITLE_NOTES_CONNECTORS) {
    const rawIndex = findConnectorIndex(cleaned, connector);
    if (rawIndex < 0) continue;

    const title = collapseSpaces(cleaned.slice(0, rawIndex));
    const notes = collapseSpaces(cleaned.slice(rawIndex));
    return { title: title || cleaned || original.trim(), notes };
  }

  return {
    title: cleaned || original.trim().slice(0, 40),
    notes: "",
  };
}

function cleanNotesFromLocationIntent(
  notes: string,
  locationQuery: string | null,
  source: "connector" | "at_symbol" | "house_of" | null
) {
  if (!notes) return "";
  if (!locationQuery || !source) return collapseSpaces(notes);

  const escaped = locationQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let next = String(notes);

  if (source === "at_symbol") {
    next = next.replace(new RegExp(`@\\s*${escaped}`, "i"), "");
  } else if (source === "house_of") {
    const houseName = locationQuery.replace(/^Casa\s+de\s+/i, "").trim();
    const escapedHouseName = houseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(
      new RegExp(`\\ben\\s+casa\\s+de\\s+(${escaped}|${escapedHouseName})\\b`, "i"),
      ""
    );
  } else {
    next = next.replace(
      new RegExp(`\\b(donde|en|cerca de|junto a|por)\\s+${escaped}\\b`, "i"),
      ""
    );
  }

  return collapseSpaces(next.replace(/^[,.;:\-\s]+|[,.;:\-\s]+$/g, ""));
}

function cleanNotesFromParticipantIntent(notes: string, participants: string[]) {
  const value = collapseSpaces(notes);
  if (!value) return "";
  if (!participants.length) return value;

  const normalized = normalizeForMatching(value);
  if (!normalized) return "";

  if (/^(con|junto a)\b/.test(normalized)) {
    const withoutConnector = normalized
      .replace(/^(con|junto a)\s+/, "")
      .replace(/\s+(y|e)\s+/g, " ")
      .replace(/,/g, " ");

    const participantKeys = new Set(
      participants.map((participant) => normalizeForMatching(participant))
    );
    const tokens = withoutConnector.split(" ").filter(Boolean);

    const looksLikeOnlyParticipants = tokens.every((token) => {
      if (token === "mas" || token === "más") return true;
      for (const key of participantKeys) {
        if (key.split(" ").includes(token)) return true;
      }
      return false;
    });

    if (looksLikeOnlyParticipants) return "";
  }

  return value;
}

function cleanFallbackTitle(raw: string): string {
  const cleaned = collapseSpaces(
    removeDateAndTimeTokens(removeParticipantPhrases(raw))
  );
  if (!cleaned) return collapseSpaces(raw).slice(0, 40);
  return cleaned.slice(0, 60);
}

function shouldAppendParticipantToTitle(
  baseTitle: string,
  participant: string
) {
  const normalizedBase = normalizeForMatching(baseTitle);
  const normalizedParticipant = normalizeForMatching(participant);

  if (!normalizedParticipant) return false;
  if (normalizedParticipant === "grupo") return false;
  if (GENERIC_GROUP_PHRASES.includes(normalizedParticipant)) return false;
  if (new RegExp(`\\b${normalizedParticipant}\\b`).test(normalizedBase)) {
    return false;
  }
  if (/\b(con|junto a|en casa de)\b/.test(normalizedBase)) return false;
  if (
    normalizedParticipant === "amigos" &&
    /padel|pádel|fulbito|futbol|fútbol|tenis|reunion|reunión|asado|after|previa/.test(
      normalizedBase
    )
  ) {
    return false;
  }
  if (
    normalizedParticipant === "familia" &&
    /almuerzo|cena|viaje|cumple|cumpleanos|cumpleaños/.test(normalizedBase)
  ) {
    return false;
  }
  return true;
}

function buildSemanticTitle(baseTitle: string, participants: string[]): string {
  const safeBase = formatTitle(baseTitle);
  if (!safeBase) return "";

  const attachableParticipants = participants.filter((participant) =>
    shouldAppendParticipantToTitle(safeBase, participant)
  );

  if (attachableParticipants.length === 0) return safeBase;
  if (attachableParticipants.length === 1) {
    return `${safeBase} con ${attachableParticipants[0]}`;
  }
  if (attachableParticipants.length === 2) {
    return `${safeBase} con ${attachableParticipants[0]} y ${attachableParticipants[1]}`;
  }
  return `${safeBase} con ${attachableParticipants[0]} y ${
    attachableParticipants.length - 1
  } más`;
}

export function parseQuickCapture(input: string): ParsedQuickCapture {
  const raw = String(input || "").trim();
  const normalized = normalizeText(raw);

  const participants = extractParticipants(raw);
  const signals = detectSignals(raw, participants);
  const locationIntent = detectLocationIntent(raw);
  const explicitRange = extractExplicitDateRange(raw);
  const explicitSingleDate = explicitRange ? null : extractExplicitSingleDate(raw);
  const date = explicitRange?.start ?? explicitSingleDate ?? extractDay(raw);
  const rawTimeRange = extractTimeRange(raw);
  const explicitClockTime = extractExplicitSingleClock(raw);
  const timeRange = explicitRange
    ? explicitClockTime ?? { startHour: null, startMinutes: 0, endHour: null, endMinutes: 0 }
    : rawTimeRange;
  const inferredDuration = extractDuration(normalized);

  let finalDate: Date | null = null;
  let finalEndDate: Date | null = null;
  let duration = inferredDuration;

  if (date) {
    finalDate = new Date(date);
    if (timeRange.startHour !== null) {
      finalDate.setHours(timeRange.startHour, timeRange.startMinutes, 0, 0);
    } else if (explicitRange) {
      finalDate.setHours(10, 0, 0, 0);
    } else {
      finalDate.setHours(12, 0, 0, 0);
    }
  }

  if (explicitRange && finalDate) {
    finalEndDate = new Date(explicitRange.end);
    if (timeRange.endHour !== null) {
      finalEndDate.setHours(timeRange.endHour, timeRange.endMinutes, 0, 0);
    } else {
      finalEndDate.setHours(11, 0, 0, 0);
    }

    if (finalEndDate.getTime() <= finalDate.getTime()) {
      finalEndDate = new Date(finalDate.getTime() + Math.max(60, inferredDuration) * 60 * 1000);
    }

    duration = Math.max(60, Math.round((finalEndDate.getTime() - finalDate.getTime()) / 60000));
  }

  const split = splitTitleAndNotes(raw);
  const titleBase =
    explicitRange && split.title && /^en\s+/i.test(split.notes)
      ? `${split.title} ${split.notes}`
      : split.title || cleanFallbackTitle(raw);
  const title = buildSemanticTitle(titleBase, participants);
  const notesWithoutLocation = cleanNotesFromLocationIntent(
    split.notes,
    locationIntent.locationQuery,
    locationIntent.locationSource
  );
  const cleanedNotes = cleanNotesFromParticipantIntent(
    notesWithoutLocation,
    participants
  );

  return {
    title: title || formatTitle(cleanFallbackTitle(raw)),
    notes: formatNotes(cleanedNotes),
    date: finalDate,
    endDate: finalEndDate,
    durationMinutes: duration,
    participants,
    startHour: timeRange.startHour,
    startMinutes: timeRange.startMinutes,
    locationQuery: locationIntent.locationQuery,
    locationConfidence: locationIntent.locationConfidence,
    locationSource: locationIntent.locationSource,
    signals: {
      ...signals,
      hasExplicitDate: signals.hasExplicitDate || !!date || !!explicitRange,
      hasExplicitTime:
        signals.hasExplicitTime || timeRange.startHour !== null,
      confidence:
        date && timeRange.startHour !== null
          ? "high"
          : date || timeRange.startHour !== null || participants.length > 0
          ? "medium"
          : signals.confidence,
    },
  };
}