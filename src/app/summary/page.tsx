// src/app/summary/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  computeVisibleConflicts,
  type CalendarEvent,
  type GroupType,
  groupMeta,
} from "@/lib/conflicts";
import { getMyGroups } from "@/lib/groupsDb";
import { getMyEvents } from "@/lib/eventsDb";

type SummaryEvent = CalendarEvent & {
  whenLabel: string;
};

const ONBOARDING_KEY = "syncplans_onboarded_v1";

export default function SummaryPage() {
  const router = useRouter();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 👇 Nuevo: estado para el onboarding suave
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Carga de datos del resumen (igual que antes)
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [groups, rawEvents] = await Promise.all([
          getMyGroups(),
          getMyEvents(),
        ]);

        if (!alive) return;

        const groupTypeById = new Map<string, GroupType>(
          (groups || []).map((g: any) => {
            const id = String(g.id);
            const rawType = String(g.type ?? "").toLowerCase();

            // normalizamos: solo/personal → personal, couple → pair
            let gt: GroupType = "personal";
            if (rawType === "pair" || rawType === "couple") gt = "pair";
            else if (rawType === "family") gt = "family";

            return [id, gt];
          })
        );

        const mapped: CalendarEvent[] = (rawEvents || []).map((e: any) => {
          const gid = e.group_id ?? e.groupId ?? null;

          let groupType: GroupType = "personal";
          if (gid) {
            const t = groupTypeById.get(String(gid));
            groupType = (t ?? "pair") as GroupType;
          }

          return {
            id: String(e.id),
            title: String(e.title ?? "Evento"),
            start: String(e.start),
            end: String(e.end),
            notes: e.notes ?? undefined,
            groupId: gid ? String(gid) : null,
            groupType,
          };
        });

        setEvents(mapped);
      } catch (err: any) {
        console.error(err);
        setErrorMsg("No pudimos cargar tu resumen. Intenta de nuevo.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 👇 Nuevo: revisar si ya se mostró el onboarding
  useEffect(() => {
    try {
      const flag = window.localStorage.getItem(ONBOARDING_KEY);
      if (!flag) {
        setShowOnboarding(true);
      }
    } catch {
      // si falla localStorage, no rompemos nada
    }
  }, []);

  const now = Date.now();
  const in7 = now + 7 * 24 * 60 * 60 * 1000;
  const in30 = now + 30 * 24 * 60 * 60 * 1000;

  const upcoming = useMemo(() => {
    return events
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      );
  }, [events, now]);

  const next7 = useMemo(
    () =>
      upcoming.filter((e) => {
        const s = new Date(e.start).getTime();
        return s <= in7;
      }),
    [upcoming, in7]
  );

  const next30 = useMemo(
    () =>
      upcoming.filter((e) => {
        const s = new Date(e.start).getTime();
        return s <= in30;
      }),
    [upcoming, in30]
  );

  const nextEvents: SummaryEvent[] = useMemo(() => {
    return upcoming.slice(0, 4).map((e) => ({
      ...e,
      whenLabel: formatRange(e),
    }));
  }, [upcoming]);

  const conflicts = useMemo(
    () => computeVisibleConflicts(events),
    [events]
  );

  const upcomingConflicts = useMemo(() => {
    const list = conflicts || [];
    if (!list.length) return list;

    // nos quedamos con los que afectan hoy hacia adelante
    return list.filter((c) => {
      const endMs = new Date(c.overlapEnd).getTime();
      return endMs >= now;
    });
  }, [conflicts, now]);

  const perType = useMemo(() => {
    let personal = 0;
    let pair = 0;
    let family = 0;

    for (const e of upcoming) {
      if (e.groupType === "family") family++;
      else if (e.groupType === "pair" || e.groupType === "couple") pair++;
      else personal++;
    }

    return { personal, pair, family };
  }, [upcoming]);

  const hasAny = events.length > 0;

  function markOnboardingSeen() {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignorar
    }
    setShowOnboarding(false);
  }

  function goToCalendarFromOnboarding() {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // ignorar
    }
    router.push("/calendar");
  }

  return (
    <main style={S.page}>
      <div style={S.shell}>
        <div style={S.topRow}>
          <PremiumHeader />
          <div style={S.topActions}>
            <button
              type="button"
              style={S.secondary}
              onClick={() => router.push("/events")}
            >
              Ver eventos
            </button>
            <button
              type="button"
              style={S.primary}
              onClick={() => router.push("/events/new/details?type=personal")}
            >
              + Nuevo evento
            </button>
            <LogoutButton />
          </div>
        </div>

        {/* 👇 Nuevo: Onboarding ligero, premium y solo una vez */}
        {showOnboarding && (
          <section style={S.onboardCard}>
            <div>
              <div style={S.onboardBadge}>Bienvenido a SyncPlans</div>
              <h2 style={S.onboardTitle}>
                Tu semana, tu pareja y tu familia en una sola vista.
              </h2>
              <p style={S.onboardText}>
                Aquí verás tus próximos eventos, cómo se reparten entre
                personal, pareja y familia, y dónde hay posibles choques de
                horario.
              </p>
            </div>
            <div style={S.onboardButtons}>
              <button
                type="button"
                style={S.onboardPrimary}
                onClick={goToCalendarFromOnboarding}
              >
                Ir a mi calendario
              </button>
              <button
                type="button"
                style={S.onboardSecondary}
                onClick={markOnboardingSeen}
              >
                Entendido
              </button>
            </div>
          </section>
        )}

        <section style={S.heroCard}>
          <div>
            <div style={S.badge}>Resumen</div>
            <h1 style={S.title}>Así se ve tu semana con SyncPlans</h1>
            <p style={S.subtitle}>
              Mira de un vistazo cuántos planes tienes, dónde hay posibles
              choques y cuál es tu próximo evento importante.
            </p>
          </div>

          <div style={S.heroStats}>
            <HeroStat
              label="Próximos 7 días"
              value={next7.length}
              hint="eventos agendados"
            />
            <HeroStat
              label="Próximos 30 días"
              value={next30.length}
              hint="entre personales y compartidos"
            />
            <HeroStat
              label="Conflictos detectados"
              value={upcomingConflicts.length}
              hint={
                upcomingConflicts.length === 0
                  ? "Todo en orden ✨"
                  : "Revísalos para evitar choques"
              }
              highlight={upcomingConflicts.length > 0}
            />
          </div>
        </section>

        {errorMsg && <div style={S.errorBox}>{errorMsg}</div>}

        <section style={S.grid}>
          <div style={S.cardLeft}>
            <h2 style={S.cardTitle}>Tus calendarios</h2>
            <p style={S.cardSub}>
              Así se reparten tus planes entre personal, pareja y familia.
            </p>

            <div style={S.typeList}>
              <TypeRow
                typeLabel="Personal"
                description="Solo tú"
                count={perType.personal}
                meta={groupMeta("personal")}
              />
              <TypeRow
                typeLabel="Pareja"
                description="Eventos con tu persona favorita"
                count={perType.pair}
                meta={groupMeta("pair")}
              />
              <TypeRow
                typeLabel="Familia"
                description="Planes con tu círculo más cercano"
                count={perType.family}
                meta={groupMeta("family")}
              />
            </div>

            <div style={S.tipBox}>
              <div style={S.tipTitle}>Consejo rápido</div>
              <p style={S.tipBody}>
                Si ves muchos eventos en un mismo día, entra al calendario y
                usa el botón <strong>Conflictos</strong> para resolverlos en
                segundos.
              </p>
            </div>
          </div>

          <div style={S.cardRight}>
            <h2 style={S.cardTitle}>Lo que viene</h2>
            <p style={S.cardSub}>
              Tus próximos eventos, ordenados de más cercano a más lejano.
            </p>

            {!hasAny ? (
              <div style={S.emptyBox}>
                <div style={S.emptyTitle}>Todavía no tienes eventos</div>
                <div style={S.emptySub}>
                  Empieza creando un evento personal o de pareja. SyncPlans te
                  avisará si se cruza con algo más.
                </div>
                <button
                  type="button"
                  style={S.emptyBtn}
                  onClick={() =>
                    router.push("/events/new/details?type=personal")
                  }
                >
                  Crear mi primer evento
                </button>
              </div>
            ) : nextEvents.length === 0 ? (
              <div style={S.emptyBox}>
                <div style={S.emptyTitle}>No hay nada en los próximos días</div>
                <div style={S.emptySub}>
                  Tu calendario está libre por ahora. Aprovecha para planear
                  algo que te haga ilusión.
                </div>
              </div>
            ) : (
              <div style={S.list}>
                {nextEvents.map((e) => (
                  <UpcomingRow key={e.id} event={e} />
                ))}
              </div>
            )}

            <div style={S.footerActions}>
              <button
                type="button"
                style={S.linkBtn}
                onClick={() => router.push("/calendar")}
              >
                Ir al calendario
              </button>
              <button
                type="button"
                style={S.linkBtn}
                onClick={() => router.push("/conflicts/detected")}
              >
                Ver conflictos
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ────────────── Componentes pequeños ────────────── */

function HeroStat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: number;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        ...S.heroStat,
        borderColor: highlight
          ? "rgba(248,113,113,0.7)"
          : "rgba(148,163,184,0.45)",
      }}
    >
      <div style={S.heroLabel}>{label}</div>
      <div style={S.heroValue}>{value}</div>
      <div style={S.heroHint}>{hint}</div>
    </div>
  );
}

