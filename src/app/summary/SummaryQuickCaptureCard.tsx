// src/app/summary/SummaryQuickCaptureCard.tsx
import React, { type CSSProperties } from "react";
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

function actionTone(
  activeGroupType: GroupType,
  interpretation: SmartInterpretation | null
) {
  const isShared =
    interpretation?.intent === "group" ||
    activeGroupType === "pair" ||
    activeGroupType === "family" ||
    activeGroupType === "other";

  return {
    isShared,
    contextLabel: isShared ? "Compartido" : "Personal",
    submitLabel: isShared ? "Convertir en plan" : "Crear plan",
  };
}

function exampleText(example: QuickCaptureExample): string {
  const raw = example as unknown as Record<string, unknown>;
  return String(raw.text ?? raw.value ?? raw.label ?? raw.title ?? "").trim();
}

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
  onOpenCapture,
  timeSuggestionsLabel,
  timeSuggestions = [],
  onSuggestedSlotClick,
}: Props) {
  const hasValue = String(value ?? "").trim().length > 0;
  const { isShared, contextLabel, submitLabel } = actionTone(
    activeGroupType,
    interpretation
  );
  const hasMultipleGroups = groups.length > 1;
  const visibleExamples = examples.map(exampleText).filter(Boolean).slice(0, 3);
  const visibleSuggestions = timeSuggestions.slice(0, 3);

  return (
    <section style={s.card} className="spQc-card">
      <div style={s.glowTop} aria-hidden />
      <div style={s.glowBottom} aria-hidden />

      <header style={s.header}>
        <div style={s.headerCopy}>
          <div style={s.eyebrow}>Quick Capture</div>
          <h2 style={s.title}>{headline || "Crea un plan en una línea"}</h2>
          <p style={s.subtitle}>
            {subcopy ||
              "Escribe la idea como te salga y SyncPlans la deja lista para revisar."}
          </p>
        </div>

        <div style={s.contextWrap}>
          <span style={s.contextPill}>
            {activeGroupName ? activeGroupName : "Modo rápido"}
          </span>
          <span style={s.contextPillSoft}>{contextLabel}</span>
        </div>
      </header>

      <div style={s.composerCard}>
        <label htmlFor="summary-quick-capture" style={s.composerLabel}>
          ¿Qué quieres organizar?
        </label>

        <textarea
          id="summary-quick-capture"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ej: cena viernes 8 con Ara / pádel sábado 10 / doctor martes 9"
          rows={3}
          style={s.textarea}
        />

        <div style={s.submitRow} className="spQc-submitRow">
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={!hasValue || busy}
            style={{
              ...s.primaryButton,
              ...(hasValue && !busy ? null : s.primaryButtonDisabled),
            }}
            className="spQc-primaryButton"
          >
            {busy ? "Preparando..." : submitLabel}
          </button>

          {onOpenCapture ? (
            <button
              type="button"
              onClick={() => void onOpenCapture()}
              style={s.secondaryButton}
              className="spQc-secondaryButton"
            >
              Capture completo
            </button>
          ) : null}
        </div>
      </div>

      {(preview || interpretationLabel || visibleSuggestions.length > 0) && (
        <div style={s.previewCard}>
          <div style={s.previewTop}>
            <div>
              <div style={s.previewEyebrow}>Vista rápida</div>
              <div style={s.previewTitle}>Así lo estoy entendiendo</div>
            </div>

            {isShared ? <span style={s.previewBadge}>Compartido</span> : null}
          </div>

          {preview ? <div style={s.previewText}>{preview}</div> : null}

          {interpretationLabel ? (
            <div style={s.interpretationLine}>{interpretationLabel}</div>
          ) : null}

          {visibleSuggestions.length > 0 ? (
            <div style={s.suggestionsBlock}>
              {timeSuggestionsLabel ? (
                <div style={s.suggestionsLabel}>{timeSuggestionsLabel}</div>
              ) : null}

              <div style={s.chipsWrap}>
                {visibleSuggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.label}-${index}`}
                    type="button"
                    onClick={() => {
                      if (onSuggestedSlotClick) {
                        void onSuggestedSlotClick(suggestion.date);
                      }
                    }}
                    style={s.suggestionChip}
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {visibleExamples.length > 0 ? (
        <div style={s.examplesWrap}>
          <div style={s.examplesLabel}>Prueba con:</div>
          <div style={s.exampleChips}>
            {visibleExamples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onExampleClick(example)}
                style={s.exampleChip}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <details style={s.details}>
        <summary style={s.detailsSummary}>Compartir o copiar</summary>
        <div style={s.actionsRow}>
          <button
            type="button"
            onClick={() => void onWhatsApp()}
            disabled={!hasValue || busy}
            style={{
              ...s.whatsAppButton,
              ...(hasValue && !busy ? null : s.actionDisabled),
            }}
          >
            WhatsApp
          </button>

          <button
            type="button"
            onClick={() => void onShare()}
            disabled={!hasValue || busy}
            style={{
              ...s.linkButton,
              ...(hasValue && !busy ? null : s.actionDisabled),
            }}
          >
            Copiar link
          </button>
        </div>
      </details>

      {hasMultipleGroups && interpretation?.intent === "group" ? (
        <div style={s.helperNote}>
          Si algo no coincide, podrás corregirlo antes de guardar.
        </div>
      ) : null}

      <style>{`
        @media (max-width: 520px) {
          .spQc-card {
            padding: 15px !important;
            gap: 12px !important;
            border-radius: 22px !important;
          }

          .spQc-submitRow {
            display: grid !important;
            grid-template-columns: 1fr !important;
            width: 100% !important;
          }

          .spQc-primaryButton,
          .spQc-secondaryButton {
            width: 100% !important;
          }
        }
      `}</style>
    </section>
  );
}

const s: Record<string, CSSProperties> = {
  card: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 26,
    border: "1px solid rgba(148,163,184,0.16)",
    background:
      "linear-gradient(180deg, rgba(11,18,32,0.98) 0%, rgba(6,11,24,0.99) 100%)",
    boxShadow:
      "0 30px 90px rgba(2,6,23,0.40), inset 0 1px 0 rgba(255,255,255,0.04)",
    padding: 18,
    display: "grid",
    gap: 14,
  },
  glowTop: {
    position: "absolute",
    inset: "-80px auto auto -40px",
    width: 220,
    height: 220,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(56,189,248,0.14), transparent 68%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  glowBottom: {
    position: "absolute",
    inset: "auto -60px -100px auto",
    width: 240,
    height: 240,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(168,85,247,0.10), transparent 70%)",
    pointerEvents: "none",
    filter: "blur(12px)",
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  headerCopy: {
    display: "grid",
    gap: 5,
    minWidth: 0,
    flex: "1 1 440px",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.88)",
  },
  title: {
    margin: 0,
    fontSize: 24,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.035em",
    color: "rgba(248,250,252,0.98)",
    maxWidth: 720,
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.82)",
    maxWidth: 720,
  },
  contextWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  contextPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.14)",
    color: "rgba(219,234,254,0.95)",
    fontSize: 12,
    fontWeight: 850,
  },
  contextPillSoft: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 32,
    padding: "0 11px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.66)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 12,
    fontWeight: 850,
  },
  composerCard: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 10,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.10)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.58) 0%, rgba(2,6,23,0.32) 100%)",
    padding: 14,
  },
  composerLabel: {
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(226,242,255,0.92)",
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.22)",
    background: "rgba(15,23,42,0.78)",
    color: "rgba(248,250,252,0.98)",
    padding: "14px 15px",
    fontSize: 15,
    lineHeight: 1.5,
    outline: "none",
    minHeight: 86,
    boxSizing: "border-box",
  },
  submitRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryButton: {
    minHeight: 46,
    padding: "0 18px",
    borderRadius: 16,
    border: "1px solid rgba(96,165,250,0.30)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.94), rgba(37,99,235,0.92))",
    color: "white",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(30,64,175,0.26)",
  },
  primaryButtonDisabled: {
    cursor: "not-allowed",
    opacity: 0.6,
    boxShadow: "none",
    background: "rgba(51,65,85,0.74)",
  },
  secondaryButton: {
    minHeight: 46,
    padding: "0 15px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.66)",
    color: "rgba(226,242,255,0.92)",
    fontSize: 13,
    fontWeight: 850,
    cursor: "pointer",
  },
  previewCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 20,
    border: "1px solid rgba(94,234,212,0.16)",
    background: "rgba(13,148,136,0.08)",
    padding: "13px 14px",
    display: "grid",
    gap: 8,
  },
  previewTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    flexWrap: "wrap",
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(153,246,228,0.92)",
  },
  previewTitle: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.35,
    color: "rgba(240,253,250,0.98)",
  },
  previewBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "0 10px",
    borderRadius: 999,
    border: "1px solid rgba(45,212,191,0.20)",
    background: "rgba(45,212,191,0.12)",
    color: "rgba(204,251,241,0.94)",
    fontSize: 11,
    fontWeight: 850,
  },
  previewText: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "rgba(240,253,250,0.96)",
  },
  interpretationLine: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(186,230,253,0.94)",
    fontWeight: 800,
  },
  suggestionsBlock: {
    display: "grid",
    gap: 8,
    marginTop: 2,
  },
  suggestionsLabel: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,242,255,0.78)",
    fontWeight: 800,
  },
  chipsWrap: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  suggestionChip: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.30)",
    background: "rgba(56,189,248,0.14)",
    color: "rgba(226,242,255,0.96)",
    fontSize: 12,
    fontWeight: 850,
    cursor: "pointer",
  },
  examplesWrap: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 8,
  },
  examplesLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    color: "rgba(148,163,184,0.86)",
  },
  exampleChips: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  exampleChip: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(30,41,59,0.74)",
    color: "rgba(226,232,240,0.96)",
    padding: "9px 11px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  details: {
    position: "relative",
    zIndex: 1,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(255,255,255,0.025)",
    padding: "10px 12px",
  },
  detailsSummary: {
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 900,
    color: "rgba(203,213,225,0.86)",
  },
  actionsRow: {
    marginTop: 10,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  whatsAppButton: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,0.22)",
    background: "rgba(20,83,45,0.24)",
    color: "rgba(220,252,231,0.94)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  linkButton: {
    minHeight: 38,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.20)",
    background: "rgba(15,23,42,0.68)",
    color: "rgba(226,232,240,0.94)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  actionDisabled: {
    cursor: "not-allowed",
    opacity: 0.6,
  },
  helperNote: {
    position: "relative",
    zIndex: 1,
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(148,163,184,0.88)",
  },
};