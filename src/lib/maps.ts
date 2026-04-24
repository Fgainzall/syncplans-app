export type PlaceProvider = "google";

export type TravelMode = "driving" | "walking" | "bicycling" | "transit";

export type TrafficModel = "best_guess" | "pessimistic" | "optimistic";

export type LatLng = {
  lat: number;
  lng: number;
};

export type PlacePrediction = {
  label: string;
  address: string;
  lat: number;
  lng: number;
  place_id: string;
  provider: PlaceProvider;
  type: string;
};

export type AutocompleteInput = {
  input: string;
  sessionToken?: string | null;
  locationBias?: {
    center: LatLng;
    radiusMeters?: number;
  } | null;
  limit?: number;
};

export type AutocompleteResult = {
  predictions: PlacePrediction[];
};

export type RouteEtaInput = {
  origin: LatLng;
  destination: LatLng;
  travelMode?: TravelMode | string | null;
  departureTime?: string | null;
  trafficModel?: TrafficModel | string | null;
};

export type RouteEtaResult = {
  etaSeconds: number;
  distanceMeters: number;
  trafficModel: TrafficModel;
  provider: PlaceProvider;
  calculatedAt: string;
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      place?: string;
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
      types?: string[];
    };
  }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  types?: string[];
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
  }>;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const DEFAULT_AUTOCOMPLETE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_ROUTE_TTL_MS = 60 * 1000;
const DEFAULT_AUTOCOMPLETE_LIMIT = 5;
const MAX_AUTOCOMPLETE_LIMIT = 8;
const MAX_AUTOCOMPLETE_INPUT_LENGTH = 160;
const MAX_AUTOCOMPLETE_BODY_INPUT_LENGTH = 600;
const DEFAULT_DETAILS_LIMIT = 3;

const DEFAULT_AUTOCOMPLETE_BIAS_CENTER: LatLng = {
  lat: -12.0464,
  lng: -77.0428,
};

const DEFAULT_AUTOCOMPLETE_BIAS_RADIUS_METERS = 35_000;

const PERU_LOCALITY_HINTS = [
  "peru",
  "perú",
  "lima",
  "miraflores",
  "san isidro",
  "surco",
  "santiago de surco",
  "la molina",
  "barranco",
  "san borja",
  "jesus maria",
  "jesús maría",
  "magdalena",
  "lince",
  "surquillo",
  "callao",
  "chorrillos",
  "pueblo libre",
  "san miguel",
  "rimac",
  "rímac",
];

const LOCAL_QUERY_HINTS = [
  "larcomar",
  "jockey",
  "miraflores",
  "san isidro",
  "surco",
  "la molina",
  "barranco",
  "san borja",
  "magdalena",
  "lince",
  "surquillo",
  "callao",
  "wong",
  "vivanda",
  "tottus",
  "plaza vea",
  "real plaza",
];

const autocompleteCache = new Map<string, CacheEntry<AutocompleteResult>>();
const routeCache = new Map<string, CacheEntry<RouteEtaResult>>();

export class MapsError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly isProviderError: boolean;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: string;
      isProviderError?: boolean;
      recoverable?: boolean;
    }
  ) {
    super(message);
    this.name = "MapsError";
    this.status = options?.status ?? 500;
    this.code = options?.code ?? "MAPS_INTERNAL_ERROR";
    this.isProviderError = options?.isProviderError ?? false;
    this.recoverable = options?.recoverable ?? false;
  }
}

