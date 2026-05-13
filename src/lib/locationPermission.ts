"use client";

import supabase from "@/lib/supabaseClient";

export type LocationPromptStatus = "granted" | "dismissed" | "denied";
export type PersistedLocationPromptStatus = LocationPromptStatus | "unknown" | null;

export type PersistedLocationState = {
  locationEnabled: boolean;
  promptStatus: PersistedLocationPromptStatus;
  promptedAt: string | null;
  dismissedUntil: string | null;
  lastKnown: {
    lat: number | null;
    lng: number | null;
    accuracy: number | null;
    at: string | null;
  };
};

type LatLng = {
  lat: number;
  lng: number;
  accuracy?: number | null;
};

const DISMISSED_UNTIL_KEY = "syncplans:location_prompt_dismissed_until";
const DENIED_KEY = "syncplans:location_prompt_denied";
const GRANTED_KEY = "syncplans:location_prompt_granted";
const GRANTED_AT_KEY = "syncplans:location_prompt_granted_at";
const HANDLED_KEY = "syncplans:location_prompt_handled";

const GRANTED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isLocationPromptSnoozed() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_UNTIL_KEY);
    if (!raw) return false;
    return Date.now() < Number(raw);
  } catch {
    return false;
  }
}

export function snoozeLocationPrompt(days = 7) {
  try {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(HANDLED_KEY, "1");
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
  } catch {}
}

export function snoozeLocationPromptUntil(untilIsoOrMs: string | number | null | undefined) {
  try {
    const until =
      typeof untilIsoOrMs === "number"
        ? untilIsoOrMs
        : Date.parse(String(untilIsoOrMs ?? ""));

    if (!Number.isFinite(until) || until <= Date.now()) return;
    window.localStorage.setItem(HANDLED_KEY, "1");
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
  } catch {}
}

export function clearLocationPromptSnooze() {
  try {
    window.localStorage.removeItem(DISMISSED_UNTIL_KEY);
  } catch {}
}
export function markLocationPromptHandled() {
  try {
    window.localStorage.setItem(HANDLED_KEY, "1");
  } catch {}
}

export function wasLocationPromptHandled() {
  try {
    return window.localStorage.getItem(HANDLED_KEY) === "1";
  } catch {
    return false;
  }
}
export function clearLocationPromptHandled() {
  try {
    window.localStorage.removeItem(HANDLED_KEY);
  } catch {}
}


export function markLocationPromptDenied() {
  try {
    window.localStorage.setItem(HANDLED_KEY, "1");
    window.localStorage.setItem(DENIED_KEY, "1");
  } catch {}
}

export function clearLocationPromptDenied() {
  try {
    window.localStorage.removeItem(DENIED_KEY);
  } catch {}
}

export function markLocationPromptGranted() {
  try {
    window.localStorage.setItem(HANDLED_KEY, "1");
    window.localStorage.setItem(GRANTED_KEY, "1");
    window.localStorage.setItem(GRANTED_AT_KEY, String(Date.now()));
    window.localStorage.removeItem(DENIED_KEY);
    window.localStorage.removeItem(DISMISSED_UNTIL_KEY);
  } catch {}
}

export function clearLocationPromptGranted() {
  try {
    window.localStorage.removeItem(GRANTED_KEY);
    window.localStorage.removeItem(GRANTED_AT_KEY);
  } catch {}
}

export function wasLocationPromptGranted() {
  try {
    if (window.localStorage.getItem(GRANTED_KEY) !== "1") return false;

    const rawGrantedAt = window.localStorage.getItem(GRANTED_AT_KEY);
    const grantedAt = Number(rawGrantedAt);

    if (!rawGrantedAt || !Number.isFinite(grantedAt)) return true;
    return Date.now() - grantedAt < GRANTED_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function wasLocationPromptDenied() {
  try {
    return window.localStorage.getItem(DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export async function getCurrentBrowserPosition(): Promise<LatLng> {
  if (!("geolocation" in navigator)) {
    throw new Error("GEOLOCATION_NOT_SUPPORTED");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy ?? null;

        if (!isValidLatLng(lat, lng)) {
          reject(new Error("INVALID_COORDINATES"));
          return;
        }

        resolve({ lat, lng, accuracy });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  });
}

async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? "";
}

export async function getPersistedLocationPromptState(): Promise<PersistedLocationState | null> {
  const token = await getAccessToken();

  if (!token) return null;

  const res = await fetch("/api/user/location", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) return null;

  const body = json as {
    locationEnabled?: unknown;
    promptStatus?: unknown;
    promptedAt?: unknown;
    dismissedUntil?: unknown;
    lastKnown?: {
      lat?: unknown;
      lng?: unknown;
      accuracy?: unknown;
      at?: unknown;
    };
  };

  const promptStatus =
    body.promptStatus === "granted" ||
    body.promptStatus === "dismissed" ||
    body.promptStatus === "denied" ||
    body.promptStatus === "unknown"
      ? body.promptStatus
      : null;

  const lastKnown = body.lastKnown ?? {};

  return {
    locationEnabled: body.locationEnabled === true,
    promptStatus,
    promptedAt: typeof body.promptedAt === "string" ? body.promptedAt : null,
    dismissedUntil:
      typeof body.dismissedUntil === "string" ? body.dismissedUntil : null,
    lastKnown: {
      lat: Number.isFinite(Number(lastKnown.lat)) ? Number(lastKnown.lat) : null,
      lng: Number.isFinite(Number(lastKnown.lng)) ? Number(lastKnown.lng) : null,
      accuracy: Number.isFinite(Number(lastKnown.accuracy))
        ? Number(lastKnown.accuracy)
        : null,
      at: typeof lastKnown.at === "string" ? lastKnown.at : null,
    },
  };
}

export async function persistLocationFromBrowser(point: LatLng) {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("MISSING_SESSION");
  }

  const res = await fetch("/api/user/location", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode: "location",
      lat: point.lat,
      lng: point.lng,
      accuracy: point.accuracy ?? null,
      source: "permission_prompt",
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(json?.code || "LOCATION_SAVE_FAILED");
  }

  return json;
}

export async function persistLocationPromptStatus(status: LocationPromptStatus) {
  const token = await getAccessToken();

  if (!token) return null;

  const res = await fetch("/api/user/location", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mode: "prompt_state",
      status,
    }),
  });

  return res.json().catch(() => null);
}