"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { getEvents, type CalendarEvent } from "@/lib/events";
import { computeVisibleConflicts, type ConflictItem } from "@/lib/conflicts";
import { groupMeta } from "@/lib/scheduling";

type GroupUiType = "personal" | "pair" | "family";
type SchedulingGroupType = "personal" | "couple" | "family";

function safeDate(v: any): Date | null {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay(); // 0 Sun..6 Sat
  const diff = (day + 6) % 7; // Monday=0
  x.setDate(x.getDate() - diff);
  return x;
}

function ymd(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtTime(d: Date | null) {
  if (!d) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(d: Date) {
  return d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
}

function toGroupUiType(gt: any): GroupUiType {
  if (gt === "couple") return "pair";
  if (gt === "personal" || gt === "pair" || gt === "family") return gt;
  return "personal";
}

function toSchedulingType(gt: any): SchedulingGroupType {
  if (gt === "pair") return "couple";
  if (gt === "couple") return "couple";
  if (gt === "family") return "family";
  return "personal";
}

function pickTopConflict(list: ConflictItem[]) {
  if (!Array.isArray(list) || list.length === 0) return null;

  // Prefer the one with the longest overlap (if possible)
  const scored = list
    .map((c) => {
      const os = safeDate((c as any).overlapStart);
      const oe = safeDate((c as any).overlapEnd);
      const score = os && oe ? Math.max(0, oe.getTime() - os.getTime()) : 0;
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.c ?? list[0];
}

export default function SummaryPage() {
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    try {
      const loaded = getEvents();
      setEvents(Array.isArray(loaded) ? loaded : []);
    } catch {
      setEvents([]);
    }
  }, []);

  const weekStart = useMemo(() => startOfWeekMonday(new Date()), []);
  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekEvents = useMemo(() => {
    const out: CalendarEvent[] = [];
    for (const e of Array.isArray(events) ? events : []) {
      const s = safeDate((e as any).start);
      if (!s) continue;
      if (s.getTime() >= weekStart.getTime() && s.getTime() < weekEnd.getTime()) out.push(e);
    }
    out.sort((a: any, b: any) => (safeDate(a.start)?.getTime() ?? 0) - (safeDate(b.start)?.getTime() ?? 0));
    return out;
  }, [events, weekStart, weekEnd]);

  const groupCounts = useMemo(() => {
    const counts: Record<GroupUiType, number> = { personal: 0, pair: 0, family: 0 };
    for (const e of weekEvents as any[]) {
      const ui = toGroupUiType(e.groupType);
      counts[ui] += 1;
    }
    return counts;
  }, [weekEvents]);

  const conflicts = useMemo(() => {
    try {
      return computeVisibleConflicts(Array.isArray(weekEvents) ? weekEvents : []);
    } catch {
      return [];
    }
  }, [weekEvents]);

  const topConflict = useMemo(() => pickTopConflict(conflicts), [conflicts]);

  const perDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const d of days) map.set(ymd(d), []);
    for (const e of weekEvents as any[]) {
      const s = safeDate(e.start);
      if (!s) continue;
      const key = ymd(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a: any, b: any) => (safeDate(a.start)?.getTime() ?? 0) - (safeDate(b.start)?.getTime() ?? 0));
      map.set(k, list);
    }
    return map;
  }, [weekEvents, days]);

  const busiest = useMemo(() => {
    let bestKey = ymd(weekStart);
    let bestCount = -1;
    for (const d of days) {
      const key = ymd(d);
      const c = (perDay.get(key) ?? []).length;
      if (c > bestCount) {
        bestCount = c;
        bestKey = key;
      }
    }
    return { key: bestKey, count: Math.max(0, bestCount) };
  }, [perDay, days, weekStart]);

  const hoursScheduled = useMemo(() => {
    let mins = 0;
    for (const e of weekEvents as any[]) {
      const s = safeDate(e.start);
      const en = safeDate(e.end);
      if (!s || !en) continue;
      const diff = Math.max(0, en.getTime() - s.getTime());
      mins += Math.floor(diff / 60000);
    }
    return Math.round((mins / 60) * 10) / 10;
  }, [weekEvents]);

  const topLine = useMemo(() => {
    if (conflicts.length === 0) return "✅ Semana limpia: cero choques detectados.";
    if (conflicts.length === 1) return "⚠️ Se detectó 1 conflicto esta semana.";
    return `⚠️ Se detectaron ${conflicts.length} conflictos esta semana.`;
  }, [conflicts.length]);

  function goResolveTop() {
    if (!topConflict) {
      router.push("/conflicts/detected");
      return;
    }

    // Prefer compare with conflictId if your compare page supports it.
    // If not, it still lands on compare and you can pick inside.
    const id = (topConflict as any).id;
    if (id) {
      router.push(`/conflicts/compare?conflictId=${encodeURIComponent(id)}`);
      return;
    }
    router.push("/conflicts/compare");
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-cyan-400" />
              SyncPlans · Resumen semanal
            </div>

            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Tu semana, en una vista</h1>

            <div className="mt-2 text-sm text-white/60">
              {fmtDay(weekStart)} — {fmtDay(addDays(weekEnd, -1))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
              {topLine}
              <div className="mt-2 text-xs text-white/60">
                Para demo: la app no solo detecta choques — te guía para resolverlos.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push("/calendar")}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Volver a calendario
            </button>

            <button
              onClick={() => router.push("/events/new")}
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              + Crear evento
            </button>

            <Link
              href="/conflicts/detected"
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
            >
              Ver conflictos →
            </Link>
          </div>
        </div>

        {/* KPI Row */}
        <div className="mb-6 grid gap-3 md:grid-cols-4">
          <Stat label="Eventos (semana)" value={String(weekEvents.length)} />
          <Stat label="Horas organizadas" value={`${hoursScheduled}`} />
          <Stat label="Conflictos" value={String(conflicts.length)} />
          <Stat label="Día más cargado" value={`${busiest.count}`} sub={`(${fmtDay(new Date(busiest.key))})`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_.95fr]">
          {/* Left */}
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
            {/* TOP CONFLICT */}
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Conflicto destacado</div>
                  <div className="mt-1 text-xs text-white/60">
                    El más relevante de la semana (para resolver en 15 segundos).
                  </div>
                </div>

                <button
                  onClick={goResolveTop}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                >
                  Resolver →
                </button>
              </div>

              {!topConflict ? (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100/80">
                  ✅ No hay conflictos esta semana. Perfecto.
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  <MiniRow label="Overlap" value={`${(topConflict as any).overlapStart ?? "—"} → ${(topConflict as any).overlapEnd ?? "—"}`} />
                  <MiniRow label="ExistingEventId" value={`${(topConflict as any).existingEventId ?? "—"}`} />
                  <MiniRow label="IncomingEventId" value={`${(topConflict as any).incomingEventId ?? "—"}`} />
                  <div className="mt-2 text-xs text-white/50">
                    Tip: si tu /conflicts/compare ya acepta conflictId, este botón entra directo al caso.
                  </div>
                </div>
              )}
            </div>

            {/* Distribución */}
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold">Distribución por grupo</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <GroupStat label="Personal" dotClass="bg-amber-400" value={groupCounts.personal} />
                <GroupStat label="Pareja" dotClass="bg-rose-400" value={groupCounts.pair} />
                <GroupStat label="Familia" dotClass="bg-sky-400" value={groupCounts.family} />
              </div>
            </div>

            {/* Eventos preview */}
            <div className="mt-6">
              <div className="mb-2 text-sm font-semibold">Eventos de la semana</div>

              {weekEvents.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
                  No hay eventos esta semana.
                </div>
              ) : (
                <div className="grid gap-2">
                  {weekEvents.slice(0, 6).map((e: any) => {
                    const s = safeDate(e.start);
                    const en = safeDate(e.end);
                    const m = groupMeta(toSchedulingType(toGroupUiType(e.groupType)));
                    return (
                      <div key={e.id ?? `${e.title}-${e.start}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{e.title ?? "Evento"}</div>
                            <div className="mt-1 text-xs text-white/60">
                              {s ? fmtDay(s) : "Fecha inválida"} · {fmtTime(s)} — {fmtTime(en)}
                            </div>
                          </div>
                          <span className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                            <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                            {m.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Right: week-by-day */}
          <aside className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">Semana (Lun → Dom)</div>
                <div className="mt-1 text-xs text-white/60">Eventos por día</div>
              </div>
              <div className="text-xs text-white/50">{weekEvents.length} evento(s)</div>
            </div>

            <div className="grid gap-2">
              {days.map((d) => {
                const key = ymd(d);
                const list = perDay.get(key) ?? [];
                const intensity = clamp(list.length, 0, 6);

                return (
                  <div key={key} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{fmtDay(d)}</div>

                      <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-1">
                          {Array.from({ length: 6 }).map((_, i) => (
                            <span
                              key={i}
                              className={[
                                "h-2 w-2 rounded-full border border-white/10",
                                i < intensity ? "bg-white/30" : "bg-white/5",
                              ].join(" ")}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-white/60">{list.length}</span>
                      </div>
                    </div>

                    {list.length === 0 ? (
                      <div className="mt-2 text-xs text-white/50">Sin eventos</div>
                    ) : (
                      <div className="mt-3 grid gap-2">
                        {list.slice(0, 4).map((e: any) => {
                          const s = safeDate(e.start);
                          const en = safeDate(e.end);
                          const m = groupMeta(toSchedulingType(toGroupUiType(e.groupType)));
                          return (
                            <div key={e.id ?? `${e.title}-${e.start}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0 truncate text-xs font-semibold">{e.title ?? "Evento"}</div>
                                <span className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2 py-0.5 text-[11px] text-white/70">
                                  <span className={`h-2 w-2 rounded-full ${m.dot}`} />
                                  {m.label}
                                </span>
                              </div>
                              <div className="mt-1 text-[11px] text-white/60">
                                {fmtTime(s)} — {fmtTime(en)}
                              </div>
                            </div>
                          );
                        })}
                        {list.length > 4 && <div className="text-[11px] text-white/50">+{list.length - 4} más…</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Acción recomendada</div>
              <div className="mt-1 text-xs text-white/60">
                Mantén tu semana limpia resolviendo lo detectado (en 3 clicks).
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={goResolveTop}
                  className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15"
                >
                  Resolver destacado →
                </button>
                <button
                  onClick={() => router.push("/conflicts/detected")}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Ver todos
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ---------------- UI bits ---------------- */

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs font-semibold text-white/70">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-white/50">{sub}</div>}
    </div>
  );
}

function GroupStat({ label, value, dotClass }: { label: string; value: number; dotClass: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-white/50">eventos</div>
    </div>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs font-semibold text-white/60">{label}</div>
      <div className="text-xs text-white/80 truncate max-w-[60%] text-right">{value}</div>
    </div>
  );
}
