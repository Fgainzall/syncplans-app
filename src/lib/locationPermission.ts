"use client";

import supabase from "@/lib/supabaseClient";

export type LocationPromptStatus = "granted" | "dismissed" | "denied";

type LatLng = {
  lat: number;
  lng: number;
  accuracy?: number | null;
};

const DISMISSED_UNTIL_KEY = "syncplans:location_prompt_dismissed_until";
const DENIED_KEY = "syncplans:location_prompt_denied";

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
    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));
  } catch {}
}

export function markLocationPromptDenied() {
  try {
    window.localStorage.setItem(DENIED_KEY, "1");
  } catch {}
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