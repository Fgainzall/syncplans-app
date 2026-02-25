// src/components/events/EventsFiltersBar.tsx
"use client";

import React, { type CSSProperties } from "react";

type ViewMode = "upcoming" | "history" | "all";
type Scope = "personal" | "groups" | "all";

type EventsFiltersBarProps = {
  view: ViewMode;
  scope: Scope;
  query: string;
  onChangeView: (view: ViewMode) => void;
  onChangeScope: (scope: Scope) => void;
  onChangeQuery: (query: string) => void;
};

export default function EventsFiltersBar({
  view,
  scope,
  query,
  onChangeView,
  onChangeScope,
  onChangeQuery,
}: EventsFiltersBarProps) {
  return (
    <div style={S.filters} className="spEvt-filters">
      {/* Tabs de vista (Próximos / Historial / Todos) */}
      <div style={S.tabs}>
        <div style={S.segment}>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(view === "upcoming" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeView("upcoming")}
          >
            Próximos
          </button>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(view === "history" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeView("history")}
          >
            Historial
          </button>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(view === "all" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeView("all")}
          >
            Todos
          </button>
        </div>

        {/* Tabs de scope (Todo / Personal / Grupos) */}
        <div style={S.segment}>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(scope === "all" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeScope("all")}
          >
            Todo
          </button>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(scope === "personal" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeScope("personal")}
          >
            Personal
          </button>
          <button
            type="button"
            style={{
              ...S.segmentBtn,
              ...(scope === "groups" ? S.segmentBtnActive : {}),
            }}
            onClick={() => onChangeScope("groups")}
          >
            Grupos
          </button>
        </div>
      </div>

      {/* Buscador */}
      <input
        style={S.search}
        className="spEvt-search"
        placeholder="Buscar por título, notas o grupo…"
        value={query}
        onChange={(e) => onChangeQuery(e.target.value)}
      />
    </div>
  );
}

// ===== Estilos locales (copiados del S original) =====

const S: Record<string, CSSProperties> = {
  filters: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  tabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  segment: {
    display: "inline-flex",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.96)",
    overflow: "hidden",
  },
  segmentBtn: {
    padding: "8px 11px",
    fontSize: 12,
    background: "transparent",
    border: "none",
    color: "rgba(209,213,219,0.9)",
    fontWeight: 800,
    cursor: "pointer",
  },
  segmentBtnActive: {
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.55), rgba(56,189,248,0.55))",
    color: "white",
  },
  search: {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.60)",
    background: "rgba(15,23,42,0.96)",
    padding: "9px 12px",
    color: "rgba(248,250,252,0.98)",
    fontSize: 13,
    outline: "none",
  },
};