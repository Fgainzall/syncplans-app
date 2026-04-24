// src/app/api/push/test/route.ts
import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PushSubscriptionRow = {
  id?: string | null;
  user_id?: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  updated_at?: string | null;
};

type PushBody = {
  title?: string;
  body?: string;
  url?: string;
};

function response(payload: Record<string, unknown>, status = 200) {
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

function getEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const vapidSubject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:no-reply@syncplansapp.com";

  const pushTestSecret = process.env.PUSH_TEST_SECRET?.trim();

  const missing: string[] = [];

  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!vapidPublicKey) missing.push("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!vapidPrivateKey) missing.push("VAPID_PRIVATE_KEY");
  if (!pushTestSecret) missing.push("PUSH_TEST_SECRET");

  return {
    ok: missing.length === 0,
    missing,
    supabaseUrl,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
    pushTestSecret,
  };
}

function isAuthorized(req: Request, expectedSecret: string) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  const headerSecret = req.headers.get("x-push-test-secret")?.trim();

  return querySecret === expectedSecret || headerSecret === expectedSecret;
}

async function parseBody(req: Request): Promise<PushBody> {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};

    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const record = parsed as Record<string, unknown>;

    return {
      title: typeof record.title === "string" ? record.title : undefined,
      body: typeof record.body === "string" ? record.body : undefined,
      url: typeof record.url === "string" ? record.url : undefined,
    };
  } catch {
    return {};
  }
}

function toWebPushSubscription(row: PushSubscriptionRow) {
  if (!row.endpoint || !row.p256dh || !row.auth) return null;

  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function handler(req: Request) {
  try {
    const env = getEnv();

    if (!env.ok) {
      return response(
        {
          ok: false,
          error: "Missing required environment variables.",
          missing: env.missing,
        },
        500,
      );
    }

    if (!isAuthorized(req, env.pushTestSecret!)) {
      return response(
        {
          ok: false,
          error: "Unauthorized. Invalid PUSH_TEST_SECRET.",
        },
        401,
      );
    }

    if (
      !env.vapidSubject.startsWith("mailto:") &&
      !env.vapidSubject.startsWith("https://")
    ) {
      return response(
        {
          ok: false,
          error:
            "Invalid VAPID_SUBJECT. Use mailto:correo@dominio.com or https://dominio.com.",
        },
        500,
      );
    }

    const supabase = createClient(env.supabaseUrl!, env.serviceRoleKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth,updated_at")
      .order("updated_at", { ascending: false })
      .limit(10);

    if (error) {
      return response(
        {
          ok: false,
          error: "Could not read push_subscriptions.",
          details: error.message,
        },
        500,
      );
    }

    const rows = ((data || []) as PushSubscriptionRow[]).filter(
      (row) => row.endpoint && row.p256dh && row.auth,
    );

    if (rows.length === 0) {
      return response(
        {
          ok: false,
          error: "No valid push subscriptions found.",
          totalRowsRead: data?.length || 0,
          hint:
            "Go to /settings/notifications, activate push again, and confirm a fresh row exists in push_subscriptions.",
        },
        404,
      );
    }

    webpush.setVapidDetails(
      env.vapidSubject,
      env.vapidPublicKey!,
      env.vapidPrivateKey!,
    );

    const body = await parseBody(req);

    const title = body.title?.trim() || "SyncPlans";
    const message =
      body.body?.trim() ||
      "Push funcionando correctamente. Ya podemos conectarlo con las alertas de salida.";
    const url = body.url?.trim() || "/settings/notifications";

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

    const subscriptions = rows
      .map(toWebPushSubscription)
      .filter((sub): sub is NonNullable<ReturnType<typeof toWebPushSubscription>> =>
        Boolean(sub),
      );

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription, payload),
      ),
    );

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, index }) => ({
        index,
        message:
          result.status === "rejected"
            ? getErrorMessage(result.reason)
            : "Unknown push error",
      }));

    const sent = results.length - failures.length;

    return response({
      ok: sent > 0,
      attempted: results.length,
      sent,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    return response(
      {
        ok: false,
        error: "Unexpected push test error.",
        details: getErrorMessage(error),
      },
      500,
    );
  }
}

export async function POST(req: Request) {
  return handler(req);
}

export async function GET(req: Request) {
  return handler(req);
}