function getEnvNumber(name: string, fallback: number): number {
  const raw = String(process.env[name] ?? "").trim();
  if (!raw) return fallback;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function getGoogleMapsApiKey(): string {
  const apiKey = String(process.env.GOOGLE_MAPS_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new MapsError("Missing GOOGLE_MAPS_API_KEY on server.", {
      status: 500,
      code: "MAPS_MISSING_API_KEY",
      recoverable: false,
    });
  }
  return apiKey;
}

const AUTOCOMPLETE_TTL_MS = getEnvNumber(
  "MAPS_AUTOCOMPLETE_CACHE_TTL_MS",
  DEFAULT_AUTOCOMPLETE_TTL_MS
);
const ROUTE_TTL_MS = getEnvNumber("MAPS_ROUTE_CACHE_TTL_MS", DEFAULT_ROUTE_TTL_MS);
const AUTOCOMPLETE_DETAILS_LIMIT = clamp(
  getEnvNumber("MAPS_AUTOCOMPLETE_DETAILS_LIMIT", DEFAULT_DETAILS_LIMIT),
  1,
  MAX_AUTOCOMPLETE_LIMIT
);

export function cleanString(input: unknown, maxLen = MAX_AUTOCOMPLETE_INPUT_LENGTH): string {
  return String(input ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, Math.max(1, maxLen));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
    lngN <= 180
  );
}

export function normalizeTravelMode(input: unknown): TravelMode {
  const normalized = cleanString(input, 30).toLowerCase();
  if (normalized === "walking") return "walking";
  if (normalized === "bicycling" || normalized === "cycling" || normalized === "bike") return "bicycling";
  if (normalized === "transit" || normalized === "public_transit") return "transit";
  return "driving";
}

function normalizeTrafficModel(input: unknown): TrafficModel {
  const normalized = cleanString(input, 30).toLowerCase();
  if (normalized === "pessimistic") return "pessimistic";
  if (normalized === "optimistic") return "optimistic";
  return "best_guess";
}

export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);

  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusMeters * c;
}

function approximateEtaSeconds(distanceMeters: number, mode: TravelMode): number {
  const metersPerSecondByMode: Record<TravelMode, number> = {
    driving: 12.5,
    transit: 9,
    bicycling: 5.5,
    walking: 1.4,
  };

  const speed = metersPerSecondByMode[mode] ?? metersPerSecondByMode.driving;
  return Math.max(60, Math.round(distanceMeters / speed));
}

function parseGoogleDurationToSeconds(raw: unknown): number | null {
  const value = String(raw ?? "").trim();
  const match = value.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;

  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return Math.round(seconds);
}

function makeCacheKey(parts: Array<string | number | null | undefined>): string {
  return parts
    .map((part) => String(part ?? ""))
    .join("|")
    .toLowerCase();
}

function normalizeForMatching(input: string): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAnyHint(haystack: string, hints: string[]): boolean {
  return hints.some((hint) => haystack.includes(normalizeForMatching(hint)));
}

function queryLooksPeruLocal(query: string): boolean {
  const normalizedQuery = normalizeForMatching(query);
  return containsAnyHint(normalizedQuery, PERU_LOCALITY_HINTS) || containsAnyHint(normalizedQuery, LOCAL_QUERY_HINTS);
}

function scorePredictionForPeru(query: string, prediction: PlacePrediction): number {
  const normalizedQuery = normalizeForMatching(query);
  const label = normalizeForMatching(prediction.label);
  const address = normalizeForMatching(prediction.address);
  const combined = `${label} ${address}`.trim();

  let score = 0;

  if (label === normalizedQuery) score += 120;
  if (label.startsWith(normalizedQuery)) score += 90;
  if (label.includes(normalizedQuery)) score += 70;
  if (combined.includes(normalizedQuery)) score += 40;

  if (containsAnyHint(combined, PERU_LOCALITY_HINTS)) score += 80;
  if (containsAnyHint(label, PERU_LOCALITY_HINTS)) score += 30;

  if (containsAnyHint(combined, ["ee uu", "ee. uu.", "united states", "virginia", "usa"])) {
    score -= 120;
  }

  if (queryLooksPeruLocal(query) && !containsAnyHint(combined, PERU_LOCALITY_HINTS)) {
    score -= 35;
  }

  if (prediction.type === "shopping_mall") score += 16;
  if (prediction.type === "restaurant") score += 12;
  if (prediction.type === "cafe") score += 8;
  if (prediction.type === "lodging") score -= 8;

  return score;
}

