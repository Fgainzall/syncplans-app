// LEGACY / DEMO LOCAL GROUPS STORE
// ------------------------------------------------------
// Este archivo mantiene un estado de grupos SOLO en localStorage.
// No es la fuente de verdad real de grupos en Supabase.
// Para datos reales usa src/lib/groupsDb.ts + src/lib/activeGroup.ts.
// Se mantiene por compatibilidad con pantallas antiguas (ej. /members, PremiumHeader).

// src/lib/groups.ts
// SyncPlans — Groups store (LOCAL demo storage)
// Objetivo: COMPAT TOTAL con pantallas actuales (0 TS errors por exports/props)

export type UsageMode = "solo" | "pair" | "family";
export type CalendarScope = "personal" | "active" | "all";

export type Person = { name: string; email: string };

export type GroupState = {
  mode: UsageMode;
  groupId: string;
  groupName?: string;

  me?: Person;
  partnerEmail?: string;
  partnerName?: string;

  inviteCode?: string;
  joinCode?: string;

  ok?: boolean;
  reason?: string;

  updatedAt?: string;

  // alias compat
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

export type StoredGroup = {
  id: string;
  mode: UsageMode;
  name: string;
  me?: Person;
  partnerEmail?: string;
  partnerName?: string;
  inviteCode?: string;
  joinCode?: string;
  createdAt: string;
};

const KEY_STATE = "syncplans.groupState.v3";
const KEY_GROUPS = "syncplans.groups.v3";

function nowIso() {
  return new Date().toISOString();
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function idFromMode(mode: UsageMode): string {
  if (mode === "solo") return "personal";
  if (mode === "pair") return "pair";
  return "family";
}

function nameFromMode(mode: UsageMode): string {
  if (mode === "solo") return "Personal";
  if (mode === "pair") return "Pareja";
  return "Familia";
}

function defaultState(): GroupState {
  return {
    mode: "solo",
    groupId: "personal",
    groupName: "Personal",
    ok: true,
    updatedAt: nowIso(),
  };
}

function normalizeAliases(s: GroupState): GroupState {
  if (!s.inviteCode && s.joinCode) s.inviteCode = s.joinCode;
  if (!s.joinCode && s.inviteCode) s.joinCode = s.inviteCode;
  return s;
}

/** ✅ Estado actual (persistido) */
export function getGroupState(): GroupState {
  if (typeof window === "undefined") return defaultState();

  const parsed = safeParse<Partial<GroupState>>(localStorage.getItem(KEY_STATE));
  const base = defaultState();

  const merged: GroupState = {
    ...base,
    ...(parsed ?? {}),
    mode: (parsed?.mode ?? base.mode) as UsageMode,
    groupId: String(parsed?.groupId ?? base.groupId),
    groupName: String(parsed?.groupName ?? base.groupName),
  };

  return normalizeAliases(merged);
}

/** set total (se usa internamente, merge limitado) */
export function setGroupState(patch: Partial<GroupState>): GroupState {
  if (typeof window === "undefined") {
    const cur = defaultState();
    return normalizeAliases({ ...cur, ...patch, updatedAt: nowIso() });
  }

  const cur = getGroupState();
  const next: GroupState = normalizeAliases({
    ...cur,
    ...patch,
    updatedAt: nowIso(),
  });

  if (!next.mode) next.mode = "solo";
  if (!next.groupId) next.groupId = idFromMode(next.mode);
  if (!next.groupName) next.groupName = nameFromMode(next.mode);

  localStorage.setItem(KEY_STATE, JSON.stringify(next));
  return next;
}

export function setMode(mode: UsageMode): GroupState {
  return setGroupState({
    mode,
    groupId: idFromMode(mode),
    groupName: nameFromMode(mode),
    ok: true,
    reason: undefined,
  });
}

export function resetGroup(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY_STATE);
}

/* ─────────────────────────────────────────────
   ✅ UI helpers (para selects: /events/new/details)
   ───────────────────────────────────────────── */

export type SyncGroup = {
  type: "personal" | "pair" | "family";
  label: string;
  dotVar: string;
};

export function getGroups(): SyncGroup[] {
  return [
    { type: "personal", label: "Personal", dotVar: "var(--sp-personal)" },
    { type: "pair", label: "Pareja", dotVar: "var(--sp-pair)" },
    { type: "family", label: "Familia", dotVar: "var(--sp-family)" },
  ];
}

/* ─────────────────────────────────────────────
   ✅ Active group helpers
   ───────────────────────────────────────────── */

export function getActiveGroup(): "personal" | "pair" | "family" {
  const gs = getGroupState();
  const mode = gs.mode ?? "solo";
  if (mode === "solo") return "personal";
  if (mode === "pair") return "pair";
  return "family";
}

export function defaultScopeFromActive(
  active: ReturnType<typeof getActiveGroup>
): CalendarScope {
  if (active === "personal") return "personal";
  return "active";
}

export function getCalendarScope(): CalendarScope {
  const active = getActiveGroup();
  return defaultScopeFromActive(active);
}

/* ─────────────────────────────────────────────
   ✅ Local "groups" list (demo)
   ───────────────────────────────────────────── */

function listGroups(): StoredGroup[] {
  if (typeof window === "undefined") return [];
  const parsed = safeParse<StoredGroup[]>(localStorage.getItem(KEY_GROUPS));
  return Array.isArray(parsed) ? parsed : [];
}

export function saveGroup(group: StoredGroup): void {
  if (typeof window === "undefined") return;
  const all = listGroups();
  const next = [group, ...all.filter((g) => g.id !== group.id)];
  localStorage.setItem(KEY_GROUPS, JSON.stringify(next));
}

export function loadGroup(id: string): StoredGroup | null {
  if (typeof window === "undefined") return null;
  const all = listGroups();
  return all.find((g) => g.id === id) ?? null;
}

export function getAllLocalGroups(): StoredGroup[] {
  return listGroups();
}

/* ─────────────────────────────────────────────
   ✅ Creación de grupos (solo / pair / family)
   ───────────────────────────────────────────── */

function genInviteCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export type CreateSoloInput = {
  myName: string;
  myEmail: string;
};

export type CreatePairInput = {
  myName: string;
  myEmail: string;
  partnerEmail: string;
  partnerName?: string;
};

export type CreateFamilyInput = {
  myName: string;
  myEmail: string;
  familyName?: string;
};

export function createSolo(myName: string): GroupState;
export function createSolo(input: CreateSoloInput): GroupState;
export function createSolo(myName: string, myEmail: string): GroupState;
export function createSolo(a: any, b?: any): GroupState {
  const myName = typeof a === "object" ? a.myName : a;
  const myEmail = typeof a === "object" ? a.myEmail : b;

  if (!myName || !myEmail) {
    return setGroupState({
      ok: false,
      reason: "Faltan datos para crear perfil personal (nombre y email).",
    });
  }

  const st: GroupState = {
    mode: "solo",
    groupId: "personal",
    groupName: "Personal",
    me: { name: myName, email: myEmail },
    partnerEmail: undefined,
    partnerName: undefined,
    inviteCode: undefined,
    joinCode: undefined,
    ok: true,
    updatedAt: nowIso(),
  };

  return setGroupState(st);
}

/** createPair: acepta 1 string (no rompe TS) + objeto + posicional */
export function createPair(myName: string): GroupState;
export function createPair(input: CreatePairInput): GroupState;
export function createPair(
  myName: string,
  myEmail: string,
  partnerEmail: string
): GroupState;
export function createPair(a: any, b?: any, c?: any): GroupState {
  const myName = typeof a === "object" ? a.myName : a;
  const myEmail = typeof a === "object" ? a.myEmail : b;
  const partnerEmail = typeof a === "object" ? a.partnerEmail : c;
  const partnerName = typeof a === "object" ? a.partnerName : undefined;

  if (!myName || !myEmail || !partnerEmail) {
    return setGroupState({
      ok: false,
      reason:
        "Faltan datos para crear pareja (nombre, email y email de la pareja).",
    });
  }

  const inviteCode = genInviteCode();
  const rec: StoredGroup = {
    id: `pair_${Date.now().toString(16)}`,
    mode: "pair",
    name: "Pareja",
    me: { name: myName, email: myEmail },
    partnerEmail,
    partnerName,
    inviteCode,
    joinCode: inviteCode,
    createdAt: nowIso(),
  };
  saveGroup(rec);

  return setGroupState({
    mode: "pair",
    groupId: rec.id,
    groupName: rec.name,
    me: rec.me,
    partnerEmail: rec.partnerEmail,
    partnerName: rec.partnerName,
    inviteCode: rec.inviteCode,
    joinCode: rec.joinCode,
    ok: true,
    reason: undefined,
  });
}

/** createFamily: acepta 1 string + objeto + posicional */
export function createFamily(myName: string): GroupState;
export function createFamily(input: CreateFamilyInput): GroupState;
export function createFamily(
  myName: string,
  myEmail: string,
  familyName: string
): GroupState;
export function createFamily(a: any, b?: any, c?: any): GroupState {
  const myName = typeof a === "object" ? a.myName : a;
  const myEmail = typeof a === "object" ? a.myEmail : b;
  const familyName = typeof a === "object" ? a.familyName : c;

  if (!myName || !myEmail) {
    return setGroupState({
      ok: false,
      reason: "Faltan datos para crear familia (nombre y email).",
    });
  }

  const inviteCode = genInviteCode();
  const rec: StoredGroup = {
    id: `family_${Date.now().toString(16)}`,
    mode: "family",
    name: familyName?.trim() ? familyName.trim() : "Familia",
    me: { name: myName, email: myEmail },
    inviteCode,
    joinCode: inviteCode,
    createdAt: nowIso(),
  };
  saveGroup(rec);

  return setGroupState({
    mode: "family",
    groupId: rec.id,
    groupName: rec.name,
    me: rec.me,
    inviteCode: rec.inviteCode,
    joinCode: rec.joinCode,
    ok: true,
    reason: undefined,
  });
}

/* ─────────────────────────────────────────────
   ✅ Join con código (demo)
   ───────────────────────────────────────────── */

export type JoinInput =
  | { myName: string; myEmail: string; code: string }
  | string;

export function joinWithCode(input: JoinInput): GroupState {
  const myName = typeof input === "object" ? input.myName : undefined;
  const myEmail = typeof input === "object" ? input.myEmail : undefined;
  const code = (typeof input === "object" ? input.code : input) as string;

  if (!code) {
    return setGroupState({ ok: false, reason: "Ingresa un código." });
  }

  const groups = listGroups();
  const found = groups.find(
    (g) =>
      (g.inviteCode ?? g.joinCode ?? "").toUpperCase() === code.toUpperCase()
  );

  if (!found) {
    return setGroupState({
      mode: "pair",
      groupId: `pair_join_${Date.now().toString(16)}`,
      groupName: "Pareja",
      ok: false,
      reason: "No se encontró un grupo con ese código.",
    });
  }

  return setGroupState({
    mode: found.mode,
    groupId: found.id,
    groupName: found.name,
    me: myName && myEmail ? { name: myName, email: myEmail } : found.me,
    partnerEmail: found.partnerEmail,
    partnerName: found.partnerName,
    inviteCode: found.inviteCode ?? found.joinCode,
    joinCode: found.joinCode ?? found.inviteCode,
    ok: true,
    reason: undefined,
  });
}
