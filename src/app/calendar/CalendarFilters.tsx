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
  /** índice de mes actual (0-11) basado en anchor */
  currentMonthIndex: number;
  /** año actual basado en anchor */
  currentYear: number;
  /** salta directo a un mes/año concreto */
  onChangeMonthYear: (year: number, monthIndex: number) => void;
};

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

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
  currentMonthIndex,
  currentYear,
  onChangeMonthYear,
}: CalendarFiltersProps) {
  // Helpers para mover mes / año sin dropdown feo
  const handleMonthStep = (delta: number) => {
    let newMonth = currentMonthIndex + delta;
    let newYear = currentYear;

    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }

    onChangeMonthYear(newYear, newMonth);
  };

  const handleYearStep = (delta: number) => {
    const newYear = currentYear + delta;
    onChangeMonthYear(newYear, currentMonthIndex);
  };

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
            Calendario
          </button>
          <button
            onClick={() => onChangeTab("agenda")}
            style={{
              ...styles.segmentBtn,
              ...(tab === "agenda" ? styles.segmentOn : {}),
            }}
          >
            Seguimiento
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
            title="Personal + grupo activo + señales compartidas"
          >
            Compartido
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
            Todo visible
          </button>
        </div>

        {/* Navegación + controles Mes / Año premium */}
        <div style={styles.navCol}>
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

          {/* 🔽 Controles Mes / Año tipo pill, sin dropdown nativo */}
          <div style={styles.monthYearRow}>
            <div style={styles.selectPill}>
              <span style={styles.selectLabel}>Mes</span>
              <button
                type="button"
                onClick={() => handleMonthStep(-1)}
                style={styles.selectArrow}
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <span style={styles.selectValue}>
                {MONTH_LABELS[currentMonthIndex] ?? "Mes"}
              </span>
              <button
                type="button"
                onClick={() => handleMonthStep(1)}
                style={styles.selectArrow}
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>

            <div style={styles.selectPill}>
              <span style={styles.selectLabel}>Año</span>
              <button
                type="button"
                onClick={() => handleYearStep(-1)}
                style={styles.selectArrow}
                aria-label="Año anterior"
              >
                ‹
              </button>
              <span style={styles.selectValue}>{currentYear}</span>
              <button
                type="button"
                onClick={() => handleYearStep(1)}
                style={styles.selectArrow}
                aria-label="Año siguiente"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Chips de grupos visibles */}
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

  navCol: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "flex-end",
  },
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

  monthYearRow: {
    display: "flex",
    gap: 8,
    marginTop: 4,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  selectPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.26)",
    background:
      "radial-gradient(220px 220px at 0% 0%, rgba(56,189,248,0.18), transparent 60%), rgba(15,23,42,0.85)",
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(148,163,184,0.95)",
  },
  selectArrow: {
    width: 22,
    height: 22,
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.45)",
    background: "rgba(15,23,42,0.95)",
    color: "rgba(226,232,240,0.96)",
    cursor: "pointer",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  },
  selectValue: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(226,232,240,0.98)",
    minWidth: 32,
    textAlign: "center",
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