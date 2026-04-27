export type LatLng = {
  lat: number;
  lng: number;
};

export type SmartOriginSource = "gps" | "stored" | "url" | "last_known" | "missing";

export type SmartOriginConfidence =
  | "high_confidence"
  | "usable"
  | "stale"
  | "low_accuracy"
  | "missing";

export type SmartOriginCandidate = {
  point: LatLng | null;
  source: SmartOriginSource;
  updatedAt?: string | number | Date | null;
  accuracyM?: number | null;
};

export type ResolvedSmartOrigin = {
  point: LatLng | null;
  source: SmartOriginSource;
  confidence: SmartOriginConfidence;
  updatedAt: string | null;
  accuracyM: number | null;
  ageMs: number | null;
  usableForEta: boolean;
  usableForCriticalEta: boolean;
  reason: string | null;
};

export const SMART_ORIGIN_STORAGE_KEY = "syncplans:last_origin_point";

export const SMART_ORIGIN_LEGACY_STORAGE_KEYS = [
  "syncplans:last_origin_point",
  "syncplans:last_location",
  "syncplans:current_location",
] as const;

export const SMART_ORIGIN_FRESH_MS = 45 * 60 * 1000;
export const SMART_ORIGIN_USABLE_MS = 6 * 60 * 60 * 1000;
export const SMART_ORIGIN_MAX_CRITICAL_AGE_MS = 24 * 60 * 60 * 1000;

export const SMART_ORIGIN_HIGH_ACCURACY_M = 250;
export const SMART_ORIGIN_USABLE_ACCURACY_M = 1500;

export const SMART_MOBILITY_MAX_URBAN_DISTANCE_METERS = 120_000;

export function isValidLatLngPoint(value: unknown): value is LatLng {
  if (!value || typeof value !== "object") return false;

  const point = value as Partial<LatLng>;
  const lat = Number(point.lat);
  const lng = Number(point.lng);

  return isValidLatLng(lat, lng);
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  const latN = Number(lat);
  const lngN = Number(lng);

  return (
    Number.isFinite(latN) &&
    Number.isFinite(lngN) &&
    latN >= -90 &&
    latN <= 90 &&
    lngN >= -180 &&
    lngN <= 180 &&
    !isNullIsland(latN, lngN)
  );
}

export function isNullIsland(lat: number, lng: number): boolean {
  return Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001;
}

export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  if (!isValidLatLng(lat, lng)) return null;
  return { lat: Number(lat), lng: Number(lng) };
}

export function readNestedLatLng(value: unknown): LatLng | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  return (
    toLatLng(record.lat, record.lng) ||
    toLatLng(record.latitude, record.longitude) ||
    toLatLng(record.location_lat, record.location_lng) ||
    null
  );
}

export function parseSmartOriginUpdatedAt(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getAgeMs(updatedAt: string | null, nowMs = Date.now()): number | null {
  if (!updatedAt) return null;
  const ms = new Date(updatedAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, nowMs - ms);
}

export function evaluateSmartOriginCandidate(
  candidate: SmartOriginCandidate,
  options?: { nowMs?: number }
): ResolvedSmartOrigin {
  const nowMs = options?.nowMs ?? Date.now();
  const point = candidate.point && isValidLatLngPoint(candidate.point) ? candidate.point : null;
  const updatedAt = parseSmartOriginUpdatedAt(candidate.updatedAt ?? null);
  const ageMs = getAgeMs(updatedAt, nowMs);
  const accuracyMRaw = Number(candidate.accuracyM ?? NaN);
  const accuracyM = Number.isFinite(accuracyMRaw) && accuracyMRaw >= 0 ? accuracyMRaw : null;

  if (!point) {
    return {
      point: null,
      source: candidate.source,
      confidence: "missing",
      updatedAt,
      accuracyM,
      ageMs,
      usableForEta: false,
      usableForCriticalEta: false,
      reason: "missing_or_invalid_coordinates",
    };
  }

  let confidence: SmartOriginConfidence = "usable";
  let usableForEta = true;
  let usableForCriticalEta = true;
  let reason: string | null = null;

  if (ageMs !== null && ageMs > SMART_ORIGIN_MAX_CRITICAL_AGE_MS) {
    confidence = "stale";
    usableForEta = false;
    usableForCriticalEta = false;
    reason = "origin_older_than_24h";
  } else if (ageMs !== null && ageMs > SMART_ORIGIN_USABLE_MS) {
    confidence = "stale";
    usableForEta = true;
    usableForCriticalEta = false;
    reason = "origin_older_than_6h";
  } else if (accuracyM !== null && accuracyM > SMART_ORIGIN_USABLE_ACCURACY_M) {
    confidence = "low_accuracy";
    usableForEta = true;
    usableForCriticalEta = false;
    reason = "origin_low_accuracy";
  } else if (
    (ageMs === null || ageMs <= SMART_ORIGIN_FRESH_MS) &&
    (accuracyM === null || accuracyM <= SMART_ORIGIN_HIGH_ACCURACY_M)
  ) {
    confidence = "high_confidence";
  }

  return {
    point,
    source: candidate.source,
    confidence,
    updatedAt,
    accuracyM,
    ageMs,
    usableForEta,
    usableForCriticalEta,
    reason,
  };
}

export function chooseBestSmartOrigin(
  candidates: SmartOriginCandidate[],
  options?: { critical?: boolean; nowMs?: number }
): ResolvedSmartOrigin {
  const critical = options?.critical ?? true;
  const evaluated = candidates.map((candidate) =>
    evaluateSmartOriginCandidate(candidate, { nowMs: options?.nowMs })
  );

  const usable = evaluated.filter((item) =>
    critical ? item.usableForCriticalEta : item.usableForEta
  );

  const rankSource = (source: SmartOriginSource) => {
    if (source === "gps") return 5;
    if (source === "url") return 4;
    if (source === "stored") return 3;
    if (source === "last_known") return 2;
    return 0;
  };

  const rankConfidence = (confidence: SmartOriginConfidence) => {
    if (confidence === "high_confidence") return 4;
    if (confidence === "usable") return 3;
    if (confidence === "low_accuracy") return 2;
    if (confidence === "stale") return 1;
    return 0;
  };

  usable.sort((a, b) => {
    const confidenceDiff = rankConfidence(b.confidence) - rankConfidence(a.confidence);
    if (confidenceDiff !== 0) return confidenceDiff;

    const sourceDiff = rankSource(b.source) - rankSource(a.source);
    if (sourceDiff !== 0) return sourceDiff;

    const aAge = a.ageMs ?? Number.POSITIVE_INFINITY;
    const bAge = b.ageMs ?? Number.POSITIVE_INFINITY;
    return aAge - bAge;
  });

  return (
    usable[0] ?? {
      point: null,
      source: "missing",
      confidence: "missing",
      updatedAt: null,
      accuracyM: null,
      ageMs: null,
      usableForEta: false,
      usableForCriticalEta: false,
      reason: "no_safe_origin",
    }
  );
}

export function distanceMetersBetween(a: LatLng, b: LatLng): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusMeters * c;
}

