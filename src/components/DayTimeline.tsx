"use client";

import * as React from "react";
import { getEvents, updateEvent, type CalendarEvent } from "@/lib/events";
import { getActiveGroupId } from "@/lib/groups";

type Props = {
  dateISO: string; // YYYY-MM-DD
  onEventClick?: (ev: CalendarEvent) => void;
  onChanged?: () => void; // para refrescar lista global (modal)
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function startOfDay(dateISO: string) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function minutesSinceDayStart(dateISO: string, iso: string) {
  const base = startOfDay(dateISO).getTime();
  const t = new Date(iso).getTime();
  return Math.round((t - base) / 60000);
}

function isoFromMinutes(dateISO: string, minutes: number) {
  const base = startOfDay(dateISO);
  base.setMinutes(base.getMinutes() + minutes);
  return base.toISOString();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function snapTo(n: number, step: number) {
  return Math.round(n / step) * step;
}

// Conflictos local (no depende de otro archivo)
function detectConflictedIds(events: CalendarEvent[]) {
 const sorted = [...events].sort(
  (a: CalendarEvent, b: CalendarEvent) => new Date(a.start).getTime() - new Date(b.start).getTime()
);

  const conflicted = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aS = new Date(a.start).getTime();
    const aE = new Date(a.end).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bS = new Date(b.start).getTime();
      const bE = new Date(b.end).getTime();

      if (bS >= aE) break;

      const overlaps = aS < bE && bS < aE;
      if (overlaps) {
        conflicted.add(a.id);
        conflicted.add(b.id);
      }
    }
  }

  return conflicted;
}

