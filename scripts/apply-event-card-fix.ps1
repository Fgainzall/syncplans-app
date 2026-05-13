$ErrorActionPreference = "Stop"

$cardPath = "src\components\EventTimelineCard.tsx"
if (!(Test-Path $cardPath)) {
  throw "No encontré $cardPath. Ejecuta este script desde la raíz del proyecto syncplans-app."
}

$content = Get-Content $cardPath -Raw
$content = $content -replace "`r`n", "`n"

$oldLogic = @'
  const effectiveEventResponseStatus: EventResponseStatus | null =
    localEventResponseStatus ??
    (isInvitedGroupEvent ? "pending" : isOwnerView && isSharedEvent ? "accepted" : null);
  const needsMyResponse =
    isInvitedGroupEvent && effectiveEventResponseStatus === "pending";
  const acceptedByMe =
    isInvitedGroupEvent && effectiveEventResponseStatus === "accepted";
  const declinedByMe =
    isInvitedGroupEvent && effectiveEventResponseStatus === "declined";

  const statusUi =
    safeConflictsCount > 0
      ? baseStatusUi
      : needsMyResponse
        ? getEventStatusUi("pending")
        : acceptedByMe || (isOwnerView && isSharedEvent && baseStatusUi.status === "scheduled")
          ? getEventStatusUi("confirmed")
          : baseStatusUi;

  const ownerWaitingForResponse =
    isOwnerView && isSharedEvent && baseStatusUi.status === "pending";
  const stateLabel = ownerWaitingForResponse
    ? "Esperando respuesta"
    : declinedByMe
      ? "Rechazado por ti"
      : statusUi.label;
  const stateSubtitle = ownerWaitingForResponse
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
  const primaryAction = needsMyResponse || declinedByMe
    ? null
    : ownerWaitingForResponse
      ? {
          label: "Ver estado",
          href: `/events/new/details?eventId=${encodeURIComponent(eventId)}`,
        }
      : basePrimaryAction;
'@

$newLogic = @'
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
  const stateLabel = acceptedBySharedMember
    ? "Confirmado"
    : declinedBySharedMember
      ? "Rechazado"
      : ownerWaitingForResponse
        ? "Esperando respuesta"
        : declinedByMe
          ? "Rechazado por ti"
          : statusUi.label;
  const stateSubtitle = acceptedBySharedMember
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
  const primaryAction = needsMyResponse || declinedByMe
    ? null
    : ownerWaitingForResponse || declinedBySharedMember
      ? {
          label: "Ver estado",
          href: `/events/new/details?eventId=${encodeURIComponent(eventId)}`,
        }
      : basePrimaryAction;
'@

if (!$content.Contains($oldLogic)) {
  throw "No pude aplicar el bloque funcional en EventTimelineCard.tsx. El archivo cambió y hay que revisarlo manualmente."
}
$content = $content.Replace($oldLogic, $newLogic)

$replacements = @(
  @{
    Old = @'
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
'@
    New = @'
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
'@
  },
  @{
    Old = @'
  stateCardCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    flex: 1,
  },
'@
    New = @'
  stateCardCopy: {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    minWidth: 0,
    width: "100%",
  },
'@
  },
  @{
    Old = @'
  stateCardLabel: { fontSize: 12, fontWeight: 900, letterSpacing: "-0.01em" },
'@
    New = @'
  stateCardLabel: {
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "-0.01em",
    lineHeight: 1.25,
    overflowWrap: "normal",
    wordBreak: "normal",
  },
'@
  },
  @{
    Old = @'
  stateCardSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.5,
  },
'@
    New = @'
  stateCardSub: {
    fontSize: 12.5,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 1.62,
    maxWidth: 560,
    overflowWrap: "normal",
    wordBreak: "normal",
  },
'@
  },
  @{
    Old = @'
  stateCardActions: { display: "flex", alignItems: "center", gap: 8 },
'@
    New = @'
  stateCardActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    flexWrap: "wrap",
    width: "100%",
  },
'@
  }
)

foreach ($replacement in $replacements) {
  if (!$content.Contains($replacement.Old)) {
    throw "No pude aplicar un bloque visual de EventTimelineCard.tsx. El archivo cambió y hay que revisarlo manualmente."
  }
  $content = $content.Replace($replacement.Old, $replacement.New)
}

Set-Content -Path $cardPath -Value $content -NoNewline
Write-Host "EventTimelineCard.tsx corregido: estado compartido + card menos encajonada."
