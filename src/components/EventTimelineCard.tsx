
import React from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { PublicInviteRow } from "@/lib/invitationsDb";
import type { ConflictTrustSignal } from "@/lib/conflictResolutionsLogDb";
import type { ProposalResponseRow } from "@/lib/proposalResponsesDb";
import {
  buildConflictSummary,
  buildProposalContextLine,
  formatProposedDate,
  getExternalLabel,
  getGroupSignal,
  getInviteBadgeStyle,
  getInvitePresentation,
  getProposalInsight,
  getProposalInsightStyle,
  getTimelineEventStatusUi,
  getTimelinePrimaryAction,
  humanizeRelativeDate,
  openEventFromCaptureFallback,
  resolveEventOwnerId,
  type TimelineEvent,
} from "./eventsTimelineHelpers";

type ShareState = {
  loading: boolean;
  link: string | null;
  error: string | null;
  copied: boolean;
};

type Props = {
  ev: TimelineEvent;
  checked: boolean;
  focused: boolean;
  currentUserId: string | null;
  onToggleSelected: (id: string) => void;
  onDelete: (id: string) => void | Promise<void>;
  onCreateShareLink: (ev: TimelineEvent) => Promise<string | null>;
  onCopyLink: (ev: TimelineEvent) => Promise<void>;
  onWhatsApp: (ev: TimelineEvent) => Promise<void>;
  onCloseShare: (eventId: string) => void;
  router: AppRouterInstance;
  shareState?: ShareState;
  invite: PublicInviteRow | null;
  inviteStatesLoading: boolean;
  trustSignal: ConflictTrustSignal | null;
  proposalResponse: ProposalResponseRow | null;
  proposalResponseGroup: ProposalResponseRow[];
  proposalProfile: any;
  conflictsCount: number;
  eventRef?: (node: HTMLDivElement | null) => void;
};

