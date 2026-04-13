"use client";

import React from "react";

type ProposalResponse = "adjust" | "accept" | null;

type Props = {
  visible: boolean;
  isProposal?: boolean;
  isShared?: boolean;
  title?: string;
  proposalResponse: ProposalResponse;
  sharingPostSave: boolean;
  postSaveShareUrl: string | null;
  onViewCalendar: () => void;
  onShare: () => void;
  onCreateAnother: () => void;
  onCopyLink: () => void | Promise<void>;
  onCloseShareUrl: () => void;
};

function getHeaderText(props: Props) {
  if (props.isProposal) {
    return props.proposalResponse === "adjust"
      ? "Propuesta ajustada"
      : "Propuesta aceptada";
  }

  return props.isShared ? "Plan compartido guardado" : "Evento guardado";
}

function getBodyText(props: Props) {
  if (props.isProposal) {
    if (props.proposalResponse === "adjust") {
      return props.title
        ? `"${props.title}" ya quedó ajustada y guardada como plan. ¿Qué quieres hacer ahora?`
        : "La propuesta ya quedó ajustada y guardada como plan. ¿Qué quieres hacer ahora?";
    }

    return props.title
      ? `"${props.title}" ya quedó aceptada y convertida en plan. ¿Qué quieres hacer ahora?`
      : "La propuesta ya quedó aceptada y convertida en plan. ¿Qué quieres hacer ahora?";
  }

  if (props.isShared) {
    return props.title
      ? `"${props.title}" ya quedó en un lugar compartido. Este es el mejor momento para sumar a la otra persona: cuando entre, verá exactamente lo mismo que tú y podrán coordinar desde el mismo contexto.`
      : "Tu plan ya quedó en un lugar compartido. Este es el mejor momento para sumar a la otra persona: cuando entre, verá exactamente lo mismo que tú y podrán coordinar desde el mismo contexto.";
  }

  return props.title
    ? `"${props.title}" ya quedó listo. ¿Qué quieres hacer ahora?`
    : "Tu evento ya quedó listo. ¿Qué quieres hacer ahora?";
}

function getCreateAnotherLabel(props: Props) {
  if (!props.isProposal) return props.isShared ? "Crear otro plan compartido" : "Crear otro similar";
  return props.proposalResponse === "adjust"
    ? "Crear otra propuesta para ajustar"
    : "Crear otra propuesta similar";
}

export default function PostSaveActionsCard(props: Props) {
  if (!props.visible) return null;

  return (
    <div style={S.wrap}>
      <div>
        <div style={S.title}>{getHeaderText(props)}</div>
        <div style={S.subtitle}>{getBodyText(props)}</div>
      </div>

      <div style={S.actionsRow}>
        <button type="button" onClick={props.onViewCalendar} style={S.ghostBtn}>
          {props.isProposal ? "Ver plan en calendario" : "Ver calendario"}
        </button>

        {props.isShared ? (
          <button
            type="button"
            onClick={props.onShare}
            disabled={props.sharingPostSave}
            style={{ ...S.ghostBtn, opacity: props.sharingPostSave ? 0.7 : 1 }}
          >
            {props.sharingPostSave ? "Preparando link…" : "Invitar o compartir ahora"}
          </button>
        ) : null}

        <button type="button" onClick={props.onCreateAnother} style={S.primaryBtn}>
          {getCreateAnotherLabel(props)}
        </button>
      </div>

      {props.postSaveShareUrl ? (
        <div style={S.shareBox}>
          <div style={S.shareLabel}>Link listo para sumar a alguien</div>

          <div style={S.shareUrl}>{props.postSaveShareUrl}</div>

          <div style={S.shareActions}>
            <button type="button" onClick={props.onCopyLink} style={S.ghostBtn}>
              Copiar invitación
            </button>

            <button
              type="button"
              onClick={props.onCloseShareUrl}
              style={S.ghostBtn}
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    padding: 14,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 900,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.72,
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  shareBox: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  shareLabel: {
    fontSize: 12,
    opacity: 0.72,
  },
  shareUrl: {
    fontSize: 12,
    wordBreak: "break-all",
    opacity: 0.9,
  },
  shareActions: {
    display: "flex",
    gap: 8,
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
};