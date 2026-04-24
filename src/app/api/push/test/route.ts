// src/app/api/push/test/route.ts
import { NextResponse } from "next/server";
import webpush, { type PushSubscription } from "web-push";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PushSubscriptionRow = {
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  updated_at?: string | null;
};

type TestPushBody = {
  title?: string;
  body?: string;
  url?: string;
};

function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@syncplansapp.com";

  if (!publicKey || !privateKey) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function toWebPushSubscription(row: PushSubscriptionRow): PushSubscription | null {
  if (!row.endpoint || !row.p256dh || !row.auth) {
    return null;
  }

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function parseBody(req: Request): Promise<TestPushBody> {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    const raw = (await req.json()) as unknown;

    if (!raw || typeof raw !== "object") return {};
    const body = raw as Record<string, unknown>;

    return {
      title: typeof body.title === "string" ? body.title : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      url: typeof body.url === "string" ? body.url : undefined,
    };
  } catch {
    return {};
  }
}

async function sendTestPush(req: Request) {
  const vapid = getVapidConfig();

  if (!vapid) {
    return jsonError(
      "Missing VAPID configuration. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.",
      500,
    );
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const supabase = await supabaseServer();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonError("Unauthorized.", 401);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(3);

  if (subscriptionsError) {
    return jsonError("Could not read push subscriptions.", 500, subscriptionsError.message);
  }

  const validSubscriptions = (subscriptions || [])
    .map((row) => toWebPushSubscription(row as PushSubscriptionRow))
    .filter((subscription): subscription is PushSubscription => Boolean(subscription));

  if (validSubscriptions.length === 0) {
    return jsonError(
      "No valid push subscription found for this user. Activate push notifications first.",
      404,
    );
  }

  const body = await parseBody(req);

  const payload = JSON.stringify({
    title: body.title || "SyncPlans",
    body:
      body.body ||
      "Push funcionando correctamente. El siguiente paso es conectarlo con las alertas de salida.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: body.url || "/settings/notifications",
    data: {
      type: "push_test",
      source: "api_push_test",
      createdAt: new Date().toISOString(),
      url: body.url || "/settings/notifications",
    },
  });

  const results = await Promise.allSettled(
    validSubscriptions.map((subscription) =>
      webpush.sendNotification(subscription, payload),
    ),
  );

  const sent = results.filter((result) => result.status === "fulfilled").length;
  const failed = results.length - sent;

  const failures = results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === "rejected")
    .map(({ result, index }) => {
      const reason = result.status === "rejected" ? result.reason : null;
      return {
        index,
        message:
          reason instanceof Error
            ? reason.message
            : typeof reason === "string"
              ? reason
              : "Unknown push error",
      };
    });

  return NextResponse.json({
    ok: sent > 0,
    sent,
    failed,
    attempted: results.length,
    failures,
  });
}

export async function POST(req: Request) {
  return sendTestPush(req);
}

export async function GET(req: Request) {
  return sendTestPush(req);
}