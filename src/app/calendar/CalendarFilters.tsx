// src/app/calendar/CalendarFilters.tsx
"use client";

import React from "react";
import { type GroupType, groupMeta } from "@/lib/conflicts";

type Scope = "personal" | "active" | "all";
type Tab = "month" | "agenda";

type CalendarFiltersProps = {
  tab: Tab;
  scope: Scope;
  onChangeTab: (tab: Tab) => void;
  onChangeScope: (scope: Scope) => void;
  enabledGroups: {
    personal: boolean;
    pair: boolean;
    family: boolean;
  };
  onToggleGroup: (g: GroupType) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export function CalendarFilters({
  tab,
  scope,
  onChangeTab,
  onChangeScope,
  enabledGroups,
  onToggleGroup,
  onPrevMonth,
  onNextMonth,
  onToday,
}: CalendarFiltersProps) {
  return (
    <section style={styles.filtersCard}>
      <div style={styles.filtersRow}>
        {/* Selector Mes / Agenda */}
        <div style={styles.segment}>
          <button
            onClick={() => onChangeTab("month")}
            style={{
              ...styles.segmentBtn,
              ...(tab === "month" ? styles.segmentOn : {}),
            }}
          >
            Mes
          </button>
          <button
            onClick={() => onChangeTab("agenda")}
            style={{
              ...styles.segmentBtn,
              ...(tab === "agenda" ? styles.segmentOn : {}),
            }}
          >
            Agenda
          </button>
        </div>

        {/* Selector Alcance: Activo / Personal / Todo */}
        <div style={styles.segment}>
          <button
            onClick={() => onChangeScope("active")}
            style={{
              ...styles.segmentBtn,
              ...(scope === "active" ? styles.segmentOn : {}),
            }}
            title="Personal + grupo activo + conflictos"
          >
            Activo
          </button>
          <button
            onClick={() => onChangeScope("personal")}
            style={{
              ...styles.segmentBtn,
              ...(scope === "personal" ? styles.segmentOn : {}),
            }}
          >
            Personal
          </button>
          <button
            onClick={() => onChangeScope("all")}
            style={{
              ...styles.segmentBtn,
              ...(scope === "all" ? styles.segmentOn : {}),
            }}
          >
            Todo
          </button>
        </div>

        {/* Navegación de mes */}
        <div style={styles.navRow}>
          <button
            onClick={onPrevMonth}
            style={styles.iconBtn}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <button
            onClick={onToday}
            style={styles.ghostBtnSmall}
          >
            Hoy
          </button>
          <button
            onClick={onNextMonth}
            style={styles.iconBtn}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      </div>

      {/* Chips de grupos (Personal / Pareja / Familia) */}
      <div style={styles.groupRow}>
        {(
          ["personal", "pair", "family"] as any as GroupType[]
        ).map((g) => {
          const meta = groupMeta(g);
          const on = (enabledGroups as any)[g];
          return (
            <button
              key={g}
              onClick={() => onToggleGroup(g)}
              style={{
                ...styles.groupChip,
                borderColor: on
                  ? "rgba(255,255,255,0.18)"
                  : "rgba(255,255,255,0.10)",
                opacity: on ? 1 : 0.55,
              }}
            >
              <span
                style={{
                  ...styles.groupDot,
                  background: meta.dot,
                }}
              />
              {meta.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filtersCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
    marginBottom: 12,
  },
  filtersRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  segment: {
    display: "flex",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    overflow: "hidden",
    background: "rgba(255,255,255,0.03)",
  },
  segmentBtn: {
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(255,255,255,0.86)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 850,
  },
  segmentOn: { background: "rgba(255,255,255,0.08)" },
  navRow: { display: "flex", gap: 8, alignItems: "center" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 18,
  },
  ghostBtnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: 12,
  },
  groupRow: {
    display: "flex",
    gap: 10,
    paddingTop: 10,
    flexWrap: "wrap",
  },
  groupChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    fontWeight: 850,
  },
  groupDot: { width: 10, height: 10, borderRadius: 999 },
};