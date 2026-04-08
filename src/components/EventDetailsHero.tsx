"use client";

import React from "react";

type ProposalResponse = "adjust" | "accept" | null;

type Props = {
  themeLabel: string;
  themeBorder: string;
  themeSoft: string;
  metaLabel: string;
  metaDot: string;
  isEditing: boolean;
  isSharedProposal: boolean;
  proposalResponse: ProposalResponse;
  summaryLine: string;
  durationLabel: string | null;
  lockedToActiveGroup: boolean;
  canSave: boolean;
  saving: boolean;
  onPrimaryClick: () => void;
  onSecondaryClick: () => void;
};

function getPrimaryLabel(input: {
  saving: boolean;
  isEditing: boolean;
  isSharedProposal: boolean;
  proposalResponse: ProposalResponse;
}) {
  if (input.saving) return "Guardando…";
  if (input.isEditing) return "Guardar cambios";
  if (input.isSharedProposal) {
    return input.proposalResponse === "adjust"
      ? "Guardar propuesta ajustada"
      : "Aceptar propuesta";
  }
  return "Guardar";
}

export default function EventDetailsHero(props: Props) {
  const primaryLabel = getPrimaryLabel(props);

  return (
    <>
      <section
        style={{
          ...S.hero,
          borderColor: props.themeBorder,
          background: `linear-gradient(180deg, ${props.themeSoft}, rgba(255,255,255,0.03))`,
        }}
      >
        <div style={S.heroLeft}>
          <div style={S.heroKicker}>{props.isEditing ? "Editar" : "Nuevo"}</div>
          <div style={S.heroTitleRow}>
            <h1 style={S.h1}>{props.themeLabel}</h1>
            <span style={S.pill}>
              <span style={{ ...S.pillDot, background: props.metaDot }} />
              {props.metaLabel}
            </span>
          </div>
          <div style={S.heroSub}>
            {props.isSharedProposal
              ? props.proposalResponse === "adjust"
                ? "Estás ajustando una propuesta compartida antes de guardarla. Revisa los detalles y deja tu versión final lista."
                : "Estás revisando una propuesta compartida. Puedes aceptarla tal cual o ajustarla antes de guardarla."
              : "Crea el evento en pocos segundos. SyncPlans revisa conflictos antes de guardarlo para que no pierdas el hilo."}
            <div style={S.heroMetaRow}>
              <span style={S.heroMetaPill}>{props.summaryLine}</span>
              {props.isSharedProposal ? (
                <span style={S.heroMetaPill}>
                  {props.proposalResponse === "adjust"
                    ? "Ajustando propuesta"
                    : "Propuesta compartida"}
                </span>
              ) : null}
              {props.durationLabel ? (
                <span style={S.heroMetaPill}>Duración: {props.durationLabel}</span>
              ) : null}
            </div>
            {props.lockedToActiveGroup ? (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
                Este evento se compartirá automáticamente con tu grupo activo.
              </div>
            ) : null}
          </div>
        </div>

        <div style={S.heroRight}>
          <button onClick={props.onSecondaryClick} style={S.ghostBtn}>
            {props.isSharedProposal ? "Revisar luego" : "Cancelar"}
          </button>
          <button
            onClick={props.onPrimaryClick}
            style={{ ...S.primaryBtn, opacity: props.canSave ? 1 : 0.6 }}
            disabled={!props.canSave}
          >
            {primaryLabel}
          </button>
        </div>
      </section>

      {props.isSharedProposal ? (
        <section style={S.proposalBanner}>
          <div style={S.proposalBannerEyebrow}>
            {props.proposalResponse === "adjust"
              ? "Ajustando propuesta"
              : "Propuesta compartida"}
          </div>
          <div style={S.proposalBannerTitle}>
            {props.proposalResponse === "adjust"
              ? "Estás preparando tu versión ajustada de esta propuesta"
              : "Estás respondiendo a una idea que te compartieron"}
          </div>
          <div style={S.proposalBannerSub}>
            {props.proposalResponse === "adjust"
              ? "Cambia título, horario o notas y guarda tu versión final del plan."
              : "Revisa título, horario y notas. Si te cuadra, acéptala y guárdala; si no, ajústala antes de crear el plan."}
          </div>
        </section>
      ) : null}
    </>
  );
}

const S: Record<string, React.CSSProperties> = {
  hero: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    padding: "18px 16px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    marginBottom: 12,
  },
  heroLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  heroKicker: {
    alignSelf: "flex-start",
    fontSize: 11,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    opacity: 0.9,
    fontWeight: 900,
  },
  heroTitleRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  h1: {
    margin: 0,
    fontSize: 28,
    letterSpacing: "-0.6px",
  },
  heroSub: {
    fontSize: 13,
    opacity: 0.75,
    maxWidth: 520,
    lineHeight: 1.4,
  },
  heroMetaRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 10,
  },
  heroMetaPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(255,255,255,0.88)",
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.03)",
    fontSize: 12,
    fontWeight: 900,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  heroRight: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  ghostBtn: {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.92)",
    cursor: "pointer",
    fontWeight: 800,
  },
  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background:
      "linear-gradient(135deg, rgba(56,189,248,0.20), rgba(124,58,237,0.20))",
    color: "rgba(255,255,255,0.95)",
    cursor: "pointer",
    fontWeight: 900,
  },
  proposalBanner: {
    marginBottom: 12,
    padding: "14px 16px",
    borderRadius: 18,
    border: "1px solid rgba(56,189,248,0.22)",
    background: "rgba(56,189,248,0.10)",
    boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
  },
  proposalBannerEyebrow: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    fontWeight: 900,
    color: "rgba(125,211,252,0.95)",
  },
  proposalBannerTitle: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: 900,
    letterSpacing: "-0.02em",
    color: "rgba(226,242,255,0.96)",
  },
  proposalBannerSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.82)",
  },
};