export function resolveSafeRouteOriginForEta(input: {
  origin: LatLng | null;
  destination: LatLng | null;
  maxDistanceMeters?: number;
}): {
  canCalculateEta: boolean;
  reason: "ready" | "no_origin" | "no_destination" | "event_too_far";
  origin: LatLng | null;
  distanceMeters: number | null;
} {
  if (!input.origin) {
    return { canCalculateEta: false, reason: "no_origin", origin: null, distanceMeters: null };
  }

  if (!input.destination) {
    return { canCalculateEta: false, reason: "no_destination", origin: input.origin, distanceMeters: null };
  }

  const distanceMeters = distanceMetersBetween(input.origin, input.destination);
  const maxDistanceMeters = input.maxDistanceMeters ?? SMART_MOBILITY_MAX_URBAN_DISTANCE_METERS;

  if (!Number.isFinite(distanceMeters) || distanceMeters > maxDistanceMeters) {
    return {
      canCalculateEta: false,
      reason: "event_too_far",
      origin: input.origin,
      distanceMeters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : null,
    };
  }

  return {
    canCalculateEta: true,
    reason: "ready",
    origin: input.origin,
    distanceMeters: Math.round(distanceMeters),
  };
}

export function readSmartOriginFromStorage(): ResolvedSmartOrigin | null {
  if (typeof window === "undefined") return null;

  for (const key of SMART_ORIGIN_LEGACY_STORAGE_KEYS) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const point =
        toLatLng(parsed.lat, parsed.lng) ||
        toLatLng(parsed.latitude, parsed.longitude) ||
        readNestedLatLng(parsed.point) ||
        readNestedLatLng(parsed.coords);

     const updatedAtRaw =
  parsed.savedAt ??
  parsed.updatedAt ??
  parsed.createdAt ??
  parsed.timestamp ??
  parsed.ts ??
  null;

const updatedAt =
  typeof updatedAtRaw === "string" || typeof updatedAtRaw === "number"
    ? updatedAtRaw
    : null;
      const accuracyM =
        parsed.accuracyM ?? parsed.accuracy_m ?? parsed.accuracy ?? parsed.coordsAccuracy ?? null;

      const evaluated = evaluateSmartOriginCandidate({
        point,
        source: "stored",
        updatedAt,
        accuracyM: accuracyM == null ? null : Number(accuracyM),
      });

      if (evaluated.point && evaluated.usableForEta) return evaluated;
    } catch {
      // Ignore broken localStorage entries.
    }
  }

  return null;
}

export function writeSmartOriginToStorage(input: {
  point: LatLng;
  source?: SmartOriginSource;
  accuracyM?: number | null;
  updatedAt?: string | number | Date | null;
}): void {
  if (typeof window === "undefined") return;
  if (!isValidLatLngPoint(input.point)) return;

  try {
    const updatedAt = parseSmartOriginUpdatedAt(input.updatedAt ?? null) ?? new Date().toISOString();
    window.localStorage.setItem(
      SMART_ORIGIN_STORAGE_KEY,
      JSON.stringify({
        lat: input.point.lat,
        lng: input.point.lng,
        accuracyM: Number.isFinite(Number(input.accuracyM)) ? Number(input.accuracyM) : null,
        updatedAt,
        savedAt: Date.now(),
        source: input.source ?? "stored",
      })
    );
  } catch {
    // Ignore localStorage write errors.
  }
}

export async function getGrantedBrowserOrigin(options?: {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
}): Promise<ResolvedSmartOrigin | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) return null;

  try {
    if ("permissions" in navigator) {
      const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      if (permission.state !== "granted") return null;
    }

    return await new Promise<ResolvedSmartOrigin | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const point = toLatLng(position.coords.latitude, position.coords.longitude);
          const evaluated = evaluateSmartOriginCandidate({
            point,
            source: "gps",
            updatedAt: position.timestamp || Date.now(),
            accuracyM: Number(position.coords.accuracy),
          });
          resolve(evaluated.point ? evaluated : null);
        },
        () => resolve(null),
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeoutMs ?? 6000,
          maximumAge: options?.maximumAgeMs ?? 3 * 60 * 1000,
        }
      );
    });
  } catch {
    return null;
  }
}