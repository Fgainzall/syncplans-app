export const SYNCPLANS_DEFAULT_TIME_ZONE = "America/Lima";

export function formatSmartTime(
  value: string | number | Date | null | undefined,
  fallback = "—",
  options?: { timeZone?: string; hour12?: boolean }
): string {
  if (value == null) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: options?.timeZone || SYNCPLANS_DEFAULT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: options?.hour12 ?? true,
  }).format(date);
}

export function formatSmartDateTime(
  value: string | number | Date | null | undefined,
  fallback = "—",
  options?: { timeZone?: string; hour12?: boolean }
): string {
  if (value == null) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("es-PE", {
    timeZone: options?.timeZone || SYNCPLANS_DEFAULT_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: options?.hour12 ?? true,
  }).format(date);
}