function rankPredictionsForPeru(query: string, predictions: PlacePrediction[]): PlacePrediction[] {
  return [...predictions].sort((a, b) => {
    const scoreDiff = scorePredictionForPeru(query, b) - scorePredictionForPeru(query, a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.label.localeCompare(b.label, "es");
  });
}

function getEffectiveAutocompleteBias(
  input?: AutocompleteInput["locationBias"] | null
): AutocompleteInput["locationBias"] {
  if (input?.center) {
    return {
      center: input.center,
      radiusMeters:
        Number.isFinite(Number(input.radiusMeters))
          ? Math.max(100, Math.round(Number(input.radiusMeters)))
          : DEFAULT_AUTOCOMPLETE_BIAS_RADIUS_METERS,
    };
  }

  return {
    center: DEFAULT_AUTOCOMPLETE_BIAS_CENTER,
    radiusMeters: DEFAULT_AUTOCOMPLETE_BIAS_RADIUS_METERS,
  };
}

function getFromCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const hit = cache.get(key);
  if (!hit) return null;

  if (Date.now() >= hit.expiresAt) {
    cache.delete(key);
    return null;
  }

  return hit.value;
}

function setCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttlMs: number) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  if (cache.size > 300) {
    let oldestKey: string | null = null;
    let oldest = Number.POSITIVE_INFINITY;

    for (const [k, entry] of cache.entries()) {
      if (entry.expiresAt < oldest) {
        oldest = entry.expiresAt;
        oldestKey = k;
      }
    }

    if (oldestKey) cache.delete(oldestKey);
  }
}

function assertValidLatLng(
  point: LatLng,
  label: "origin" | "destination" | "locationBias.center"
): void {
  if (!isValidLatLng(point.lat, point.lng)) {
    throw new MapsError(`Invalid ${label} coordinates.`, {
      status: 400,
      code: "MAPS_INVALID_COORDINATES",
    });
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerErrorFromStatus(
  status: number,
  providerErrorCode: string,
  bodySnippet: string
): MapsError {
  const common = {
    isProviderError: true,
    code: providerErrorCode,
  } as const;

  if (status === 401 || status === 403) {
    return new MapsError(`Maps provider auth/permission error (${status}).`, {
      ...common,
      status: 502,
      recoverable: false,
    });
  }

  if (status === 429) {
    return new MapsError(`Maps provider rate limited (${status}).`, {
      ...common,
      status: 502,
      recoverable: false,
    });
  }

 if (status === 400 || status === 404) {
  return new MapsError(`Maps provider rejected request (${status}).`, {
    ...common,
    status: 502,
    recoverable: true,
  });
}

  return new MapsError(
    `Maps provider request failed (${status}). ${bodySnippet}`.trim(),
    {
      ...common,
      status: 502,
      recoverable: true,
    }
  );
}

async function fetchJson<T>(url: string, init: RequestInit, providerErrorCode: string): Promise<T> {
  try {
    const response = await fetch(url, init);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw providerErrorFromStatus(statusSafe(response.status), providerErrorCode, text.slice(0, 180));
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof MapsError) throw error;

    throw new MapsError("Maps provider request failed due to network error.", {
      status: 502,
      code: providerErrorCode,
      isProviderError: true,
      recoverable: true,
    });
  }
}

function statusSafe(status: unknown): number {
  const n = Number(status);
  if (!Number.isFinite(n) || n < 100 || n > 599) return 500;
  return Math.floor(n);
}

async function getGooglePlaceDetails(
  placeResourceOrId: string,
  apiKey: string
): Promise<PlacePrediction | null> {
  const raw = cleanString(placeResourceOrId, 200);
  if (!raw) return null;

  const resource = raw.startsWith("places/") ? raw : `places/${raw}`;
  const encodedResource = resource
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const url = `https://places.googleapis.com/v1/${encodedResource}`;

  const details = await fetchJson<GooglePlaceDetailsResponse>(
    url,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "id,displayName,formattedAddress,location,types",
      },
      cache: "no-store",
    },
    "MAPS_PROVIDER_PLACE_DETAILS_FAILED"
  );

  const lat = Number(details.location?.latitude);
  const lng = Number(details.location?.longitude);
  const placeId = cleanString(details.id, 200);

  if (!isValidLatLng(lat, lng) || !placeId) return null;

  const label = cleanString(details.displayName?.text || details.formattedAddress || placeId, 140);
  const address = cleanString(details.formattedAddress || label, 200);
  const type = cleanString(details.types?.[0] || "place", 60).toLowerCase() || "place";

  return {
    label,
    address,
    lat,
    lng,
    place_id: placeId,
    provider: "google",
    type,
  };
}

