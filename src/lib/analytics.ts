import supabase from "@/lib/supabaseClient";

export type AnalyticsMetadata = Record<string, unknown>;

type TrackParams = {
  event: string;
  userId?: string | null;
  entityId?: string | null;
  metadata?: AnalyticsMetadata;
};

type TrackScreenViewParams = {
  screen: string;
  userId?: string | null;
  metadata?: AnalyticsMetadata;
};

function getBrowserContext() {
  if (typeof window === "undefined") return {} as AnalyticsMetadata;

  return {
    pathname: window.location.pathname,
    search: window.location.search || undefined,
    referrer: document.referrer || undefined,
  } satisfies AnalyticsMetadata;
}

function cleanMetadata(metadata?: AnalyticsMetadata): AnalyticsMetadata | null {
  const merged: AnalyticsMetadata = {
    ...getBrowserContext(),
    ...(metadata ?? {}),
    tracked_at: new Date().toISOString(),
    analytics_version: 3,
  };

  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined)
  );

  return Object.keys(cleaned).length ? cleaned : null;
}

async function resolveAnalyticsUserId(userId?: string | null) {
  if (userId) return userId;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("[analytics] USER ERROR", error);
      return null;
    }

    return user?.id ?? null;
  } catch (err: unknown) {
    console.error("[analytics] USER FATAL ERROR", err);
    return null;
  }
}

export async function trackEvent({
  event,
  userId,
  entityId,
  metadata,
}: TrackParams) {
  void (async () => {
    try {
      const resolvedUserId = await resolveAnalyticsUserId(userId);

      if (!resolvedUserId) {
        return;
      }

      const payload = {
        event_type: event,
        user_id: resolvedUserId,
        entity_id: entityId ?? null,
        metadata: cleanMetadata(metadata),
      };

      const { error } = await supabase.from("events_analytics").insert(payload);

      if (error) {
        console.error("[analytics] INSERT ERROR", error);
      }
    } catch (err: unknown) {
      console.error("[analytics] FATAL ERROR", err);
    }
  })();
}

export async function trackScreenView({
  screen,
  userId,
  metadata,
}: TrackScreenViewParams) {
  if (typeof window !== "undefined") {
    const key = `sp:screen-view:${screen}:${window.location.pathname}`;
    try {
      if (window.sessionStorage.getItem(key) === "1") return;
      window.sessionStorage.setItem(key, "1");
    } catch {}
  }

  await trackEvent({
    event: "screen_view",
    userId,
    metadata: {
      screen,
      ...(metadata ?? {}),
    },
  });
}

export type AnalyticsStorageScope = "local" | "session";

function getStorage(scope: AnalyticsStorageScope) {
  if (typeof window === "undefined") return null;

  try {
    return scope === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function getOnceStorageKey(onceKey: string) {
  return `sp:analytics-once:${onceKey}`;
}

export function hasTrackedEventOnce(
  onceKey: string,
  scope: AnalyticsStorageScope = "local"
) {
  const storage = getStorage(scope);
  if (!storage) return false;

  try {
    return storage.getItem(getOnceStorageKey(onceKey)) === "1";
  } catch {
    return false;
  }
}

export async function trackEventOnce({
  onceKey,
  scope = "local",
  event,
  userId,
  entityId,
  metadata,
}: TrackParams & { onceKey: string; scope?: AnalyticsStorageScope }) {
  const storage = getStorage(scope);
  const storageKey = getOnceStorageKey(onceKey);

  try {
    if (storage?.getItem(storageKey) === "1") return false;
  } catch {}

  await trackEvent({
    event,
    userId,
    entityId,
    metadata,
  });

  try {
    storage?.setItem(storageKey, "1");
  } catch {}

  return true;
}