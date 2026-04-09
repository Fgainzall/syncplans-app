import React from "react";
import type { GroupRow } from "@/lib/groupsDb";
import type { GroupType } from "@/lib/conflicts";
import type {
  QuickCaptureExample,
  SmartInterpretation,
} from "./summaryHelpers";

type TimeSuggestion = {
  label: string;
  date: Date;
};

type Props = {
  value: string;
  busy: boolean;
  preview: string | null;
  interpretation: SmartInterpretation | null;
  interpretationLabel: string | null;
  examples: QuickCaptureExample[];
  activeGroupName: string | null;
  activeGroupType: GroupType;
  groups: GroupRow[];
  onChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  onShare: () => void | Promise<void>;
  onWhatsApp: () => void | Promise<void>;
  onExampleClick: (value: string) => void;

  headline?: string | null;
  subcopy?: string | null;
  shareHelperExample?: string | null;
  onOpenCapture?: () => void | Promise<void>;
  timeSuggestionsLabel?: string | null;
  timeSuggestions?: TimeSuggestion[];
  onSuggestedSlotClick?: (date: Date) => void | Promise<void>;
};

export default function SummaryQuickCaptureCard({
  value,
  busy,
  preview,
  interpretation,
  interpretationLabel,
  examples,
  activeGroupName,
  activeGroupType,
  groups,
  onChange,
  onSubmit,
  onShare,
  onWhatsApp,
  onExampleClick,
  headline,
  subcopy,
  shareHelperExample,
  onOpenCapture,
  timeSuggestionsLabel,
  timeSuggestions = [],
  onSuggestedSlotClick,
}: Props) {
  const hasValue = String(value ?? "").trim().length > 0;
  const isShared =
    interpretation?.intent === "group" ||
    activeGroupType === "pair" ||
    activeGroupType === "family" ||
    activeGroupType === "other";

  return (
    <section
      style={{
        borderRadius: 24,
        border: "1px solid rgba(148,163,184,0.18)",
        background:
          "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(2,6,23,0.98) 100%)",
        boxShadow:
          "0 24px 80px rgba(2,6,23,0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(125,211,252,0.86)",
              }}
            >
              Quick Capture
            </div>

            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: "rgba(248,250,252,0.98)",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {headline || "Escribe lo que tienes en mente"}
            </div>

            {subcopy ? (
              <div
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "rgba(148,163,184,0.92)",
                  maxWidth: 720,
                }}
              >
                {subcopy}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 999,
              padding: "6px 10px",
              background: "rgba(59,130,246,0.14)",
              border: "1px solid rgba(96,165,250,0.28)",
              fontSize: 12,
              color: "rgba(219,234,254,0.95)",
              fontWeight: 700,
            }}
          >
            {activeGroupName ? `Contexto: ${activeGroupName}` : "Modo rápido"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => void onWhatsApp()}
            disabled={!hasValue || busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 42,
              borderRadius: 999,
              border: "1px solid rgba(74,222,128,0.24)",
              background: "rgba(20,83,45,0.34)",
              color: "rgba(220,252,231,0.96)",
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 800,
              cursor: !hasValue || busy ? "not-allowed" : "pointer",
              opacity: !hasValue || busy ? 0.6 : 1,
            }}
          >
            WhatsApp
          </button>

          <button
            type="button"
            onClick={() => void onShare()}
            disabled={!hasValue || busy}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 42,
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.22)",
              background: "rgba(15,23,42,0.82)",
              color: "rgba(226,232,240,0.96)",
              padding: "0 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: !hasValue || busy ? "not-allowed" : "pointer",
              opacity: !hasValue || busy ? 0.6 : 1,
            }}
          >
            Copiar link
          </button>

          {onOpenCapture ? (
            <button
              type="button"
              onClick={() => void onOpenCapture()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 42,
                borderRadius: 999,
                border: "1px solid rgba(96,165,250,0.24)",
                background: "rgba(8,15,29,0.82)",
                color: "rgba(226,242,255,0.96)",
                padding: "0 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Abrir capture completo
            </button>
          ) : null}
        </div>

        <div
          style={{
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.04)",
            padding: "12px 14px",
            display: "grid",
            gap: 6,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              color: "rgba(226,242,255,0.94)",
            }}
          >
            Llévalo fuera de la app
          </div>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "rgba(226,242,255,0.72)",
              fontWeight: 650,
            }}
          >
            Comparte una idea por WhatsApp o por link. La otra persona la abre,
            la entiende rápido y la convierte en plan sin perder el contexto.
          </div>
          {shareHelperExample ? (
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.4,
                color: "rgba(125,211,252,0.92)",
                fontWeight: 800,
              }}
            >
              Mensaje listo: {shareHelperExample}
            </div>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: cena viernes 8 con Fer / pádel sábado 10 / doctor martes 9"
          rows={3}
          style={{
            width: "100%",
            resize: "vertical",
            borderRadius: 18,
            border: "1px solid rgba(148,163,184,0.22)",
            background: "rgba(15,23,42,0.76)",
            color: "rgba(248,250,252,0.98)",
            padding: "14px 16px",
            fontSize: 15,
            lineHeight: 1.5,
            outline: "none",
          }}
        />

        <button
          type="button"
          onClick={() => void onSubmit()}
          disabled={!hasValue || busy}
          style={{
            borderRadius: 16,
            border: "1px solid rgba(96,165,250,0.3)",
            background: busy
              ? "rgba(51,65,85,0.7)"
              : "linear-gradient(135deg, rgba(59,130,246,0.92), rgba(37,99,235,0.92))",
            color: "white",
            padding: "13px 14px",
            fontSize: 14,
            fontWeight: 800,
            cursor: !hasValue || busy ? "not-allowed" : "pointer",
            opacity: !hasValue || busy ? 0.6 : 1,
          }}
        >
          {busy ? "Preparando..." : isShared ? "Convertir en plan" : "Crear plan"}
        </button>

        {preview ? (
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(94,234,212,0.18)",
              background: "rgba(13,148,136,0.08)",
              padding: "12px 14px",
              display: "grid",
              gap: 6,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "rgba(153,246,228,0.92)",
              }}
            >
              Vista rápida
            </div>
            <div
              style={{
                fontSize: 14,
                lineHeight: 1.5,
                color: "rgba(240,253,250,0.96)",
              }}
            >
              {preview}
            </div>

            {interpretationLabel ? (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  lineHeight: 1.4,
                  color: "rgba(125,211,252,0.92)",
                  fontWeight: 800,
                }}
              >
                {interpretationLabel}
              </div>
            ) : null}

            {timeSuggestions.length > 0 ? (
              <div
                style={{
                  marginTop: 8,
                  display: "grid",
                  gap: 8,
                }}
              >
                {timeSuggestionsLabel ? (
                  <div
                    style={{
                      fontSize: 12,
                      lineHeight: 1.4,
                      color: "rgba(226,242,255,0.78)",
                      fontWeight: 800,
                    }}
                  >
                    {timeSuggestionsLabel}
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  {timeSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.label}-${index}`}
                      type="button"
                      onClick={() => {
                        if (onSuggestedSlotClick) {
                          void onSuggestedSlotClick(suggestion.date);
                        }
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 999,
                        border: "1px solid rgba(56,189,248,0.30)",
                        background: "rgba(56,189,248,0.15)",
                        color: "rgba(226,242,255,0.96)",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {examples.length ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(148,163,184,0.9)",
            }}
          >
            Ideas rápidas
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            {examples.map((example) => (
              <button
                key={`${example.label}-${example.value}`}
                type="button"
                onClick={() => onExampleClick(example.value)}
                style={{
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.18)",
                  background: "rgba(30,41,59,0.72)",
                  color: "rgba(226,232,240,0.96)",
                  padding: "10px 12px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {example.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {groups.length > 1 && interpretation?.intent === "group" ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.5,
            color: "rgba(148,163,184,0.88)",
          }}
        >
          Si la interpretación no coincide con tu intención, igual la podrás
          corregir en el siguiente paso antes de guardar.
        </div>
      ) : null}
    </section>
  );
}