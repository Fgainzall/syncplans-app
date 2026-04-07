export type LearnedGroupType = "pair" | "family" | "other";
export type LearnedMatchStrength = "weak" | "strong";

export type LearnedGroupEntry = {
  key: string;
  groupId: string;
  groupType: LearnedGroupType;
  count: number;
  lastUsedAt: string;
  sampleTitle: string;
};

export type LearnedGroupMatch = {
  groupId: string;
  groupType: LearnedGroupType;
  count: number;
  score: number;
  sampleTitle: string;
  matchKind: "exact" | "contains" | "overlap";
  strength: LearnedMatchStrength;
  shouldAutoApply: boolean;
  normalizedInput: string;
};

const STORAGE_KEY = "syncplans.group-learning.v1";
const MAX_ENTRIES = 120;
const AUTO_APPLY_MIN_COUNT = 2;

const STOPWORDS = new Set([
  "de","del","la","las","el","los","y","o","a","al","en","con","para","por",
  "un","una","unos","unas","mi","tu","su","que","lo","le","se"
]);

const GENERIC_BLOCKED_KEYS = new Set([
  "evento",
  "plan",
  "planes",
  "reunion",
  "reuniones",
  "llamada",
  "llamadas",
  "actividad",
  "pendiente",
  "cita"
]);

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function stripTemporalNoise(input: string): string {
  return String(input ?? "")
    .replace(/\b(?:a\s+las|alas)\b/gi, " ")
    .replace(/\b(?:hoy|mañana|manana|pasado mañana|pasado manana)\b/gi, " ")
    .replace(/\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi, " ")
    .replace(/\b(?:proximo|próximo|proxima|próxima|siguiente|otro|otra)\b/gi, " ")
    .replace(/\b(?:semana|que|viene)\b/gi, " ")
    .replace(/\b(?:am|pm)\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\b/g, " ")
    .replace(/\b\d+\s?(?:min|mins|m|h|hora|horas)\b/gi, " ");
}

export function normalizeLearningText(input: string): string {
  return stripTemporalNoise(String(input ?? ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(input: string): string[] {
  return normalizeLearningText(input)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function buildLearningKey(input: string): string {
  return tokenize(input).join(" ").trim();
}

export function canLearnFromInput(input: string): boolean {
  const key = buildLearningKey(input);
  if (!key) return false;
  if (GENERIC_BLOCKED_KEYS.has(key)) return false;
  if (key.length < 4) return false;
  return true;
}

function readEntries(): LearnedGroupEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => ({
        key: String(item?.key ?? "").trim(),
        groupId: String(item?.groupId ?? "").trim(),
        groupType:
          item?.groupType === "pair" || item?.groupType === "family"
            ? item.groupType
            : "other",
        count: Math.max(1, Number(item?.count ?? 1) || 1),
        lastUsedAt: String(item?.lastUsedAt ?? ""),
        sampleTitle: String(item?.sampleTitle ?? "").trim(),
      }))
      .filter((item) => item.key && item.groupId);
  } catch {
    return [];
  }
}

function writeEntries(entries: LearnedGroupEntry[]) {
  if (!canUseStorage()) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    // ignore storage errors
  }
}

function sortEntries(entries: LearnedGroupEntry[]) {
  return [...entries].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(b.lastUsedAt).localeCompare(String(a.lastUsedAt));
  });
}

export function learnGroupSelection(input: {
  title: string;
  groupId: string;
  groupType: LearnedGroupType;
}) {
  const title = String(input.title ?? "").trim();
  const key = buildLearningKey(title);

  if (!canLearnFromInput(title) || !key) return;

  const entries = readEntries();
  const now = new Date().toISOString();
  const existingIndex = entries.findIndex(
    (entry) => entry.key === key && entry.groupId === input.groupId
  );

  if (existingIndex >= 0) {
    const current = entries[existingIndex];
    entries[existingIndex] = {
      ...current,
      count: current.count + 1,
      lastUsedAt: now,
      groupType: input.groupType,
      sampleTitle: title,
    };
  } else {
    entries.push({
      key,
      groupId: input.groupId,
      groupType: input.groupType,
      count: 1,
      lastUsedAt: now,
      sampleTitle: title,
    });
  }

  writeEntries(sortEntries(entries));
}

export function getLearnedGroupMatch(input: {
  title: string;
  availableGroupIds?: string[];
}): LearnedGroupMatch | null {
  const title = String(input.title ?? "").trim();
  const key = buildLearningKey(title);
  if (!canLearnFromInput(title) || !key) return null;

  const allowed = new Set(
    (input.availableGroupIds ?? [])
      .map((id) => String(id ?? "").trim())
      .filter(Boolean)
  );

  const queryTokens = tokenize(title);
  const entries = readEntries().filter(
    (entry) => !allowed.size || allowed.has(entry.groupId)
  );

  let best: LearnedGroupMatch | null = null;

  for (const entry of entries) {
    const entryTokens = tokenize(entry.sampleTitle || entry.key);
    let score = 0;
    let matchKind: LearnedGroupMatch["matchKind"] | null = null;

    if (entry.key === key) {
      score += 100;
      matchKind = "exact";
    } else if (entry.key.includes(key) || key.includes(entry.key)) {
      score += 70;
      matchKind = "contains";
    } else {
      const overlap = queryTokens.filter((token) => entryTokens.includes(token)).length;
      if (overlap > 0) {
        score += overlap * 18;
        matchKind = "overlap";
      }
    }

    if (!matchKind) continue;

    score += Math.min(entry.count * 5, 30);

    const strength: LearnedMatchStrength =
      entry.count >= AUTO_APPLY_MIN_COUNT ? "strong" : "weak";

    const candidate: LearnedGroupMatch = {
      groupId: entry.groupId,
      groupType: entry.groupType,
      count: entry.count,
      score,
      sampleTitle: entry.sampleTitle,
      matchKind,
      strength,
      shouldAutoApply: strength === "strong",
      normalizedInput: key,
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  if (!best) return null;
  if (best.matchKind === "overlap" && best.score < 22) return null;

  return best;
}


export function learnedGroupMatch(input: string): LearnedGroupMatch | null {
  return getLearnedGroupMatch({ title: input });
}

export function clearGroupLearning() {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}