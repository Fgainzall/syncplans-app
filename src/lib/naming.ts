// src/lib/naming.tsx

/**
 * Fuente única de verdad semántica para SyncPlans.
 *
 * Objetivo:
 * - absorber legacy sin romper la app
 * - emitir siempre valores canónicos
 * - evitar que cada pantalla "interprete" tipos/estados por su cuenta
 */

/* =========================================================
   GROUP TYPES
========================================================= */

export type CanonicalGroupType = "personal" | "pair" | "family" | "other";

export type LegacyGroupType =
  | "solo"
  | "couple"
  | "shared";

export type SupportedGroupType = CanonicalGroupType | LegacyGroupType;

export function normalizeGroupType(
  value: string | null | undefined
): CanonicalGroupType {
  const safe = String(value ?? "").trim().toLowerCase();

  if (!safe) return "personal";

  if (safe === "personal" || safe === "solo") return "personal";
  if (safe === "pair" || safe === "couple") return "pair";
  if (safe === "family") return "family";
  if (safe === "other" || safe === "shared") return "other";

  return "other";
}

export function isCanonicalGroupType(
  value: string | null | undefined
): value is CanonicalGroupType {
  return (
    value === "personal" ||
    value === "pair" ||
    value === "family" ||
    value === "other"
  );
}

export function getGroupTypeLabel(
  value: string | null | undefined
): string {
  const normalized = normalizeGroupType(value);

  if (normalized === "personal") return "Personal";
  if (normalized === "pair") return "Pareja";
  if (normalized === "family") return "Familia";
  return "Compartido";
}

export function isSharedGroupType(
  value: string | null | undefined
): boolean {
  const normalized = normalizeGroupType(value);
  return normalized === "pair" || normalized === "family" || normalized === "other";
}

/* =========================================================
   EVENT DATE FIELDS
========================================================= */

export type EventDateFields = {
  start: string;
  end: string;
};

type EventDateInput = {
  start?: string | null;
  end?: string | null;
  start_at?: string | null;
  end_at?: string | null;
};

export function normalizeEventDateFields(
  input: EventDateInput | null | undefined
): EventDateFields {
  const start = String(input?.start ?? input?.start_at ?? "").trim();
  const end = String(input?.end ?? input?.end_at ?? "").trim();

  return {
    start,
    end,
  };
}

export function withNormalizedEventDateFields<T extends EventDateInput>(
  input: T
): Omit<T, "start_at" | "end_at"> & EventDateFields {
  const { start, end } = normalizeEventDateFields(input);

  return {
    ...input,
    start,
    end,
  };
}

/* =========================================================
   RESPONSES
========================================================= */

export type CanonicalResponseStatus = "pending" | "accepted" | "adjusted";

export function normalizeProposalResponse(
  value: string | null | undefined
): CanonicalResponseStatus {
  const safe = String(value ?? "").trim().toLowerCase();

  if (safe === "accepted") return "accepted";
  if (safe === "adjusted") return "adjusted";
  return "pending";
}

export function getProposalResponseLabel(
  value: string | null | undefined
): string {
  const normalized = normalizeProposalResponse(value);

  if (normalized === "accepted") return "Aceptado";
  if (normalized === "adjusted") return "Ajustado";
  return "Pendiente";
}

export function getProposalResponseActorLabel(
  value: string | null | undefined
): string {
  const normalized = normalizeProposalResponse(value);

  if (normalized === "accepted") return "aceptó";
  if (normalized === "adjusted") return "ajustó";
  return "pendiente";
}

export function getProposalResponseTone(
  value: string | null | undefined
): "accepted" | "adjusted" | "pending" {
  return normalizeProposalResponse(value);
}

/* =========================================================
   INVITE STATUS
========================================================= */

export type CanonicalInviteStatus = "pending" | "accepted" | "rejected";

export function normalizeInviteStatus(
  value: string | null | undefined
): CanonicalInviteStatus | null {
  const safe = String(value ?? "").trim().toLowerCase();

  if (safe === "accepted") return "accepted";
  if (safe === "rejected") return "rejected";
  if (safe === "pending") return "pending";
  return null;
}

/* =========================================================
   EVENT STATUS
========================================================= */

export type CanonicalEventStatus =
  | "conflicted"
  | "pending"
  | "adjusted"
  | "confirmed"
  | "scheduled";

export type DeriveEventStatusInput = {
  conflictsCount?: number | null;
  responseStatuses?: Array<string | null | undefined> | null;
  inviteStatus?: string | null | undefined;
  hasInviteProposedDate?: boolean | null;
  hasTrustSignal?: boolean | null;
};

export function deriveEventStatus(
  input: DeriveEventStatusInput | null | undefined
): CanonicalEventStatus {
  const conflictsCount = Number(input?.conflictsCount ?? 0);
  const responseStatuses = Array.isArray(input?.responseStatuses)
    ? input!.responseStatuses!
    : [];

  const normalizedResponses = responseStatuses.map((value) =>
    normalizeProposalResponse(value)
  );

  const hasPending = normalizedResponses.includes("pending");
  const hasAdjusted = normalizedResponses.includes("adjusted");
  const hasAccepted = normalizedResponses.includes("accepted");

  const inviteStatus = normalizeInviteStatus(input?.inviteStatus);
  const hasInviteProposedDate = Boolean(input?.hasInviteProposedDate);
  const hasTrustSignal = Boolean(input?.hasTrustSignal);

  if (conflictsCount > 0) return "conflicted";

  if (
    hasPending ||
    inviteStatus === "pending" ||
    (inviteStatus === "rejected" && hasInviteProposedDate)
  ) {
    return "pending";
  }

  if (hasAdjusted) return "adjusted";

  if (hasAccepted || inviteStatus === "accepted" || hasTrustSignal) {
    return "confirmed";
  }

  return "scheduled";
}

export function getEventStatusLabel(
  status: CanonicalEventStatus
): string {
  if (status === "conflicted") return "Requiere decisión";
  if (status === "pending") return "Pendiente";
  if (status === "adjusted") return "Ajustado";
  if (status === "confirmed") return "Confirmado";
  return "Programado";
}

export function getEventStatusSubtitle(
  status: CanonicalEventStatus,
  conflictsCount = 0
): string {
  if (status === "conflicted") {
    return conflictsCount === 1
      ? "Este plan choca con otro evento visible."
      : "Este plan tiene varios choques por revisar.";
  }

  if (status === "pending") {
    return "Todavía falta una decisión para cerrar este plan.";
  }

  if (status === "adjusted") {
    return "Hubo cambios antes de dejar este plan listo.";
  }

  if (status === "confirmed") {
    return "Este plan ya tiene una salida clara.";
  }

  return "Este plan ya está agendado.";
}