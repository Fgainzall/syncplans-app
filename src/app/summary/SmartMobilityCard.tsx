"use client";

import type { CSSProperties } from "react";
import type { SmartMobilityState } from "./useSummaryData";

type Props = {
  smartMobility: SmartMobilityState;
};

const MAX_VISIBLE_LEAVE_MINUTES = 180; // 3 horas

function formatMinutesHuman(totalMinutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(totalMinutes ?? 0)));

  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function minutesLabel(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return "Calculando cuándo salir…";
  if (minutes <= -5) return "Vas tarde";
  if (minutes <= 0) return "Sal ahora";
  return `Sal en ${formatMinutesHuman(minutes)}`;
}

function baseRouteLabel(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes <= 0) return "Estás muy cerca";
  return `${formatMinutesHuman(minutes)} de ruta`;
}

function recommendedTravelLabel(seconds: number | null, bufferMinutes: number): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;

  const routeMinutes = Math.max(0, Math.round(seconds / 60));
  const totalMinutes = routeMinutes + Math.max(0, Math.round(Number(bufferMinutes ?? 0)));

  if (totalMinutes <= 0) return "Estás muy cerca";
  return `${formatMinutesHuman(totalMinutes)} con margen`;
}

function distanceLabel(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function originLabel(
  source: string | null | undefined,
  confidence: string | null | undefined
): string | null {
  if (!source) return null;

  if (source === "gps") return "Desde tu ubicación actual";
  if (source === "stored" || source === "last_known") {
    if (confidence === "high_confidence") return "Desde tu última ubicación confiable";
    return "Desde tu última ubicación guardada";
  }
  if (source === "url") return "Desde el origen enviado";
  return null;
}

function relativeFreshnessLabel(value: string | null | undefined, prefix: string): string | null {
  if (!value) return null;

  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;

  const diffMinutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));

  if (diffMinutes < 1) return `${prefix} ahora`;
  if (diffMinutes < 60) return `${prefix} hace ${diffMinutes} min`;

  const hours = Math.round(diffMinutes / 60);
  if (hours < 24) return `${prefix} hace ${hours} h`;

  const days = Math.round(hours / 24);
  return `${prefix} hace ${days} d`;
}

function eventTimeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleTimeString("es-PE", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function SmartMobilityCard({ smartMobility }: Props) {
  const leaveInMinutes = smartMobility.leaveInMinutes;

  if (!smartMobility.loading && smartMobility.reason === "no_event_location") return null;

  if (
    !smartMobility.loading &&
    leaveInMinutes !== null &&
    Number.isFinite(leaveInMinutes) &&
    leaveInMinutes > MAX_VISIBLE_LEAVE_MINUTES
  ) {
    return null;
  }

  const eventTitle = String(smartMobility.eventTitle ?? "tu próximo plan").trim();
  const eventStart = eventTimeLabel(smartMobility.eventStartIso);

  const title = smartMobility.loading
    ? "Calculando cuándo salir…"
    : smartMobility.reason === "no_origin"
      ? "Activa ubicación para saber cuándo salir"
      : smartMobility.reason === "event_too_far"
        ? "Actualiza tu ubicación antes de confiar en el ETA"
        : smartMobility.reason === "route_failed"
          ? "No pude calcular la ruta ahora"
          : minutesLabel(leaveInMinutes);

  const subtitle = smartMobility.loading
    ? "Estoy revisando tu próximo plan con dirección."
    : smartMobility.reason === "no_origin"
      ? "SyncPlans puede avisarte con mejor precisión cuando tenga tu ubicación real."
      : smartMobility.reason === "event_too_far"
        ? "La ubicación actual o guardada parece demasiado lejos del destino. Actualízala antes de salir."
        : smartMobility.reason === "route_failed"
          ? "Puedes abrir la ruta igual y volver a intentar en unos segundos."
          : `Para ${eventTitle}${eventStart ? ` · ${eventStart}` : ""}. Estimado en auto con ${formatMinutesHuman(
              smartMobility.bufferMinutes
            )} de margen.`;

  const toneStyle = smartMobility.isLateRisk
    ? styles.dangerTone
    : smartMobility.shouldLeaveNow
      ? styles.warningTone
      : styles.readyTone;

  const recommendedTravel = recommendedTravelLabel(
    smartMobility.etaSeconds,
    smartMobility.bufferMinutes
  );
  const baseRoute = baseRouteLabel(smartMobility.etaSeconds);
  const distance = distanceLabel(smartMobility.distanceMeters);
  const origin = originLabel(
    smartMobility.originSource,
    smartMobility.originConfidence
  );
  const originFreshness = relativeFreshnessLabel(
    smartMobility.originUpdatedAt,
    "Ubicación"
  );
  const etaFreshness = relativeFreshnessLabel(
    smartMobility.calculatedAt,
    "ETA"
  );

  return (
    <div style={{ ...styles.card, ...toneStyle }}>
      <div style={styles.copy}>
        <div style={styles.eyebrow}>Salida inteligente</div>
        <div style={styles.title}>{title}</div>
        <div style={styles.subtitle}>{subtitle}</div>

        <div style={styles.routeLine}>
          <span>{origin ?? "Origen pendiente"}</span>
          <span style={styles.routeArrow}>→</span>
          <span>{eventTitle}</span>
        </div>

        <div style={styles.metaRow}>
          {recommendedTravel ? <span style={styles.metaPill}>{recommendedTravel}</span> : null}
          {baseRoute ? <span style={styles.metaPill}>{baseRoute}</span> : null}
          {distance ? <span style={styles.metaPill}>{distance}</span> : null}
          <span style={styles.metaPill}>Auto</span>
          {originFreshness ? <span style={styles.metaPill}>{originFreshness}</span> : null}
          {etaFreshness ? <span style={styles.metaPill}>{etaFreshness}</span> : null}
        </div>
      </div>

      <div style={styles.actions}>
        {smartMobility.mapsUrl ? (
          <a
            href={smartMobility.mapsUrl}
            target="_blank"
            rel="noreferrer"
            style={styles.primaryBtn}
          >
            Abrir Maps
          </a>
        ) : null}

        {smartMobility.wazeUrl ? (
          <a
            href={smartMobility.wazeUrl}
            target="_blank"
            rel="noreferrer"
            style={styles.secondaryBtn}
          >
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
    fontSize: 24,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "rgba(255,255,255,0.98)",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.5,
    color: "rgba(226,232,240,0.80)",
    fontWeight: 650,
    maxWidth: 720,
  },
  routeLine: {
    marginTop: 10,
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    fontSize: 12,
    fontWeight: 850,
    color: "rgba(224,242,254,0.92)",
  },
  routeArrow: {
    opacity: 0.55,
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