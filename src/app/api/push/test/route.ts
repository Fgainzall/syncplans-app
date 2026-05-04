// src/app/api/push/test/route.ts
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, getClientIp, rateLimitHeaders } from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  logRequestStart,
} from "@/lib/apiObservability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUSH_TEST_RATE_LIMIT_WINDOW_SECONDS = 60;
const PUSH_TEST_RATE_LIMIT_MAX_ATTEMPTS = 5;

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

type PushEnv = {
  ok: boolean;
  missing: string[];
  supabaseUrl?: string;
  serviceRoleKey?: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject: string;
  pushTestSecret?: string;
};

function getEnv(): PushEnv {
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

function getBearerToken(req: Request) {
  const header = String(req.headers.get("authorization") ?? "").trim();
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function isAuthorized(req: Request, expectedSecret: string) {
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  const headerSecret = req.headers.get("x-push-test-secret")?.trim();
  const bearer = getBearerToken(req);

  return (
    querySecret === expectedSecret ||
    headerSecret === expectedSecret ||
    bearer === expectedSecret
  );
}

async function parseBody(req: Request): Promise<PushBody> {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};

    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const record = parsed as Record<string, unknown>;

    return {
      title: typeof record.title === "string" ? record.title.slice(0, 120) : undefined,
      body: typeof record.body === "string" ? record.body.slice(0, 240) : undefined,
      url: typeof record.url === "string" ? record.url.slice(0, 400) : undefined,
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

function getPushFailureDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { name: "UnknownPushError" };
  }

  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : "PushProviderError",
    statusCode: typeof record.statusCode === "number" ? record.statusCode : null,
    code: typeof record.code === "string" ? record.code : null,
  };
}

async function handler(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "push.test" });

  try {
    const env = getEnv();

    if (!env.ok) {
      return jsonError(ctx, {
        error: "Faltan variables de entorno para probar push.",
        code: "PUSH_ENV_MISSING",
        status: 500,
        level: "error",
        data: { missing: env.missing },
        log: { flow: "push.test", missing: env.missing },
      });
    }

    const limit = await checkRateLimit({
      prefix: "push-test",
      keyParts: [getClientIp(req)],
      limit: PUSH_TEST_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: PUSH_TEST_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!limit.allowed) {
      return jsonError(ctx, {
        error: "Demasiadas pruebas de push. Intenta nuevamente en unos segundos.",
        code: "PUSH_TEST_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(limit),
        log: { flow: "push.test" },
      });
    }

    if (!isAuthorized(req, env.pushTestSecret!)) {
      return jsonError(ctx, {
        error: "No autorizado para probar push.",
        code: "PUSH_TEST_UNAUTHORIZED",
        status: 401,
        log: { flow: "push.test" },
      });
    }

    if (
      !env.vapidSubject.startsWith("mailto:") &&
      !env.vapidSubject.startsWith("https://")
    ) {
      return jsonError(ctx, {
        error: "VAPID_SUBJECT inválido.",
        code: "PUSH_VAPID_SUBJECT_INVALID",
        status: 500,
        level: "error",
        log: { flow: "push.test" },
      });
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
      return jsonError(ctx, {
        error: "No se pudieron leer las suscripciones push.",
        code: "PUSH_SUBSCRIPTIONS_LOOKUP_FAILED",
        status: 500,
        log: { flow: "push.test", providerError: error.message },
      });
    }

    const rows = ((data || []) as PushSubscriptionRow[]).filter(
      (row) => row.endpoint && row.p256dh && row.auth
    );

    if (rows.length === 0) {
      return jsonError(ctx, {
        error: "No hay suscripciones push válidas.",
        code: "PUSH_NO_VALID_SUBSCRIPTIONS",
        status: 404,
        data: {
          totalRowsRead: data?.length || 0,
          hint:
            "Ve a /settings/notifications, activa push otra vez y confirma que exista una fila fresca en push_subscriptions.",
        },
        log: { flow: "push.test", totalRowsRead: data?.length || 0 },
      });
    }

    webpush.setVapidDetails(
      env.vapidSubject,
      env.vapidPublicKey!,
      env.vapidPrivateKey!
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
        requestId: ctx.requestId,
        createdAt: new Date().toISOString(),
      },
    });

    const subscriptions = rows
      .map(toWebPushSubscription)
      .filter((sub): sub is NonNullable<ReturnType<typeof toWebPushSubscription>> =>
        Boolean(sub)
      );

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription, payload)
      )
    );

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter(({ result }) => result.status === "rejected")
      .map(({ result, index }) => ({
        index,
        ...(result.status === "rejected"
          ? getPushFailureDetails(result.reason)
          : { name: "UnknownPushError" }),
      }));

    const sent = results.length - failures.length;

    if (sent <= 0) {
      return jsonError(ctx, {
        error: "No se pudo enviar ninguna notificación push.",
        code: "PUSH_SEND_FAILED",
        status: 502,
        data: {
          attempted: results.length,
          sent,
          failed: failures.length,
          failures,
        },
        log: {
          flow: "push.test",
          attempted: results.length,
          sent,
          failed: failures.length,
          failures,
        },
      });
    }

    return jsonOk(
      ctx,
      {
        attempted: results.length,
        sent,
        failed: failures.length,
        failures,
      },
      {
        headers: rateLimitHeaders(limit),
        log: {
          flow: "push.test",
          attempted: results.length,
          sent,
          failed: failures.length,
        },
      }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "Error inesperado probando push.",
      code: "PUSH_TEST_FAILED",
      status: 500,
      level: "error",
      log: { flow: "push.test", error },
    });
  }
}

export async function POST(req: Request) {
  return handler(req);
}

export async function GET(req: Request) {
  return handler(req);
}
