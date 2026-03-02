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
  // Ventana de años alrededor del año actual (por ejemplo, -3 a +3)
  const years: number[] = [];
  const startYear = currentYear - 3;
  const endYear = currentYear + 3;
  for (let y = startYear; y <= endYear; y++) {
    years.push(y);
  }

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

        {/* Navegación + selector rápido de mes/año */}
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

          {/* 🔽 Filtro directo de Mes / Año */}
          <div style={styles.monthYearRow}>
            <div style={styles.selectPill}>
              <span style={styles.selectLabel}>Mes</span>
              <select
                value={currentMonthIndex}
                onChange={(e) =>
                  onChangeMonthYear(
                    currentYear,
                    Number(e.target.value),
                  )
                }
                style={styles.selectNative}
              >
                {MONTH_LABELS.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.selectPill}>
              <span style={styles.selectLabel}>Año</span>
              <select
                value={currentYear}
                onChange={(e) =>
                  onChangeMonthYear(
                    Number(e.target.value),
                    currentMonthIndex,
                  )
                }
                style={styles.selectNative}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Chips de grupos (Personal / Pareja / Familia) */}
      <div style={styles.groupRow}>
        {(
          ["personal", "pair", "family"] as any as GroupType[]
        ).map((g) => {
          const meta = groupMeta(
            (g === "pair" ? ("couple" as any) : g) as GroupType,
          );
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
    background:
      "radial-gradient(600px 260px at 0% 0%, rgba(56,189,248,0.12), transparent 60%), radial-gradient(600px 260px at 100% 0%, rgba(129,140,248,0.16), transparent 60%), rgba(15,23,42,0.92)",
    padding: 12,
    marginBottom: 12,
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
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
    background: "rgba(15,23,42,0.85)",
  },
  segmentBtn: {
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(226,232,240,0.96)",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontWeight: 850,
  },
  segmentOn: {
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.35), rgba(129,140,248,0.30))",
  },

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
    background: "rgba(15,23,42,0.9)",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontSize: 18,
  },
  ghostBtnSmall: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
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
    background: "rgba(15,23,42,0.95)",
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(148,163,184,0.95)",
  },
  selectNative: {
    background: "transparent",
    border: "none",
    color: "rgba(226,232,240,0.96)",
    fontSize: 13,
    fontWeight: 850,
    outline: "none",
    paddingRight: 4,
    cursor: "pointer",
    appearance: "none",
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
    background: "rgba(15,23,42,0.95)",
    cursor: "pointer",
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    fontWeight: 850,
  },
  groupDot: { width: 10, height: 10, borderRadius: 999 },
};