function buildAutocompleteCacheKey(input: {
  input: string;
  sessionToken?: string | null;
  limit: number;
  locationBias?: AutocompleteInput["locationBias"];
}): string {
  const center = input.locationBias?.center;
  const radius = Number(input.locationBias?.radiusMeters ?? 0);

  return makeCacheKey([
    input.input,
    input.sessionToken || "",
    input.limit,
    center ? center.lat.toFixed(6) : "",
    center ? center.lng.toFixed(6) : "",
    Number.isFinite(radius) ? Math.round(radius) : "",
  ]);
}

function buildRouteCacheKey(input: {
  origin: LatLng;
  destination: LatLng;
  mode: TravelMode;
  departureTime: string | null;
  trafficModel: TrafficModel;
}): string {
  return makeCacheKey([
    input.origin.lat.toFixed(6),
    input.origin.lng.toFixed(6),
    input.destination.lat.toFixed(6),
    input.destination.lng.toFixed(6),
    input.mode,
    input.departureTime || "",
    input.trafficModel,
  ]);
}

function mapTravelModeToGoogle(mode: TravelMode): "DRIVE" | "WALK" | "BICYCLE" | "TRANSIT" {
  if (mode === "walking") return "WALK";
  if (mode === "bicycling") return "BICYCLE";
  if (mode === "transit") return "TRANSIT";
  return "DRIVE";
}

function mapTrafficModelToGoogle(model: TrafficModel): "BEST_GUESS" | "PESSIMISTIC" | "OPTIMISTIC" {
  if (model === "pessimistic") return "PESSIMISTIC";
  if (model === "optimistic") return "OPTIMISTIC";
  return "BEST_GUESS";
}

function parseDepartureTime(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const value = cleanString(raw, 64);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new MapsError("Invalid departureTime. Use ISO date string.", {
      status: 400,
      code: "MAPS_INVALID_DEPARTURE_TIME",
    });
  }

  return parsed.toISOString();
}

export function parseAutocompleteInputFromUnknown(
  payload: unknown
): AutocompleteInput {
  if (!isObjectRecord(payload)) {
    throw new MapsError("Body must be a JSON object.", {
      status: 400,
      code: "MAPS_INVALID_BODY",
    });
  }

  const rawInput =
    typeof payload.input === "string"
      ? payload.input
      : typeof payload.query === "string"
      ? payload.query
      : "";

  const inputText = cleanString(
    rawInput,
    MAX_AUTOCOMPLETE_BODY_INPUT_LENGTH
  );

  if (!inputText) {
    throw new MapsError("input is required.", {
      status: 400,
      code: "MAPS_INVALID_INPUT",
    });
  }

  if (String(rawInput ?? "").length > MAX_AUTOCOMPLETE_BODY_INPUT_LENGTH) {
    throw new MapsError("input is too long.", {
      status: 400,
      code: "MAPS_INPUT_TOO_LONG",
    });
  }

  const sessionToken = cleanString(payload.sessionToken, 120) || undefined;

  const limitRaw = Number(payload.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT);
  const limit = clamp(
    Number.isFinite(limitRaw)
      ? Math.floor(limitRaw)
      : DEFAULT_AUTOCOMPLETE_LIMIT,
    1,
    MAX_AUTOCOMPLETE_LIMIT
  );

  let locationBias: AutocompleteInput["locationBias"] | undefined;
  const biasRaw = payload.locationBias;

  if (isObjectRecord(biasRaw)) {
    const centerRaw = biasRaw.center;

    if (isObjectRecord(centerRaw)) {
      const center = {
        lat: Number(centerRaw.lat),
        lng: Number(centerRaw.lng),
      };

      assertValidLatLng(center, "locationBias.center");

      const radiusRaw = Number(biasRaw.radiusMeters ?? 0);

      locationBias = {
        center,
        radiusMeters:
          Number.isFinite(radiusRaw) && radiusRaw > 0
            ? Math.round(radiusRaw)
            : undefined,
      };
    }
  }

  return {
    input: inputText,
    sessionToken,
    locationBias,
    limit,
  };
}

