// src/app/api/push/test/route.ts
import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";
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

function json(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
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
      error:
        "Invalid VAPID_SUBJECT. Use mailto:correo@dominio.com or https://dominio.com.",
    };
  }

  return { ok: true as const, publicKey, privateKey, subject };
}

function hasValidSecret(req: Request) {
  const expected = process.env.PUSH_TEST_SECRET?.trim();
  if (!expected) return false;

  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  const headerSecret = req.headers.get("x-push-test-secret")?.trim();

  return querySecret === expected || headerSecret === expected;
}

function toWebPushSubscription(row: PushSubscriptionRow): WebPushSubscription | null {
  if (!row.endpoint || !row.p256dh || !row.auth) return null;

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function parseOptionalBody(req: Request) {
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

async function getSubscriptions(req: Request) {
  const supabase = await supabaseServer();

  if (hasValidSecret(req)) {
    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("user_id,endpoint,p256dh,auth,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      return {
        ok: false as const,
        status: 500,
        error: "Could not read push_subscriptions.",
        details: error.message,
      };
    }

    return {
      ok: true as const,
      mode: "secret",
      rows: (data || []) as PushSubscriptionRow[],
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      status: 401,
      error:
        "Unauthorized. Test from a logged-in browser or call with PUSH_TEST_SECRET using ?secret=...",
      details: userError?.message || null,
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
      error: "Could not read push_subscriptions.",
      details: error.message,
    };
  }

  return {
    ok: true as const,
    mode: "session",
    rows: (data || []) as PushSubscriptionRow[],
  };
}

async function handle(req: Request) {
  try {
    const vapid = getVapidConfig();

    if (!vapid.ok) {
      return json({ ok: false, error: vapid.error }, 500);
    }

    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    const subscriptionResult = await getSubscriptions(req);

    if (!subscriptionResult.ok) {
      return json(
        {
          ok: false,
          error: subscriptionResult.error,
          details: subscriptionResult.details ?? null,
        },
        subscriptionResult.status,
      );
    }

    const subscriptions = subscriptionResult.rows
      .map(toWebPushSubscription)
      .filter((subscription): subscription is WebPushSubscription => Boolean(subscription));

    if (subscriptions.length === 0) {
      return json(
        {
          ok: false,
          error: "No valid push subscriptions found. Activate notifications first.",
        },
        404,
      );
    }

    const body = await parseOptionalBody(req);

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : "SyncPlans";

    const message =
      typeof body.body === "string" && body.body.trim()
        ? body.body.trim()
        : "Push funcionando correctamente. Ya podemos conectarlo con las alertas de salida.";

    const targetUrl =
      typeof body.url === "string" && body.url.trim()
        ? body.url.trim()
        : "/settings/notifications";

    const payload = JSON.stringify({
      title,
      body: message,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      url: targetUrl,
      data: {
        type: "push_test",
        source: "api_push_test",
        url: targetUrl,
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

    return json({
      ok: sent > 0,
      mode: subscriptionResult.mode,
      attempted: results.length,
      sent,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: "Unexpected push test error.",
        details: getErrorMessage(error),
      },
      500,
    );
  }
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}