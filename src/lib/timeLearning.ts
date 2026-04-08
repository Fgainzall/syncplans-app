export type TimeLearningGroupType = "personal" | "pair" | "family" | "other";

export type TimeLearningEntry = {
  id: string;
  createdAt: string;
  normalizedText: string;
  title: string;
  selectedDateIso: string;
  selectedHour: number;
  selectedWeekday: number;
  durationMinutes: number;
  groupType: TimeLearningGroupType;
  groupId?: string | null;
  wasSuggested?: boolean;
};

export type LearnedTimePattern = {
  confidence: "low" | "medium" | "high";
  preferredHours: number[];
  preferredWeekdays: number[];
  preferredDurationMinutes: number | null;
  prefersWeekend: boolean;
  prefersWeekday: boolean;
  sampleSize: number;
};

const STORAGE_KEY = "sp:time-learning:v1";
const MAX_ENTRIES = 250;

function normalizeText(input: string) {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeId() {
  return `tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getAllEntries(): TimeLearningEntry[] {
  if (!canUseStorage()) return [];
  const data = safeParse<TimeLearningEntry[]>(window.localStorage.getItem(STORAGE_KEY), []);
  return Array.isArray(data) ? data : [];
}

function saveAllEntries(entries: TimeLearningEntry[]) {
  if (!canUseStorage()) return;
  const trimmed = [...entries]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

function hourBucket(hour: number) {
  if (hour <= 9) return 9;
  if (hour <= 11) return 11;
  if (hour <= 14) return 13;
  if (hour <= 17) return 17;
  if (hour <= 20) return 20;
  return 21;
}

function mostFrequentNumbers(values: number[], limit = 3) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return sorted[mid];
}

function similarityScore(a: string, b: string) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;

  const aTokens = new Set(aa.split(" "));
  const bTokens = new Set(bb.split(" "));
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size, 1);
}

export function clearTimeLearning() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function rememberTimeSelection(input: {
  rawText: string;
  title: string;
  selectedDate: Date | string;
  durationMinutes: number;
  groupType: TimeLearningGroupType;
  groupId?: string | null;
  wasSuggested?: boolean;
}) {
  const normalizedText = normalizeText(input.rawText || input.title);
  const date = input.selectedDate instanceof Date ? input.selectedDate : new Date(input.selectedDate);
  if (!normalizedText || Number.isNaN(date.getTime())) return;

  const entry: TimeLearningEntry = {
    id: makeId(),
    createdAt: new Date().toISOString(),
    normalizedText,
    title: String(input.title ?? "").trim(),
    selectedDateIso: date.toISOString(),
    selectedHour: date.getHours(),
    selectedWeekday: date.getDay(),
    durationMinutes: Math.max(15, Math.round(Number(input.durationMinutes) || 60)),
    groupType: input.groupType,
    groupId: input.groupId ?? null,
    wasSuggested: Boolean(input.wasSuggested),
  };

  const entries = getAllEntries();
  entries.unshift(entry);
  saveAllEntries(entries);
}

export function getTimeLearningPattern(input: {
  rawText: string;
  title?: string;
  groupType: TimeLearningGroupType;
  groupId?: string | null;
}): LearnedTimePattern | null {
  const query = normalizeText(input.rawText || input.title || "");
  if (!query) return null;

  const entries = getAllEntries().filter((entry) => entry.groupType === input.groupType);
  const matched = entries.filter((entry) => {
    if (input.groupId && entry.groupId && input.groupId === entry.groupId) {
      return similarityScore(query, entry.normalizedText) >= 0.25;
    }
    return similarityScore(query, entry.normalizedText) >= 0.35;
  });

  if (!matched.length) return null;

  const preferredHours = mostFrequentNumbers(matched.map((entry) => hourBucket(entry.selectedHour)), 3);
  const preferredWeekdays = mostFrequentNumbers(matched.map((entry) => entry.selectedWeekday), 3);
  const preferredDurationMinutes = median(matched.map((entry) => entry.durationMinutes));
  const weekendCount = matched.filter((entry) => entry.selectedWeekday === 0 || entry.selectedWeekday === 6).length;
  const weekdayCount = matched.length - weekendCount;

  return {
    confidence: matched.length >= 5 ? "high" : matched.length >= 3 ? "medium" : "low",
    preferredHours,
    preferredWeekdays,
    preferredDurationMinutes,
    prefersWeekend: weekendCount > weekdayCount,
    prefersWeekday: weekdayCount >= weekendCount,
    sampleSize: matched.length,
  };
}

export function getTimeLearningBoost(input: {
  rawText: string;
  date: Date;
  hour: number;
  groupType: TimeLearningGroupType;
  groupId?: string | null;
}): number {
  const pattern = getTimeLearningPattern({
    rawText: input.rawText,
    groupType: input.groupType,
    groupId: input.groupId ?? null,
  });

  if (!pattern) return 0;

  let score = 0;
  const weekday = input.date.getDay();
  const weekend = weekday === 0 || weekday === 6;
  const bucket = hourBucket(input.hour);

  if (pattern.preferredHours.includes(bucket)) score += pattern.confidence === "high" ? 18 : pattern.confidence === "medium" ? 12 : 6;
  if (pattern.preferredWeekdays.includes(weekday)) score += pattern.confidence === "high" ? 14 : pattern.confidence === "medium" ? 8 : 4;
  if (pattern.prefersWeekend && weekend) score += 8;
  if (pattern.prefersWeekday && !weekend) score += 6;

  return score;
}