// src/components/EventsTimeline.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import supabase from "@/lib/supabaseClient";
import { deleteEventsByIdsDetailed, generatePublicInviteLink } from "@/lib/eventsDb";
import {
  getLatestPublicInvitesByEventIds,
  type PublicInviteRow,
} from "@/lib/invitationsDb";

type TimelineEvent = {
  id: string;
  user_id?: string | null;
  owner_id?: string | null;
  created_by?: string | null;
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
  onEventsRemoved?: (removedIds: string[]) => void;
};

type ShareState = {
  loading: boolean;
  link: string | null;
  error: string | null;
  copied: boolean;
};

type InviteStateByEventId = Record<string, PublicInviteRow | null>;

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

function formatProposedDate(value: string | null | undefined) {
  if (!value) return null;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInvitePresentation(invite: PublicInviteRow | null) {
  if (!invite) {
    return {
      label: "Sin respuesta todavía",
      tone: "neutral" as const,
      detail: "Aún no hay una respuesta registrada para este link.",
    };
  }

  if (invite.status === "pending") {
    return {
      label: "Pendiente",
      tone: "pending" as const,
      detail: "El link fue compartido, pero todavía no hubo respuesta.",
    };
  }

  if (invite.status === "accepted") {
    return {
      label: "Aceptado",
      tone: "accepted" as const,
      detail: "La persona externa confirmó este plan.",
    };
  }

  if (invite.status === "rejected" && invite.proposed_date) {
    return {
      label: "Propuso nueva fecha",
      tone: "proposed" as const,
      detail: "La persona rechazó el horario original y sugirió otra fecha.",
    };
  }

  return {
    label: "Rechazado",
    tone: "rejected" as const,
    detail: "La persona externa rechazó este plan.",
  };
}

function getInviteBadgeStyle(tone: "neutral" | "pending" | "accepted" | "rejected" | "proposed"): React.CSSProperties {
  switch (tone) {
    case "pending":
      return {
        background: "rgba(120,53,15,0.85)",
        borderColor: "rgba(251,191,36,0.24)",
        color: "rgba(254,243,199,0.98)",
      };
    case "accepted":
      return {
        background: "rgba(20,83,45,0.9)",
        borderColor: "rgba(74,222,128,0.24)",
        color: "rgba(220,252,231,0.98)",
      };
    case "rejected":
      return {
        background: "rgba(127,29,29,0.9)",
        borderColor: "rgba(252,165,165,0.24)",
        color: "rgba(254,226,226,0.98)",
      };
    case "proposed":
      return {
        background: "rgba(49,46,129,0.9)",
        borderColor: "rgba(165,180,252,0.24)",
        color: "rgba(224,231,255,0.98)",
      };
    default:
      return {
        background: "rgba(15,23,42,0.72)",
        borderColor: "rgba(148,163,184,0.18)",
        color: "rgba(226,232,240,0.94)",
      };
  }
}

function resolveEventOwnerId(event: TimelineEvent | null | undefined): string {
  return String(event?.owner_id ?? event?.user_id ?? event?.created_by ?? "").trim();
}

export default function EventsTimeline({
  events,
  selectedIds,
  onToggleSelected,
  onEventsRemoved,
}: Props) {
  const router = useRouter();

  const [shareStateById, setShareStateById] = useState<Record<string, ShareState>>(
    {}
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [inviteStateByEventId, setInviteStateByEventId] =
    useState<InviteStateByEventId>({});
  const [inviteStatesLoading, setInviteStatesLoading] = useState(false);

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

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) {
        console.error("[EventsTimeline] getUser error", error);
        return;
      }

      setCurrentUserId(data.user?.id ?? null);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInviteStates() {
      const eventIds = Array.from(
        new Set(
          sorted
            .map((ev) => String(ev.id ?? "").trim())
            .filter(Boolean)
        )
      );

      if (eventIds.length === 0) {
        setInviteStateByEventId({});
        return;
      }

      try {
        setInviteStatesLoading(true);
        const data = await getLatestPublicInvitesByEventIds(eventIds);

        if (!cancelled) {
          setInviteStateByEventId(data);
        }
      } catch (error) {
        console.error("[EventsTimeline] loadInviteStates error", error);
        if (!cancelled) {
          const fallback: InviteStateByEventId = {};
          for (const id of eventIds) fallback[id] = null;
          setInviteStateByEventId(fallback);
        }
      } finally {
        if (!cancelled) {
          setInviteStatesLoading(false);
        }
      }
    }

    loadInviteStates();

    return () => {
      cancelled = true;
    };
  }, [sorted]);

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;

    try {
      const result = await deleteEventsByIdsDetailed([id]);

      if (result.deletedCount === 1) {
        onEventsRemoved?.([id]);
        return;
      }

      if (result.blockedIds.length > 0) {
        window.alert(
          "No pudiste eliminar ese evento con tu sesión actual. Puede pertenecer a otra persona o no estar permitido por permisos."
        );
        return;
      }

      window.alert(
        "El evento no se eliminó realmente. La lista no se actualizó como si hubiera salido bien."
      );
    } catch (error: any) {
      console.error("[EventsTimeline] delete error", error);
      window.alert(
        error?.message ||
          "No se pudo eliminar este evento. Revisa tus permisos o vuelve a intentar."
      );
    }
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
      const { invite, link } = await generatePublicInviteLink(eventId);

      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link,
          error: null,
          copied: false,
        },
      }));

      setInviteStateByEventId((prev) => ({
        ...prev,
        [eventId]: invite ?? prev[eventId] ?? null,
      }));

      return link;
    } catch (e: any) {
      setShareStateById((prev) => ({
        ...prev,
        [eventId]: {
          loading: false,
          link: prev[eventId]?.link ?? null,
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
                const invite = inviteStateByEventId[eventId] ?? null;
                const invitePresentation = getInvitePresentation(invite);

                const start = new Date(ev.start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const end = new Date(ev.end).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                const checked = selectedIds.has(eventId);
                const isShareOpen =
                  !!shareState?.loading || !!shareState?.link || !!shareState?.error;
                const isOwnerView =
                  !!currentUserId && resolveEventOwnerId(ev) === currentUserId;
                const canDelete = isOwnerView;

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
                          {isOwnerView ? (
                            <button
                              onClick={() => onCreateShareLink(ev)}
                              style={isShareOpen ? activeIconBtn : iconBtn}
                              title="Compartir"
                              type="button"
                              disabled={shareState?.loading}
                            >
                              {shareState?.loading ? "…" : "🔗"}
                            </button>
                          ) : null}

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

                          {canDelete ? (
                            <button
                              onClick={() => onDelete(eventId)}
                              style={iconBtn}
                              title="Eliminar"
                              type="button"
                            >
                              🗑️
                            </button>
                          ) : null}
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

                        {isOwnerView ? (
                          <span
                            style={{
                              ...S.signalBadge,
                              ...getInviteBadgeStyle(invitePresentation.tone),
                            }}
                          >
                            {invitePresentation.label}
                          </span>
                        ) : invite ? (
                          <span
                            style={{
                              ...S.signalBadge,
                              background: "rgba(30,41,59,0.88)",
                              borderColor: "rgba(148,163,184,0.18)",
                              color: "rgba(226,232,240,0.96)",
                            }}
                          >
                            Invitación recibida
                          </span>
                        ) : null}
                      </div>

                      {isOwnerView && (shareState?.loading || shareState?.link || shareState?.error) && (
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

                          {inviteStatesLoading && !invite ? (
                            <div style={S.shareSubtle}>Cargando estado actual…</div>
                          ) : null}

                          <div style={S.inviteStatusCard}>
                            <div style={S.inviteStatusTopRow}>
                              <div style={S.inviteStatusLabelWrap}>
                                <div style={S.inviteStatusKicker}>Estado actual</div>
                                <div style={S.inviteStatusText}>
                                  {invitePresentation.label}
                                </div>
                              </div>

                              <span
                                style={{
                                  ...S.signalBadge,
                                  ...getInviteBadgeStyle(invitePresentation.tone),
                                }}
                              >
                                {invitePresentation.label}
                              </span>
                            </div>

                            <div style={S.inviteStatusDetail}>
                              {invitePresentation.detail}
                            </div>

                            {invite?.message ? (
                              <div style={S.inviteMetaBlock}>
                                <div style={S.inviteMetaTitle}>Mensaje</div>
                                <div style={S.inviteMetaValue}>{invite.message}</div>
                              </div>
                            ) : null}

                            {invite?.proposed_date ? (
                              <div style={S.inviteMetaBlock}>
                                <div style={S.inviteMetaTitle}>Fecha propuesta</div>
                                <div style={S.inviteMetaValue}>
                                  {formatProposedDate(invite.proposed_date)}
                                </div>
                              </div>
                            ) : null}
                          </div>

                          {shareState.loading ? (
                            <div style={S.shareStatus}>Generando link…</div>
                          ) : shareState.error ? (
                            <div style={S.shareError}>{shareState.error}</div>
                          ) : shareState.link ? (
                            <>
                              <div style={S.shareStatus}>
                                Este es el link activo de este plan. Puedes copiarlo o
                                enviarlo por WhatsApp.
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
                          ) : (
                            <div style={S.shareSubtle}>
                              Genera el link para compartir este plan externamente.
                            </div>
                          )}
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
  shareSubtle: {
    fontSize: 12,
    color: "rgba(191,219,254,0.86)",
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
  inviteStatusCard: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.42)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  inviteStatusTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  inviteStatusLabelWrap: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  inviteStatusKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(148,163,184,0.95)",
  },
  inviteStatusText: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
  },
  inviteStatusDetail: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.9)",
  },
  inviteMetaBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  inviteMetaTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(125,211,252,0.9)",
  },
  inviteMetaValue: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(240,249,255,0.95)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
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

const activeIconBtn: React.CSSProperties = {
  ...iconBtn,
  border: "1px solid rgba(96,165,250,0.28)",
  background: "rgba(59,130,246,0.12)",
  boxShadow: "0 10px 24px rgba(59,130,246,0.16)",
};