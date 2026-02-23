// src/app/events/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AppHero from "@/components/AppHero";
import LogoutButton from "@/components/LogoutButton";

import { getMyEvents, deleteEventsByIds } from "@/lib/eventsDb";
import { getMyGroups } from "@/lib/groupsDb";
import {
  groupMeta,
  type CalendarEvent,
  type GroupType,
} from "@/lib/conflicts";

import supabase from "@/lib/supabaseClient";

type DbEvent = {
  id: string;
  title?: string | null;
  start: string;
  end: string;
  notes?: string | null;
  group_id?: string | null;
  groupId?: string | null;
};

type ViewMode = "upcoming" | "past" | "all";

/** ✅ Detecta móvil por ancho */
function useIsMobileWidth(maxWidth = 520) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`);

    const apply = () => setIsMobile(!!mq.matches);
    apply();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } else {
      // @ts-ignore
      mq.addListener(apply);
      return () => {
        // @ts-ignore
        mq.removeListener(apply);
      };
    }
  }, [maxWidth]);

  return isMobile;
}

export default function EventsPage() {
  const router = useRouter();
  const isMobile = useIsMobileWidth(520);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("upcoming");
  const [query, setQuery] = useState("");
  const [sendingDigest, setSendingDigest] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [myGroups, rawEvents] = await Promise.all([
          getMyGroups(),
          getMyEvents(),
        ]);

        if (!alive) return;

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

  const upcomingAll = useMemo(() => {
    return [...events]
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
      );
  }, [events, now]);

  const pastAll = useMemo(() => {
    return [...events]
      .filter((e) => new Date(e.end).getTime() < now)
      .sort(
        (a, b) =>
          new Date(b.start).getTime() - new Date(a.start).getTime()
      );
  }, [events, now]);

  const baseAll = useMemo(() => {
    if (view === "upcoming") return upcomingAll;
    if (view === "past") return pastAll;
    return [...events].sort(
      (a, b) =>
        new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [view, upcomingAll, pastAll, events]);

  const visibleAll = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return baseAll;

    return baseAll.filter((e) => {
      const t = (e.title ?? "").toLowerCase();
      const n = (e.notes ?? "").toLowerCase();
      return t.includes(q) || n.includes(q);
    });
  }, [baseAll, query]);

  const LIST_LIMIT = isMobile ? 5 : 60;

  const visible = useMemo(
    () => visibleAll.slice(0, LIST_LIMIT),
    [visibleAll, LIST_LIMIT]
  );

  const showSeeMore =
    !loading && visibleAll.length > LIST_LIMIT;

  async function onDelete(id: string) {
    const ok = confirm(
      "¿Eliminar este evento? Esta acción no se puede deshacer."
    );
    if (!ok) return;

    const deleted = await deleteEventsByIds([id]);

    if (deleted >= 0) {
      setEvents((s) =>
        s.filter((x) => String(x.id) !== String(id))
      );
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

  async function sendTodayDigest() {
    try {
      setSendingDigest(true);

      const { data, error } =
        await supabase.auth.getUser();

      if (error || !data.user) {
        throw new Error(
          "No pude leer tu sesión. Vuelve a iniciar sesión."
        );
      }

      const email = data.user.email;
      if (!email) {
        throw new Error(
          "No encontré tu correo en la cuenta."
        );
      }

      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth();
      const d = today.getDate();

      const todaysEvents = events.filter((e) => {
        const s = new Date(e.start);
        return (
          s.getFullYear() === y &&
          s.getMonth() === m &&
          s.getDate() === d
        );
      });

      if (todaysEvents.length === 0) {
        setToast("Hoy no tienes eventos para recordar 🙂");
        window.setTimeout(() => setToast(null), 2200);
        return;
      }

      const payloadEvents = todaysEvents.map((e) => {
        const meta = groupMeta(
          (e.groupType ?? "personal") as any
        );
        return {
          title: e.title ?? "Evento",
          start: e.start,
          end: e.end,
          groupLabel: meta.label,
        };
      });

      const dateLabel = `${String(d).padStart(
        2,
        "0"
      )}/${String(m + 1).padStart(2, "0")}/${y}`;

      const res = await fetch("/api/daily-digest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: email,
          date: dateLabel,
          events: payloadEvents,
        }),
      });

      if (!res.ok) {
        throw new Error(
          "No se pudo enviar el correo."
        );
      }

      setToast(
        "Te envié un resumen de hoy a tu correo ✉️"
      );
      window.setTimeout(() => setToast(null), 2200);
    } catch (err: any) {
      console.error("[sendTodayDigest] error", err);

      setToast(
        err?.message ||
          "No se pudo enviar el recordatorio. Intenta más tarde."
      );

      window.setTimeout(() => setToast(null), 2600);
    } finally {
      setSendingDigest(false);
    }
  }

  const headerSubtitle = isMobile
    ? "Tus eventos, sin ruido."
    : "Organiza tu día sin choques de horario.";
      return (
    <main style={S.page} className="spEvt-page">
      {toast && <div style={S.toast}>{toast}</div>}

      <div style={S.shell} className="spEvt-shell">
        {/* ✅ APP MODE en móvil: bottom bar + sin nav larga arriba */}
        <AppHero
          title="Eventos"
          subtitle={headerSubtitle}
          mobileNav="bottom"
          rightSlot={
            <div style={S.topActions} className="spEvt-topActions">
              <button
                style={S.secondary}
                onClick={sendTodayDigest}
                disabled={sendingDigest}
              >
                {sendingDigest ? "Enviando…" : "Recordatorio de hoy"}
              </button>

              <button
                style={S.primary}
                onClick={() =>
                  router.push("/events/new/details?type=personal")
                }
              >
                + Evento
              </button>

              <LogoutButton />
            </div>
          }
        />

        {/* ✅ 1 card principal */}
        <section style={S.card} className="spEvt-card">
          <div style={S.titleRow} className="spEvt-titleRow">
            <div>
              <div style={S.title}>Lista</div>
              <div style={S.sub} className="spEvt-sub">
                {events.length === 0
                  ? "Aún no tienes eventos registrados."
                  : isMobile
                  ? `Mostrando ${visible.length} · Total ${events.length}`
                  : `Total: ${events.length} · Próximos: ${upcomingAll.length} · Historial: ${pastAll.length}`}
              </div>
            </div>

            <div style={S.filters} className="spEvt-filters">
              <div style={S.tabs} className="spEvt-tabs">
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
                placeholder="Buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={S.search}
                className="spEvt-search"
              />
            </div>
          </div>

          {loading ? (
            <div style={S.empty}>Cargando…</div>
          ) : visibleAll.length === 0 ? (
            <div style={S.empty}>
              {view === "past"
                ? "Aún no tienes historial de eventos."
                : view === "upcoming"
                ? "No tienes eventos futuros."
                : "No hay eventos que coincidan con la búsqueda."}
            </div>
          ) : (
            <>
              <div style={S.list} className="spEvt-list">
                {visible.map((e) => {
                  const meta = groupMeta(
                    (e.groupType ?? "personal") as any
                  );

                  return (
                    <div
                      key={e.id}
                      style={S.row}
                      className="spEvt-row"
                    >
                      <div
                        style={{
                          ...S.bar,
                          background: meta.dot,
                        }}
                      />

                      <div
                        style={{ flex: 1, minWidth: 0 }}
                      >
                        <div style={S.rowTop}>
                          <div
                            style={{
                              ...S.rowTitle,
                              cursor: "pointer",
                            }}
                            title="Editar evento"
                            onClick={() =>
                              router.push(
                                `/events/new/details?mode=edit&id=${e.id}`
                              )
                            }
                          >
                            {e.title}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                            }}
                          >
                            <button
                              style={S.edit}
                              onClick={() =>
                                router.push(
                                  `/events/new/details?mode=edit&id=${e.id}`
                                )
                              }
                              title="Editar"
                            >
                              ✏️
                            </button>

                            <button
                              style={S.del}
                              onClick={() =>
                                onDelete(String(e.id))
                              }
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <div style={S.rowSub}>
                          {formatRange(e)}
                        </div>

                        <div style={S.badge}>
                          {meta.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ✅ En móvil: “ver más” en vez de scroll eterno */}
              {showSeeMore && (
                <button
                  style={S.seeMore}
                  className="spEvt-seeMore"
                  onClick={() =>
                    setToast(
                      `Mostrando solo ${LIST_LIMIT}. Usa buscar o cambia filtro.`
                    )
                  }
                >
                  Ver más ({visibleAll.length}) →
                </button>
              )}
            </>
          )}
        </section>
      </div>

      {/* ✅ Responsive SOLO Events (no toca desktop global) */}
      <style>{`
        @media (max-width: 520px) {
          .spEvt-shell {
            padding: 14px 12px 110px !important; /* espacio para bottom bar */
          }

          .spEvt-card {
            padding: 12px !important;
            border-radius: 16px !important;
            margin-top: 10px !important;
          }

          .spEvt-titleRow {
            gap: 10px !important;
          }

          .spEvt-sub {
            display: none !important; /* menos ruido */
          }

          .spEvt-filters {
            width: 100% !important;
            justify-content: space-between !important;
          }

          .spEvt-tabs {
            width: 100% !important;
            justify-content: space-between !important;
          }

          .spEvt-search {
            width: 100% !important;
            min-width: 0 !important;
          }

          .spEvt-row {
            padding: 10px !important;
            border-radius: 14px !important;
          }

          .spEvt-list {
            gap: 8px !important;
          }

          .spEvt-seeMore {
            width: 100% !important;
          }
        }
      `}</style>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
    color: "rgba(255,255,255,0.92)",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
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
  secondary: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.9)",
    color: "#e5e7eb",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },
  card: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
    marginTop: 14,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
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
  seeMore: {
    marginTop: 10,
    width: "fit-content",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 12,
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
  edit: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 16,
    opacity: 0.85,
  },
};