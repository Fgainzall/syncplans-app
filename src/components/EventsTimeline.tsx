// src/components/EventsTimeline.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { deleteEventsByIds, generatePublicInviteLink } from "@/lib/eventsDb";

type TimelineEvent = {
  id: string;
  title?: string | null;
  notes?: string | null;
  start: string;
  end: string;
  group_id?: string | null;
  external_source?: string | null;
  external_id?: string | null;
  group?: {
    id?: string;
    name?: string | null;
    type?: string | null;
  } | null;
};

type Props = {
  events: TimelineEvent[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
};

type ShareState = {
  loading: boolean;
  link: string | null;
  error: string | null;
  copied: boolean;
};

function localDateKey(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfTomorrow() {
  const today = startOfToday();
  const next = new Date(today);
  next.setDate(today.getDate() + 1);
  return next;
}

function startOfNextWeekBoundary() {
  const today = startOfToday();
  const next = new Date(today);
  next.setDate(today.getDate() + 7);
  return next;
}

function getDayHeaderLabel(value: string | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const today = startOfToday();
  const tomorrow = startOfTomorrow();
  const nextWeek = startOfNextWeekBoundary();

  if (dateOnly.getTime() === today.getTime()) return "Hoy";
  if (dateOnly.getTime() === tomorrow.getTime()) return "Mañana";
  if (dateOnly > tomorrow && dateOnly < nextWeek) return "Esta semana";

  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getGroupSignal(ev: TimelineEvent) {
  const rawType = String(ev.group?.type ?? "").toLowerCase();

  if (!ev.group_id) {
    return {
      label: "Personal",
      dot: "rgba(56,189,248,0.98)",
      badgeBg: "rgba(8,47,73,0.9)",
      badgeBorder: "rgba(56,189,248,0.28)",
      badgeText: "rgba(186,230,253,0.98)",
    };
  }

  if (rawType === "pair" || rawType === "couple") {
    return {
      label: "Pareja",
      dot: "rgba(244,114,182,0.98)",
      badgeBg: "rgba(80,7,36,0.9)",
      badgeBorder: "rgba(244,114,182,0.28)",
      badgeText: "rgba(251,207,232,0.98)",
    };
  }

  if (rawType === "family") {
    return {
      label: "Familia",
      dot: "rgba(56,189,248,0.98)",
      badgeBg: "rgba(8,47,73,0.9)",
      badgeBorder: "rgba(56,189,248,0.28)",
      badgeText: "rgba(186,230,253,0.98)",
    };
  }

  return {
    label: "Compartido",
    dot: "rgba(167,139,250,0.98)",
    badgeBg: "rgba(46,16,101,0.9)",
    badgeBorder: "rgba(167,139,250,0.28)",
    badgeText: "rgba(221,214,254,0.98)",
  };
}

function getExternalLabel(ev: TimelineEvent) {
  if (!ev.external_source) return null;

  if (ev.external_source.toLowerCase() === "google") return "Google";
  return "Externo";
}

function clientBaseUrl() {
  const env = String(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  )
    .trim()
    .replace(/\/$/, "");

  if (env) return env;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function buildWhatsAppText(ev: TimelineEvent, link: string) {
  const start = new Date(ev.start);
  const startLabel = start.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `Te comparto este plan de SyncPlans: ${ev.title || "Evento"} (${startLabel}). Puedes responder aquí: ${link}`;
}

export default function EventsTimeline({
  events,
  selectedIds,
  onToggleSelected,
}: Props) {
  const router = useRouter();
  const [shareStateById, setShareStateById] = useState<Record<string, ShareState>>(
    {}
  );

  const sorted = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [events]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>();

    for (const ev of sorted) {
      const key = localDateKey(ev.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }

    return Array.from(map.entries()).map(([dayKey, dayEvents]) => ({
      dayKey,
      dayEvents,
    }));
  }, [sorted]);

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    await deleteEventsByIds([id]);
    router.refresh();
  }

  async function onCreateShareLink(ev: TimelineEvent): Promise<string | null> {
    const eventId = String(ev.id);

    setShareStateById((prev) => ({
      ...prev,
      [eventId]: {
        loading: true,
        link: prev[eventId]?.link ?? null,
        error: null,
        copied: false,
      },
    }));

    try {
const { link } = await generatePublicInviteLink(eventId);

      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link,
          error: null,
          copied: false,
        },
      }));

      return link;
    } catch (e: any) {
      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link: null,
          error:
            e?.message ||
            "No se pudo generar el link para compartir este evento.",
          copied: false,
        },
      }));
      return null;
    }
  }

  async function onCopyLink(ev: TimelineEvent) {
    const eventId = String(ev.id);
    const shareState = shareStateById[eventId];
    let link = shareState?.link ?? null;

    if (!link) {
      link = await onCreateShareLink(ev);
      if (!link) return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const input = document.createElement("textarea");
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }

      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link,
          error: null,
          copied: true,
        },
      }));
    } catch {
      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link,
          error: "No se pudo copiar automáticamente. Copia el link manualmente.",
          copied: false,
        },
      }));
    }
  }

  async function onWhatsApp(ev: TimelineEvent) {
    const eventId = String(ev.id);
    let link = shareStateById[eventId]?.link ?? null;

    if (!link) {
      link = await onCreateShareLink(ev);
    }

    if (!link) return;

    const text = buildWhatsAppText(ev, link);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function onCloseShare(eventId: string) {
    setShareStateById((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });
  }

  return (
    <div style={S.wrapper}>
      {groupedByDay.map(({ dayKey, dayEvents }) => {
        const firstDate = new Date(dayEvents[0].start);
        const dayLabel = getDayHeaderLabel(firstDate);

        return (
          <section key={dayKey} style={S.daySection}>
            <div style={S.dayHeader}>
              <div style={S.dayTitle}>{dayLabel}</div>
              <div style={S.dayCount}>
                {dayEvents.length} evento{dayEvents.length === 1 ? "" : "s"}
              </div>
            </div>

            <div style={S.dayList}>
              {dayEvents.map((ev) => {
                const signal = getGroupSignal(ev);
                const externalLabel = getExternalLabel(ev);
                const eventId = String(ev.id);
                const shareState = shareStateById[eventId];

                const start = new Date(ev.start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const end = new Date(ev.end).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const checked = selectedIds.has(eventId);

                return (
                  <div key={eventId} style={S.eventRow}>
                    <label style={S.checkWrap}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleSelected(eventId)}
                        style={S.checkbox}
                      />
                    </label>

                    <div style={S.eventMain}>
                      <div style={S.titleRow}>
                        <div style={S.titleWrap}>
                          <span
                            style={{
                              ...S.dot,
                              background: signal.dot,
                            }}
                          />
                          <div style={S.titleBlock}>
                            <div style={S.titleText}>{ev.title || "Sin título"}</div>

                            <div style={S.metaLine}>
                              <span>
                                {start} – {end}
                              </span>
                              {ev.group?.name ? <span>· {ev.group.name}</span> : null}
                            </div>
                          </div>
                        </div>

                        <div style={S.actions}>
                          <button
                            onClick={() => onCreateShareLink(ev)}
                            style={iconBtn}
                            title="Compartir"
                            type="button"
                            disabled={shareState?.loading}
                          >
                            {shareState?.loading ? "…" : "🔗"}
                          </button>
                          <button
                            onClick={() =>
                              router.push(`/events/new/details?eventId=${eventId}`)
                            }
                            style={iconBtn}
                            title="Editar"
                            type="button"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => onDelete(eventId)}
                            style={iconBtn}
                            title="Eliminar"
                            type="button"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div style={S.signalsRow}>
                        <span
                          style={{
                            ...S.signalBadge,
                            background: signal.badgeBg,
                            borderColor: signal.badgeBorder,
                            color: signal.badgeText,
                          }}
                        >
                          {signal.label}
                        </span>

                        {externalLabel && (
                          <span
                            style={{
                              ...S.signalBadge,
                              background: "rgba(22,78,99,0.9)",
                              borderColor: "rgba(103,232,249,0.22)",
                              color: "rgba(207,250,254,0.98)",
                            }}
                          >
                            {externalLabel}
                          </span>
                        )}
                      </div>

                      {(shareState?.loading || shareState?.link || shareState?.error) && (
                        <div style={S.sharePanel}>
                          <div style={S.sharePanelHeader}>
                            <div>
                              <div style={S.shareKicker}>Invitación externa</div>
                              <div style={S.shareTitle}>Compartir este plan</div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onCloseShare(eventId)}
                              style={S.shareCloseBtn}
                            >
                              Cerrar
                            </button>
                          </div>

                          {shareState.loading ? (
                            <div style={S.shareStatus}>Generando link…</div>
                          ) : shareState.error ? (
                            <div style={S.shareError}>{shareState.error}</div>
                          ) : shareState.link ? (
                            <>
                              <div style={S.shareStatus}>
                                Link listo. Puedes copiarlo o enviarlo por WhatsApp.
                              </div>

                              <div style={S.shareLinkBox}>{shareState.link}</div>

                              <div style={S.shareActionsRow}>
                                <button
                                  type="button"
                                  onClick={() => onCopyLink(ev)}
                                  style={S.sharePrimaryBtn}
                                >
                                  {shareState.copied ? "Link copiado" : "Copiar link"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => onWhatsApp(ev)}
                                  style={S.shareSecondaryBtn}
                                >
                                  Enviar por WhatsApp
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginTop: 12,
  },
  daySection: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: 14,
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  dayTitle: {
    fontWeight: 900,
    fontSize: 14,
    color: "rgba(255,255,255,0.94)",
    textTransform: "capitalize",
  },
  dayCount: {
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(148,163,184,0.95)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dayList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  eventRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(6,10,20,0.55)",
  },
  checkWrap: {
    display: "flex",
    alignItems: "flex-start",
    paddingTop: 2,
  },
  checkbox: {
    width: 16,
    height: 16,
    cursor: "pointer",
  },
  eventMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  titleWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    minWidth: 0,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: 5,
    flexShrink: 0,
  },
  titleBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  titleText: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metaLine: {
    fontSize: 12,
    color: "rgba(203,213,225,0.78)",
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
  },
  signalsRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
  },
  signalBadge: {
    borderRadius: 999,
    border: "1px solid transparent",
    padding: "4px 8px",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
  },
  sharePanel: {
    marginTop: 4,
    borderRadius: 14,
    border: "1px solid rgba(103,232,249,0.18)",
    background:
      "linear-gradient(180deg, rgba(6,182,212,0.10), rgba(15,23,42,0.50))",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  sharePanelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  shareKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(125,211,252,0.92)",
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
  },
  shareCloseBtn: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(226,232,240,0.95)",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 10px",
    cursor: "pointer",
  },
  shareStatus: {
    fontSize: 12,
    color: "rgba(226,232,240,0.88)",
  },
  shareError: {
    fontSize: 12,
    color: "rgba(252,165,165,0.98)",
    fontWeight: 700,
  },
  shareLinkBox: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.55)",
    color: "rgba(224,242,254,0.96)",
    fontSize: 12,
    lineHeight: 1.45,
    padding: "10px 12px",
    wordBreak: "break-all",
  },
  shareActionsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  sharePrimaryBtn: {
    borderRadius: 999,
    border: "1px solid rgba(103,232,249,0.28)",
    background: "rgba(6,182,212,0.18)",
    color: "rgba(236,254,255,0.98)",
    fontSize: 12,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
  shareSecondaryBtn: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
};

const iconBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 10,
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: 13,
};