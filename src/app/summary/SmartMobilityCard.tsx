// src/app/summary/SmartMobilityCard.tsx
"use client";

import type { CSSProperties } from "react";
import type { SmartMobilityState } from "./useSummaryData";

type Props = {
  smartMobility: SmartMobilityState;
};

function formatMinutesHuman(totalMinutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(totalMinutes ?? 0)));

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function minutesLabel(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "Calculando…";
  if (minutes <= -5) return "Vas justo";
  if (minutes <= 0) return "Es momento de salir";
  return `Sales en ${formatMinutesHuman(minutes)}`;
}

function etaLabel(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes <= 0) return "Estás muy cerca";
  return `${formatMinutesHuman(minutes)} de ruta`;
}

function distanceLabel(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export default function SmartMobilityCard({ smartMobility }: Props) {
  if (!smartMobility.loading && smartMobility.reason === "no_event_location") return null;

  const title = smartMobility.loading
    ? "Calculando cuándo salir…"
    : smartMobility.reason === "no_origin"
      ? "Activa ubicación para saber cuándo salir"
      : smartMobility.reason === "event_too_far"
        ? "Revisa tu ubicación antes de salir"
        : smartMobility.reason === "route_failed"
          ? "No pude calcular la ruta ahora"
          : minutesLabel(smartMobility.leaveInMinutes);

  const subtitle = smartMobility.loading
    ? "Estoy revisando tu próximo plan con dirección."
    : smartMobility.reason === "no_origin"
      ? "SyncPlans puede avisarte con mejor precisión cuando tenga tu ubicación real."
      : smartMobility.reason === "event_too_far"
        ? "El origen parece demasiado lejos para una alerta automática confiable. Actualiza tu ubicación."
        : smartMobility.reason === "route_failed"
          ? "Puedes abrir la ruta igual y volver a intentar en unos segundos."
          : smartMobility.eventTitle
            ? `Para ${smartMobility.eventTitle}. Incluye ${formatMinutesHuman(smartMobility.bufferMinutes)} de margen.`
            : `Incluye ${formatMinutesHuman(smartMobility.bufferMinutes)} de margen.`;

  const toneStyle = smartMobility.isLateRisk
    ? styles.dangerTone
    : smartMobility.shouldLeaveNow
      ? styles.warningTone
      : styles.readyTone;

  const eta = etaLabel(smartMobility.etaSeconds);
  const distance = distanceLabel(smartMobility.distanceMeters);

  return (
    <div style={{ ...styles.card, ...toneStyle }}>
      <div style={styles.copy}>
        <div style={styles.eyebrow}>Smart Mobility</div>
        <div style={styles.title}>{title}</div>
        <div style={styles.subtitle}>{subtitle}</div>

        <div style={styles.metaRow}>
          {eta ? <span style={styles.metaPill}>{eta}</span> : null}
          {distance ? <span style={styles.metaPill}>{distance}</span> : null}
          {smartMobility.calculatedAt ? <span style={styles.metaPill}>Tráfico actualizado</span> : null}
        </div>
      </div>

      <div style={styles.actions}>
        {smartMobility.mapsUrl ? (
          <a href={smartMobility.mapsUrl} target="_blank" rel="noreferrer" style={styles.primaryBtn}>
            Abrir Maps
          </a>
        ) : null}
        {smartMobility.wazeUrl ? (
          <a href={smartMobility.wazeUrl} target="_blank" rel="noreferrer" style={styles.secondaryBtn}>
            Waze
          </a>
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    borderRadius: 22,
    padding: 16,
    border: "1px solid rgba(125,211,252,0.18)",
    background:
      "linear-gradient(135deg, rgba(14,165,233,0.14), rgba(15,23,42,0.84))",
    boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
  },
  readyTone: {
    border: "1px solid rgba(56,189,248,0.22)",
  },
  warningTone: {
    border: "1px solid rgba(251,191,36,0.30)",
    background:
      "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(15,23,42,0.86))",
  },
  dangerTone: {
    border: "1px solid rgba(248,113,113,0.34)",
    background:
      "linear-gradient(135deg, rgba(185,28,28,0.22), rgba(15,23,42,0.88))",
  },
  copy: {
    minWidth: 0,
    flex: "1 1 360px",
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "rgba(125,211,252,0.92)",
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "rgba(255,255,255,0.98)",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.78)",
    fontWeight: 650,
    maxWidth: 720,
  },
  metaRow: {
    marginTop: 12,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: 850,
  },
  actions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },
  primaryBtn: {
    minHeight: 42,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(125,211,252,0.28)",
    background: "rgba(56,189,248,0.16)",
    color: "rgba(240,249,255,0.98)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  secondaryBtn: {
    minHeight: 42,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 14px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.92)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 850,
  },
};