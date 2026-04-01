// src/lib/quickCaptureParser.tsx

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

  for (const [word, dayIndex] of Object.entries(DAYS_MAP)) {
    const normalizedWord = normalizeForMatching(word);
    if (normalized.includes(normalizedWord)) {
      const result = new Date(today);
      const currentDay = today.getDay();
      let diff = dayIndex - currentDay;

      if (diff <= 0) diff += 7;

      result.setDate(today.getDate() + diff);
      return result;
    }
  }

  if (normalized.includes("hoy")) return today;

  if (normalized.includes("manana")) {
    const t = new Date(today);
    t.setDate(today.getDate() + 1);
    return t;
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
      /\b(hoy|mañana|manana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
    .replace(/\b(\d{1,2}(?::\d{2})?\s?(am|pm)?)\b/gi, " ")
    .replace(/\b(\d+)\s?(min|mins|m|h|hora|horas)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTitleAndNotes(original: string): { title: string; notes: string } {
  const cleaned = removeDateAndTimeTokens(original);
  const normalizedCleaned = normalizeForMatching(cleaned);

  let splitIndex = -1;
  let matchedConnector = "";

  for (const connector of CONTEXT_CONNECTORS) {
    const normalizedConnector = normalizeForMatching(connector).trim();
    const idx = normalizedCleaned.indexOf(` ${normalizedConnector} `);
    if (idx >= 0) {
      splitIndex = idx;
      matchedConnector = cleaned.slice(idx).trim();
      break;
    }
  }

  if (splitIndex >= 0) {
    const title = cleaned.slice(0, splitIndex).replace(/\s+/g, " ").trim();
    const notes = matchedConnector.replace(/\s+/g, " ").trim();
    return {
      title: title || cleaned || original.trim(),
      notes,
    };
  }

  return {
    title: cleaned || original.trim().slice(0, 40),
    notes: "",
  };
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
    title: split.title || raw.slice(0, 40),
    notes: split.notes,
    date: finalDate,
    durationMinutes: duration,
  };
}