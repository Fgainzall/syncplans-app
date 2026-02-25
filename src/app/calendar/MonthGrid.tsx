// src/app/calendar/MonthGrid.tsx
"use client";

import React from "react";

type MonthGridProps = {
  monthCells: React.ReactNode;
};

export function MonthGrid({ monthCells }: MonthGridProps) {
  return (
    <div
      style={styles.grid}
      className="spCal-grid"
    >
      {monthCells}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 8,
  },
};