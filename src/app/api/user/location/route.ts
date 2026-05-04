// src/app/api/user/location/route.ts
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  type ApiRequestContext,
} from "@/lib/apiObservability";
import { createSupabaseUserClient } from "@/lib/apiSecurity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_BODY_BYTES = 2_000;

const USER_LOCATION_SELECT =
  "user_id, location_enabled, location_prompt_status, location_prompted_at, location_dismissed_until, last_known_lat, last_known_lng, last_known_accuracy_m, last_known_at";

type PromptStatus = "granted" | "dismissed" | "denied";

type UserLocationSettingsRow = {
  user_id: string;
  location_enabled?: boolean | null;
  location_prompt_status?: PromptStatus | null;
  location_prompted_at?: string | null;
  location_dismissed_until?: string | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
  last_known_accuracy_m?: number | null;
  last_known_at?: string | null;
};

function isValidLatLng(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function isValidPromptStatus(status: unknown): status is PromptStatus {
  return status === "granted" || status === "dismissed" || status === "denied";
}

async function readJsonBody(req: Request) {
  const rawLength = req.headers.get("content-length");
  const contentLength = Number(rawLength);

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  try {
    return (await req.json()) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function publicLocationState(row: UserLocationSettingsRow | null) {
  return {
    locationEnabled: Boolean(row?.location_enabled),
    promptStatus: row?.location_prompt_status ?? null,
    promptedAt: row?.location_prompted_at ?? null,
    dismissedUntil: row?.location_dismissed_until ?? null,
    lastKnown: {
      lat: Number.isFinite(Number(row?.last_known_lat))
        ? Number(row?.last_known_lat)
        : null,
      lng: Number.isFinite(Number(row?.last_known_lng))
        ? Number(row?.last_known_lng)
        : null,
      accuracy: Number.isFinite(Number(row?.last_known_accuracy_m))
        ? Number(row?.last_known_accuracy_m)
        : null,
      at: row?.last_known_at ?? null,
    },
  };
}

async function getAuthedSupabase(req: Request, ctx: ApiRequestContext) {
  const supabase = await createSupabaseUserClient(req);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    return {
      ok: false as const,
      response: jsonError(ctx, {
        error: "Sesión inválida o expirada.",
        code: "LOCATION_AUTH_REQUIRED",
        status: 401,
        log: { error },
      }),
    };
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
  };
}

function handleBodyError(ctx: ApiRequestContext, error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "REQUEST_TOO_LARGE") {
    return jsonError(ctx, {
      error: "Request body too large.",
      code: "LOCATION_REQUEST_TOO_LARGE",
      status: 413,
    });
  }

  if (message === "INVALID_JSON") {
    return jsonError(ctx, {
      error: "Invalid JSON body.",
      code: "LOCATION_INVALID_JSON",
      status: 400,
    });
  }

  return null;
}

export async function GET(req: Request) {
  const ctx = createApiRequestContext(req);

  try {
    const auth = await getAuthedSupabase(req, ctx);
    if (!auth.ok) return auth.response;

    const { data, error } = await auth.supabase
      .from("user_settings")
      .select(USER_LOCATION_SELECT)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (error) {
      return jsonError(ctx, {
        error: "Could not read location settings.",
        code: "LOCATION_READ_FAILED",
        status: 500,
        log: { userId: auth.userId, error },
      });
    }

    return jsonOk(ctx, publicLocationState(data as UserLocationSettingsRow | null));
  } catch (error) {
    return jsonError(ctx, {
      error: "Unexpected location read error.",
      code: "LOCATION_UNEXPECTED_ERROR",
      status: 500,
      log: { error },
    });
  }
}

export async function DELETE(req: Request) {
  const ctx = createApiRequestContext(req);

  try {
    const auth = await getAuthedSupabase(req, ctx);
    if (!auth.ok) return auth.response;

    const nowIso = new Date().toISOString();

    const { error } = await auth.supabase.from("user_settings").upsert(
      {
        user_id: auth.userId,
        last_known_lat: null,
        last_known_lng: null,
        last_known_accuracy_m: null,
        last_known_at: null,
        location_enabled: false,
        location_prompt_status: "dismissed",
        location_prompted_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return jsonError(ctx, {
        error: "Could not clear location.",
        code: "LOCATION_CLEAR_FAILED",
        status: 500,
        log: { userId: auth.userId, error },
      });
    }

    return jsonOk(ctx, { success: true });
  } catch (error) {
    return jsonError(ctx, {
      error: "Unexpected location clear error.",
      code: "LOCATION_UNEXPECTED_ERROR",
      status: 500,
      log: { error },
    });
  }
}

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);

  try {
    const auth = await getAuthedSupabase(req, ctx);
    if (!auth.ok) return auth.response;

    let body: unknown;

    try {
      body = await readJsonBody(req);
    } catch (error) {
      const response = handleBodyError(ctx, error);
      if (response) return response;
      throw error;
    }

    if (!body || typeof body !== "object") {
      return jsonError(ctx, {
        error: "Invalid JSON body.",
        code: "LOCATION_INVALID_BODY",
        status: 400,
      });
    }

    const record = body as Record<string, unknown>;
    const mode = String(record.mode ?? "location").trim();
    const nowIso = new Date().toISOString();

    if (mode === "prompt_state") {
      const status = record.status;

      if (!isValidPromptStatus(status)) {
        return jsonError(ctx, {
          error: "Invalid location prompt status.",
          code: "LOCATION_INVALID_PROMPT_STATUS",
          status: 400,
        });
      }

      const updatePayload: Record<string, unknown> = {
        user_id: auth.userId,
        location_prompt_status: status,
        location_prompted_at: nowIso,
        updated_at: nowIso,
      };

      if (status === "granted") {
        updatePayload.location_enabled = true;
        updatePayload.location_dismissed_until = null;
      }

      if (status === "dismissed") {
        updatePayload.location_enabled = false;
        updatePayload.location_dismissed_until = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      if (status === "denied") {
        updatePayload.location_enabled = false;
        updatePayload.location_dismissed_until = null;
      }

      const { error } = await auth.supabase
        .from("user_settings")
        .upsert(updatePayload, { onConflict: "user_id" });

      if (error) {
        return jsonError(ctx, {
          error: "Could not save location prompt status.",
          code: "LOCATION_PROMPT_SAVE_FAILED",
          status: 500,
          log: { userId: auth.userId, error },
        });
      }

      return jsonOk(ctx, {
        success: true,
        promptStatus: status,
      });
    }

    if (mode !== "location") {
      return jsonError(ctx, {
        error: "Invalid location mode.",
        code: "LOCATION_INVALID_MODE",
        status: 400,
      });
    }

    const lat = Number(record.lat);
    const lng = Number(record.lng);
    const accuracy =
      record.accuracy === null || record.accuracy === undefined
        ? null
        : Number(record.accuracy);

    if (!isValidLatLng(lat, lng)) {
      return jsonError(ctx, {
        error: "Invalid latitude or longitude.",
        code: "LOCATION_INVALID_COORDINATES",
        status: 400,
      });
    }

    const accuracyValue =
      Number.isFinite(accuracy) && Number(accuracy) >= 0 ? Number(accuracy) : null;

    const { error } = await auth.supabase.from("user_settings").upsert(
      {
        user_id: auth.userId,
        last_known_lat: lat,
        last_known_lng: lng,
        last_known_accuracy_m: accuracyValue,
        last_known_at: nowIso,
        location_enabled: true,
        location_prompt_status: "granted",
        location_prompted_at: nowIso,
        location_dismissed_until: null,
        updated_at: nowIso,
      },
      { onConflict: "user_id" },
    );

    if (error) {
      return jsonError(ctx, {
        error: "Could not save location.",
        code: "LOCATION_SAVE_FAILED",
        status: 500,
        log: { userId: auth.userId, error },
      });
    }

    return jsonOk(ctx, {
      success: true,
      lastKnownLocation: {
        lat,
        lng,
        accuracy: accuracyValue,
        at: nowIso,
      },
    });
  } catch (error) {
    return jsonError(ctx, {
      error: "Unexpected location save error.",
      code: "LOCATION_UNEXPECTED_ERROR",
      status: 500,
      log: { error },
    });
  }
}
