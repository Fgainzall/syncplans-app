// src/lib/quickCaptureParser.ts

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

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHour(text: string): number | null {
  const match = text.match(/(\d{1,2})(?:[:h](\d{2}))?\s?(am|pm)?/i);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;

  const now = new Date();
  now.setHours(hour, minutes, 0, 0);

  return now.getHours();
}

function extractDay(text: string): Date | null {
  const today = new Date();

  for (const [word, dayIndex] of Object.entries(DAYS_MAP)) {
    if (text.includes(word)) {
      const result = new Date(today);
      const currentDay = today.getDay();
      let diff = dayIndex - currentDay;

      if (diff <= 0) diff += 7;

      result.setDate(today.getDate() + diff);
      return result;
    }
  }

  if (text.includes("hoy")) return today;

  if (text.includes("mañana")) {
    const t = new Date(today);
    t.setDate(today.getDate() + 1);
    return t;
  }

  return null;
}

function extractDuration(text: string): number {
  const match = text.match(/(\d+)\s?(min|mins|m)/);
  if (match) return Math.max(15, parseInt(match[1], 10));

  const hourMatch = text.match(/(\d+)\s?(h|hora|horas)/);
  if (hourMatch) return parseInt(hourMatch[1], 10) * 60;

  return 60; // default
}

function cleanTitle(text: string): string {
  // quitamos palabras comunes
  return text
    .replace(/(hoy|mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)/gi, "")
    .replace(/(\d{1,2}(:\d{2})?\s?(am|pm)?)/gi, "")
    .replace(/(en|con)/gi, "")
    .trim();
}

export function parseQuickCapture(input: string): ParsedQuickCapture {
  const normalized = normalizeText(input);

  const date = extractDay(normalized);
  const hour = extractHour(normalized);
  const duration = extractDuration(normalized);

  let finalDate: Date | null = null;

  if (date) {
    finalDate = new Date(date);

    if (hour !== null) {
      finalDate.setHours(hour, 0, 0, 0);
    } else {
      finalDate.setHours(12, 0, 0, 0);
    }
  }

  const title = cleanTitle(normalized) || input.slice(0, 40);

  // TODO lo que no es fecha/hora → notas
  const notes = input;

  return {
    title,
    notes,
    date: finalDate,
    durationMinutes: duration,
  };
}