// src/app/summary/SummaryClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import PremiumHeader from "@/components/PremiumHeader";
import SummaryOnboardingBanner from "@/components/SummaryOnboardingBanner";

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

type SummaryFeedback = {
  fromConflicts: boolean;
  resolvedCount?: number;
};

export default function SummaryPage() {
  const router = useRouter();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<SummaryFeedback>({
    fromConflicts: false,
  });

  // Carga de datos del resumen
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        // Usamos allSettled para que un error en grupos/eventos NO rompa todo el resumen
        const [groupsResult, eventsResult] = await Promise.allSettled([
          getMyGroups(),
          getMyEvents(),
        ]);
        if (!alive) return;

        if (
          groupsResult.status === "rejected" ||
          eventsResult.status === "rejected"
        ) {
          console.error("Error cargando resumen:", {
            groupsError:
              groupsResult.status === "rejected"
                ? groupsResult.reason
                : null,
            eventsError:
              eventsResult.status === "rejected"
                ? eventsResult.reason
                : null,
          });
          // No mostramos el error al usuario; simplemente dejamos 0s.
        }

        const groups =
          groupsResult.status === "fulfilled" ? groupsResult.value : [];
        const rawEvents =
          eventsResult.status === "fulfilled" ? eventsResult.value : [];

        const groupTypeById = new Map<string, GroupType>(
          (groups || []).map((g: any) => {
            const id = String(g.id);
            const rawType = String(g.type ?? "").toLowerCase();
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
        if (alive) {
          setErrorMsg(
            "No pudimos cargar tu resumen. Intenta de nuevo en unos segundos."
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Feedback post-conflictos (solo lectura de query string, sin useSearchParams)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const from = sp.get("from");
    const resolvedRaw = sp.get("resolved");

    if (from === "conflicts") {
      const n = resolvedRaw ? Number(resolvedRaw) : NaN;
      const resolvedCount = Number.isFinite(n) && n > 0 ? n : undefined;

      setFeedback({
        fromConflicts: true,
        resolvedCount,
      });

      // Limpiamos la URL para que el mensaje no quede pegado a futuras visitas
      sp.delete("from");
      sp.delete("resolved");
      const cleaned = sp.toString();
      const newUrl = cleaned
        ? `${window.location.pathname}?${cleaned}`
        : window.location.pathname;
      window.history.replaceState(null, "", newUrl);
    }
  }, []);

  const now = Date.now();
  const in7 = now + 7 * 24 * 60 * 60 * 1000;
  const in30 = now + 30 * 24 * 60 * 60 * 1000;

  const upcoming = useMemo(() => {
    return events
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.start).getTime() - new Date(b.start).getTime()
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

  const conflictsHighlight =
    upcomingConflicts.length > 0 || feedback.fromConflicts;

  const conflictsHint =
    upcomingConflicts.length === 0
      ? feedback.fromConflicts
        ? feedback.resolvedCount && feedback.resolvedCount > 0
          ? "Se aplicaron tus decisiones de conflicto."
          : "Se actualizaron los conflictos pendientes."
        : "Todo en orden. No hay eventos que se crucen."
      : "Tienes eventos que se cruzan entre sí. Revísalos para ajustar tu agenda.";

  return (
    <main style={S.page}>
      <div style={S.shell}>
        {/* 🔝 Solo el header global, sin botones duplicados */}
        <div style={S.topRow}>
          <PremiumHeader />
        </div>

        {/* Onboarding ligero reutilizable (ahora depende de si hay eventos o no) */}
        <SummaryOnboardingBanner hasEvents={hasAny} />

        {/* Feedback sutil post-conflictos */}
        {feedback.fromConflicts && (
          <div style={S.feedbackBox}>
            <span style={S.feedbackDot} />
            <span style={S.feedbackText}>
              Tus cambios de conflicto ya se aplicaron al calendario.
            </span>
          </div>
        )}

        <section style={S.heroCard}>
          <div>
            <div style={S.badge}>Resumen</div>
            <h1 style={S.title}>Tu agenda en una sola mirada</h1>
            <p style={S.subtitle}>
              Aquí ves cuántos planes tienes pronto, si algo se cruza y cuál
              es tu próximo evento importante.
            </p>
          </div>
          <div style={S.heroStats}>
            <HeroStat
              label="Próximos 7 días"
              value={next7.length}
              hint="Eventos en la próxima semana."
            />
            <HeroStat
              label="Próximos 30 días"
              value={next30.length}
              hint="Eventos en el próximo mes."
            />
            <HeroStat
              label="Conflictos detectados"
              value={upcomingConflicts.length}
              hint={conflictsHint}
              highlight={conflictsHighlight}
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
                description="Planes que solo dependen de ti."
                count={perType.personal}
                meta={groupMeta("personal")}
              />
              <TypeRow
                typeLabel="Pareja"
                description="Planes que compartes con tu pareja."
                count={perType.pair}
                meta={groupMeta("pair")}
              />
              <TypeRow
                typeLabel="Familia"
                description="Planes donde se mueve toda la familia."
                count={perType.family}
                meta={groupMeta("family")}
              />
            </div>

            <div style={S.tipBox}>
              <div style={S.tipTitle}>Consejo rápido</div>
              <p style={S.tipBody}>
                Si ves un día muy cargado, abre el calendario y usa el botón{" "}
                <strong>Conflictos</strong> para decidir qué se queda y qué se
                mueve.
              </p>
            </div>
          </div>

          <div style={S.cardRight}>
            <h2 style={S.cardTitle}>Lo que viene</h2>
            <p style={S.cardSub}>
              Tus próximos eventos, empezando por el más cercano.
            </p>

            {!hasAny ? (
              <div style={S.emptyBox}>
                <div style={S.emptyTitle}>Todavía no tienes eventos</div>
                <div style={S.emptySub}>
                  Crea tu primer evento y aquí verás un resumen automático de
                  tu semana.
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
                <div style={S.emptyTitle}>
                  No hay eventos en los próximos días
                </div>
                <div style={S.emptySub}>
                  Tu agenda está tranquila. Es un buen momento para planear
                  algo que te provoque.
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
          ? "rgba(34,197,94,0.8)"
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

/* ────────────── Estilos inline ────────────── */

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050816",
    color: "rgba(248,250,252,0.98)",
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
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  feedbackBox: {
    marginBottom: 10,
    marginTop: 2,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(34,197,94,0.5)",
    background: "rgba(22,163,74,0.15)",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  },
  feedbackDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "rgba(34,197,94,0.9)",
  },
  feedbackText: {
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(220,252,231,0.95)",
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