export default function DayTimeline({ dateISO, onEventClick, onChanged }: Props) {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Drag/resize overrides
  const [overrideTop, setOverrideTop] = React.useState<Record<string, number>>({});
  const [overrideHeight, setOverrideHeight] = React.useState<Record<string, number>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const moveRef = React.useRef<{
    id: string;
    startMin: number;
    durationMin: number;
    pointerStartY: number;
    topAtStart: number;
  } | null>(null);

  const resizeRef = React.useRef<{
    id: string;
    startMin: number;
    endMin: number;
    pointerStartY: number;
    heightAtStart: number;
  } | null>(null);

  // Visual tuning
  const pxPerMin = 1.2;
  const snapMin = 15;
  const minDurationMin = 15;

  // Window
  const dayStartMin = 6 * 60;
  const dayEndMin = 23 * 60;
  const dayWindowMin = dayEndMin - dayStartMin;

  const activeGroupId = React.useMemo(() => getActiveGroupId(), []);
  const conflictedIds = React.useMemo(() => detectConflictedIds(events), [events]);

  async function load() {
    setLoading(true);
    const all = await getEvents();

    const base = startOfDay(dateISO);
    const end = new Date(base);
    end.setDate(end.getDate() + 1);

    const dayEvents = all.filter((e: CalendarEvent) => {
      const s = new Date(e.start).getTime();
      const inDay = s >= base.getTime() && s < end.getTime();
      if (!inDay) return false;

      const evGroupId = (e as any).groupId ?? null;
      if (!activeGroupId) return true;
      return evGroupId === activeGroupId || !evGroupId; // personal siempre visible
    });

    dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    setEvents(dayEvents);
    setOverrideTop({});
    setOverrideHeight({});
    setLoading(false);

    onChanged?.();
  }

  React.useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  function getBaseTop(ev: CalendarEvent) {
    const m = minutesSinceDayStart(dateISO, ev.start);
    const rel = clamp(m - dayStartMin, 0, dayWindowMin);
    return rel * pxPerMin;
  }

  function getBaseHeight(ev: CalendarEvent) {
    const s = minutesSinceDayStart(dateISO, ev.start);
    const e = minutesSinceDayStart(dateISO, ev.end);
    const dur = clamp(e - s, minDurationMin, 24 * 60);
    return Math.max(28, dur * pxPerMin);
  }

  function getTop(ev: CalendarEvent) {
    const ov = overrideTop[ev.id];
    return typeof ov === "number" ? ov : getBaseTop(ev);
  }

  function getHeight(ev: CalendarEvent) {
    const ov = overrideHeight[ev.id];
    return typeof ov === "number" ? ov : getBaseHeight(ev);
  }

  function hourMarks() {
    const marks: { label: string; top: number }[] = [];
    for (let h = 6; h <= 23; h++) {
      const mins = h * 60;
      const rel = mins - dayStartMin;
      marks.push({ label: `${pad(h)}:00`, top: rel * pxPerMin });
    }
    return marks;
  }

  // MOVE
  function onMovePointerDown(e: React.PointerEvent, item: CalendarEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startMin = minutesSinceDayStart(dateISO, item.start);
    const endMin = minutesSinceDayStart(dateISO, item.end);
    const durationMin = clamp(endMin - startMin, minDurationMin, 24 * 60);

    moveRef.current = {
      id: item.id,
      startMin,
      durationMin,
      pointerStartY: e.clientY,
      topAtStart: getTop(item),
    };
  }

  // RESIZE (bottom handle)
  function onResizePointerDown(e: React.PointerEvent, item: CalendarEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startMin = minutesSinceDayStart(dateISO, item.start);
    const endMin = minutesSinceDayStart(dateISO, item.end);

    resizeRef.current = {
      id: item.id,
      startMin,
      endMin,
      pointerStartY: e.clientY,
      heightAtStart: getHeight(item),
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    // resize first
    if (resizeRef.current) {
      const d = resizeRef.current;
      const dy = e.clientY - d.pointerStartY;
      const nextH = Math.max(28, d.heightAtStart + dy);
      setOverrideHeight((prev) => ({ ...prev, [d.id]: nextH }));
      return;
    }

    if (moveRef.current) {
      const d = moveRef.current;
      const dy = e.clientY - d.pointerStartY;
      const nextTop = d.topAtStart + dy;
      setOverrideTop((prev) => ({ ...prev, [d.id]: nextTop }));
    }
  }

  async function onPointerUp() {
    // RESIZE commit
    if (resizeRef.current) {
      const d = resizeRef.current;
      resizeRef.current = null;

      const h = overrideHeight[d.id] ?? d.heightAtStart;
      const durMin = snapTo(h / pxPerMin, snapMin);
      const safeDur = clamp(durMin, minDurationMin, dayEndMin - d.startMin);

      const startMin = clamp(d.startMin, dayStartMin, dayEndMin - minDurationMin);
      const endMin = clamp(startMin + safeDur, startMin + minDurationMin, dayEndMin);

      const nextStartISO = isoFromMinutes(dateISO, startMin);
      const nextEndISO = isoFromMinutes(dateISO, endMin);

      setSavingId(d.id);
      try {
        await updateEvent(d.id, { start: nextStartISO, end: nextEndISO });
        await load();
      } finally {
        setSavingId(null);
      }
      return;
    }

    // MOVE commit
    if (moveRef.current) {
      const d = moveRef.current;
      moveRef.current = null;

      const top = overrideTop[d.id] ?? d.topAtStart;
      const relMin = snapTo(top / pxPerMin, snapMin);

      const startMin = clamp(dayStartMin + relMin, dayStartMin, dayEndMin - minDurationMin);
      const endMin = clamp(startMin + d.durationMin, startMin + minDurationMin, dayEndMin);

      const nextStartISO = isoFromMinutes(dateISO, startMin);
      const nextEndISO = isoFromMinutes(dateISO, endMin);

      setSavingId(d.id);
      try {
        await updateEvent(d.id, { start: nextStartISO, end: nextEndISO });
        await load();
      } finally {
        setSavingId(null);
      }
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
        Cargando tu día…
      </div>
    );
  }

  const marks = hourMarks();
  const timelineHeight = dayWindowMin * pxPerMin;

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Timeline del día</div>
          <div className="mt-1 text-xs text-white/55">
            Arrastra para mover · Arrastra el borde inferior para cambiar duración · Snap {snapMin}min
          </div>
        </div>

        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          {conflictedIds.size > 0 ? `${conflictedIds.size} en conflicto` : "Sin conflictos"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-[72px_1fr] gap-3">
        {/* Hours column */}
        <div className="relative" style={{ height: timelineHeight }}>
          {marks.map((m) => (
            <div
              key={m.label}
              className="absolute left-0 right-0 text-[11px] text-white/45"
              style={{ top: m.top - 6 }}
            >
              {m.label}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div
          className="relative rounded-3xl border border-white/10 bg-black/20"
          style={{ height: timelineHeight }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* grid lines */}
          {marks.map((m) => (
            <div
              key={m.label}
              className="absolute left-0 right-0 border-t border-white/10"
              style={{ top: m.top }}
            />
          ))}

          {/* Events */}
          {events.map((ev) => {
            const top = getTop(ev);
            const h = getHeight(ev);
            const isSaving = savingId === ev.id;
            const isConflict = conflictedIds.has(ev.id);

            return (
              <div
                key={ev.id}
                className="absolute left-3 right-3"
                style={{ top, height: h }}
              >
                <button
                  onClick={() => onEventClick?.(ev)}
                  onPointerDown={(e) => onMovePointerDown(e, ev)}
                  className={[
                    "relative h-full w-full rounded-2xl border px-4 py-3 text-left",
                    "shadow-lg shadow-black/30 transition hover:bg-white/15 active:scale-[0.995]",
                    isConflict
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-white/10 bg-white/10",
                    isSaving ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{ev.title}</div>
                      <div className="mt-1 text-xs text-white/60 truncate">
                        {ev.description || " "}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {isConflict && (
                        <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-1 text-[10px] font-semibold text-red-100">
                          Conflicto
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/70">
                        {isSaving ? "Guardando…" : "Drag"}
                      </span>
                    </div>
                  </div>

                  {/* Resize handle */}
                  <div
                    onPointerDown={(e) => onResizePointerDown(e, ev)}
                    className={[
                      "absolute bottom-2 right-2 h-7 w-7 rounded-xl border border-white/10",
                      "bg-black/30 grid place-items-center",
                      "cursor-ns-resize hover:bg-white/10 transition",
                    ].join(" ")}
                    title="Arrastra para cambiar duración"
                  >
                    <div className="h-3 w-3 rounded-sm border border-white/30 opacity-70" />
                  </div>
                </button>
              </div>
            );
          })}

          {events.length === 0 && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/60">
              No hay eventos hoy.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