export function parseRouteEtaInputFromUnknown(payload: unknown): RouteEtaInput {
  if (!isObjectRecord(payload)) {
    throw new MapsError("Body must be a JSON object.", {
      status: 400,
      code: "MAPS_INVALID_BODY",
    });
  }

  const originRaw = payload.origin;
  const destinationRaw = payload.destination;

  if (!isObjectRecord(originRaw) || !isObjectRecord(destinationRaw)) {
    throw new MapsError("origin and destination are required.", {
      status: 400,
      code: "MAPS_INVALID_COORDINATES",
    });
  }

  const origin = {
    lat: Number(originRaw.lat),
    lng: Number(originRaw.lng),
  };

  const destination = {
    lat: Number(destinationRaw.lat),
    lng: Number(destinationRaw.lng),
  };

  if (!isValidLatLng(origin.lat, origin.lng) || !isValidLatLng(destination.lat, destination.lng)) {
    throw new MapsError("origin and destination must be valid lat/lng.", {
      status: 400,
      code: "MAPS_INVALID_COORDINATES",
    });
  }

  const travelMode = normalizeTravelMode(payload.travelMode);
  const departureTime = payload.departureTime == null ? null : String(payload.departureTime);

  return {
    origin,
    destination,
    travelMode,
    departureTime,
    trafficModel: payload.trafficModel == null ? null : String(payload.trafficModel),
  };
}

