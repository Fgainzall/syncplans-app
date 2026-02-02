// src/app/calendar/month/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

import { getMyGroups } from "@/lib/groupsDb";
import { getActiveGroupIdFromDb } from "@/lib/activeGroup";
import { getEventsForGroups } from "@/lib/eventsDb";
import { groupMeta, type CalendarEvent, type GroupType } from "@/lib/conflicts";

type Scope = "personal" | "active" | "all";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function startOfWeekMonday(d: Date) {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const out = new Date(d);
  out.setDate(d.getDate() - diff);
  out.setHours(0, 0, 0, 0);
  return out;
}
function addDays(d: Date, n: number) {
  const o = new Date(d);
  o.setDate(o.getDate() + n);
  return o;
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function prettyMonth(d: Date) {
  return d.toLocaleString("es-PE", { month: "long", year: "numeric" });
}

export default function CalendarMonthPage() {
  const router = useRouter();

  const [cursor, setCursor] = React.useState(() => new Date());
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [scope, setScope] = React.useState<Scope>("all");
  const [activeGroupId, setActiveGroupId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.user) {
        router.replace("/auth/login");
        return;
      }

      const activeId = await getActiveGroupIdFromDb().catch(() => null);
      setActiveGroupId(activeId);

      const myGroups = await getMyGroups();
      const allGroupIds = (myGroups ?? []).map((g: any) => String(g.id));

      let groupIdsToFetch: string[] = [];
      if (scope === "active") groupIdsToFetch = activeId ? [String(activeId)] : allGroupIds;
      else groupIdsToFetch = allGroupIds;

      // ✅ ahora acepta args y SIEMPRE incluye personal
      const raw = await getEventsForGroups(groupIdsToFetch);

      const typeByGroupId = new Map<string, GroupType>(
        (myGroups ?? []).map((g: any) => [String(g.id), (String(g.type ?? "").toLowerCase() === "family" ? "family" : "pair") as GroupType])
      );

      const adapted: CalendarEvent[] = (raw ?? []).map((e: any) => {
        const gid = e.groupId ?? e.group_id ?? null;

        const gt: GroupType = gid
          ? (typeByGroupId.get(String(gid)) ?? ("pair" as any))
          : ("personal" as any);

        return {
          id: String(e.id),
          title: e.title ?? "Evento",
          start: String(e.start),
          end: String(e.end),
          notes: e.notes ?? undefined,
          groupId: gid ? String(gid) : null,
          groupType: gt,
        };
      });

      const finalEvents =
        scope === "personal" ? adapted.filter((e) => (e.groupType ?? "personal") === "personal") : adapted;

      setEvents(finalEvents);
    } catch (e: any) {
      setError(e?.message ?? "Error cargando calendar/month");
    } finally {
      setLoading(false);
    }
  }, [router, scope]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const grid = React.useMemo(() => {
    const gridStart = startOfWeekMonday(startOfMonth(cursor));
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return { date, key: ymd(date), inMonth: sameMonth(date, cursor) };
    });
  }, [cursor]);

  const eventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.start);
      const key = ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      map.set(k, arr);
    }
    return map;
  }, [events]);

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.top}>
          <div>
            <h1 style={styles.h1}>{prettyMonth(cursor)}</h1>
            <div style={styles.sub}>
              Mensual · scope: <b>{scope}</b>
              {scope === "active" && activeGroupId ? (
                <span style={{ opacity: 0.7 }}>
                  {" "}
                  · activo: <span style={{ fontFamily: "ui-monospace" }}>{String(activeGroupId).slice(0, 8)}…</span>
                </span>
              ) : null}
            </div>
            {error ? <div style={styles.error}>{error}</div> : null}
          </div>

          <div style={styles.actions}>
            <Link href="/calendar" style={styles.linkBtn}>
              Ver agenda
            </Link>

            <button onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={styles.btn}>
              ←
            </button>
            <button onClick={() => setCursor(new Date())} style={styles.btn}>
              Hoy
            </button>
            <button onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={styles.btn}>
              →
            </button>
          </div>
        </div>

        <div style={styles.scopeRow}>
          {(["active", "personal", "all"] as Scope[]).map((s) => (
            <button key={s} onClick={() => setScope(s)} style={{ ...styles.scopeBtn, ...(scope === s ? styles.scopeOn : {}) }}>
              {s === "active" ? "Grupo activo" : s === "personal" ? "Personal" : "Todo"}
            </button>
          ))}
          <button onClick={refresh} style={styles.scopeBtn}>
            {loading ? "…" : "Refrescar"}
          </button>
        </div>

        <div style={styles.weekHeader}>
          {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
            <div key={d} style={styles.weekDay}>
              {d}
            </div>
          ))}
        </div>

        <div style={styles.grid}>
          {grid.map((cell) => {
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === ymd(new Date());

            return (
              <div
                key={cell.key}
                style={{
                  ...styles.cell,
                  opacity: cell.inMonth ? 1 : 0.45,
                  borderColor: cell.inMonth ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
                  background: cell.inMonth ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.25)",
                }}
              >
                <div style={styles.cellTop}>
                  <div style={{ ...styles.dayNum, opacity: isToday ? 1 : 0.8 }}>{cell.date.getDate()}</div>
                  {isToday ? <div style={styles.todayPill}>Hoy</div> : null}
                </div>

                <div style={styles.dotRow}>
                  {loading ? (
                    <span style={{ opacity: 0.35 }}>…</span>
                  ) : dayEvents.length === 0 ? (
                    <span style={{ opacity: 0.25 }}>—</span>
                  ) : (
                    dayEvents.slice(0, 12).map((e) => {
                      const m = groupMeta((e.groupType ?? "personal") as GroupType);
                      return <span key={String(e.id)} title={e.title} style={{ ...styles.dot, background: m.dot as any }} />;
                    })
                  )}
                  {!loading && dayEvents.length > 12 ? <span style={{ fontSize: 11, opacity: 0.6 }}>+{dayEvents.length - 12}</span> : null}
                </div>

                <div style={styles.lines}>
                  {dayEvents.slice(0, 3).map((e) => (
                    <div key={String(e.id)} style={styles.line} title={e.title}>
                      {e.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div style={styles.footerHint}>
          Tip: define el grupo activo en <span style={{ fontFamily: "ui-monospace" }}>/groups</span> para que “Grupo activo” tenga sentido.
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
  },
  shell: { maxWidth: 1120, margin: "0 auto", padding: "22px 18px 48px" },
  top: { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" },
  h1: { margin: 0, fontSize: 26, fontWeight: 900, textTransform: "capitalize" },
  sub: { marginTop: 6, fontSize: 13, opacity: 0.75 },
  error: { marginTop: 10, padding: 12, borderRadius: 14, border: "1px solid rgba(248,113,113,0.30)", background: "rgba(248,113,113,0.10)", fontSize: 13 },
  actions: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  linkBtn: { padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.92)", textDecoration: "none", fontWeight: 800, fontSize: 13 },
  btn: { width: 44, height: 40, borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.92)", cursor: "pointer", fontWeight: 900, fontSize: 16 },
  scopeRow: { marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" },
  scopeBtn: { padding: "10px 12px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.92)", cursor: "pointer", fontWeight: 800, fontSize: 13 },
  scopeOn: { background: "rgba(255,255,255,0.09)" },
  weekHeader: { marginTop: 14, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 },
  weekDay: { fontSize: 12, opacity: 0.65, padding: "0 6px" },
  grid: { marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 },
  cell: { minHeight: 122, borderRadius: 18, border: "1px solid rgba(255,255,255,0.10)", padding: 12 },
  cellTop: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  dayNum: { fontSize: 12, fontWeight: 900 },
  todayPill: { fontSize: 10, fontWeight: 900, padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.08)", opacity: 0.9 },
  dotRow: { marginTop: 10, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  dot: { width: 9, height: 9, borderRadius: 999 },
  lines: { marginTop: 10, display: "flex", flexDirection: "column", gap: 6 },
  line: { fontSize: 11, fontWeight: 700, opacity: 0.86, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  footerHint: { marginTop: 14, fontSize: 12, opacity: 0.55 },
};
