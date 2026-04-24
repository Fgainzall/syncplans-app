// src/app/api/push/test/route.ts
import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PushSubscriptionRow = {
  user_id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  updated_at: string | null;
};

type WebPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

function jsonError(error: string, status = 400, details?: unknown) {
  return jsonResponse(
    {
      ok: false,
      error,
      ...(details ? { details } : {}),
    },
    status,
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@syncplansapp.com";

  if (!publicKey) {
    return { ok: false as const, error: "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY." };
  }

  if (!privateKey) {
    return { ok: false as const, error: "Missing VAPID_PRIVATE_KEY." };
  }

  if (!subject.startsWith("mailto:") && !subject.startsWith("https://")) {
    return {
      ok: false as const,
      error: "Invalid VAPID_SUBJECT. Use mailto:correo@dominio.com or https://dominio.com.",
    };
  }

  return {
    ok: true as const,
    publicKey,
    privateKey,
    subject,
  };
}

function toSubscription(row: PushSubscriptionRow): WebPushSubscription | null {
  if (!row.endpoint || !row.p256dh || !row.auth) return null;

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

function hasTestSecret(req: Request): boolean {
  const expected = process.env.PUSH_TEST_SECRET?.trim();

  // In production, if you set PUSH_TEST_SECRET, the endpoint can be tested from terminal:
  // /api/push/test?secret=...
  if (!expected) return false;

  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("secret")?.trim();
  const fromHeader = req.headers.get("x-push-test-secret")?.trim();

  return fromQuery === expected || fromHeader === expected;
}

async function getRequestBody(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function getLatestSubscriptions(req: Request) {
  const supabase = await supabaseServer();

  // Option A: test from terminal with PUSH_TEST_SECRET.
  // This sends to the latest subscriptions in the table, without needing browser cookies.
  if (hasTestSecret(req)) {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("user_id,endpoint,p256dh,auth,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      return {
        ok: false as const,
        status: 500,
        error: "Could not read push subscriptions.",
        details: error.message,
      };
    }

    return {
      ok: true as const,
      rows: (data || []) as PushSubscriptionRow[],
      mode: "secret",
    };
  }

  // Option B: test from browser while logged in.
  // This only sends to the current user's subscriptions.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      error:
        "Unauthorized. Open this endpoint from a logged-in browser session, or set PUSH_TEST_SECRET and call it with ?secret=...",
      details: userError?.message,
    };
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("user_id,endpoint,p256dh,auth,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: "Could not read push subscriptions.",
      details: error.message,
    };
  }

  return {
    ok: true as const,
    rows: (data || []) as PushSubscriptionRow[],
    mode: "session",
  };
}

async function handlePushTest(req: Request) {
  try {
    const vapid = getVapidConfig();

    if (!vapid.ok) {
      return jsonError(vapid.error, 500);
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const subscriptionResult = await getLatestSubscriptions(req);

    if (!subscriptionResult.ok) {
      return jsonError(
        subscriptionResult.error,
        subscriptionResult.status,
        subscriptionResult.details,
      );
    }

    const subscriptions = subscriptionResult.rows
      .map(toSubscription)
      .filter((subscription): subscription is WebPushSubscription => Boolean(subscription));

    if (subscriptions.length === 0) {
      return jsonError(
        "No valid push subscriptions found. Activate notifications first.",
        404,
      );
    }

    const body = await getRequestBody(req);

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "SyncPlans";

    const message =
      typeof body.body === "string" && body.body.trim()
        ? body.body.trim()
        : "Push funcionando correctamente. Ya podemos conectarlo con las alertas de salida.";

    const url =
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : "/settings/notifications";

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      url,
      data: {
        type: "push_test",
        source: "api_push_test",
        url,
        createdAt: new Date().toISOString(),
      },
    });

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription, payload),
      ),
    );

    const sent = results.filter((result) => result.status === "fulfilled").length;

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, index }) => ({
        index,
        message:
          result.status === "rejected"
            ? getErrorMessage(result.reason)
            : "Unknown error",
      }));

    return jsonResponse({
      ok: sent > 0,
      mode: subscriptionResult.mode,
      attempted: results.length,
      sent,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    return jsonError("Unexpected push test error.", 500, getErrorMessage(error));
  }
}

export async function POST(req: Request) {
  return handlePushTest(req);
}

export async function GET(req: Request) {
  return handlePushTest(req);
}