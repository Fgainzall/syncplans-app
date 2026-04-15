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
    analytics_version: 2,
  };

  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined)
  );

  return Object.keys(cleaned).length ? cleaned : null;
}

export async function trackEvent({
  event,
  userId,
  entityId,
  metadata,
}: TrackParams) {
  try {
    const { error } = await supabase.from("events_analytics").insert({
      event_type: event,
      user_id: userId ?? null,
      entity_id: entityId ?? null,
      metadata: cleanMetadata(metadata),
    });

    if (error) {
      console.error("[analytics] INSERT ERROR", error);
    }
  } catch (err) {
    console.error("[analytics] FATAL ERROR", err);
  }
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