function TypeRow({
  typeLabel,
  description,
  count,
  meta,
}: {
  typeLabel: string;
  description: string;
  count: number;
  meta: { label: string; dot: string };
}) {
  return (
    <div style={S.typeRow}>
      <div style={S.typeLeft}>
        <span
          style={{
            ...S.typeDot,
            background: meta.dot,
          }}
        />
        <div>
          <div style={S.typeTitle}>{typeLabel}</div>
          <div style={S.typeDesc}>{description}</div>
        </div>
      </div>
      <div style={S.typeCount}>{count}</div>
    </div>
  );
}

function UpcomingRow({ event }: { event: SummaryEvent }) {
  const meta = groupMeta(event.groupType);

  return (
    <div style={S.row}>
      <div style={{ ...S.rowBar, background: meta.dot }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.rowTop}>
          <div style={S.rowTitle}>{event.title}</div>
          <span style={S.rowBadge}>{meta.label}</span>
        </div>
        <div style={S.rowSub}>{event.whenLabel}</div>
        {event.notes && (
          <div style={S.rowNotes}>
            {event.notes.length > 120
              ? event.notes.slice(0, 117) + "…"
              : event.notes}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────── Helpers ────────────── */

function formatRange(e: CalendarEvent): string {
  const start = new Date(e.start);
  const end = new Date(e.end);

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  const optsDay: Intl.DateTimeFormatOptions = {
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
      optsDay
    )} · ${start.toLocaleTimeString(
      undefined,
      optsTime
    )} — ${end.toLocaleTimeString(undefined, optsTime)}`;
  }

  return `${start.toLocaleString()} — ${end.toLocaleString()}`;
}

/* ────────────── Estilos inline (matching estilo SyncPlans) ────────────── */

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(248,250,252,0.98)",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shell: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 18px 48px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  primary: {
    height: 40,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid rgba(244,244,245,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.40), rgba(124,58,237,0.60))",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    cursor: "pointer",
  },
  secondary: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.90)",
    color: "rgba(226,232,240,0.96)",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },

  // 🔹 Nuevo: estilos onboarding
  onboardCard: {
    marginBottom: 16,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.55)",
    padding: 16,
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 55%), radial-gradient(circle at bottom right, rgba(34,197,94,0.20), transparent 55%), rgba(15,23,42,0.96)",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
  },
  onboardBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(226,232,240,0.96)",
    background: "rgba(15,23,42,0.9)",
  },
  onboardTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 900,
  },
  onboardText: {
    marginTop: 4,
    fontSize: 12,
    maxWidth: 520,
    color: "rgba(203,213,225,0.96)",
  },
  onboardButtons: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: 180,
  },
  onboardPrimary: {
    padding: "9px 14px",
    borderRadius: 999,
    border: "1px solid rgba(244,244,245,0.22)",
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.9), rgba(16,185,129,0.95))",
    color: "#F9FAFB",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 14px 38px rgba(37,99,235,0.45)",
  },
  onboardSecondary: {
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    color: "rgba(226,232,240,0.96)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
  },

  heroCard: {
    borderRadius: 24,
    border: "1px solid rgba(148,163,184,0.45)",
    background:
      "radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 55%), radial-gradient(circle at bottom right, rgba(124,58,237,0.20), transparent 55%), rgba(15,23,42,0.96)",
    padding: 20,
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.5)",
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(226,232,240,0.96)",
    background: "rgba(15,23,42,0.85)",
  },
  title: {
    marginTop: 10,
    fontSize: 24,
    fontWeight: 900,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    maxWidth: 420,
    color: "rgba(203,213,225,0.96)",
  },
  heroStats: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "stretch",
    minWidth: 260,
  },
  heroStat: {
    flex: 1,
    minWidth: 140,
    padding: 10,
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.85)",
  },
  heroLabel: {
    fontSize: 11,
    color: "rgba(148,163,184,0.95)",
    fontWeight: 700,
  },
  heroValue: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 900,
  },
  heroHint: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(203,213,225,0.96)",
  },
  errorBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    border: "1px solid rgba(248,113,113,0.7)",
    background: "rgba(127,29,29,0.75)",
    fontSize: 12,
  },
  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1.1fr)",
    gap: 16,
  },
  cardLeft: {
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.96)",
    padding: 16,
  },
  cardRight: {
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.96)",
    padding: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 900,
  },
  cardSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },
  typeList: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  typeRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 10,
    borderRadius: 16,
    border: "1px solid rgba(51,65,85,0.9)",
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(15,23,42,0.8))",
  },
  typeLeft: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  typeDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    boxShadow: "0 0 0 4px rgba(15,23,42,0.9)",
  },
  typeTitle: {
    fontSize: 13,
    fontWeight: 800,
  },
  typeDesc: {
    marginTop: 1,
    fontSize: 11,
    color: "rgba(148,163,184,0.96)",
  },
  typeCount: {
    fontSize: 18,
    fontWeight: 900,
  },
  tipBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px dashed rgba(148,163,184,0.7)",
    padding: 10,
    background: "rgba(15,23,42,0.9)",
  },
  tipTitle: {
    fontSize: 12,
    fontWeight: 800,
    color: "rgba(226,232,240,0.96)",
  },
  tipBody: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },
  list: {
    marginTop: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  row: {
    display: "flex",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    border: "1px solid rgba(51,65,85,0.9)",
    background: "rgba(15,23,42,0.9)",
  },
  rowBar: {
    width: 6,
    borderRadius: 999,
  },
  rowTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: {
    fontSize: 13,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowBadge: {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    fontSize: 10,
    fontWeight: 700,
    color: "rgba(226,232,240,0.98)",
  },
  rowSub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.98)",
  },
  rowNotes: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(148,163,184,0.96)",
  },
  emptyBox: {
    marginTop: 12,
    padding: 14,
    borderRadius: 18,
    border: "1px dashed rgba(148,163,184,0.65)",
    background: "rgba(15,23,42,0.9)",
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: 900,
  },
  emptySub: {
    marginTop: 4,
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
  },
  emptyBtn: {
    marginTop: 10,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(244,244,245,0.18)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.34), rgba(124,58,237,0.6))",
    color: "#fff",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  footerActions: {
    marginTop: 14,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  linkBtn: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.7)",
    background: "rgba(15,23,42,0.9)",
    color: "rgba(226,232,240,0.96)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
};