export default function EventTimelineCard({
  ev,
  checked,
  focused,
  currentUserId,
  onToggleSelected,
  onDelete,
  onCreateShareLink,
  onCopyLink,
  onWhatsApp,
  onCloseShare,
  router,
  shareState,
  invite,
  inviteStatesLoading,
  trustSignal,
  proposalResponse,
  proposalResponseGroup,
  proposalProfile,
  conflictsCount,
  eventRef,
}: Props) {
  const signal = getGroupSignal(ev);
  const externalLabel = getExternalLabel(ev);
  const eventId = String(ev.id);
  const invitePresentation = getInvitePresentation(invite);
  const proposalInsight = getProposalInsight(proposalResponse?.response);
  const proposalActorName =
    proposalProfile?.display_name ??
    proposalProfile?.full_name ??
    proposalProfile?.first_name ??
    null;
  const proposalTime = humanizeRelativeDate(proposalResponse?.updated_at);
  const proposalContextLine = buildProposalContextLine({
    response: proposalResponse?.response,
    displayName: proposalActorName,
    relativeDate: proposalTime,
  });
const safeResponses =
  trustSignal?.label === "resolved" || trustSignal?.label === "auto_adjusted"
    ? []
    : (proposalResponseGroup ?? []).filter(
        (row) => String(row?.response ?? "").toLowerCase() !== "pending"
      );

const safeConflictsCount =
  trustSignal?.label === "resolved" || trustSignal?.label === "auto_adjusted"
    ? 0
    : conflictsCount;

const safeInvite =
  trustSignal?.label === "resolved" || trustSignal?.label === "auto_adjusted"
    ? null
    : invite;

const statusUi = getTimelineEventStatusUi({
  conflictsCount: safeConflictsCount,
  responses: safeResponses,
  trustSignal,
  invite: safeInvite,
});
  const primaryAction = getTimelinePrimaryAction({
    eventId,
    status: statusUi.status,
  });
  const conflictSummary = conflictsCount > 0
    ? buildConflictSummary(Array.from({ length: conflictsCount }, (_, idx) => ({ id: String(idx) } as any)))
    : null;

  const start = new Date(ev.start).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = new Date(ev.end).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const isShareOpen =
    !!shareState?.loading || !!shareState?.link || !!shareState?.error;
  const isOwnerView =
    !!currentUserId && resolveEventOwnerId(ev) === currentUserId;
  const canDelete = isOwnerView;
  const canAcceptProposal =
    isOwnerView &&
    invite?.status === "rejected" &&
    !!invite?.proposed_date &&
    !invite?.creator_response;
  const proposedDateLabel = formatProposedDate(invite?.proposed_date ?? null);

  function onTakeExternalProposal() {
    if (!invite?.proposed_date) return;

    const proposedStart = new Date(invite.proposed_date);
    if (Number.isNaN(proposedStart.getTime())) return;

    const durationMs = Math.max(
      new Date(ev.end).getTime() - new Date(ev.start).getTime(),
      60 * 60 * 1000
    );
    const proposedEnd = new Date(proposedStart.getTime() + durationMs);

    const qp = new URLSearchParams();
    qp.set("eventId", eventId);
    qp.set("proposedStart", proposedStart.toISOString());
    qp.set("proposedEnd", proposedEnd.toISOString());
    qp.set("proposalSource", "public_invite");
    qp.set("proposalIntent", "accept");

    router.push(`/events/new/details?${qp.toString()}`);
  }

  return (
    <div
      ref={eventRef}
      data-event-id={eventId}
      style={{
        ...S.eventRow,
        ...(focused ? S.eventRowFocused : null),
      }}
    >
      <label style={S.checkWrap}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggleSelected(eventId)}
          style={S.checkbox}
        />
      </label>

      <div style={S.eventMain}>
        <div style={S.titleRow}>
          <div style={S.titleWrap}>
            <span
              style={{
                ...S.dot,
                background: signal.dot,
              }}
            />
            <div style={S.titleBlock}>
              <div style={S.titleText}>{ev.title || "Sin título"}</div>

              <div style={S.metaLine}>
                <span>
                  {start} – {end}
                </span>
                {ev.group?.name ? <span>· {ev.group.name}</span> : null}
              </div>
            </div>
          </div>

          <div style={S.actions}>
            {isOwnerView ? (
              <button
                onClick={() => void onCreateShareLink(ev)}
                style={isShareOpen ? activeIconBtn : iconBtn}
                title="Compartir"
                type="button"
                disabled={shareState?.loading}
              >
                {shareState?.loading ? "…" : "🔗"}
              </button>
            ) : null}

            <button
              onClick={() =>
                router.push(`/events/new/details?eventId=${eventId}`)
              }
              style={iconBtn}
              title="Editar"
              type="button"
            >
              Abrir
            </button>

            {canDelete ? (
              <button
                onClick={() => void onDelete(eventId)}
                style={iconBtn}
                title="Eliminar"
                type="button"
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>

        <div
          style={{
            ...S.stateCard,
            borderColor: String(
              statusUi.panelStyle.borderColor ?? "rgba(148,163,184,0.16)"
            ),
            background: String(
              statusUi.panelStyle.background ??
                "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.08))"
            ),
          }}
        >
          <div style={S.stateCardCopy}>
            <div
              style={{
                ...S.stateCardLabel,
                color: String(
                  statusUi.badgeStyle.color ?? "rgba(226,232,240,0.96)"
                ),
              }}
            >
              {statusUi.label}
            </div>
            <div style={S.stateCardSub}>
              {conflictSummary || statusUi.subtitle}
            </div>
          </div>

          <div style={S.stateCardActions}>
            {primaryAction ? (
              <button
                type="button"
                onClick={() => router.push(primaryAction.href)}
                style={S.stateCardPrimaryBtn}
              >
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        </div>

        <div style={S.signalsRow}>
          <span
            style={{
              ...S.signalBadge,
              background: signal.badgeBg,
              borderColor: signal.badgeBorder,
              color: signal.badgeText,
              opacity: 0.8,
            }}
          >
            {signal.label}
          </span>

          {externalLabel ? (
            <span
              style={{
                ...S.signalBadge,
                background: "rgba(22,78,99,0.9)",
                borderColor: "rgba(103,232,249,0.22)",
                color: "rgba(207,250,254,0.98)",
                opacity: 0.8,
              }}
            >
              {externalLabel}
            </span>
          ) : null}
        </div>

        {proposalInsight ? (
          <div
            style={{
              ...S.proposalInsightCard,
              ...getProposalInsightStyle(proposalInsight.tone),
            }}
          >
            <div style={S.proposalInsightCopy}>
              <div style={S.proposalInsightKicker}>
                {proposalInsight.kicker}
              </div>
              <div style={S.proposalInsightTitle}>
                {proposalInsight.title}
              </div>
              <div style={S.proposalInsightSub}>
                {proposalContextLine || proposalInsight.subtitle}
              </div>
            </div>

            {proposalResponse?.response === "pending" ||
            proposalResponse?.response === "adjusted" ? (
              <button
                type="button"
                onClick={() =>
                  router.push(`/events/new/details?eventId=${eventId}`)
                }
                style={S.proposalSecondaryBtn}
              >
                Abrir
              </button>
            ) : null}
          </div>
        ) : null}

        {canAcceptProposal ? (
          <div style={S.inlineProposalStrip}>
            <div style={S.inlineProposalCopy}>
              <div style={S.inlineProposalKicker}>
                Propuesta externa
              </div>
              <div style={S.inlineProposalTitle}>
                {proposedDateLabel
                  ? `Te propusieron mover este plan a ${proposedDateLabel}`
                  : "Te propusieron una nueva fecha para este plan"}
              </div>
              <div style={S.inlineProposalSub}>
                Si te sirve, entra directo con esta fecha y guarda la
                decisión pasando por el flujo real de conflictos.
              </div>
            </div>

            <div style={S.inlineProposalActions}>
              <button
                type="button"
                onClick={onTakeExternalProposal}
                style={S.proposalPrimaryBtn}
              >
                Tomar fecha
              </button>

              <button
                type="button"
                onClick={() => openEventFromCaptureFallback(router, ev)}
                style={S.proposalSecondaryBtn}
              >
                Ver evento
              </button>
            </div>
          </div>
        ) : null}

        {isOwnerView &&
        (shareState?.loading || shareState?.link || shareState?.error) ? (
          <div style={S.sharePanel}>
            <div style={S.sharePanelHeader}>
              <div>
                <div style={S.shareKicker}>Invitación externa</div>
                <div style={S.shareTitle}>Compartir este plan</div>
              </div>

              <button
                type="button"
                onClick={() => onCloseShare(eventId)}
                style={S.shareCloseBtn}
              >
                Cerrar
              </button>
            </div>

            {inviteStatesLoading && !invite ? (
              <div style={S.shareSubtle}>Cargando estado actual…</div>
            ) : null}

            <div style={S.inviteStatusCard}>
              <div style={S.inviteStatusTopRow}>
                <div style={S.inviteStatusLabelWrap}>
                  <div style={S.inviteStatusKicker}>Estado actual</div>
                  <div style={S.inviteStatusText}>
                    {invitePresentation.label}
                  </div>
                </div>

                <span
                  style={{
                    ...S.signalBadge,
                    ...getInviteBadgeStyle(invitePresentation.tone),
                  }}
                >
                  {invitePresentation.label}
                </span>
              </div>

              <div style={S.inviteStatusDetail}>
                {invitePresentation.detail}
              </div>

              {invite?.message ? (
                <div style={S.inviteMetaBlock}>
                  <div style={S.inviteMetaTitle}>Mensaje</div>
                  <div style={S.inviteMetaValue}>{invite.message}</div>
                </div>
              ) : null}

              {invite?.proposed_date ? (
                <div style={S.inviteMetaBlock}>
                  <div style={S.inviteMetaTitle}>Fecha propuesta</div>
                  <div style={S.inviteMetaValue}>
                    {formatProposedDate(invite.proposed_date)}
                  </div>
                </div>
              ) : null}
            </div>

            {canAcceptProposal ? (
              <div style={S.proposalActionBox}>
                <div style={S.proposalActionTitle}>
                  Esta propuesta ya puede convertirse en una decisión
                  real dentro de SyncPlans
                </div>
                <div style={S.proposalActionSub}>
                  Entraremos con la fecha sugerida precargada para
                  confirmar y guardar pasando por el flujo real de
                  conflictos.
                </div>

                <div style={S.inlineProposalActions}>
                  <button
                    type="button"
                    onClick={onTakeExternalProposal}
                    style={S.proposalPrimaryBtn}
                  >
                    Tomar fecha
                  </button>

                  <button
                    type="button"
                    onClick={() => openEventFromCaptureFallback(router, ev)}
                    style={S.proposalSecondaryBtn}
                  >
                    Ver evento
                  </button>
                </div>
              </div>
            ) : null}

            {shareState?.loading ? (
              <div style={S.shareStatus}>Generando link…</div>
            ) : shareState?.error ? (
              <div style={S.shareError}>{shareState.error}</div>
            ) : shareState?.link ? (
              <>
                <div style={S.shareStatus}>
                  Este es el link activo de este plan. Puedes copiarlo o
                  enviarlo por WhatsApp.
                </div>

                <div style={S.shareLinkBox}>{shareState.link}</div>

                <div style={S.shareActionsRow}>
                  <button
                    type="button"
                    onClick={() => void onCopyLink(ev)}
                    style={S.sharePrimaryBtn}
                  >
                    {shareState.copied ? "Link copiado" : "Copiar link"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void onWhatsApp(ev)}
                    style={S.shareSecondaryBtn}
                  >
                    Enviar por WhatsApp
                  </button>
                </div>
              </>
            ) : (
              <div style={S.shareSubtle}>
                Genera el link para compartir este plan externamente.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  eventRow: {
    display: "flex",
    alignItems: "stretch",
    gap: 10,
    padding: "12px 13px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.11)",
    background: "rgba(6,10,20,0.58)",
    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
    scrollMarginTop: 110,
    transition:
      "border-color 180ms ease, box-shadow 180ms ease, background 180ms ease",
  },
  eventRowFocused: {
    border: "1px solid rgba(56,189,248,0.42)",
    background: "rgba(8,47,73,0.34)",
    boxShadow:
      "0 0 0 1px rgba(56,189,248,0.16), 0 14px 34px rgba(56,189,248,0.12)",
  },
  checkWrap: { display: "flex", alignItems: "flex-start", paddingTop: 2 },
  checkbox: { width: 16, height: 16, cursor: "pointer" },
  eventMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  titleRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    minWidth: 0,
    flex: 1,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: 6,
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.04)",
  },
  titleBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  titleText: {
    fontSize: 14,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  metaLine: {
    fontSize: 11,
    color: "rgba(203,213,225,0.76)",
    display: "flex",
    gap: 5,
    flexWrap: "wrap",
    lineHeight: 1.45,
  },
  actions: { display: "flex", gap: 7, flexShrink: 0 },
  signalsRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  signalBadge: {
    borderRadius: 999,
    border: "1px solid transparent",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1,
  },
  proposalInsightCard: {
    borderRadius: 14,
    padding: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  proposalInsightCopy: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 },
  proposalInsightKicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 800, color: "rgba(226,232,240,0.92)" },
  proposalInsightTitle: { fontSize: 13, fontWeight: 900, color: "rgba(255,255,255,0.98)", lineHeight: 1.4 },
  proposalInsightSub: { fontSize: 12, color: "rgba(226,232,240,0.82)", lineHeight: 1.5 },
  stateCard: {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: 14,
    backgroundBlendMode: "overlay",
    boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  stateCardCopy: { display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 },
  stateCardLabel: { fontSize: 12, fontWeight: 900, letterSpacing: "-0.01em" },
  stateCardSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 },
  stateCardActions: { display: "flex", alignItems: "center", gap: 8 },
  stateCardPrimaryBtn: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(7,11,22,0.42)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  sharePanel: {
    marginTop: 6,
    borderRadius: 16,
    border: "1px solid rgba(103,232,249,0.16)",
    background: "linear-gradient(180deg, rgba(6,182,212,0.09), rgba(15,23,42,0.52))",
    padding: 13,
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },
  sharePanelHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  shareKicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 800, color: "rgba(125,211,252,0.92)" },
  shareTitle: { fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,0.98)", letterSpacing: "-0.01em" },
  shareCloseBtn: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(226,232,240,0.95)",
    fontSize: 12,
    fontWeight: 700,
    padding: "7px 10px",
    cursor: "pointer",
  },
  shareStatus: { fontSize: 12, color: "rgba(226,232,240,0.88)" },
  shareSubtle: { fontSize: 12, color: "rgba(191,219,254,0.86)" },
  shareError: { fontSize: 12, color: "rgba(252,165,165,0.98)", fontWeight: 700 },
  shareLinkBox: {
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.55)",
    color: "rgba(224,242,254,0.96)",
    fontSize: 12,
    lineHeight: 1.5,
    padding: "11px 12px",
    wordBreak: "break-all",
  },
  shareActionsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  sharePrimaryBtn: {
    borderRadius: 999,
    border: "1px solid rgba(103,232,249,0.28)",
    background: "rgba(6,182,212,0.18)",
    color: "rgba(236,254,255,0.98)",
    fontSize: 12,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
  shareSecondaryBtn: {
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
  inviteStatusCard: {
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(2,6,23,0.42)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  inviteStatusTopRow: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
  inviteStatusLabelWrap: { display: "flex", flexDirection: "column", gap: 4 },
  inviteStatusKicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 800, color: "rgba(148,163,184,0.95)" },
  inviteStatusText: { fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,0.98)", letterSpacing: "-0.01em" },
  inviteStatusDetail: { fontSize: 12, lineHeight: 1.45, color: "rgba(226,232,240,0.9)" },
  inviteMetaBlock: { display: "flex", flexDirection: "column", gap: 4 },
  inviteMetaTitle: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 800, color: "rgba(125,211,252,0.9)" },
  inviteMetaValue: { fontSize: 12, lineHeight: 1.45, color: "rgba(240,249,255,0.95)", whiteSpace: "pre-wrap", wordBreak: "break-word" },
  inlineProposalStrip: {
    borderRadius: 14,
    border: "1px solid rgba(165,180,252,0.24)",
    background: "linear-gradient(180deg, rgba(79,70,229,0.16), rgba(30,41,59,0.42))",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  inlineProposalCopy: { display: "flex", flexDirection: "column", gap: 4 },
  inlineProposalKicker: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 800, color: "rgba(199,210,254,0.95)" },
  inlineProposalTitle: { fontSize: 13, fontWeight: 900, color: "rgba(238,242,255,0.98)", lineHeight: 1.4 },
  inlineProposalSub: { fontSize: 12, lineHeight: 1.5, color: "rgba(224,231,255,0.84)" },
  inlineProposalActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  proposalActionBox: {
    borderRadius: 14,
    border: "1px solid rgba(165,180,252,0.22)",
    background: "rgba(49,46,129,0.18)",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  proposalActionTitle: { fontSize: 13, fontWeight: 900, color: "rgba(224,231,255,0.98)" },
  proposalActionSub: { fontSize: 12, lineHeight: 1.5, color: "rgba(224,231,255,0.86)" },
  proposalPrimaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    border: "1px solid rgba(165,180,252,0.28)",
    background: "rgba(99,102,241,0.22)",
    color: "rgba(238,242,255,0.98)",
    fontSize: 12,
    fontWeight: 900,
    padding: "10px 14px",
    cursor: "pointer",
  },
  proposalSecondaryBtn: {
    alignSelf: "flex-start",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.96)",
    fontSize: 12,
    fontWeight: 800,
    padding: "10px 14px",
    cursor: "pointer",
  },
};

const iconBtn: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.045)",
  borderRadius: 11,
  padding: "7px 9px",
  cursor: "pointer",
  fontSize: 13,
  boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
};

const activeIconBtn: React.CSSProperties = {
  ...iconBtn,
  border: "1px solid rgba(96,165,250,0.28)",
  background: "rgba(59,130,246,0.12)",
  boxShadow: "0 10px 24px rgba(59,130,246,0.16)",
};