// src/lib/conflicts.ts

export type GroupType = "personal" | "pair" | "family" | "couple";
export type SyncPlansGroupType = GroupType;

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO-ish
  end: string; // ISO-ish

  groupType: GroupType;
  groupId?: string | null;

  // UI estándar
  description?: string;

  // compat viejo
  notes?: string;
};

export type ConflictResolution = "keep_existing" | "replace_with_new" | "ignore";

export type ConflictItem = {
  id: string; // ✅ estable (determinístico)
  kind: "overlap";
  existingEventId: string;
  incomingEventId: string;
  overlapStart: string;
  overlapEnd: string;

  // compat
  existing?: CalendarEvent | null;
  incoming?: CalendarEvent | null;

  // alias nuevo
  existingEvent?: CalendarEvent | null;
  incomingEvent?: CalendarEvent | null;

  resolution?: ConflictResolution;
};

export const EVENTS_KEY = "syncplans_events_v1";
export const RESOLUTIONS_KEY = "syncplans_conflict_resolutions_v1";

// 🆕 Conflictos ignorados a nivel local (para "Conservar ambos" del preflight)
export const IGNORED_CONFLICTS_KEY = "syncplans_conflicts_ignored_v1";

export function loadIgnoredConflictKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(IGNORED_CONFLICTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => String(x)));
  } catch {
    return new Set();
  }
}

export function saveIgnoredConflictKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    IGNORED_CONFLICTS_KEY,
    JSON.stringify(Array.from(keys))
  );
}

/** Marcar una lista de conflictos como ignorados (por id) */
export function ignoreConflictIds(ids: string[]) {
  if (!ids || !ids.length) return;
  const set = loadIgnoredConflictKeys();
  for (const id of ids) {
    if (!id) continue;
    set.add(String(id));
  }
  saveIgnoredConflictKeys(set);
}

/** Filtro de conveniencia para quitar conflictos ignorados */
export function filterIgnoredConflicts(
  conflicts: ConflictItem[],
  ignored?: Set<string>
): ConflictItem[] {
  const set = ignored ?? loadIgnoredConflictKeys();
  if (!set.size) return conflicts;
  return conflicts.filter((c) => !set.has(String(c.id)));
}

/* =========================
   Local Storage helpers
   ========================= */

export function loadEvents(): CalendarEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CalendarEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: CalendarEvent[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    EVENTS_KEY,
    JSON.stringify(Array.isArray(events) ? events : [])
  );
}

/* =========================
   UX helpers
   ========================= */

export function conflictResolutionLabel(r?: ConflictResolution) {
  if (!r) return "Pendiente";
  if (r === "keep_existing") return "Conservar A";
  if (r === "replace_with_new") return "Conservar B";
  return "Ignorar";
}

export function conflictResolutionHint(r?: ConflictResolution) {
  if (!r) return "Aún no decidiste qué hacer";
  if (r === "keep_existing") return "Se eliminará el evento B";
  if (r === "replace_with_new") return "Se eliminará el evento A";
  return "Se mantendrán ambos eventos";
}

/* =========================
   Date parsing (FIX REAL)
   ========================= */

function hasTimezone(iso: string) {
  return /([zZ]|[+\-]\d{2}:\d{2}|[+\-]\d{4})$/.test(iso);
}

