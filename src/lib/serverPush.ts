import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PushSubscriptionRow = {
  id?: string | null;
  user_id?: string | null;
  endpoint?: string | null;
  p256dh?: string | null;
  auth?: string | null;
  updated_at?: string | null;
};

export type SyncPlansPushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  data?: Record<string, unknown>;
};

export type SendPushResult = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: boolean;
  reason?: string;
};

type PushEnv = {
  ok: boolean;
  missing: string[];
  supabaseUrl?: string;
  serviceRoleKey?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject: string;
};

function getPushEnv(): PushEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapidSubject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@syncplansapp.com";

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!vapidPublicKey) missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!vapidPrivateKey) missing.push("VAPID_PRIVATE_KEY");

  return {
    ok: missing.length === 0,
    missing,
    supabaseUrl,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
  };
}

export function createServiceRoleClient(): SupabaseClient {
  const env = getPushEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error("Missing Supabase service role env vars.");
  }

  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toWebPushSubscription(row: PushSubscriptionRow): WebPushSubscription | null {
  const endpoint = String(row.endpoint ?? "").trim();
  const p256dh = String(row.p256dh ?? "").trim();
  const auth = String(row.auth ?? "").trim();

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
  };
}

function isExpiredPushSubscriptionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const statusCode = Number(record.statusCode ?? 0);
  return statusCode === 404 || statusCode === 410;
}

export async function sendPushToUsers(input: {
  supabase: SupabaseClient;
  userIds: string[];
  payload: SyncPlansPushPayload;
}): Promise<SendPushResult> {
  const env = getPushEnv();

  if (!env.ok) {
    console.warn("[sendPushToUsers] push disabled by missing env", env.missing);
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: `Missing env: ${env.missing.join(", ")}`,
    };
  }

  if (
    !env.vapidSubject.startsWith("mailto:") &&
    !env.vapidSubject.startsWith("https://")
  ) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "Invalid VAPID_SUBJECT",
    };
  }

  const userIds = Array.from(
    new Set(
      (input.userIds || [])
        .map((id) => String(id ?? "").trim())
        .filter(Boolean),
    ),
  );

  if (userIds.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, skipped: true, reason: "No recipients" };
  }

  const { data, error } = await input.supabase
    .from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth,updated_at")
    .in("user_id", userIds);

  if (error) {
    throw new Error(`Push subscription lookup failed: ${error.message}`);
  }

  const rows = ((data || []) as PushSubscriptionRow[]).filter(
    (row) => row.endpoint && row.p256dh && row.auth,
  );

  if (rows.length === 0) {
    return {
      attempted: 0,
      sent: 0,
      failed: 0,
      skipped: true,
      reason: "Recipients have no push subscription",
    };
  }

  webpush.setVapidDetails(
    env.vapidSubject,
    env.vapidPublicKey!,
    env.vapidPrivateKey!,
  );

  const payload = JSON.stringify({
    title: input.payload.title,
    body: input.payload.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: input.payload.url,
    tag: input.payload.tag,
    data: {
      ...(input.payload.data || {}),
      url: input.payload.url,
      createdAt: new Date().toISOString(),
    },
  });

  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const subscription = toWebPushSubscription(row);
      if (!subscription) return { sent: false };

      try {
        await webpush.sendNotification(subscription, payload);
        return { sent: true };
      } catch (error) {
        if (isExpiredPushSubscriptionError(error) && row.endpoint) {
          await input.supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", row.endpoint);
        }
        throw error;
      }
    }),
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  return {
    attempted: results.length,
    sent,
    failed,
    skipped: false,
  };
}
