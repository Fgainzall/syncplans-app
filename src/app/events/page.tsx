// src/app/events/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import { getMyEvents, deleteEventsByIds } from "@/lib/eventsDb";
import { getMyGroups } from "@/lib/groupsDb";
import { groupMeta, type CalendarEvent, type GroupType } from "@/lib/conflicts";

type DbEvent = {
  id: string;
  title?: string | null;
  start: string;
  end: string;
  notes?: string | null;
  group_id?: string | null;
  groupId?: string | null; // fallback si viene con otro nombre
};

type ViewMode = "upcoming" | "past" | "all";

export default function EventsPage() {
  const router = useRouter();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("upcoming");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // ✅ Cargamos ambas cosas (igual que CalendarClient)
        const [myGroups, rawEvents] = await Promise.all([getMyGroups(), getMyEvents()]);
        if (!alive) return;

        // ✅ Map group_id -> type ("pair" | "family")
        const groupTypeById = new Map<string, "pair" | "family">(
          (myGroups || []).map((g: any) => {
            const id = String(g.id);
            const rawType = String(g.type ?? "").toLowerCase();
            const normalized: "pair" | "family" =
              rawType === "family" ? "family" : "pair";
            return [id, normalized];
          })
        );

        const list: CalendarEvent[] = ((rawEvents || []) as DbEvent[])
          .map((ev) => {
            const gid = ev.group_id ?? ev.groupId ?? null;
            let gt: GroupType = "personal";
            if (gid) {
              const t = groupTypeById.get(String(gid));
              gt = (t === "family" ? "family" : "pair") as GroupType;
            }

            return {
              id: String(ev.id),
              title: ev.title ?? "Evento",
              start: String(ev.start),
              end: String(ev.end),
              notes: ev.notes ?? undefined,
              groupId: gid ? String(gid) : null,
              groupType: gt,
            };
          })
          .filter(Boolean);

        setEvents(list);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const now = Date.now();

  const upcoming = useMemo(() => {
    return [...events]
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      );
  }, [events, now]);

  const past = useMemo(() => {
    return [...events]
      .filter((e) => new Date(e.end).getTime() < now)
      .sort(
        (a, b) =>
          new Date(b.start).getTime() - new Date(a.start).getTime()
      );
  }, [events, now]);

  const visible = useMemo(() => {
    let base: CalendarEvent[];
    if (view === "upcoming") base = upcoming;
    else if (view === "past") base = past;
    else {
      base = [...events].sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      );
    }

    const q = query.trim().toLowerCase();
    if (!q) return base;

    return base.filter((e) => {
      const t = (e.title ?? "").toLowerCase();
      const n = (e.notes ?? "").toLowerCase();
      return t.includes(q) || n.includes(q);
    });
  }, [view, upcoming, past, events, query]);

  async function onDelete(id: string) {
    const ok = confirm("¿Eliminar este evento? Esta acción no se puede deshacer.");
    if (!ok) return;
    const deleted = await deleteEventsByIds([id]);
    if (deleted >= 0) {
      setEvents((s) => s.filter((x) => String(x.id) !== String(id)));
      setToast("Evento eliminado ✅");
      window.setTimeout(() => setToast(null), 1800);
    }
  }

  function formatRange(e: CalendarEvent): string {
    const start = new Date(e.start);
    const end = new Date(e.end);

    const sameDay =
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();

    const optsDate: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "2-digit",
      month: "short",
    };
    const optsTime: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
    };

    if (sameDay) {
      return `${start.toLocaleDateString(
        undefined,
        optsDate
      )} · ${start.toLocaleTimeString(
        undefined,
        optsTime
      )} — ${end.toLocaleTimeString(undefined, optsTime)}`;
    }

    return `${start.toLocaleString()} — ${end.toLocaleString()}`;
  }

  return (
    <main style={S.page}>
      {toast && <div style={S.toast}>{toast}</div>}
      <div style={S.shell}>
        <div style={S.topRow}>
          <PremiumHeader />
          <div style={S.topActions}>
            <button
              style={S.primary}
              onClick={() => router.push("/events/new/details?type=personal")}
            >
              + Evento
            </button>
            <LogoutButton />
          </div>
        </div>

        <section style={S.card}>
          <div style={S.titleRow}>
            <div>
              <div style={S.title}>Eventos</div>
              <div style={S.sub}>
                {events.length === 0
                  ? "Aún no tienes eventos registrados."
                  : `Total: ${events.length} · Próximos: ${upcoming.length} · Historial: ${past.length}`}
              </div>
            </div>

            <div style={S.filters}>
              <div style={S.tabs}>
                <button
                  type="button"
                  style={{
                    ...S.tab,
                    ...(view === "upcoming" ? S.tabActive : null),
                  }}
                  onClick={() => setView("upcoming")}
                >
                  Próximos
                </button>
                <button
                  type="button"
                  style={{
                    ...S.tab,
                    ...(view === "past" ? S.tabActive : null),
                  }}
                  onClick={() => setView("past")}
                >
                  Historial
                </button>
                <button
                  type="button"
                  style={{
                    ...S.tab,
                    ...(view === "all" ? S.tabActive : null),
                  }}
                  onClick={() => setView("all")}
                >
                  Todos
                </button>
              </div>

              <input
                placeholder="Buscar por título o nota…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={S.search}
              />
            </div>
          </div>

          {loading ? (
            <div style={S.empty}>Cargando…</div>
          ) : visible.length === 0 ? (
            <div style={S.empty}>
              {view === "past"
                ? "Aún no tienes historial de eventos."
                : view === "upcoming"
                ? "No tienes eventos futuros."
                : "No hay eventos que coincidan con la búsqueda."}
            </div>
          ) : (
            <div style={S.list}>
              {visible.map((e) => {
                const meta = groupMeta((e.groupType ?? "personal") as any);
                return (
                  <div key={e.id} style={S.row}>
                    <div style={{ ...S.bar, background: meta.dot }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={S.rowTop}>
                        <div style={S.rowTitle}>{e.title}</div>
                        <button
                          style={S.del}
                          onClick={() => onDelete(String(e.id))}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                      <div style={S.rowSub}>{formatRange(e)}</div>
                      <div style={S.badge}>{meta.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "spaceBetween" as any, // o "space-between"
    gap: 14,
    marginBottom: 14,
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  primary: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
  },
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },
  titleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 16,
    fontWeight: 950,
  },
  sub: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  filters: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  tabs: {
    display: "flex",
    gap: 6,
    padding: 2,
    borderRadius: 999,
    background: "rgba(15,23,42,0.85)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tab: {
    border: "none",
    outline: "none",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: "transparent",
    color: "rgba(255,255,255,0.70)",
    cursor: "pointer",
  } as React.CSSProperties,
  tabActive: {
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.40), rgba(124,58,237,0.40))",
    color: "#fff",
  },
  search: {
    minWidth: 160,
    padding: "5px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    background: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
    fontSize: 11,
  },
  list: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 10,
    padding: 12,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
  },
  bar: {
    width: 6,
    borderRadius: 999,
  },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "center",
  },
  rowTitle: {
    fontWeight: 950,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  rowSub: {
    marginTop: 6,
    fontSize: 12,
    opacity: 0.75,
    fontWeight: 650,
  },
  badge: {
    marginTop: 8,
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(15,23,42,0.9)",
  },
  empty: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    border: "1px dashed rgba(255,255,255,0.16)",
    fontSize: 13,
    opacity: 0.8,
  },
  toast: {
    position: "fixed",
    top: 16,
    right: 16,
    zIndex: 60,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(7,11,22,0.75)",
    backdropFilter: "blur(12px)",
    fontWeight: 900,
  },
  del: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 16,
  },
};
