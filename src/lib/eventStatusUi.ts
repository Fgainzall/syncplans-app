import type { CSSProperties } from "react";
import {
  getEventStatusLabel,
  getEventStatusSubtitle,
  type CanonicalEventStatus,
} from "@/lib/naming";

export type EventStatusTone =
  | "danger"
  | "warning"
  | "info"
  | "success"
  | "neutral";

export type EventStatusUi = {
  status: CanonicalEventStatus;
  label: string;
  compactLabel: string;
  subtitle: string;
  tone: EventStatusTone;
  priority: number;
  ctaLabel: string;
  badgeStyle: CSSProperties;
  panelStyle: CSSProperties;
};

const BADGE_STYLES: Record<EventStatusTone, CSSProperties> = {
  danger: {
    background: "rgba(127,29,29,0.88)",
    borderColor: "rgba(252,165,165,0.28)",
    color: "rgba(254,226,226,0.98)",
  },
  warning: {
    background: "rgba(120,53,15,0.88)",
    borderColor: "rgba(251,191,36,0.30)",
    color: "rgba(254,243,199,0.98)",
  },
  info: {
    background: "rgba(22,78,99,0.90)",
    borderColor: "rgba(103,232,249,0.28)",
    color: "rgba(207,250,254,0.98)",
  },
  success: {
    background: "rgba(20,83,45,0.92)",
    borderColor: "rgba(74,222,128,0.28)",
    color: "rgba(220,252,231,0.98)",
  },
  neutral: {
    background: "rgba(15,23,42,0.88)",
    borderColor: "rgba(148,163,184,0.22)",
    color: "rgba(226,232,240,0.96)",
  },
};

const PANEL_STYLES: Record<EventStatusTone, CSSProperties> = {
  danger: {
    background:
      "linear-gradient(180deg, rgba(127,29,29,0.22), rgba(127,29,29,0.08))",
    borderColor: "rgba(252,165,165,0.20)",
  },
  warning: {
    background:
      "linear-gradient(180deg, rgba(120,53,15,0.20), rgba(120,53,15,0.08))",
    borderColor: "rgba(251,191,36,0.20)",
  },
  info: {
    background:
      "linear-gradient(180deg, rgba(22,78,99,0.20), rgba(22,78,99,0.08))",
    borderColor: "rgba(103,232,249,0.18)",
  },
  success: {
    background:
      "linear-gradient(180deg, rgba(20,83,45,0.20), rgba(20,83,45,0.08))",
    borderColor: "rgba(74,222,128,0.18)",
  },
  neutral: {
    background:
      "linear-gradient(180deg, rgba(15,23,42,0.18), rgba(15,23,42,0.08))",
    borderColor: "rgba(148,163,184,0.16)",
  },
};

function getTone(status: CanonicalEventStatus): EventStatusTone {
  if (status === "conflicted") return "danger";
  if (status === "pending") return "warning";
  if (status === "adjusted") return "info";
  if (status === "confirmed") return "success";
  return "neutral";
}

function getPriority(status: CanonicalEventStatus): number {
  if (status === "conflicted") return 100;
  if (status === "pending") return 80;
  if (status === "adjusted") return 60;
  if (status === "confirmed") return 40;
  return 20;
}

function getCompactLabel(status: CanonicalEventStatus): string {
  if (status === "conflicted") return "Cruce";
  if (status === "pending") return "Decidir";
  if (status === "adjusted") return "Cambio";
  if (status === "confirmed") return "Listo";
  return "Plan";
}

function getCtaLabel(status: CanonicalEventStatus): string {
  if (status === "conflicted") return "Revisar cruce";
  if (status === "pending") return "Ver pendiente";
  if (status === "adjusted") return "Ver cambio";
  if (status === "confirmed") return "Ver plan";
  return "Abrir";
}

export function getEventStatusUi(
  status: CanonicalEventStatus,
  options?: { conflictsCount?: number | null }
): EventStatusUi {
  const tone = getTone(status);

  return {
    status,
    label: getEventStatusLabel(status),
    compactLabel: getCompactLabel(status),
    subtitle: getEventStatusSubtitle(
      status,
      Number(options?.conflictsCount ?? 0)
    ),
    tone,
    priority: getPriority(status),
    ctaLabel: getCtaLabel(status),
    badgeStyle: BADGE_STYLES[tone],
    panelStyle: PANEL_STYLES[tone],
  };
}