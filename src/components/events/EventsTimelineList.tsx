// src/components/events/EventsTimelineList.tsx
"use client";

import React, { type CSSProperties } from "react";
import { groupMeta } from "@/lib/conflicts";
import { getGroupTypeLabel, type GroupRow } from "@/lib/groupsDb";
import { type DbEventRow } from "@/lib/eventsDb";

type EventWithGroup = DbEventRow & {
  group?: GroupRow | null;
};

type GroupedByDate = {
  dateKey: string;
  events: EventWithGroup[];
};

type EventsTimelineListProps = {
  groupedByDate: GroupedByDate[];
  selectedIds: Set<string>;
  onToggleSelected: (id: string) => void;
};

export default function EventsTimelineList({
  groupedByDate,
  selectedIds,
  onToggleSelected,
}: EventsTimelineListProps) {
  if (!groupedByDate.length) return null;

  return (
    <div style={S.list} className="spEvt-list">
      {groupedByDate.map(({ dateKey, events }) => (
        <div
          key={dateKey}
          style={S.section}
          className="spEvt-section"
        >
          <div style={S.sectionHeader}>
            <div style={S.sectionDate}>{formatDateNice(dateKey)}</div>
            <div style={S.sectionCount}>
              {events.length} evento
              {events.length === 1 ? "" : "s"}
            </div>
          </div>

          <div style={S.sectionBody}>
            {events.map((e) => (
              <EventRow
                key={e.id}
                e={e}
                selected={selectedIds.has(String(e.id))}
                toggleSelection={onToggleSelected}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========== EventRow ==========

function EventRow({
  e,
  selected,
  toggleSelection,
}: {
  e: EventWithGroup;
  selected: boolean;
  toggleSelection: (id: string) => void;
}) {
  const meta = groupMeta(
    e.group_id ? (e.group?.type as any) ?? "pair" : "personal",
  );

  const start = new Date(e.start);
  const end = new Date(e.end);

  const timeLabel =
    start.toDateString() === end.toDateString()
      ? `${formatTime(start)} — ${formatTime(end)}`
      : `${formatDateShort(start)} ${formatTime(
          start,
        )} → ${formatDateShort(end)} ${formatTime(end)}`;

  return (
    <div style={S.eventRow} className="spEvt-row">
      <button
        type="button"
        onClick={() => toggleSelection(String(e.id))}
        style={{
          ...S.checkbox,
          ...(selected ? S.checkboxOn : {}),
        }}
        aria-pressed={selected}
      >
        {selected ? "✓" : ""}
      </button>

      <div
        style={{
          ...S.eventCard,
          borderColor: selected
            ? "rgba(56,189,248,0.55)"
            : (S.eventCard.border as string),
          boxShadow: selected
            ? "0 0 0 1px rgba(56,189,248,0.35)"
            : (S.eventCard.boxShadow as string),
        }}
      >
        <div style={S.eventTop}>
          <div style={S.eventTitleRow}>
            <div style={S.eventDotWrap}>
              <span
                style={{
                  ...S.eventDot,
                  background: meta.dot,
                }}
              />
            </div>
            <div>
              <div style={S.eventTitle}>
                {e.title || "Sin título"}
              </div>
              <div style={S.eventGroup}>
                {e.group_id
                  ? getGroupTypeLabel(e.group?.type as any)
                  : "Personal"}
                {e.group?.name ? ` • ${e.group.name}` : ""}
              </div>
            </div>
          </div>

          <div style={S.eventTime}>{timeLabel}</div>
        </div>

        {e.notes && (
          <div style={S.eventNotes}>{e.notes}</div>
        )}
      </div>
    </div>
  );
}

// ========== Helpers de formato (copiados de /events) ==========

function formatDateNice(isoDateKey: string) {
  const d = new Date(isoDateKey);
  const formatter = new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return formatter.format(d);
}

function formatDateShort(d: Date) {
  const formatter = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  });
  return formatter.format(d);
}

function formatTime(d: Date) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// ========== Estilos (subconjunto de S original) ==========

const S: Record<string, CSSProperties> = {
  list: {
    marginTop: 10,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  section: {
    borderRadius: 18,
    border: "1px solid rgba(31,41,55,0.95)",
    background: "rgba(17,24,39,0.96)",
    padding: 10,
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  sectionDate: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(243,244,246,0.98)",
  },
  sectionCount: {
    fontSize: 12,
    color: "rgba(156,163,175,0.96)",
  },
  sectionBody: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  eventRow: {
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    border: "1px solid rgba(148,163,184,0.75)",
    background: "rgba(15,23,42,0.96)",
    color: "white",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxOn: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.95), rgba(56,189,248,0.95))",
    borderColor: "transparent",
  },
  eventCard: {
    flex: 1,
    borderRadius: 14,
    border: "1px solid rgba(31,41,55,0.98)",
    background:
      "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.16), transparent 55%), rgba(15,23,42,0.98)",
    padding: "10px 11px",
    boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
  },
  eventTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  eventTitleRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  },
  eventDotWrap: {
    marginTop: 3,
  },
  eventDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: 900,
  },
  eventGroup: {
    marginTop: 2,
    fontSize: 12,
    color: "rgba(156,163,175,0.96)",
  },
  eventTime: {
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
    fontWeight: 700,
  },
  eventNotes: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(209,213,219,0.96)",
  },
};