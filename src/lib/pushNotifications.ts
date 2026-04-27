"use client";

type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type PushPermissionStatus =
  | "unsupported"
  | "granted"
  | "denied"
  | "default"
  | "unknown";

const PUSH_SNOOZE_KEY = "syncplans:push_prompt_snoozed_until";
const PUSH_DENIED_KEY = "syncplans:push_prompt_denied";
const PUSH_SUBSCRIBED_KEY = "syncplans:push_subscribed_at";

function getVapidPublicKey(): string {
  return String(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function isBrowserPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushPermissionStatus(): PushPermissionStatus {
  if (typeof window === "undefined") return "unknown";
  if (!isBrowserPushSupported()) return "unsupported";

  const permission = Notification.permission;
  if (permission === "granted") return "granted";
  if (permission === "denied") return "denied";
  if (permission === "default") return "default";
  return "unknown";
}

export function isPushPromptSnoozed(): boolean {
  if (typeof window === "undefined") return true;

  try {
    const raw = window.localStorage.getItem(PUSH_SNOOZE_KEY);
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function snoozePushPrompt(days = 7): void {
  if (typeof window === "undefined") return;

  try {
    const safeDays = Math.max(1, Math.min(30, Math.round(days)));
    const until = Date.now() + safeDays * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(PUSH_SNOOZE_KEY, String(until));
  } catch {
    // No-op.
  }
}

export function wasPushPromptDenied(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(PUSH_DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markPushPromptDenied(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PUSH_DENIED_KEY, "1");
  } catch {
    // No-op.
  }
}

export function clearPushPromptFlags(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(PUSH_DENIED_KEY);
    window.localStorage.removeItem(PUSH_SNOOZE_KEY);
  } catch {
    // No-op.
  }
}

function markPushSubscribed(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PUSH_SUBSCRIBED_KEY, new Date().toISOString());
  } catch {
    // No-op.
  }
}

function toPushSubscriptionPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();

  const endpoint = String(json.endpoint ?? "").trim();
  const p256dh = String(json.keys?.p256dh ?? "").trim();
  const auth = String(json.keys?.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Invalid browser push subscription.");
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

export async function registerSyncPlansServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!isBrowserPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;

  const registration = await navigator.serviceWorker.register("/sw.js", {
    scope: "/",
  });

  await navigator.serviceWorker.ready;
  return registration;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isBrowserPushSupported()) return null;

  const registration = await registerSyncPlansServiceWorker();
  return registration.pushManager.getSubscription();
}

export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const payload = toPushSubscriptionPayload(subscription);

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(String(body?.error ?? "Could not save push subscription."));
  }

  markPushSubscribed();
}

export async function ensurePushSubscription(): Promise<PushSubscriptionPayload> {
  if (!isBrowserPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const vapidPublicKey = getVapidPublicKey();

  if (!vapidPublicKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  }

  const currentPermission = Notification.permission;

  if (currentPermission === "denied") {
    markPushPromptDenied();
    throw new Error("Notification permission has been denied.");
  }

  const permission =
    currentPermission === "granted"
      ? currentPermission
      : await Notification.requestPermission();

  if (permission !== "granted") {
    if (permission === "denied") markPushPromptDenied();
    throw new Error("Notification permission was not granted.");
  }

  clearPushPromptFlags();

  const registration = await registerSyncPlansServiceWorker();

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    await savePushSubscription(existing);
    return toPushSubscriptionPayload(existing);
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  await savePushSubscription(subscription);
  return toPushSubscriptionPayload(subscription);
}

export async function refreshPushSubscriptionIfGranted(): Promise<boolean> {
  if (!isBrowserPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    await ensurePushSubscription();
    return true;
  } catch {
    return false;
  }
}