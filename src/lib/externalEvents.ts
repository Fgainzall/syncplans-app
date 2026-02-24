// src/lib/externalEvents.ts

/**
 * Tipos y normalizadores para eventos externos (Google, etc.).
 *
 * Objetivo Fase 1:
 *  - Tomar la respuesta cruda de `/api/integrations/google/list`
 *  - Convertirla en una lista limpia de `ExternalEvent`
 *  - Usar esa lista solo para lectura / snapshots en UI (Panel, Summary, etc.)
 */

export type ExternalEventSource = "google";

export type ExternalEvent = {
  /** ID original del proveedor (Google event id) */
  id: string;
  /** Tipo de integración (por ahora solo "google") */
  source: ExternalEventSource;
  /** Identificador lógico de la fuente, ej. "google:primary" */
  sourceId: string;
  /** Título visible en la UI */
  title: string;
  /** Inicio en ISO (o RFC3339) ya normalizado */
  start: string;
  /** Fin en ISO (o RFC3339) ya normalizado */
  end: string;
  /** Indica si el evento es "todo el día" según Google */
  allDay: boolean;
  /** Link a Google Calendar (si existe) */
  htmlLink?: string | null;
  /** Ubicación textual (si existe) */
  location?: string | null;
};

/**
 * Intenta convertir cualquier valor (string/Date) en un ISO string.
 * Si falla, devuelve null.
 */
function toIsoOrNull(raw: any): string | null {
  if (!raw) return null;

  try {
    if (raw instanceof Date) {
      return raw.toISOString();
    }

    if (typeof raw === "string") {
      // Google suele devolver RFC3339 o YYYY-MM-DD (para all-day).
      // Ambos son parseables por Date en la mayoría de entornos.
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Normaliza los items de Google Calendar (tal como vienen del API oficial)
 * a nuestra forma `ExternalEvent` para uso en la UI.
 *
 * No hace ninguna escritura, solo lectura/snapshot.
 */
export function normalizeGoogleCalendarItems(
  items: any[],
  opts?: { calendarId?: string },
): ExternalEvent[] {
  const calendarId = opts?.calendarId ?? "primary";
  const sourceId = `google:${calendarId}`;

  if (!Array.isArray(items)) return [];

  const result: ExternalEvent[] = [];

  for (const raw of items) {
    const id: string = String(raw?.id ?? "");
    const title: string =
      (typeof raw?.summary === "string" && raw.summary.trim().length > 0
        ? raw.summary
        : "Evento sin título") ?? "Evento sin título";

    const startRaw = raw?.start?.dateTime ?? raw?.start?.date ?? null;
    const endRaw = raw?.end?.dateTime ?? raw?.end?.date ?? null;

    const startIso = toIsoOrNull(startRaw);
    const endIso = toIsoOrNull(endRaw);

    // Sin rango válido, lo descartamos
    if (!startIso || !endIso) continue;

    const allDay =
      !!raw?.start?.date && typeof raw?.start?.dateTime === "undefined";

    result.push({
      id: id || `${sourceId}-event-${result.length}`,
      source: "google",
      sourceId,
      title,
      start: startIso,
      end: endIso,
      allDay,
      htmlLink: raw?.htmlLink ?? null,
      location: raw?.location ?? null,
    });
  }

  return result;
}