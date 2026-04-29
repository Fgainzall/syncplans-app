// src/lib/dateUtils.ts

const SPANISH_DATE_LOCALE = "es-PE";

export function hasTimezone(value: string): boolean {
  return /([zZ]|[+\-]\d{2}:\d{2}|[+\-]\d{4})$/.test(String(value ?? "").trim());
}

export function parseLocalIsoNoTz(value: string): Date | null {
  const s = String(value ?? "").trim().replace(" ", "T");
  if (!s) return null;

  const dayMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    const month = Number(dayMatch[2]) - 1;
    const day = Number(dayMatch[3]);
    const date = new Date(year, month, day, 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateTimeMatch = s.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
  );

  if (!dateTimeMatch) return null;

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]) - 1;
  const day = Number(dateTimeMatch[3]);
  const hours = Number(dateTimeMatch[4]);
  const minutes = Number(dateTimeMatch[5]);
  const seconds = dateTimeMatch[6] ? Number(dateTimeMatch[6]) : 0;
  const millis = dateTimeMatch[7]
    ? Number(String(dateTimeMatch[7]).padEnd(3, "0"))
    : 0;

  const date = new Date(year, month, day, hours, minutes, seconds, millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const raw = String(value).trim();
  if (!raw) return null;

  if (hasTimezone(raw)) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return parseLocalIsoNoTz(raw);
}
// ===== ALIASES DE COMPATIBILIDAD (NO ROMPER CÓDIGO EXISTENTE) =====

export const parseIsoLike = parseDateSafe;
export const toDateMs = toMillisSafe;
export const sameLocalDay = isSameDaySafe;

export const formatRangeLabel = formatRangeSafe;
export const formatDateShort = formatDateSafe;
export const formatTimeShort = formatTimeSafe;

// algunos archivos usan nombres distintos
export const parseISO = parseDateSafe;
export const toYmdKey = (value: string | Date | null | undefined) => {
  const d = parseDateSafe(value);
  if (!d) return "";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
export function toMillisSafe(value: string | Date | null | undefined): number {
  const parsed = parseDateSafe(value);
  const time = parsed?.getTime();
  return Number.isFinite(time as number) ? (time as number) : NaN;
}

export function isValidDateValue(value: string | Date | null | undefined): boolean {
  return Number.isFinite(toMillisSafe(value));
}

export function isSameDaySafe(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined
): boolean {
  const da = parseDateSafe(a);
  const db = parseDateSafe(b);

  if (!da || !db) return false;

  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function startOfDaySafe(value: string | Date | null | undefined): Date | null {
  const date = parseDateSafe(value);
  if (!date) return null;

  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function endOfDaySafe(value: string | Date | null | undefined): Date | null {
  const date = parseDateSafe(value);
  if (!date) return null;

  const out = new Date(date);
  out.setHours(23, 59, 59, 999);
  return out;
}

export function isWithinRangeSafe(
  value: string | Date | null | undefined,
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): boolean {
  const ms = toMillisSafe(value);
  const startMs = toMillisSafe(start);
  const endMs = toMillisSafe(end);

  if (!Number.isFinite(ms) || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return false;
  }

  return ms >= startMs && ms <= endMs;
}

export function compareDatesAsc(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined
): number {
  const aMs = toMillisSafe(a);
  const bMs = toMillisSafe(b);

  const aValid = Number.isFinite(aMs);
  const bValid = Number.isFinite(bMs);

  if (!aValid && !bValid) return 0;
  if (!aValid) return 1;
  if (!bValid) return -1;

  return aMs - bMs;
}

export function compareDatesDesc(
  a: string | Date | null | undefined,
  b: string | Date | null | undefined
): number {
  return compareDatesAsc(b, a);
}

export function formatTimeSafe(value: string | Date | null | undefined): string {
  const date = parseDateSafe(value);
  if (!date) return "—";

  return date.toLocaleTimeString(SPANISH_DATE_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateSafe(value: string | Date | null | undefined): string {
  const date = parseDateSafe(value);
  if (!date) return "—";

  return date.toLocaleDateString(SPANISH_DATE_LOCALE, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

export function formatRangeSafe(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined
): string {
  const startDate = parseDateSafe(start);
  const endDate = parseDateSafe(end);

  if (!startDate || !endDate) return "Fecha inválida";

  if (isSameDaySafe(startDate, endDate)) {
    return `${formatDateSafe(startDate)} · ${formatTimeSafe(startDate)} — ${formatTimeSafe(endDate)}`;
  }

  return `${formatDateSafe(startDate)} ${formatTimeSafe(startDate)} → ${formatDateSafe(endDate)} ${formatTimeSafe(endDate)}`;
}
export const isValidDateLike = isValidDateValue;
export function overlapsSafely(
  aStart: string | Date | null | undefined,
  aEnd: string | Date | null | undefined,
  bStart: string | Date | null | undefined,
  bEnd: string | Date | null | undefined
): boolean {
  const aStartMs = toMillisSafe(aStart);
  const aEndMs = toMillisSafe(aEnd);
  const bStartMs = toMillisSafe(bStart);
  const bEndMs = toMillisSafe(bEnd);

  if (
    !Number.isFinite(aStartMs) ||
    !Number.isFinite(aEndMs) ||
    !Number.isFinite(bStartMs) ||
    !Number.isFinite(bEndMs)
  ) {
    return false;
  }

  return aStartMs < bEndMs && bStartMs < aEndMs;
}

export function getOverlapRangeSafe(
  aStart: string | Date | null | undefined,
  aEnd: string | Date | null | undefined,
  bStart: string | Date | null | undefined,
  bEnd: string | Date | null | undefined
): { start: Date; end: Date } | null {
  const aStartMs = toMillisSafe(aStart);
  const aEndMs = toMillisSafe(aEnd);
  const bStartMs = toMillisSafe(bStart);
  const bEndMs = toMillisSafe(bEnd);

  if (
    !Number.isFinite(aStartMs) ||
    !Number.isFinite(aEndMs) ||
    !Number.isFinite(bStartMs) ||
    !Number.isFinite(bEndMs)
  ) {
    return null;
  }

  const overlapStart = Math.max(aStartMs, bStartMs);
  const overlapEnd = Math.min(aEndMs, bEndMs);

  if (overlapStart >= overlapEnd) return null;

  return {
    start: new Date(overlapStart),
    end: new Date(overlapEnd),
  };
  
}
