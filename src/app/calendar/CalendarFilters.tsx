"use client";

import React, { useEffect, useMemo, useState } from "react";
import { type GroupType, groupMeta } from "@/lib/conflicts";
import { colors, radii, shadows, spacing } from "@/styles/design-tokens";

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
    other?: boolean;
  };
  onToggleGroup: (g: GroupType) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  currentMonthIndex: number;
  currentYear: number;
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

function useIsCompact(maxWidth = 860) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const apply = () => setCompact(media.matches);
    apply();

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }

    const legacyMedia = media as any;
    legacyMedia.addListener?.(apply);
    return () => legacyMedia.removeListener?.(apply);
  }, [maxWidth]);

  return compact;
}

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
  const isCompact = useIsCompact();
  const [expanded, setExpanded] = useState(!isCompact);

  useEffect(() => {
    if (!isCompact) {
      setExpanded(true);
    }
  }, [isCompact]);

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
    onChangeMonthYear(currentYear + delta, currentMonthIndex);
  };

  const summary = useMemo(() => {
    const tabLabel = tab === "month" ? "Mes" : "Agenda";
    const scopeLabel =
      scope === "active" ? "Activo" : scope === "personal" ? "Personal" : "Todo";
    const monthLabel = MONTH_LABELS[currentMonthIndex] ?? "Mes";
    return `${tabLabel} · ${scopeLabel} · ${monthLabel} ${currentYear}`;
  }, [currentMonthIndex, currentYear, scope, tab]);

  const groupOptions: GroupType[] = ["personal", "pair", "family", "other"];

  return (
    <div style={styles.rootCard}>
      <div style={styles.headerRow}>
        <div style={styles.headerCopy}>
          <div style={styles.eyebrow}>Controles del calendario</div>
          <div style={styles.titleRow}>
            <h3 style={styles.title}>Filtros y navegación</h3>
            {isCompact ? <span style={styles.summaryPill}>{summary}</span> : null}
          </div>
          <p style={styles.subtitle}>
            Ajusta la vista, el alcance y los grupos sin salir del mismo lenguaje
            visual de SyncPlans.
          </p>
        </div>

        {isCompact ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            style={styles.collapseBtn}
            aria-expanded={expanded}
            aria-label={expanded ? "Ocultar controles" : "Mostrar controles"}
          >
            {expanded ? "Ocultar" : "Mostrar"}
          </button>
        ) : null}
      </div>

      {expanded ? (
        <div style={styles.contentGrid}>
          <div style={styles.block}>
            <div style={styles.blockLabel}>Vista</div>
            <div style={styles.segment}>
              <button
                type="button"
                onClick={() => onChangeTab("month")}
                style={{
                  ...styles.segmentBtn,
                  ...(tab === "month" ? styles.segmentBtnActive : {}),
                }}
              >
                Mes
              </button>
              <button
                type="button"
                onClick={() => onChangeTab("agenda")}
                style={{
                  ...styles.segmentBtn,
                  ...(tab === "agenda" ? styles.segmentBtnActive : {}),
                }}
              >
                Agenda
              </button>
            </div>
          </div>

          <div style={styles.block}>
            <div style={styles.blockLabel}>Alcance</div>
            <div style={styles.segment}>
              <button
                type="button"
                onClick={() => onChangeScope("active")}
                style={{
                  ...styles.segmentBtn,
                  ...(scope === "active" ? styles.segmentBtnActive : {}),
                }}
                title="Personal + grupo activo + conflictos"
              >
                Activo
              </button>
              <button
                type="button"
                onClick={() => onChangeScope("personal")}
                style={{
                  ...styles.segmentBtn,
                  ...(scope === "personal" ? styles.segmentBtnActive : {}),
                }}
              >
                Personal
              </button>
              <button
                type="button"
                onClick={() => onChangeScope("all")}
                style={{
                  ...styles.segmentBtn,
                  ...(scope === "all" ? styles.segmentBtnActive : {}),
                }}
              >
                Todo
              </button>
            </div>
          </div>

          <div style={styles.block}>
            <div style={styles.blockLabel}>Mover mes</div>
            <div style={styles.navRow}>
              <button
                type="button"
                onClick={onPrevMonth}
                style={styles.iconBtn}
                aria-label="Mes anterior"
              >
                ‹
              </button>
              <button type="button" onClick={onToday} style={styles.todayBtn}>
                Hoy
              </button>
              <button
                type="button"
                onClick={onNextMonth}
                style={styles.iconBtn}
                aria-label="Mes siguiente"
              >
                ›
              </button>
            </div>
          </div>

          <div style={styles.monthYearGrid}>
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

          <div style={styles.groupsBlock}>
            <div style={styles.blockLabel}>Grupos visibles</div>
            <div style={styles.groupRow}>
              {groupOptions.map((groupType) => {
                const meta = groupMeta(groupType);
                const isEnabled = Boolean(
                  (enabledGroups as Record<string, boolean | undefined>)[groupType]
                );

                return (
                  <button
                    key={groupType}
                    type="button"
                    onClick={() => onToggleGroup(groupType)}
                    style={{
                      ...styles.groupChip,
                      opacity: isEnabled ? 1 : 0.58,
                      borderColor: isEnabled
                        ? "rgba(148,163,184,0.5)"
                        : colors.borderSubtle,
                      background: isEnabled
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(255,255,255,0.03)",
                    }}
                  >
                    <span style={{ ...styles.groupDot, background: meta.dot }} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  rootCard: {
    width: "100%",
    borderRadius: radii.xl,
    border: `1px solid ${colors.borderSubtle}`,
    background:
      "radial-gradient(160px 120px at 0% 0%, rgba(56,189,248,0.12), transparent 60%), rgba(15,23,42,0.96)",
    boxShadow: shadows.card,
    backdropFilter: "blur(14px)",
    padding: spacing.lg,
    display: "grid",
    gap: spacing.lg,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  headerCopy: {
    display: "grid",
    gap: 6,
    flex: "1 1 320px",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.1,
    fontWeight: 900,
    color: colors.textPrimary,
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.5,
    color: colors.textSecondary,
    maxWidth: 760,
  },
  summaryPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.05)",
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: 800,
  },
  collapseBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  contentGrid: {
    display: "grid",
    gap: spacing.md,
  },
  block: {
    display: "grid",
    gap: spacing.sm,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: 850,
    color: colors.textMuted,
  },
  segment: {
    display: "flex",
    flexWrap: "wrap",
    gap: spacing.xs,
    padding: 4,
    borderRadius: 16,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.03)",
  },
  segmentBtn: {
    flex: "1 1 0",
    minWidth: 92,
    border: "none",
    borderRadius: 12,
    padding: "11px 12px",
    background: "transparent",
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background: "rgba(255,255,255,0.08)",
    color: colors.textPrimary,
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
  },
  navRow: {
    display: "flex",
    gap: spacing.sm,
    alignItems: "center",
    flexWrap: "wrap",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
  },
  todayBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  monthYearGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: spacing.sm,
  },
  selectPill: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
    padding: "8px 10px",
    borderRadius: 16,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.04)",
  },
  selectLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  selectArrow: {
    width: 26,
    height: 26,
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(15,23,42,0.98)",
    color: colors.textPrimary,
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    flexShrink: 0,
  },
  selectValue: {
    fontSize: 14,
    fontWeight: 900,
    color: colors.textPrimary,
    minWidth: 56,
    textAlign: "center",
  },
  groupsBlock: {
    display: "grid",
    gap: spacing.sm,
  },
  groupRow: {
    display: "flex",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  groupChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: radii.full,
    border: `1px solid ${colors.borderSubtle}`,
    background: "rgba(255,255,255,0.03)",
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    flexShrink: 0,
  },
};