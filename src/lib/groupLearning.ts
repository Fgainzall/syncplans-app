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

// Más rápido para "sentirse inteligente", pero sin descontrolarse
const AUTO_APPLY_MIN_COUNT = 2;
const AUTO_APPLY_MIN_SCORE = 95;

const STOPWORDS = new Set([
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
  "un",
  "una",
  "unos",
  "unas",
  "mi",
  "tu",
  "su",
  "que",
  "lo",
  "le",
  "se",
  "conmigo",
  "contigo",
  "junto",
  "juntos",
  "juntas",
  "hacer",
  "ir",
  "ver",
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
  "cita",
]);

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function stripTemporalNoise(input: string): string {
  return String(input ?? "")
    .replace(/\b(?:a\s+las|alas)\b/gi, " ")
    .replace(/\b(?:hoy|mañana|manana|pasado mañana|pasado manana)\b/gi, " ")
    .replace(
      /\b(?:lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\b/gi,
      " "
    )
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

function extractNames(tokens: string[]): string[] {
  return tokens.filter((token) => token.length >= 3 && /^[a-z]+$/.test(token));
}

function buildLearningKey(input: string): string {
  return tokenize(input).join(" ").trim();
}

function getRecencyBoost(lastUsedAt: string): number {
  const lastUsedTime = new Date(lastUsedAt).getTime();
  if (!Number.isFinite(lastUsedTime)) return 0;

  const daysSinceLastUse =
    (Date.now() - lastUsedTime) / (1000 * 60 * 60 * 24);

  if (daysSinceLastUse <= 1) return 25;
  if (daysSinceLastUse <= 3) return 15;
  if (daysSinceLastUse <= 7) return 8;
  return 0;
}

function getCountBoost(count: number): number {
  return Math.min(count * 10, 50);
}

export function canLearnFromInput(input: string): boolean {
  const key = buildLearningKey(input);
  if (!key) return false;
  if (key.length < 4) return false;

  const tokens = key.split(" ").filter(Boolean);

  // Una sola palabra casi siempre genera ruido
  if (tokens.length < 2) return false;

  // Si todo es genérico, no sirve
  const meaningfulTokens = tokens.filter((token) => !GENERIC_BLOCKED_KEYS.has(token));
  if (meaningfulTokens.length === 0) return false;

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
          item?.groupType === "pair" ||
          item?.groupType === "family" ||
          item?.groupType === "other"
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
    const aScore = a.count * 1000 + new Date(a.lastUsedAt).getTime();
    const bScore = b.count * 1000 + new Date(b.lastUsedAt).getTime();
    return bScore - aScore;
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

    // Aprende más rápido si el patrón se repite
    const recencyBoost = getRecencyBoost(current.lastUsedAt) >= 15 ? 1 : 0;
    const increment = 1 + recencyBoost;

    entries[existingIndex] = {
      ...current,
      count: current.count + increment,
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
  const queryNames = extractNames(queryTokens);

  const entries = readEntries().filter(
    (entry) => !allowed.size || allowed.has(entry.groupId)
  );

  let best: LearnedGroupMatch | null = null;

  for (const entry of entries) {
    const entryTokens = tokenize(entry.sampleTitle || entry.key);
    const entryNames = extractNames(entryTokens);

    let score = 0;
    let matchKind: LearnedGroupMatch["matchKind"] | null = null;

    if (entry.key === key) {
      score += 100;
      matchKind = "exact";
    } else if (entry.key.includes(key) || key.includes(entry.key)) {
      score += 72;
      matchKind = "contains";
    } else {
      const overlap = queryTokens.filter((token) => entryTokens.includes(token)).length;
      if (overlap > 0) {
        score += overlap * 20;
        matchKind = "overlap";
      }
    }

    if (!matchKind) continue;

    const nameOverlap = queryNames.filter((name) => entryNames.includes(name)).length;
    if (nameOverlap > 0) {
      score += nameOverlap * 18;
    }

    score += getCountBoost(entry.count);
    score += getRecencyBoost(entry.lastUsedAt);

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
      shouldAutoApply:
        strength === "strong" &&
        score >= AUTO_APPLY_MIN_SCORE &&
        (matchKind === "exact" || matchKind === "contains"),
      normalizedInput: key,
    };

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  if (!best) return null;

  // Evita auto-sugerencias flojas por overlap muy tenue
  if (best.matchKind === "overlap" && best.score < 30) {
    return null;
  }

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