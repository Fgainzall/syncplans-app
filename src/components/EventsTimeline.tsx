// src/components/EventsTimeline.tsx
"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";

import { type CalendarEvent, groupMeta } from "@/lib/conflicts";
import { deleteEventsByIds } from "@/lib/eventsDb";

type Props = {
  events: CalendarEvent[];
};

export default function EventsTimeline({ events }: Props) {
  const router = useRouter();

  const sorted = useMemo(() => {
    return [...events].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }, [events]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of sorted) {
      const d = new Date(ev.start);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [sorted]);

  async function onDelete(id: string) {
    if (!confirm("¿Eliminar este evento?")) return;
    await deleteEventsByIds([id]); // 🔒 RLS-safe
    router.refresh();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {groupedByDay.map(([dayKey, dayEvents]) => {
        const d = new Date(dayEvents[0].start);
        const dayLabel = d.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        });

        return (
          <section
            key={dayKey}
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              padding: 14,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 14,
                marginBottom: 10,
                opacity: 0.9,
              }}
            >
              {dayLabel}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEvents.map((ev) => {
                const meta = groupMeta(ev.groupType);

                const start = new Date(ev.start).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const end = new Date(ev.end).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={ev.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(6,10,20,0.55)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          background: meta.dot,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 900,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ev.title}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                          }}
                        >
                          {start} – {end} · {meta.label}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() =>
                          router.push(`/events/new/details?edit=${ev.id}`)
                        }
                        style={iconBtn}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => onDelete(ev.id)}
                        style={iconBtn}
                        title="Eliminar"
                      >
                        🗑️
                      </button>
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

const iconBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 10,
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: 13,
};
