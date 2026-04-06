// src/lib/groupLearning.ts

export type LearnedGroupEntry = {
  key: string;
  groupId: string;
  groupType: string;
  count: number;
  lastUsedAt: string;
};

export type LearnedGroupMatch = {
  groupId: string;
  groupType: string;
  count: number;
  lastUsedAt: string;
};

const STORAGE_KEY = "syncplans.group-learning.v1";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeParse(raw: string | null): LearnedGroupEntry[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item) =>
        item &&
        typeof item.key === "string" &&
        typeof item.groupId === "string" &&
        typeof item.groupType === "string" &&
        typeof item.count === "number" &&
        typeof item.lastUsedAt === "string"
    );
  } catch {
    return [];
  }
}

function readAll(): LearnedGroupEntry[] {
  if (!isBrowser()) return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeAll(entries: LearnedGroupEntry[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function normalizeLearningText(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildLearningKey(input: string): string {
  const normalized = normalizeLearningText(input);
  if (!normalized) return "";
  return normalized;
}

export function learnFromEvent(
  input: string,
  groupId: string | null | undefined,
  groupType: string | null | undefined
): void {
  const key = buildLearningKey(input);

  if (!key || !groupId || !groupType || !isBrowser()) return;

  const entries = readAll();
  const now = new Date().toISOString();

  const existingIndex = entries.findIndex(
    (entry) => entry.key === key && entry.groupId === groupId
  );

  if (existingIndex >= 0) {
    const current = entries[existingIndex];

    entries[existingIndex] = {
      ...current,
      groupType,
      count: current.count + 1,
      lastUsedAt: now,
    };
  } else {
    entries.push({
      key,
      groupId,
      groupType,
      count: 1,
      lastUsedAt: now,
    });
  }

  writeAll(entries);
}

export function getLearnedGroup(input: string): LearnedGroupEntry | null {
  const key = buildLearningKey(input);

  if (!key || !isBrowser()) return null;

  const entries = readAll().filter((entry) => entry.key === key);

  if (!entries.length) return null;

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;

    return (
      new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
    );
  });

  return entries[0] ?? null;
}

/**
 * Alias para que NewEventDetailsClient.tsx pueda importar
 * learnedGroupMatch sin cambiar tu archivo actual.
 */
export function learnedGroupMatch(input: string): LearnedGroupMatch | null {
  const learned = getLearnedGroup(input);

  if (!learned) return null;

  return {
    groupId: learned.groupId,
    groupType: learned.groupType,
    count: learned.count,
    lastUsedAt: learned.lastUsedAt,
  };
}

/**
 * Alias para que NewEventDetailsClient.tsx pueda importar
 * learnGroupSelection sin cambiar tu archivo actual.
 */
export function learnGroupSelection(
  input: string,
  groupId: string | null | undefined,
  groupType: string | null | undefined
): void {
  learnFromEvent(input, groupId, groupType);
}

export function clearGroupLearning(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}