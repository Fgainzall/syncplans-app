import React from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { PublicInviteRow } from "@/lib/invitationsDb";
import type { ConflictTrustSignal } from "@/lib/conflictResolutionsLogDb";
import type { ProposalResponseRow } from "@/lib/proposalResponsesDb";
import {
  acceptEventForCurrentUser,
  declineEventForCurrentUser,
  type EventResponseStatus,
} from "@/lib/eventResponsesDb";
import { getEventStatusUi } from "@/lib/eventStatusUi";
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
type ProposalProfileLike = {
  display_name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
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
  proposalProfile: ProposalProfileLike | null;
  eventResponseStatus: EventResponseStatus | null;
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
  eventResponseStatus,
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

  const baseStatusUi = getTimelineEventStatusUi({
    conflictsCount: safeConflictsCount,
    responses: safeResponses,
    trustSignal,
    invite: safeInvite,
  });

  const [responseBusy, setResponseBusy] = React.useState<EventResponseStatus | null>(null);
  const [responseError, setResponseError] = React.useState<string | null>(null);
  const [localEventResponseStatus, setLocalEventResponseStatus] =
    React.useState<EventResponseStatus | null>(eventResponseStatus ?? null);

  React.useEffect(() => {
    setLocalEventResponseStatus(eventResponseStatus ?? null);
    setResponseError(null);
  }, [eventId, eventResponseStatus]);

  const conflictSummary =
    safeConflictsCount > 0
      ? buildConflictSummary(
   Array.from({ length: safeConflictsCount }, (_, idx) => ({
  id: String(idx),
})) as Parameters<typeof buildConflictSummary>[0]
        )
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
  const isEventSpecificGuestView =
    ev.visibility_source === "event_participant" && !isOwnerView;
  const canOpenEventDetails = !isEventSpecificGuestView;
  const canSelectEvent = !isEventSpecificGuestView;
  const canDelete = isOwnerView;
  const isSharedEvent = !!ev.group_id;
  const isInvitedGroupEvent = isSharedEvent && !isOwnerView;
  const effectiveEventResponseStatus: EventResponseStatus | null =
    localEventResponseStatus ??
    (isInvitedGroupEvent ? "pending" : isOwnerView && isSharedEvent ? "accepted" : null);
  const needsMyResponse =
    isInvitedGroupEvent && effectiveEventResponseStatus === "pending";
  const acceptedByMe =
    isInvitedGroupEvent && effectiveEventResponseStatus === "accepted";
  const declinedByMe =
    isInvitedGroupEvent && effectiveEventResponseStatus === "declined";
  const acceptedBySharedMember =
    isOwnerView && isSharedEvent && effectiveEventResponseStatus === "accepted";
  const declinedBySharedMember =
    isOwnerView && isSharedEvent && effectiveEventResponseStatus === "declined";

  const statusUi =
    safeConflictsCount > 0
      ? baseStatusUi
      : needsMyResponse
        ? getEventStatusUi("pending")
        : acceptedByMe ||
            acceptedBySharedMember ||
            (isOwnerView && isSharedEvent && baseStatusUi.status === "scheduled")
          ? getEventStatusUi("confirmed")
          : baseStatusUi;

  const ownerWaitingForResponse =
    isOwnerView &&
    isSharedEvent &&
    !acceptedBySharedMember &&
    !declinedBySharedMember &&
    baseStatusUi.status === "pending";
  const stateLabel = isEventSpecificGuestView
    ? "Invitado a este plan"
    : acceptedBySharedMember
      ? "Confirmado"
      : declinedBySharedMember
      ? "Rechazado"
      : ownerWaitingForResponse
        ? "Esperando respuesta"
        : declinedByMe
          ? "Rechazado por ti"
          : statusUi.label;
  const stateSubtitle = isEventSpecificGuestView
    ? "Te compartieron solo este evento. No tienes acceso al calendario completo ni permisos para editarlo."
    : acceptedBySharedMember
      ? "La otra persona ya confirmó este plan. La salida ya está clara para ambos."
      : declinedBySharedMember
      ? "La otra persona rechazó este plan. Ábrelo para ajustar o coordinar una nueva salida."
      : ownerWaitingForResponse
        ? "Tú ya creaste este plan. Falta que la otra persona confirme o proponga un cambio."
        : declinedByMe
          ? "Ya rechazaste este plan. Si necesitas retomarlo, coordínalo desde el grupo."
          : needsMyResponse
            ? "Te invitaron a este plan. Acéptalo si te funciona o recházalo para limpiar tu agenda."
            : conflictSummary || statusUi.subtitle;

  const basePrimaryAction = getTimelinePrimaryAction({
    eventId,
    status: statusUi.status,
  });
  const primaryAction = isEventSpecificGuestView || needsMyResponse || declinedByMe
    ? null
    : ownerWaitingForResponse || declinedBySharedMember
      ? {
          label: "Ver estado",
          href: `/events/new/details?eventId=${encodeURIComponent(eventId)}`,
        }
      : basePrimaryAction;

  const canAcceptProposal =
    isOwnerView &&
    invite?.status === "rejected" &&
    !!invite?.proposed_date &&
    !invite?.creator_response;
  const proposedDateLabel = formatProposedDate(invite?.proposed_date ?? null);

  async function respondToEvent(responseStatus: EventResponseStatus) {
    if (!ev.group_id || responseBusy) return;

    try {
      setResponseBusy(responseStatus);
      setResponseError(null);

      if (responseStatus === "accepted") {
        await acceptEventForCurrentUser(
          eventId,
          String(ev.group_id),
          "Accepted from events timeline"
        );
      } else if (responseStatus === "declined") {
        await declineEventForCurrentUser(
          eventId,
          String(ev.group_id),
          "Declined from events timeline"
        );
      }

      setLocalEventResponseStatus(responseStatus);
      window.dispatchEvent(new Event("sp:events-changed"));
    } catch (error) {
      console.error("[EventTimelineCard] respondToEvent error", error);
      setResponseError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar tu respuesta. Intenta otra vez."
      );
    } finally {
      setResponseBusy(null);
    }
  }

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
          checked={canSelectEvent ? checked : false}
          onChange={() => {
            if (canSelectEvent) onToggleSelected(eventId);
          }}
          disabled={!canSelectEvent}
          title={
            canSelectEvent
              ? "Seleccionar evento"
              : "Este plan fue compartido solo en modo lectura"
          }
          style={{
            ...S.checkbox,
            ...(!canSelectEvent ? S.checkboxDisabled : null),
          }}
        />
      </label>

      <div style={S.eventMain}>
        <div style={S.topBlock}>
          <div style={S.titleWrap}>
            <span
              style={{
                ...S.dot,
                background: signal.dot,
              }}
            />

            <div style={S.titleBlock}>
              <div style={S.titleEyebrowRow}>
                <span style={S.timePill}>
                  {start} – {end}
                </span>
                {ev.group?.name ? (
                  <span style={S.contextPill}>{ev.group.name}</span>
                ) : null}
                {externalLabel ? (
                  <span style={S.contextPillMuted}>{externalLabel}</span>
                ) : null}
              </div>

              <div style={S.titleText}>{ev.title || "Sin título"}</div>

              <div style={S.metaLine}>
                <span style={S.metaStrong}>{stateLabel}</span>
                <span>· Evento con lectura compartida</span>
              </div>
            </div>
          </div>

          <div style={S.mobileActionsRow}>
            {isOwnerView ? (
              <button
                onClick={() => void onCreateShareLink(ev)}
                style={isShareOpen ? activeShareBtn : shareBtn}
                title="Compartir"
                type="button"
                disabled={shareState?.loading}
              >
                {shareState?.loading ? "Generando…" : "Invitar"}
              </button>
            ) : null}

            {canOpenEventDetails ? (
              <button
                onClick={() => router.push(`/events/new/details?eventId=${eventId}`)}
                style={secondaryBtn}
                title="Abrir"
                type="button"
              >
                Abrir
              </button>
            ) : (
              <span style={S.readOnlyPill}>Solo este plan</span>
            )}

            {canDelete ? (
              <button
                onClick={() => void onDelete(eventId)}
                style={ghostDangerBtn}
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
              {stateLabel}
            </div>
            <div style={S.stateCardSub}>{stateSubtitle}</div>
          </div>

          <div style={S.stateCardActions}>
            {needsMyResponse ? (
              <>
                <button
                  type="button"
                  onClick={() => void respondToEvent("accepted")}
                  disabled={!!responseBusy}
                  style={{
                    ...S.stateCardAcceptBtn,
                    opacity: responseBusy ? 0.68 : 1,
                  }}
                >
                  {responseBusy === "accepted" ? "Aceptando…" : "Aceptar"}
                </button>

                <button
                  type="button"
                  onClick={() => void respondToEvent("declined")}
                  disabled={!!responseBusy}
                  style={{
                    ...S.stateCardRejectBtn,
                    opacity: responseBusy ? 0.68 : 1,
                  }}
                >
                  {responseBusy === "declined" ? "Rechazando…" : "Rechazar"}
                </button>
              </>
            ) : primaryAction ? (
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

        {responseError ? <div style={S.responseActionError}>{responseError}</div> : null}

        <div style={S.signalsRow}>
          <span
            style={{
              ...S.signalBadge,
              background: signal.badgeBg,
              borderColor: signal.badgeBorder,
              color: signal.badgeText,
              opacity: 0.88,
            }}
          >
            {signal.label}
          </span>

          {isEventSpecificGuestView ? (
            <span style={S.readOnlySignalBadge}>Acceso puntual · solo lectura</span>
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
              <div style={S.proposalInsightKicker}>{proposalInsight.kicker}</div>
              <div style={S.proposalInsightTitle}>{proposalInsight.title}</div>
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
              <div style={S.inlineProposalKicker}>Propuesta externa</div>
              <div style={S.inlineProposalTitle}>
                {proposedDateLabel
                  ? `Te propusieron mover este plan a ${proposedDateLabel}`
                  : "Te propusieron una nueva fecha para este plan"}
              </div>
              <div style={S.inlineProposalSub}>
                Si te sirve, entra directo con esta fecha y guarda la decisión
                pasando por el flujo real de conflictos.
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
                  <div style={S.inviteStatusText}>{invitePresentation.label}</div>
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

              <div style={S.inviteStatusDetail}>{invitePresentation.detail}</div>

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
                  Esta propuesta ya puede convertirse en una decisión real dentro
                  de SyncPlans
                </div>
                <div style={S.proposalActionSub}>
                  Entraremos con la fecha sugerida precargada para confirmar y
                  guardar pasando por el flujo real de conflictos.
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
                  Este es el link activo de este plan. Puedes copiarlo o enviarlo
                  por WhatsApp.
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
    padding: "14px 14px",
    borderRadius: 18,
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
  checkWrap: {
    display: "flex",
    alignItems: "flex-start",
    paddingTop: 4,
    flexShrink: 0,
  },
  checkbox: { width: 16, height: 16, cursor: "pointer" },
  checkboxDisabled: { cursor: "not-allowed", opacity: 0.38 },
  eventMain: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  topBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minWidth: 0,
  },
  titleWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    minWidth: 0,
    width: "100%",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
    marginTop: 7,
    flexShrink: 0,
    boxShadow: "0 0 0 4px rgba(255,255,255,0.04)",
  },
  titleBlock: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: 7,
    flex: 1,
  },
  titleEyebrowRow: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  timePill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 11,
    fontWeight: 900,
    color: "rgba(241,245,249,0.96)",
  },
  contextPill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.16)",
    background: "rgba(56,189,248,0.10)",
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(224,242,254,0.96)",
  },
  contextPillMuted: {
    display: "inline-flex",
    alignItems: "center",
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
    fontSize: 11,
    fontWeight: 800,
    color: "rgba(203,213,225,0.88)",
  },
  titleText: {
    fontSize: 17,
    fontWeight: 950,
    color: "rgba(255,255,255,0.98)",
    lineHeight: 1.35,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    letterSpacing: "-0.02em",
  },
  metaLine: {
    fontSize: 12,
    color: "rgba(203,213,225,0.76)",
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    lineHeight: 1.5,
  },
  metaStrong: {
    color: "rgba(241,245,249,0.95)",
    fontWeight: 800,
  },
  mobileActionsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 2,
  },
  readOnlyPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 34,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.045)",
    color: "rgba(226,232,240,0.86)",
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 12px",
    whiteSpace: "nowrap",
  },
  signalsRow: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap",
    alignItems: "center",
  },
  signalBadge: {
    borderRadius: 999,
    border: "1px solid transparent",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
  },
  readOnlySignalBadge: {
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.52)",
    color: "rgba(203,213,225,0.92)",
    padding: "6px 10px",
    fontSize: 11,
    fontWeight: 900,
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
  proposalInsightCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
  proposalInsightKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(226,232,240,0.92)",
  },
  proposalInsightTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    lineHeight: 1.4,
  },
  proposalInsightSub: {
    fontSize: 12,
    color: "rgba(226,232,240,0.82)",
    lineHeight: 1.5,
  },
  stateCard: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.18)",
    padding: "16px 16px 15px",
    backgroundBlendMode: "overlay",
    boxShadow: "0 18px 40px rgba(0,0,0,0.20)",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "nowrap",
  },
  stateCardCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    width: "100%",
  },
  stateCardLabel: {
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    overflowWrap: "normal",
    wordBreak: "normal",
  },
  stateCardSub: {
    fontSize: 12.5,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.62,
    maxWidth: 560,
    overflowWrap: "normal",
    wordBreak: "normal",
  },
  stateCardActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
    width: "100%",
  },
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
  stateCardAcceptBtn: {
    borderRadius: 999,
    border: "1px solid rgba(74,222,128,0.28)",
    background: "rgba(22,101,52,0.28)",
    color: "rgba(220,252,231,0.98)",
    fontSize: 12,
    fontWeight: 950,
    padding: "8px 13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  stateCardRejectBtn: {
    borderRadius: 999,
    border: "1px solid rgba(248,113,113,0.24)",
    background: "rgba(127,29,29,0.18)",
    color: "rgba(254,226,226,0.98)",
    fontSize: 12,
    fontWeight: 900,
    padding: "8px 13px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  responseActionError: {
    borderRadius: 12,
    border: "1px solid rgba(248,113,113,0.18)",
    background: "rgba(127,29,29,0.12)",
    color: "rgba(254,202,202,0.96)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45,
    padding: "9px 11px",
  },
  sharePanel: {
    marginTop: 6,
    borderRadius: 16,
    border: "1px solid rgba(103,232,249,0.16)",
    background:
      "linear-gradient(180deg, rgba(6,182,212,0.09), rgba(15,23,42,0.52))",
    padding: 13,
    display: "flex",
    flexDirection: "column",
    gap: 11,
  },
  sharePanelHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  shareKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(125,211,252,0.92)",
  },
  shareTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    letterSpacing: "-0.01em",
  },
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
  inviteStatusTopRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
  },
  inviteStatusLabelWrap: { display: "flex", flexDirection: "column", gap: 4 },
  inviteStatusKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(148,163,184,0.95)",
  },
  inviteStatusText: {
    fontSize: 15,
    fontWeight: 900,
    color: "rgba(255,255,255,0.98)",
    letterSpacing: "-0.01em",
  },
  inviteStatusDetail: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(226,232,240,0.9)",
  },
  inviteMetaBlock: { display: "flex", flexDirection: "column", gap: 4 },
  inviteMetaTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(125,211,252,0.9)",
  },
  inviteMetaValue: {
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(240,249,255,0.95)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  inlineProposalStrip: {
    borderRadius: 14,
    border: "1px solid rgba(165,180,252,0.24)",
    background:
      "linear-gradient(180deg, rgba(79,70,229,0.16), rgba(30,41,59,0.42))",
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  inlineProposalCopy: { display: "flex", flexDirection: "column", gap: 4 },
  inlineProposalKicker: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: 800,
    color: "rgba(199,210,254,0.95)",
  },
  inlineProposalTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(238,242,255,0.98)",
    lineHeight: 1.4,
  },
  inlineProposalSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(224,231,255,0.84)",
  },
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
  proposalActionTitle: {
    fontSize: 13,
    fontWeight: 900,
    color: "rgba(224,231,255,0.98)",
  },
  proposalActionSub: {
    fontSize: 12,
    lineHeight: 1.5,
    color: "rgba(224,231,255,0.86)",
  },
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

const baseActionBtn: React.CSSProperties = {
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 800,
  padding: "8px 12px",
  lineHeight: 1.1,
  whiteSpace: "nowrap",
  boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
};

const secondaryBtn: React.CSSProperties = {
  ...baseActionBtn,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.045)",
  color: "rgba(248,250,252,0.96)",
};

const shareBtn: React.CSSProperties = {
  ...baseActionBtn,
  border: "1px solid rgba(103,232,249,0.24)",
  background: "rgba(6,182,212,0.12)",
  color: "rgba(236,254,255,0.98)",
};

const activeShareBtn: React.CSSProperties = {
  ...shareBtn,
  border: "1px solid rgba(96,165,250,0.32)",
  background: "rgba(59,130,246,0.14)",
  boxShadow: "0 10px 24px rgba(59,130,246,0.16)",
};

const ghostDangerBtn: React.CSSProperties = {
  ...baseActionBtn,
  border: "1px solid rgba(248,113,113,0.18)",
  background: "rgba(127,29,29,0.14)",
  color: "rgba(254,226,226,0.96)",
};