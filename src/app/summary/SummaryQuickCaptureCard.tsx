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
  const { isShared, contextLabel, submitLabel } = actionTone(
    activeGroupType,
    interpretation
  );
  const hasMultipleGroups = groups.length > 1;
  const visibleExamples = examples.slice(0, 4);
  const visibleSuggestions = timeSuggestions.slice(0, 3);

  return (
    <section style={s.card}>
      <div style={s.glowTop} aria-hidden />
      <div style={s.glowBottom} aria-hidden />

      <header style={s.header}>
        <div style={s.headerCopy}>
          <div style={s.eyebrow}>Quick Capture</div>
          <h2 style={s.title}>{headline || "Planea en una línea"}</h2>
          <p style={s.subtitle}>
            {subcopy ||
              "Escribe la idea como te salga naturalmente y SyncPlans la convierte en un plan claro, revisable y listo para coordinar."}
          </p>
        </div>

        <div style={s.contextWrap}>
          <span style={s.contextPill}>
            {activeGroupName ? `Contexto: ${activeGroupName}` : "Modo rápido"}
          </span>
          <span style={s.contextPillSoft}>{contextLabel}</span>
        </div>
      </header>

      <div style={s.heroPanel}>
        <div style={s.heroPanelTop}>
          <div style={s.heroPanelText}>
            <div style={s.heroPanelLabel}>Lo más valioso aquí</div>
            <div style={s.heroPanelTitle}>
              Capturar una idea sin perder el contexto
            </div>
            <div style={s.heroPanelBody}>
              Menos fricción, menos pasos y menos dependencia del chat para
              transformar una intención en un plan real.
            </div>
          </div>

          {shareHelperExample ? (
            <div style={s.shareExampleCard}>
              <div style={s.shareExampleLabel}>Ejemplo de share</div>
              <div style={s.shareExampleText}>{shareHelperExample}</div>
            </div>
          ) : null}
        </div>

        <div style={s.composerCard}>
          <label htmlFor="summary-quick-capture" style={s.composerLabel}>
            Escribe como lo pensarías normalmente
          </label>

          <textarea
            id="summary-quick-capture"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ej: cena viernes 8 con Fer / pádel sábado 10 / doctor martes 9"
            rows={3}
            style={s.textarea}
          />

          <div style={s.submitRow}>
            <button
              type="button"
              onClick={() => void onSubmit()}
              disabled={!hasValue || busy}
              style={{
                ...s.primaryButton,
                ...(hasValue && !busy ? null : s.primaryButtonDisabled),
              }}
            >
              {busy ? "Preparando..." : submitLabel}
            </button>

            {onOpenCapture ? (
              <button
                type="button"
                onClick={() => void onOpenCapture()}
                style={s.secondaryButton}
              >
                Abrir capture completo
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {(preview || interpretationLabel || visibleSuggestions.length > 0) && (
        <div style={s.previewCard}>
          <div style={s.previewTop}>
            <div>
              <div style={s.previewEyebrow}>Vista rápida</div>
              <div style={s.previewTitle}>
                Así se está entendiendo tu idea
              </div>
            </div>

            {isShared ? <span style={s.previewBadge}>Con foco compartido</span> : null}
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

<div style={s.footerGridSingle}>
  <div style={s.actionsCard}>
          <div style={s.footerEyebrow}>Acciones secundarias</div>
          <div style={s.footerTitle}>Llévalo fuera de la app</div>
          <div style={s.footerBody}>
            Comparte una idea por WhatsApp o por link para que la otra persona
            la entienda rápido y la convierta en plan sin perder el contexto.
          </div>

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
        </div>
      </div>

      {hasMultipleGroups && interpretation?.intent === "group" ? (
        <div style={s.helperNote}>
          Si la interpretación no coincide exactamente con tu intención, podrás
          corregirla en el siguiente paso antes de guardar.
        </div>
      ) : null}
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
    padding: 20,
    display: "grid",
    gap: 16,
  },
  glowTop: {
    position: "absolute",
    inset: "-80px auto auto -40px",
    width: 220,
    height: 220,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(56,189,248,0.16), transparent 68%)",
    pointerEvents: "none",
    filter: "blur(10px)",
  },
  glowBottom: {
    position: "absolute",
    inset: "auto -60px -100px auto",
    width: 240,
    height: 240,
    borderRadius: 999,
    background: "radial-gradient(circle, rgba(168,85,247,0.12), transparent 70%)",
    pointerEvents: "none",
    filter: "blur(12px)",
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
    flexWrap: "wrap",
  },
  headerCopy: {
    display: "grid",
    gap: 6,
    minWidth: 0,
    flex: "1 1 480px",
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
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(248,250,252,0.98)",
    maxWidth: 720,
  },
  subtitle: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(203,213,225,0.84)",
    maxWidth: 760,
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
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(96,165,250,0.28)",
    background: "rgba(59,130,246,0.14)",
    color: "rgba(219,234,254,0.95)",
    fontSize: 12,
    fontWeight: 800,
  },
  contextPillSoft: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.66)",
    color: "rgba(226,232,240,0.88)",
    fontSize: 12,
    fontWeight: 800,
  },
  heroPanel: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 14,
    borderRadius: 22,
    border: "1px solid rgba(148,163,184,0.10)",
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.60) 0%, rgba(2,6,23,0.34) 100%)",
    padding: 16,
  },
  heroPanelTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "stretch",
    gap: 12,
    flexWrap: "wrap",
  },
  heroPanelText: {
    display: "grid",
    gap: 4,
    minWidth: 0,
    flex: "1 1 360px",
  },
  heroPanelLabel: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.84)",
  },
  heroPanelTitle: {
    fontSize: 16,
    lineHeight: 1.25,
    fontWeight: 900,
    color: "rgba(248,250,252,0.98)",
  },
  heroPanelBody: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.76)",
    maxWidth: 620,
  },
  shareExampleCard: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: 16,
    border: "1px solid rgba(56,189,248,0.18)",
    background: "rgba(56,189,248,0.08)",
    padding: "12px 12px",
    display: "grid",
    gap: 4,
  },
  shareExampleLabel: {
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(186,230,253,0.92)",
  },
  shareExampleText: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(224,242,254,0.92)",
    fontWeight: 700,
  },
  composerCard: {
    display: "grid",
    gap: 10,
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
    padding: "15px 16px",
    fontSize: 15,
    lineHeight: 1.55,
    outline: "none",
    minHeight: 96,
    boxSizing: "border-box",
  },
  submitRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryButton: {
    minHeight: 48,
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
    minHeight: 48,
    padding: "0 16px",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.66)",
    color: "rgba(226,242,255,0.92)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  previewCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 20,
    border: "1px solid rgba(94,234,212,0.16)",
    background: "rgba(13,148,136,0.08)",
    padding: "14px 14px",
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
    fontWeight: 800,
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
    fontWeight: 800,
    cursor: "pointer",
  },
  footerGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)",
    gap: 12,
  },
  footerGridSingle: {
  position: "relative",
  zIndex: 1,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
},
  examplesCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px 14px",
    display: "grid",
    gap: 10,
  },
  actionsCard: {
    borderRadius: 18,
    border: "1px solid rgba(148,163,184,0.10)",
    background: "rgba(255,255,255,0.03)",
    padding: "14px 14px",
    display: "grid",
    gap: 10,
  },
  footerEyebrow: {
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(148,163,184,0.86)",
  },
  footerTitle: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(248,250,252,0.96)",
    lineHeight: 1.35,
  },
  footerBody: {
    fontSize: 12,
    lineHeight: 1.55,
    color: "rgba(203,213,225,0.76)",
  },
  exampleChip: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(30,41,59,0.74)",
    color: "rgba(226,232,240,0.96)",
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  },
  actionsRow: {
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
