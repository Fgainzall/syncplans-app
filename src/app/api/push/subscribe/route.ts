import { createApiRequestContext, jsonError, jsonOk, logRequestStart } from "@/lib/apiObservability";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type PushBody = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

async function parsePushBody(req: Request): Promise<PushBody | null> {
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as PushBody;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "push.subscribe" });

  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return jsonError(ctx, {
        error: "No autenticado.",
        code: "PUSH_SUBSCRIBE_UNAUTHORIZED",
        status: 401,
        log: { flow: "push.subscribe" },
      });
    }

    const body = await parsePushBody(req);

    const endpoint = String(body?.endpoint ?? "").trim();
    const p256dh = String(body?.keys?.p256dh ?? "").trim();
    const auth = String(body?.keys?.auth ?? "").trim();

    if (!endpoint || !p256dh || !auth) {
      return jsonError(ctx, {
        error: "Suscripción push inválida.",
        code: "PUSH_SUBSCRIPTION_INVALID",
        status: 400,
        log: { flow: "push.subscribe", userId: user.id },
      });
    }

    const userAgent = String(req.headers.get("user-agent") ?? "").slice(0, 500);

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,endpoint",
      }
    );

    if (error) {
      return jsonError(ctx, {
        error: "No se pudo guardar la suscripción push.",
        code: "PUSH_SUBSCRIPTION_SAVE_FAILED",
        status: 500,
        log: { flow: "push.subscribe", userId: user.id, providerError: error.message },
      });
    }

    return jsonOk(
      ctx,
      { subscribed: true },
      { log: { flow: "push.subscribe", userId: user.id } }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "No se pudo guardar la suscripción push.",
      code: "PUSH_SUBSCRIBE_FAILED",
      status: 500,
      level: "error",
      log: { flow: "push.subscribe", error },
    });
  }
}
