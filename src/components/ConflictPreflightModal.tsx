"use client";

import React from "react";

export type PreflightChoice =
  | "edit"
  | "keep_existing"
  | "replace_with_new"
  | "keep_both";

export type PreflightConflict = {
  id: string;
  existingId: string;
  title: string;
  groupLabel: string;
  range: string;
  overlapStart: string;
  overlapEnd: string;
};

function formatDateLabel(value?: string) {
  if (!value) return "—";

  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    return d.toLocaleString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function getChoiceMeta(choice: PreflightChoice) {
  switch (choice) {
    case "edit":
      return {
        title: "Ajustar horario",
        subtitle: "Vuelves a editar antes de guardar.",
        accent: "rgba(56,189,248,0.95)",
      };
    case "keep_existing":
      return {
        title: "Quedarme con el actual",
        subtitle: "No se guarda este nuevo evento.",
        accent: "rgba(148,163,184,0.95)",
      };
    case "replace_with_new":
      return {
        title: "Priorizar este",
        subtitle: "El nuevo reemplaza al existente.",
        accent: "rgba(168,85,247,0.95)",
      };
    case "keep_both":
    default:
      return {
        title: "Mantener ambos",
        subtitle: "Guardar igual y decidir después.",
        accent: "rgba(250,204,21,0.95)",
      };
  }
}

export default function ConflictPreflightModal({
  open,
  title,
  items,
  defaultChoice = "edit",
  onClose,
  onChoose,
}: {
  open: boolean;
  title?: string;
  items: PreflightConflict[];
  defaultChoice?: PreflightChoice;
  onClose: () => void;
  onChoose: (choice: PreflightChoice) => void;
}) {
  const [choice, setChoice] = React.useState<PreflightChoice>(defaultChoice);

  React.useEffect(() => {
    if (open) setChoice(defaultChoice);
  }, [open, defaultChoice]);

  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const firstItem = items[0];
  const selected = getChoiceMeta(choice);
  const count = items.length;

  return (
    <div style={S.backdropWrap}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        style={S.backdrop}
      />

      <div style={S.sheetViewport}>
        <div style={S.sheet}>
          <div style={S.handleWrap}>
            <div style={S.handle} />
          </div>

          <div style={S.header}>
            <div style={S.badgesRow}>
              <span style={S.badgeDanger}>Conflicto detectado</span>
              <span style={S.badgeSoft}>SyncPlans</span>
            </div>

            <h2 style={S.title}>
              Antes de guardar, elige una salida simple
            </h2>

            <p style={S.subtitle}>
              <strong style={{ color: "#FFFFFF" }}>
                “{title || "Este evento"}”
              </strong>{" "}
              se cruza con{" "}
              <strong style={{ color: "#FFFFFF" }}>
                {count} evento{count === 1 ? "" : "s"}
              </strong>{" "}
              ya visible. Decide ahora qué prefieres hacer.
            </p>
          </div>

          <div style={S.scrollArea}>
            {firstItem ? (
              <section style={S.section}>
                <div style={S.sectionHeader}>
                  <div style={S.sectionKicker}>Cruce principal</div>
                  <div style={S.countPill}>
                    {count} cruce{count === 1 ? "" : "s"}
                  </div>
                </div>

                <div style={S.eventCard}>
                  <div style={S.eventTitle}>
                    {firstItem.title || "Evento existente"}
                  </div>

                  <div style={S.eventMeta}>
                    {firstItem.groupLabel ? `${firstItem.groupLabel} · ` : ""}
                    {firstItem.range || "—"}
                  </div>

                  <div style={S.tagsRow}>
                    <span style={S.warningPill}>Cruce detectado</span>
                    <span style={S.timePill}>
                      {formatDateLabel(firstItem.overlapStart)} —{" "}
                      {formatDateLabel(firstItem.overlapEnd)}
                    </span>
                  </div>
                </div>
              </section>
            ) : null}

            <section style={S.section}>
              <div style={S.sectionKicker}>Tu decisión</div>
              <p style={S.helperText}>
                Toca una opción. La idea es resolverlo sin fricción.
              </p>

              <div style={S.choicesList}>
                <ChoiceCard
                  active={choice === "edit"}
                  title="Ajustar horario"
                  subtitle="Vuelves a editar antes de guardar"
                  tone="blue"
                  onClick={() => setChoice("edit")}
                />

                <ChoiceCard
                  active={choice === "keep_existing"}
                  title="Quedarme con el actual"
                  subtitle="No guardo este nuevo evento"
                  tone="slate"
                  onClick={() => setChoice("keep_existing")}
                />

                <ChoiceCard
                  active={choice === "replace_with_new"}
                  title="Priorizar este"
                  subtitle="El nuevo reemplaza al existente"
                  tone="violet"
                  onClick={() => setChoice("replace_with_new")}
                />

                <ChoiceCard
                  active={choice === "keep_both"}
                  title="Mantener ambos"
                  subtitle="Guardar igual y decidir después"
                  tone="amber"
                  onClick={() => setChoice("keep_both")}
                />
              </div>
            </section>

            <section style={S.selectionCard}>
              <div style={S.sectionKicker}>Selección actual</div>
              <div style={S.selectionTitle}>{selected.title}</div>
              <div style={S.selectionSubtitle}>{selected.subtitle}</div>
              <div
                style={{
                  ...S.selectionAccent,
                  background: selected.accent,
                }}
              />
            </section>
          </div>

          <div style={S.footer}>
            <button type="button" onClick={onClose} style={S.secondaryBtn}>
              Cerrar
            </button>

            <button
              type="button"
              onClick={() => onChoose(choice)}
              style={S.primaryBtn}
            >
              Continuar con esta decisión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  active,
  title,
  subtitle,
  onClick,
  tone,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
  tone: "blue" | "slate" | "violet" | "amber";
}) {
  const toneMap = {
    blue: {
      border: active ? "rgba(56,189,248,0.7)" : "rgba(255,255,255,0.08)",
      bg: active ? "rgba(34,211,238,0.10)" : "rgba(255,255,255,0.03)",
      glow: active ? "0 0 0 1px rgba(56,189,248,0.18) inset" : "none",
      dot: "rgba(56,189,248,0.95)",
    },
    slate: {
      border: active ? "rgba(226,232,240,0.45)" : "rgba(255,255,255,0.08)",
      bg: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
      glow: active ? "0 0 0 1px rgba(226,232,240,0.12) inset" : "none",
      dot: "rgba(226,232,240,0.95)",
    },
    violet: {
      border: active ? "rgba(168,85,247,0.7)" : "rgba(255,255,255,0.08)",
      bg: active ? "rgba(168,85,247,0.10)" : "rgba(255,255,255,0.03)",
      glow: active ? "0 0 0 1px rgba(168,85,247,0.18) inset" : "none",
      dot: "rgba(168,85,247,0.95)",
    },
    amber: {
      border: active ? "rgba(250,204,21,0.7)" : "rgba(255,255,255,0.08)",
      bg: active ? "rgba(250,204,21,0.10)" : "rgba(255,255,255,0.03)",
      glow: active ? "0 0 0 1px rgba(250,204,21,0.18) inset" : "none",
      dot: "rgba(250,204,21,0.95)",
    },
  };

  const style = toneMap[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...S.choiceCard,
        border: `1px solid ${style.border}`,
        background: style.bg,
        boxShadow: style.glow,
      }}
    >
      <div style={S.choiceCopy}>
        <div style={S.choiceTitle}>{title}</div>
        <div style={S.choiceSubtitle}>{subtitle}</div>
      </div>

      <div
        style={{
          ...S.choiceIndicator,
          borderColor: active ? style.dot : "rgba(255,255,255,0.16)",
          background: active ? "rgba(255,255,255,0.10)" : "transparent",
        }}
      >
        {active ? (
          <div
            style={{
              ...S.choiceIndicatorInner,
              background: style.dot,
            }}
          />
        ) : null}
      </div>
    </button>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdropWrap: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
  },

  backdrop: {
    position: "absolute",
    inset: 0,
    border: "none",
    background: "rgba(2,6,23,0.78)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    cursor: "pointer",
  },

  sheetViewport: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "12px",
    boxSizing: "border-box",
  },

  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "92dvh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    borderRadius: 28,
    border: "1px solid rgba(255,255,255,0.10)",
    background:
      "radial-gradient(1100px 540px at 0% -10%, rgba(56,189,248,0.16), transparent 48%), radial-gradient(900px 420px at 100% 0%, rgba(124,58,237,0.16), transparent 42%), linear-gradient(180deg, rgba(7,11,22,0.985), rgba(4,7,18,0.985))",
    boxShadow: "0 28px 90px rgba(0,0,0,0.52)",
  },

  handleWrap: {
    display: "flex",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 2,
  },

  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
  },

  header: {
    padding: "10px 18px 14px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },

  badgesRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: 10,
  },

  badgeDanger: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255,240,245,0.96)",
    background: "rgba(244,63,94,0.12)",
    border: "1px solid rgba(244,63,94,0.22)",
  },

  badgeSoft: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(226,232,240,0.75)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  title: {
    margin: 0,
    fontSize: 32,
    lineHeight: 1.02,
    letterSpacing: "-0.05em",
    fontWeight: 950,
    color: "#FFFFFF",
  },

  subtitle: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: 16,
    lineHeight: 1.55,
    color: "rgba(226,232,240,0.82)",
  },

  scrollArea: {
    overflowY: "auto",
    padding: "16px 18px 14px",
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  section: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  sectionKicker: {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "rgba(186,230,253,0.78)",
  },

  countPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: "rgba(226,232,240,0.76)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  helperText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.66)",
  },

  eventCard: {
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },

  eventTitle: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.15,
    color: "#FFFFFF",
  },

  eventMeta: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.74)",
  },

  tagsRow: {
    marginTop: 12,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },

  warningPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    color: "rgba(254,240,138,0.96)",
    background: "rgba(250,204,21,0.10)",
    border: "1px solid rgba(250,204,21,0.20)",
  },

  timePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    color: "rgba(226,232,240,0.74)",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  choicesList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  choiceCard: {
    width: "100%",
    borderRadius: 20,
    padding: "16px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    textAlign: "left",
    cursor: "pointer",
    transition: "all 160ms ease",
  },

  choiceCopy: {
    minWidth: 0,
    flex: 1,
  },

  choiceTitle: {
    fontSize: 22,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    color: "#FFFFFF",
  },

  choiceSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.72)",
  },

  choiceIndicator: {
    width: 24,
    height: 24,
    minWidth: 24,
    borderRadius: 999,
    border: "2px solid rgba(255,255,255,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  choiceIndicatorInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },

  selectionCard: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 16,
  },

  selectionTitle: {
    marginTop: 6,
    fontSize: 24,
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: "-0.04em",
    color: "#FFFFFF",
  },

  selectionSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.72)",
    maxWidth: "95%",
  },

  selectionAccent: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
  },

  footer: {
    padding: "12px 18px calc(12px + env(safe-area-inset-bottom))",
    borderTop: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(5,8,18,0.92)",
    display: "flex",
    flexDirection: "column-reverse",
    gap: 10,
  },

  secondaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(241,245,249,0.92)",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
  },

  primaryBtn: {
    width: "100%",
    height: 58,
    borderRadius: 18,
    border: "1px solid rgba(96,165,250,0.22)",
    background:
      "linear-gradient(135deg, rgba(59,130,246,0.98), rgba(124,58,237,0.98))",
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    boxShadow: "0 16px 40px rgba(59,130,246,0.26)",
    cursor: "pointer",
  },
};