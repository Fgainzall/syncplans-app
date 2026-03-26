"use client";

import { EVENT_TEMPLATES, type EventTemplate } from "@/lib/eventTemplates";

type EventTemplatePickerProps = {
  selectedTemplateId?: string | null;
  onSelect: (template: EventTemplate) => void;
};

export default function EventTemplatePicker({
  selectedTemplateId,
  onSelect,
}: EventTemplatePickerProps) {
  return (
    <section style={S.wrapper}>
      <div style={S.header}>
        <div style={S.kicker}>Empieza más rápido</div>
        <h2 style={S.title}>Templates sugeridos</h2>
        <p style={S.subtitle}>
          Elige una base para crear tu plan en menos pasos.
        </p>
      </div>

      <div style={S.grid}>
        {EVENT_TEMPLATES.map((template) => {
          const isActive = template.id === selectedTemplateId;

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              style={{
                ...S.card,
                ...(isActive ? S.cardActive : {}),
              }}
            >
              <div style={S.cardTop}>
                <span style={S.emoji}>{template.emoji}</span>
                <span style={S.badge}>
                  {labelGroupType(template.suggestedGroupType)}
                </span>
              </div>

              <div style={S.cardTitle}>{template.title}</div>

              <div style={S.meta}>
                {template.defaultDurationMinutes} min
                {template.defaultNotes ? ` · ${template.defaultNotes}` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function labelGroupType(type?: EventTemplate["suggestedGroupType"]) {
  switch (type) {
    case "personal":
      return "Personal";
    case "pair":
      return "Pareja";
    case "family":
      return "Familia";
    case "shared":
      return "Compartido";
    default:
      return "Flexible";
  }
}

const S: Record<string, React.CSSProperties> = {
  wrapper: {
    display: "grid",
    gap: 14,
  },
  header: {
    display: "grid",
    gap: 6,
  },
  kicker: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.7,
  },
  title: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 800,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    opacity: 0.78,
  },
  grid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  },
  card: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    borderRadius: 18,
    padding: 14,
    display: "grid",
    gap: 10,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 160ms ease",
    boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
  },
  cardActive: {
    border: "1px solid rgba(255,255,255,0.24)",
    background: "rgba(255,255,255,0.08)",
    transform: "translateY(-1px)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  emoji: {
    fontSize: 24,
    lineHeight: 1,
  },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: "6px 8px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    whiteSpace: "nowrap",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1.2,
  },
  meta: {
    fontSize: 13,
    lineHeight: 1.4,
    opacity: 0.78,
  },
};