export async function getPlaceAutocomplete(input: AutocompleteInput): Promise<AutocompleteResult> {
  const apiKey = getGoogleMapsApiKey();

  const sanitizedInput = cleanString(input?.input, MAX_AUTOCOMPLETE_INPUT_LENGTH);
  if (!sanitizedInput) {
    throw new MapsError("input is required.", {
      status: 400,
      code: "MAPS_INVALID_INPUT",
    });
  }

  const limitRaw = Number(input?.limit ?? DEFAULT_AUTOCOMPLETE_LIMIT);
  const limit = clamp(
    Number.isFinite(limitRaw) ? Math.floor(limitRaw) : DEFAULT_AUTOCOMPLETE_LIMIT,
    1,
    MAX_AUTOCOMPLETE_LIMIT
  );

  const sessionToken = cleanString(input?.sessionToken, 120) || undefined;

  const locationBias = getEffectiveAutocompleteBias(input?.locationBias ?? null);
  if (locationBias?.center) {
    assertValidLatLng(locationBias.center, "locationBias.center");
  }

  const cacheKey = buildAutocompleteCacheKey({
    input: sanitizedInput,
    sessionToken,
    limit,
    locationBias,
  });

  const cached = getFromCache(autocompleteCache, cacheKey);
  if (cached) return cached;

  const body: Record<string, unknown> = {
    input: sanitizedInput,
    includePureServiceAreaBusinesses: false,
    languageCode: "es",
    regionCode: "PE",
  };

  if (sessionToken) body.sessionToken = sessionToken;

  if (locationBias?.center) {
    const radiusMeters = clamp(
      Number(locationBias.radiusMeters ?? DEFAULT_AUTOCOMPLETE_BIAS_RADIUS_METERS),
      100,
      50000
    );
    body.locationBias = {
      circle: {
        center: {
          latitude: locationBias.center.lat,
          longitude: locationBias.center.lng,
        },
        radius: radiusMeters,
      },
    };
  }

  const autocomplete = await fetchJson<GoogleAutocompleteResponse>(
    "https://places.googleapis.com/v1/places:autocomplete",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
    "MAPS_PROVIDER_AUTOCOMPLETE_FAILED"
  );

  const placeItems = (autocomplete.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter(
      (
        value
      ): value is NonNullable<GoogleAutocompleteResponse["suggestions"]>[number]["placePrediction"] =>
        Boolean(value)
    )
    .slice(0, limit);

  const detailsTargets = placeItems.slice(0, Math.min(limit, AUTOCOMPLETE_DETAILS_LIMIT));

  const details = await Promise.all(
    detailsTargets.map(async (item) => {
      const placeResource = cleanString(item?.place, 200);
      const placeId = cleanString(item?.placeId, 200);
      const placeRef = placeResource || placeId;
      if (!placeRef) return null;

      const resolved = await getGooglePlaceDetails(placeRef, apiKey);
      if (!resolved) return null;

      const fallbackLabel = cleanString(
        item?.structuredFormat?.mainText?.text || item?.text?.text || resolved.label,
        140
      );
      const fallbackAddress = cleanString(
        item?.structuredFormat?.secondaryText?.text || resolved.address || fallbackLabel,
        200
      );

      return {
        ...resolved,
        label: fallbackLabel || resolved.label,
        address: fallbackAddress || resolved.address,
        type:
          cleanString(item?.types?.[0] || resolved.type || "place", 60).toLowerCase() ||
          "place",
      } satisfies PlacePrediction;
    })
  );

  const predictions = rankPredictionsForPeru(
    sanitizedInput,
    details.filter((item): item is PlacePrediction => Boolean(item))
  );

  const result: AutocompleteResult = {
    predictions: predictions.slice(0, limit),
  };

  setCache(autocompleteCache, cacheKey, result, AUTOCOMPLETE_TTL_MS);
  return result;
}

function buildFallbackRouteResult(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  trafficModel: TrafficModel
): RouteEtaResult {
  const calculatedAt = new Date().toISOString();
  const straightDistance = Math.max(0, Math.round(haversineDistanceMeters(origin, destination)));

  if (straightDistance <= 30) {
    return {
      etaSeconds: 0,
      distanceMeters: straightDistance,
      trafficModel,
      provider: "google",
      calculatedAt,
    };
  }

  return {
    etaSeconds: approximateEtaSeconds(straightDistance, mode),
    distanceMeters: straightDistance,
    trafficModel,
    provider: "google",
    calculatedAt,
  };
}

export async function getRouteEta(input: RouteEtaInput): Promise<RouteEtaResult> {
  const apiKey = getGoogleMapsApiKey();

  const origin = {
    lat: Number(input?.origin?.lat),
    lng: Number(input?.origin?.lng),
  };
  const destination = {
    lat: Number(input?.destination?.lat),
    lng: Number(input?.destination?.lng),
  };

  assertValidLatLng(origin, "origin");
  assertValidLatLng(destination, "destination");

  const mode = normalizeTravelMode(input?.travelMode);
  const trafficModel = normalizeTrafficModel(input?.trafficModel);
  const departureTime = parseDepartureTime(input?.departureTime ?? null);

  const cacheKey = buildRouteCacheKey({
    origin,
    destination,
    mode,
    departureTime,
    trafficModel,
  });

  const cached = getFromCache(routeCache, cacheKey);
  if (cached) return cached;

  const straightDistance = haversineDistanceMeters(origin, destination);
  if (straightDistance <= 20) {
    const immediate: RouteEtaResult = {
      etaSeconds: 0,
      distanceMeters: Math.round(straightDistance),
      trafficModel,
      provider: "google",
      calculatedAt: new Date().toISOString(),
    };

    setCache(routeCache, cacheKey, immediate, ROUTE_TTL_MS);
    return immediate;
  }

const body: Record<string, unknown> = {
  origin: {
    location: {
      latLng: {
        latitude: origin.lat,
        longitude: origin.lng,
      },
    },
  },
  destination: {
    location: {
      latLng: {
        latitude: destination.lat,
        longitude: destination.lng,
      },
    },
  },
  travelMode: mapTravelModeToGoogle(mode),
  computeAlternativeRoutes: false,
  languageCode: "es",
  units: "METRIC",
};

if (mode === "driving") {
  body.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
  body.trafficModel = mapTrafficModelToGoogle(trafficModel);

  if (departureTime) {
    body.departureTime = departureTime;
  }
}

  try {
    const routesResponse = await fetchJson<GoogleRoutesResponse>(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration,routes.distanceMeters",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      },
      "MAPS_PROVIDER_ROUTE_ETA_FAILED"
    );

    const firstRoute = routesResponse.routes?.[0];
    if (!firstRoute) {
      throw new MapsError("Maps provider returned no routes.", {
        status: 502,
        code: "MAPS_PROVIDER_NO_ROUTES",
        isProviderError: true,
        recoverable: true,
      });
    }

    const distanceMeters = Math.max(0, Math.round(Number(firstRoute.distanceMeters ?? 0)));
    const etaSecondsFromDuration = parseGoogleDurationToSeconds(firstRoute.duration);
    const etaSecondsFromStatic = parseGoogleDurationToSeconds(firstRoute.staticDuration);
    const etaSeconds = etaSecondsFromDuration ?? etaSecondsFromStatic;

    if (!distanceMeters && !etaSeconds) {
      throw new MapsError("Maps provider returned incomplete route data.", {
        status: 502,
        code: "MAPS_PROVIDER_INCOMPLETE_ROUTE",
        isProviderError: true,
        recoverable: true,
      });
    }

    const result: RouteEtaResult = {
      etaSeconds: etaSeconds ?? approximateEtaSeconds(Math.max(distanceMeters, straightDistance), mode),
      distanceMeters: distanceMeters || Math.round(straightDistance),
      trafficModel,
      provider: "google",
      calculatedAt: new Date().toISOString(),
    };

    setCache(routeCache, cacheKey, result, ROUTE_TTL_MS);
    return result;
  } catch (error) {
    if (error instanceof MapsError) {
      if (!error.recoverable) {
        throw error;
      }

      const fallback = buildFallbackRouteResult(origin, destination, mode, trafficModel);
      setCache(routeCache, cacheKey, fallback, ROUTE_TTL_MS);
      return fallback;
    }

    throw new MapsError("Unexpected route ETA failure.", {
      status: 500,
      code: "MAPS_INTERNAL_ERROR",
      recoverable: false,
    });
  }
}

export function buildWazeLink(lat: number, lng: number): string {
  if (!isValidLatLng(lat, lng)) {
    throw new MapsError("Invalid coordinates for Waze link.", {
      status: 400,
      code: "MAPS_INVALID_COORDINATES",
    });
  }

  return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}

export function buildGoogleMapsDirectionsLink(
  origin: LatLng,
  destination: LatLng,
  travelMode?: TravelMode
): string {
  assertValidLatLng(origin, "origin");
  assertValidLatLng(destination, "destination");

  const mode = normalizeTravelMode(travelMode);

  return [
    "https://www.google.com/maps/dir/?api=1",
    `origin=${encodeURIComponent(`${origin.lat},${origin.lng}`)}`,
    `destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}`,
    `travelmode=${encodeURIComponent(mode)}`,
  ].join("&");
}

export function isMapsError(error: unknown): error is MapsError {
  return error instanceof MapsError;
}

export function toPublicMapsError(error: unknown): {
  status: number;
  message: string;
  code: string;
  isProviderError: boolean;
} {
  if (isMapsError(error)) {
    return {
      status: error.status,
      message: error.message,
      code: error.code,
      isProviderError: error.isProviderError,
    };
  }

  return {
    status: 500,
    message: "Unexpected maps error.",
    code: "MAPS_INTERNAL_ERROR",
    isProviderError: false,
  };
}