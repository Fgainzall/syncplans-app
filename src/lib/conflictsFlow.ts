// src/lib/conflictsFlow.ts
import type { DbEvent } from "@/lib/eventsMiniDb";

export type ConflictPair = {
  a: DbEvent;
  b: DbEvent;
  overlapStart: string; // ISO
  overlapEnd: string;   // ISO
};

function toMs(iso: string) {
  return new Date(iso).getTime();
}

function isoFromMs(ms: number) {
  return new Date(ms).toISOString();
}

export function computeConflicts(events: DbEvent[]): ConflictPair[] {
  const list = events
    .filter((e) => e.start && e.end)
    .slice()
    .sort((x, y) => toMs(x.start) - toMs(y.start));

  const out: ConflictPair[] = [];
  const seen = new Set<string>();
  const active: DbEvent[] = [];

  for (const cur of list) {
    const curStart = toMs(cur.start);
    const curEnd = toMs(cur.end);

    for (let i = active.length - 1; i >= 0; i--) {
      if (toMs(active[i].end) <= curStart) active.splice(i, 1);
    }

    for (const prev of active) {
      const pStart = toMs(prev.start);
      const pEnd = toMs(prev.end);

      const oStart = Math.max(pStart, curStart);
      const oEnd = Math.min(pEnd, curEnd);

      if (oStart < oEnd) {
        const id1 = prev.id < cur.id ? prev.id : cur.id;
        const id2 = prev.id < cur.id ? cur.id : prev.id;
        const key = `${id1}_${id2}_${oStart}_${oEnd}`;

        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            a: prev.id < cur.id ? prev : cur,
            b: prev.id < cur.id ? cur : prev,
            overlapStart: isoFromMs(oStart),
            overlapEnd: isoFromMs(oEnd),
          });
        }
      }
    }

    active.push(cur);
  }

  out.sort(
    (x, y) =>
      toMs(y.overlapEnd) -
      toMs(y.overlapStart) -
      (toMs(x.overlapEnd) - toMs(x.overlapStart))
  );

  return out;
}

export function fmtRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const day = s.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short" });
  const st = s.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const et = e.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${st}–${et}`;
}

export function minutesBetween(startIso: string, endIso: string) {
  return Math.max(1, Math.round((toMs(endIso) - toMs(startIso)) / 60000));
}