function parseLocalIsoNoTz(iso: string): Date | null {
  const s = iso.trim().replace(" ", "T");

  const mDay = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (mDay) {
    const y = Number(mDay[1]);
    const mo = Number(mDay[2]) - 1;
    const d = Number(mDay[3]);
    const dt = new Date(y, mo, d, 0, 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const m = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const hh = Number(m[4]);
  const mm = Number(m[5]);
  const ss = m[6] ? Number(m[6]) : 0;
  const ms = m[7] ? Number(String(m[7]).padEnd(3, "0")) : 0;

  const dt = new Date(y, mo, d, hh, mm, ss, ms);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function parseISO(s: string) {
  if (!s || typeof s !== "string") return null;

  const t = s.trim();

  if (hasTimezone(t)) {
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return parseLocalIsoNoTz(t);
}

function toMs(iso: string) {
  const d = parseISO(iso);
  const ms = d?.getTime();
  return Number.isFinite(ms as number) ? (ms as number) : NaN;
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDate(d: Date) {
  return d.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function fmtRange(startISO: string, endISO: string) {
  const s = parseISO(startISO);
  const e = parseISO(endISO);
  if (!s || !e) return "Fecha inválida";

  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();

  if (sameDay) return `${fmtDate(s)} · ${fmtTime(s)} — ${fmtTime(e)}`;
  return `${fmtDate(s)} ${fmtTime(s)} → ${fmtDate(e)} ${fmtTime(e)}`;
}

/* =========================
   Groups
   ========================= */

export function normalizeGroupType(
  gt: GroupType
): "personal" | "pair" | "family" {
  if (gt === "couple") return "pair";
  if (gt === "pair") return "pair";
  if (gt === "family") return "family";
  return "personal";
}

export function groupMeta(groupType: GroupType) {
  const gt = normalizeGroupType(groupType);
  if (gt === "personal") return { label: "Personal", dot: "#FBBF24" };
  if (gt === "pair") return { label: "Pareja", dot: "#F87171" };
  return { label: "Familia", dot: "#60A5FA" };
}

/* =========================
   Overlap + stable id
   ========================= */

export function overlapRange(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
) {
  const start = new Date(aStart.getTime());
  const end = new Date(bEnd.getTime());

  const startMs = Math.max(aStart.getTime(), bStart.getTime());
  const endMs = Math.min(aEnd.getTime(), bEnd.getTime());

  start.setTime(startMs);
  end.setTime(endMs);

  return start.getTime() < end.getTime() ? { start, end } : null;
}

export function chooseExistingIncoming(a: CalendarEvent, b: CalendarEvent) {
  const aS = toMs(a.start) ?? 0;
  const bS = toMs(b.start) ?? 0;

  if (aS < bS) return { existing: a, incoming: b };
  if (bS < aS) return { existing: b, incoming: a };

  return String(a.id) < String(b.id)
    ? { existing: a, incoming: b }
    : { existing: b, incoming: a };
}

/**
 * ✅ NUEVO: ID estable SOLO por pareja de eventos
 */
export function conflictKey(aId: string, bId: string) {
  const [x, y] = [String(aId), String(bId)].sort();
  return `cx::${x}::${y}`;
}

/**
 * ✅ Detector robusto
 */
export function computeVisibleConflicts(events: unknown): ConflictItem[] {
  const list: CalendarEvent[] = Array.isArray(events)
    ? (events.filter(Boolean) as CalendarEvent[])
    : [];

  const normalized = list
    .map((e) => {
      const s = toMs(e.start);
      const en = toMs(e.end);
      if (!Number.isFinite(s) || !Number.isFinite(en)) return null;
      if (en <= s) return null;
      return { e, s, en };
    })
    .filter(Boolean) as Array<{ e: CalendarEvent; s: number; en: number }>;

  normalized.sort((a, b) => a.s - b.s);

  const out: ConflictItem[] = [];
  const seen = new Set<string>();
  const active: Array<{ e: CalendarEvent; s: number; en: number }> = [];

  for (const cur of normalized) {
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].en <= cur.s) active.splice(i, 1);
    }

    for (const prev of active) {
      const oStart = Math.max(prev.s, cur.s);
      const oEnd = Math.min(prev.en, cur.en);
      if (oStart >= oEnd) continue;

      const pick = chooseExistingIncoming(prev.e, cur.e);

      const id = conflictKey(pick.existing.id, pick.incoming.id);

      if (seen.has(id)) continue;
      seen.add(id);

      out.push({
        id,
        kind: "overlap",
        existingEventId: pick.existing.id,
        incomingEventId: pick.incoming.id,
        overlapStart: new Date(oStart).toISOString(),
        overlapEnd: new Date(oEnd).toISOString(),
        existing: pick.existing,
        incoming: pick.incoming,
        existingEvent: pick.existing,
        incomingEvent: pick.incoming,
      });
    }

    active.push(cur);
  }

  out.sort((x, y) => {
    const xl = toMs(x.overlapEnd) - toMs(x.overlapStart);
    const yl = toMs(y.overlapEnd) - toMs(y.overlapStart);
    if (xl !== yl) return yl - xl;
    return String(x.id) < String(y.id) ? -1 : 1;
  });

  return out;
}

export function attachEvents(
  conflicts: ConflictItem[],
  allEvents: unknown
): ConflictItem[] {
  const list: CalendarEvent[] = Array.isArray(allEvents)
    ? (allEvents.filter(Boolean) as CalendarEvent[])
    : [];
  const map = new Map(list.map((e) => [String(e.id), e]));

  return conflicts.map((c) => {
    const existing =
      map.get(String(c.existingEventId)) ??
      c.existing ??
      c.existingEvent ??
      null;
    const incoming =
      map.get(String(c.incomingEventId)) ??
      c.incoming ??
      c.incomingEvent ??
      null;

    return {
      ...c,
      existing,
      incoming,
      existingEvent: existing,
      incomingEvent: incoming,
    };
  });
}