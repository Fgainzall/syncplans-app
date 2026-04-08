"use client";

import React from "react";
import EventTemplatePicker from "@/components/events/EventTemplatePicker";
import type { EventTemplate } from "@/lib/eventTemplates";

type Props = {
  selectedTemplate: EventTemplate | null;
  onSelectTemplate: (template: EventTemplate) => void;
  onClearTemplate: () => void;
};

export default function EventDetailsTemplatesSection({
  selectedTemplate,
  onSelectTemplate,
  onClearTemplate,
}: Props) {
  return (
    <>
      <EventTemplatePicker
        selectedTemplateId={selectedTemplate?.id ?? null}
        onSelect={onSelectTemplate}
      />
      {selectedTemplate ? (
        <div style={S.templatePreview}>
          <div style={S.templatePreviewTop}>
            <div style={S.templatePreviewLabel}>Template elegido</div>

            <button
              type="button"
              onClick={onClearTemplate}
              style={S.templateClearBtn}
            >
              Empezar desde cero
            </button>
          </div>

          <div style={S.templatePreviewTitle}>
            {selectedTemplate.emoji} {selectedTemplate.title}
          </div>

          <div style={S.templatePreviewMeta}>
            Duración sugerida: {selectedTemplate.defaultDurationMinutes} min
            {selectedTemplate.defaultNotes
              ? ` · ${selectedTemplate.defaultNotes}`
              : ""}
            {" · "}El formulario ya fue precargado y puedes ajustarlo libremente.
          </div>
        </div>
      ) : null}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  templatePreview: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.025)",
    padding: 12,
    display: "grid",
    gap: 6,
  },
  templatePreviewTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  templatePreviewLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.68,
    fontWeight: 900,
  },
  templatePreviewTitle: {
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },
  templatePreviewMeta: {
    fontSize: 13,
    lineHeight: 1.4,
    opacity: 0.78,
  },
  templateClearBtn: {
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.86)",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
};