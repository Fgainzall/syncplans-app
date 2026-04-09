
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import {
  deleteEventsByIdsDetailed,
  generatePublicInviteLink,
} from "@/lib/eventsDb";
import EventTimelineCard from "./EventTimelineCard";
import { useEventsTimelineData } from "./useEventsTimelineData";
import {
  getDayHeaderLabel,
  humanizeShareError,
  localDateKey,
  type TimelineEvent,
} from "./eventsTimelineHelpers";

type Props = {
  events: TimelineEvent[];
  selectedIds: Set<string>;
  focusedEventId?: string | null;
  onToggleSelected: (id: string) => void;
  onEventsRemoved?: (removedIds: string[]) => void;
};

type ShareState = {
  loading: boolean;
  link: string | null;
  error: string | null;
  copied: boolean;
};

export default function EventsTimeline({
  events,
  selectedIds,
  focusedEventId = null,
  onToggleSelected,
  onEventsRemoved,
}: Props) {
  const router = useRouter();

  const shareRequestRef = useRef<Partial<Record<string, Promise<string | null>>>>({});
  const eventRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [shareStateById, setShareStateById] = useState<Record<string, ShareState>>(
    {}
  );

  const {
    currentUserId,
    inviteStateByEventId,
    inviteStatesLoading,
    trustSignalsByEventId,
    proposalResponsesByEventId,
    proposalResponseGroupsByEventId,
    proposalProfilesById,
    conflictsByEventId,
    refreshTick,
  } = useEventsTimelineData(events);

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
  }, [sorted, refreshTick]);

  useEffect(() => {
    if (!focusedEventId) return;

    const timer = window.setTimeout(() => {
      const node = eventRefs.current[String(focusedEventId)];
      if (!node) return;

      node.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 220);

    return () => window.clearTimeout(timer);
  }, [focusedEventId, groupedByDay]);

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

    if (shareRequestRef.current[eventId]) {
      return shareRequestRef.current[eventId]!;
    }

    setShareStateById((prev) => ({
      ...prev,
      [eventId]: {
        loading: true,
        link: prev[eventId]?.link ?? null,
        error: null,
        copied: false,
      },
    }));

    const request = (async () => {
      try {
        const { invite, link } = await generatePublicInviteLink(eventId);

        await trackEvent({
          event: "invite_created",
          userId: currentUserId,
          entityId: invite?.id ? String(invite.id) : eventId,
          metadata: {
            source: "timeline_share",
            eventId,
          },
        });

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
            link: prev[eventId]?.link ?? null,
            error: humanizeShareError(
              e,
              "No se pudo generar el link para compartir este evento."
            ),
            copied: false,
          },
        }));
        return null;
      } finally {
        delete shareRequestRef.current[eventId];
      }
    })();

    shareRequestRef.current[eventId] = request;
    return request;
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
          error:
            "No se pudo copiar automáticamente. Copia el link manualmente.",
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

    const text = `Oye, pensé esto 👇

${ev.title || "Evento"}

Lo vemos aquí:
${link}`;
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
                const eventId = String(ev.id);

                return (
                  <EventTimelineCard
                    key={eventId}
                    ev={ev}
                    checked={selectedIds.has(eventId)}
                    focused={focusedEventId === eventId}
                    currentUserId={currentUserId}
                    onToggleSelected={onToggleSelected}
                    onDelete={onDelete}
                    onCreateShareLink={onCreateShareLink}
                    onCopyLink={onCopyLink}
                    onWhatsApp={onWhatsApp}
                    onCloseShare={onCloseShare}
                    router={router}
                    shareState={shareStateById[eventId]}
                    invite={inviteStateByEventId[eventId] ?? null}
                    inviteStatesLoading={inviteStatesLoading}
                    trustSignal={trustSignalsByEventId[eventId] ?? null}
                    proposalResponse={proposalResponsesByEventId[eventId] ?? null}
                    proposalResponseGroup={
                      proposalResponseGroupsByEventId[eventId] ?? []
                    }
                    proposalProfile={
                      proposalProfilesById[
                        String(proposalResponsesByEventId[eventId]?.user_id ?? "")
                      ] ?? null
                    }
                    conflictsCount={(conflictsByEventId[eventId] ?? []).length}
                    eventRef={(node) => {
                      eventRefs.current[eventId] = node;
                    }}
                  />
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
    gap: 16,
    marginTop: 12,
  },
  daySection: {
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.032)",
    padding: 15,
    boxShadow: "0 16px 40px rgba(0,0,0,0.14)",
  },
  dayHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  dayTitle: {
    fontWeight: 900,
    fontSize: 15,
    color: "rgba(255,255,255,0.95)",
    textTransform: "capitalize",
    letterSpacing: "-0.01em",
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
    gap: 10,
  },
};