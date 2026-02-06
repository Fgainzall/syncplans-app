// src/app/components/DayTimeline.tsx
"use client";

import * as React from "react";
import type { CalendarEvent, GroupType } from "@/lib/conflicts";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import {
  getMyEvents,
  updateEventTime,
  type DbEventRow,
} from "@/lib/eventsDb";
import { getUser } from "@/lib/auth"; // 👈 para obtener el email del usuario

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

// Conflictos local (solo para pintar en el timeline)
function detectConflictedIds(events: CalendarEvent[]) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
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

      // Si el siguiente empieza después o exactamente cuando termina A, ya no solapa
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

/**
 * Por ahora:
 *  - sin group_id → "personal"
 *  - con group_id → "pair"
 *
 * (Ya encaja con el resto de la app, Bloque 3 terminará de unificar esto.)
 */
function normalizeGroupType(groupId: string | null): GroupType {
  if (!groupId) return "personal";
  return "pair";
}

// Etiqueta de grupo para el correo
function labelForGroup(ev: CalendarEvent): string {
  const t = String(ev.groupType || "").toLowerCase();
  if (t === "personal") return "Personal";
  if (t === "family") return "Familia";
  if (t === "pair" || t === "couple") return "Pareja";
  return "Grupo";
}

// Texto bonito para el subject/cuerpo del mail (ej: "Lunes, 10 de febrero 2026")
function prettyDateLabelFromISO(dateISO: string): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);

  const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const meses = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];

  return `${dias[dt.getDay()]}, ${dt.getDate()} de ${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

export default function DayTimeline({ dateISO, onEventClick, onChanged }: Props) {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [overrideTop, setOverrideTop] = React.useState<Record<string, number>>({});
  const [overrideHeight, setOverrideHeight] = React.useState<Record<string, number>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const [sendingDigest, setSendingDigest] = React.useState(false);
  const [toast, setToast] = React.useState<{ title: string; subtitle?: string } | null>(null);

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

  const pxPerMin = 1.2;
  const snapMin = 15;
  const minDurationMin = 15;

  const dayStartMin = 6 * 60;
  const dayEndMin = 23 * 60;
  const dayWindowMin = dayEndMin - dayStartMin;

  const conflictedIds = React.useMemo(() => detectConflictedIds(events), [events]);

  // Auto-esconder toast
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);

    const base = startOfDay(dateISO);
    const end = new Date(base);
    end.setDate(end.getDate() + 1);

    try {
      // Grupo activo desde DB + todos los eventos visibles via eventsDb
      const [activeGroupId, raw] = await Promise.all([
        getActiveGroupIdFromDb().catch(() => null),
        getMyEvents().catch(() => [] as DbEventRow[]),
      ]);

      const baseMs = base.getTime();
      const endMs = end.getTime();

      // Filtramos solo eventos que caen en ese día
      const filteredByDay = (raw ?? []).filter((r: DbEventRow) => {
        const startMs = new Date(r.start).getTime();
        if (Number.isNaN(startMs)) return false;
        return startMs >= baseMs && startMs < endMs;
      });

      // Y aplicamos la misma lógica de grupo que antes:
      // - si hay grupo activo → personales (group_id null) + ese grupo
      // - si no hay grupo activo → solo personales
      const filtered = filteredByDay.filter((r) => {
        if (!activeGroupId) {
          return !r.group_id;
        }
        return !r.group_id || String(r.group_id) === String(activeGroupId);
      });

      const mapped: CalendarEvent[] = filtered.map((r) => {
        const gid = r.group_id ? String(r.group_id) : null;
        return {
          id: String(r.id),
          title: r.title ?? "Evento",
          start: String(r.start),
          end: String(r.end),
          notes: r.notes ?? undefined,
          description: r.notes ?? "",
          groupId: gid,
          groupType: normalizeGroupType(gid),
        };
      });

      setEvents(mapped);
      setOverrideTop({});
      setOverrideHeight({});
    } catch (err) {
      console.error("[DayTimeline] load error", err);
      setEvents([]);
      setOverrideTop({});
      setOverrideHeight({});
    } finally {
      setLoading(false);
      onChanged?.();
    }
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

  async function persistEventTime(id: string, startISO: string, endISO: string) {
    // ✅ Ahora usamos el helper central de eventsDb
    await updateEventTime(id, startISO, endISO);
  }

  async function onPointerUp() {
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
        await persistEventTime(d.id, nextStartISO, nextEndISO);
        await load();
      } finally {
        setSavingId(null);
      }
      return;
    }

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
        await persistEventTime(d.id, nextStartISO, nextEndISO);
        await load();
      } finally {
        setSavingId(null);
      }
    }
  }

  // 🔔 V1 – enviar “Recordatorio de hoy” por correo usando /api/daily-digest
  async function handleSendTodayDigest() {
    try {
      setSendingDigest(true);

      const u = getUser();
      const email = (u as any)?.email || (u as any)?.user_metadata?.email;

      if (!email) {
        setToast({
          title: "No encontramos tu correo",
          subtitle: "Revisa tu sesión o tu perfil.",
        });
        return;
      }

      if (!events || events.length === 0) {
        setToast({
          title: "Hoy no tienes eventos 🙌",
          subtitle: "Cuando tengas algo agendado, te mandaré el resumen.",
        });
        return;
      }

      const payloadEvents = events.map((ev) => ({
        title: ev.title || "Evento",
        start: ev.start,
        end: ev.end,
        groupLabel: labelForGroup(ev),
      }));

      const dateLabel = prettyDateLabelFromISO(dateISO);

      const res = await fetch("/api/daily-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          date: dateLabel,
          events: payloadEvents,
        }),
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok || !json.ok) {
        throw new Error(json?.message || "Error enviando el correo");
      }

      setToast({
        title: "Te envié un resumen de hoy a tu correo ✉️",
        subtitle: undefined,
      });
    } catch (err) {
      console.error("[DayTimeline] daily digest error", err);
      setToast({
        title: "No se pudo enviar el resumen",
        subtitle: "Intenta de nuevo en unos segundos.",
      });
    } finally {
      setSendingDigest(false);
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Timeline del día</div>
          <div className="mt-1 text-xs text-white/55">
            Arrastra para mover · Arrastra el borde inferior para cambiar duración · Snap {snapMin}min
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSendTodayDigest}
            disabled={sendingDigest || events.length === 0}
            className={[
              "rounded-2xl border px-3 py-1.5 text-xs font-semibold transition",
              events.length === 0
                ? "border-white/10 bg-white/5 text-white/40 cursor-default"
                : "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25",
            ].join(" ")}
            title={
              events.length === 0
                ? "Hoy no tienes eventos"
                : "Enviarte un resumen de los eventos de hoy a tu correo"
            }
          >
            {sendingDigest ? "Enviando…" : "Recordatorio de hoy"}
          </button>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            {conflictedIds.size > 0 ? `${conflictedIds.size} en conflicto` : "Sin conflictos"}
          </span>
        </div>
      </div>

      {/* Toast local del timeline */}
      {toast && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs">
          <div className="font-semibold text-white">{toast.title}</div>
          {toast.subtitle && (
            <div className="mt-1 text-[11px] text-white/70">{toast.subtitle}</div>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-[72px_1fr] gap-3">
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

        <div
          className="relative rounded-3xl border border-white/10 bg-black/20"
          style={{ height: timelineHeight }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {marks.map((m) => (
            <div
              key={m.label}
              className="absolute left-0 right-0 border-t border-white/10"
              style={{ top: m.top }}
            />
          ))}

          {events.map((ev) => {
            const top = getTop(ev);
            const h = getHeight(ev);
            const isSaving = savingId === ev.id;
            const isConflict = conflictedIds.has(ev.id);

            return (
              <div key={ev.id} className="absolute left-3 right-3" style={{ top, height: h }}>
                <button
                  onClick={() => onEventClick?.(ev)}
                  onPointerDown={(e) => onMovePointerDown(e, ev)}
                  className={[
                    "relative h-full w-full rounded-2xl border px-4 py-3 text-left",
                    "shadow-lg shadow-black/30 transition hover:bg-white/15 active:scale-[0.995]",
                    isConflict ? "border-red-500/40 bg-red-500/10" : "border-white/10 bg-white/10",
                    isSaving ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{ev.title}</div>
                      <div className="mt-1 truncate text-xs text-white/60">
                        {ev.description || ev.notes || " "}
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

                  <div
                    onPointerDown={(e) => onResizePointerDown(e, ev)}
                    className={[
                      "absolute bottom-2 right-2 grid h-7 w-7 cursor-ns-resize place-items-center rounded-xl border border-white/10",
                      "bg-black/30 hover:bg-white/10 transition",
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
