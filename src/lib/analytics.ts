import supabase from "@/lib/supabaseClient";

type TrackParams = {
  event: string;
  userId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, any>;
};

export async function trackEvent({
  event,
  userId,
  entityId,
  metadata,
}: TrackParams) {
  try {
    console.log("[analytics] START", {
      event,
      userId,
      entityId,
      metadata,
    });

    const { data, error } = await supabase.from("events_analytics").insert({
      event_type: event,
      user_id: userId ?? null,
      entity_id: entityId ?? null,
      metadata: metadata ?? null,
    });

    console.log("[analytics] RESULT", { data, error });

    if (error) {
      console.error("[analytics] INSERT ERROR", error);
    }
  } catch (err) {
    console.error("[analytics] FATAL ERROR", err);
  }
}