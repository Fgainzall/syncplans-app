// src/lib/conflictPrefs.ts
const KEY = "syncplans:conflicts:accepted:v2";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function conflictKey(aId: string, bId: string) {
  const [x, y] = [aId, bId].sort();
  return `${x}::${y}`;
}

export function getAcceptedConflictKeys(): Set<string> {
  if (!isBrowser()) return new Set();
  const raw = window.localStorage.getItem(KEY);
  const arr = safeParse<string[]>(raw, []);
  return new Set(Array.isArray(arr) ? arr : []);
}

export function acceptConflict(aId: string, bId: string) {
  if (!isBrowser()) return;
  const set = getAcceptedConflictKeys();
  set.add(conflictKey(aId, bId));
  window.localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function unacceptConflict(aId: string, bId: string) {
  if (!isBrowser()) return;
  const set = getAcceptedConflictKeys();
  set.delete(conflictKey(aId, bId));
  window.localStorage.setItem(KEY, JSON.stringify([...set]));
}
