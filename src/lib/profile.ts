// src/lib/profile.ts
export type SyncUser = {
  id: string;
  name: string;
};

const PROFILE_KEY = "syncplans:profile:v1";

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

export function uid(): string {
  const g = globalThis as any;
  if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
  const rnd = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${rnd()}${rnd()}-${rnd()}-${rnd()}-${rnd()}-${rnd()}${rnd()}${rnd()}`;
}

export function getUser(): SyncUser {
  if (!isBrowser()) return { id: "server", name: "Tú" };

  const raw = window.localStorage.getItem(PROFILE_KEY);
  const current = safeParse<SyncUser | null>(raw, null);

  if (current?.id && current?.name) return current;

  const fresh: SyncUser = { id: uid(), name: "Tú" };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function setUserName(name: string) {
  if (!isBrowser()) return;
  const u = getUser();
  const next = { ...u, name: name.trim() || "Tú" };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}
