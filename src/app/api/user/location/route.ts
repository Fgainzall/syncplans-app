// src/app/api/user/location/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
).trim();

const MAX_BODY_BYTES = 2_000;

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

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
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

function getSupabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("MISSING_SUPABASE_SERVER_CONFIG");
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function getAuthedUser(req: Request) {
  const token = getBearerToken(req);

  if (!token) {
    return {
      supabaseAdmin: null,
      userId: null,
      response: NextResponse.json(
        {
          ok: false,
          error: "Missing authorization token.",
          code: "LOCATION_MISSING_AUTH",
        },
        { status: 401 },
      ),
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user?.id) {
    return {
      supabaseAdmin: null,
      userId: null,
      response: NextResponse.json(
        {
          ok: false,
          error: "Invalid or expired session.",
          code: "LOCATION_INVALID_SESSION",
        },
        { status: 401 },
      ),
    };
  }

  return { supabaseAdmin, userId: user.id, response: null };
}

function publicLocationState(row: UserLocationSettingsRow | null) {
  return {
    ok: true,
    locationEnabled: Boolean(row?.location_enabled),
    promptStatus: row?.location_prompt_status ?? null,
    promptedAt: row?.location_prompted_at ?? null,
    dismissedUntil: row?.location_dismissed_until ?? null,
    lastKnown: {
      lat: Number.isFinite(Number(row?.last_known_lat)) ? Number(row?.last_known_lat) : null,
      lng: Number.isFinite(Number(row?.last_known_lng)) ? Number(row?.last_known_lng) : null,
      accuracy: Number.isFinite(Number(row?.last_known_accuracy_m))
        ? Number(row?.last_known_accuracy_m)
        : null,
      at: row?.last_known_at ?? null,
    },
  };
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if (auth.response) return auth.response;

    const { data, error } = await auth.supabaseAdmin!
      .from("user_settings")
      .select(
        "user_id, location_enabled, location_prompt_status, location_prompted_at, location_dismissed_until, last_known_lat, last_known_lng, last_known_accuracy_m, last_known_at",
      )
      .eq("user_id", auth.userId!)
      .maybeSingle();

    if (error) {
      console.error("[api/user/location] get failed", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not read location settings.",
          code: "LOCATION_READ_FAILED",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(publicLocationState((data ?? null) as UserLocationSettingsRow | null), {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return handleUnexpectedError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if (auth.response) return auth.response;

    const nowIso = new Date().toISOString();

    const { error } = await auth.supabaseAdmin!
      .from("user_settings")
      .upsert(
        {
          user_id: auth.userId!,
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
      console.error("[api/user/location] delete failed", error);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not clear location.",
          code: "LOCATION_CLEAR_FAILED",
          details: error.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        success: true,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return handleUnexpectedError(error);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthedUser(req);
    if (auth.response) return auth.response;

    const body = await readJsonBody(req);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body.",
          code: "LOCATION_INVALID_BODY",
        },
        { status: 400 },
      );
    }

    const record = body as Record<string, unknown>;
    const mode = String(record.mode ?? "location");
    const nowIso = new Date().toISOString();

    if (mode === "prompt_state") {
      const status = record.status;

      if (!isValidPromptStatus(status)) {
        return NextResponse.json(
          {
            ok: false,
            error: "Invalid location prompt status.",
            code: "LOCATION_INVALID_PROMPT_STATUS",
          },
          { status: 400 },
        );
      }

      const updatePayload: Record<string, unknown> = {
        user_id: auth.userId!,
        location_prompt_status: status,
        location_prompted_at: nowIso,
        updated_at: nowIso,
      };

      if (status === "granted") {
        updatePayload.location_enabled = true;
        updatePayload.location_dismissed_until = null;
      }

      if (status === "dismissed") {
        const dismissedUntil = new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();

        updatePayload.location_enabled = false;
        updatePayload.location_dismissed_until = dismissedUntil;
      }

      if (status === "denied") {
        updatePayload.location_enabled = false;
        updatePayload.location_dismissed_until = null;
      }

      const { error: upsertError } = await auth.supabaseAdmin!
        .from("user_settings")
        .upsert(updatePayload, { onConflict: "user_id" });

      if (upsertError) {
        console.error("[api/user/location] prompt upsert failed", upsertError);

        return NextResponse.json(
          {
            ok: false,
            error: "Could not save location prompt status.",
            code: "LOCATION_PROMPT_SAVE_FAILED",
            details: upsertError.message,
          },
          { status: 500 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          success: true,
          promptStatus: status,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    if (mode !== "location") {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid location mode.",
          code: "LOCATION_INVALID_MODE",
        },
        { status: 400 },
      );
    }

    const lat = Number(record.lat);
    const lng = Number(record.lng);
    const accuracy =
      record.accuracy === null || record.accuracy === undefined
        ? null
        : Number(record.accuracy);

    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid latitude or longitude.",
          code: "LOCATION_INVALID_COORDINATES",
        },
        { status: 400 },
      );
    }

    const accuracyValue =
      Number.isFinite(accuracy) && Number(accuracy) >= 0 ? Number(accuracy) : null;

    const { error: upsertError } = await auth.supabaseAdmin!
      .from("user_settings")
      .upsert(
        {
          user_id: auth.userId!,
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

    if (upsertError) {
      console.error("[api/user/location] upsert failed", upsertError);

      return NextResponse.json(
        {
          ok: false,
          error: "Could not save location.",
          code: "LOCATION_SAVE_FAILED",
          details: upsertError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        success: true,
        lastKnownLocation: {
          lat,
          lng,
          accuracy: accuracyValue,
          at: nowIso,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return handleUnexpectedError(error);
  }
}

function handleUnexpectedError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "REQUEST_TOO_LARGE") {
    return NextResponse.json(
      {
        ok: false,
        error: "Request body too large.",
        code: "LOCATION_REQUEST_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  if (message === "INVALID_JSON") {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON body.",
        code: "LOCATION_INVALID_JSON",
      },
      { status: 400 },
    );
  }

  if (message === "MISSING_SUPABASE_SERVER_CONFIG") {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing Supabase server configuration.",
        code: "LOCATION_MISSING_SERVER_CONFIG",
      },
      { status: 500 },
    );
  }

  console.error("[api/user/location] unexpected error", error);

  return NextResponse.json(
    {
      ok: false,
      error: "Unexpected location save error.",
      code: "LOCATION_UNEXPECTED_ERROR",
    },
    { status: 500 },
  );
}