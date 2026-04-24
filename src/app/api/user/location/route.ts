// src/app/api/user/location/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUPABASE_URL = String(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
).trim();

const MAX_BODY_BYTES = 2_000;

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

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing authorization token.",
          code: "LOCATION_MISSING_AUTH",
        },
        { status: 401 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user?.id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid or expired session.",
          code: "LOCATION_INVALID_SESSION",
        },
        { status: 401 },
      );
    }

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
    const lat = Number(record.lat);
    const lng = Number(record.lng);

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

    const nowIso = new Date().toISOString();

    const { error: upsertError } = await supabaseAdmin
      .from("user_settings")
      .upsert(
        {
          user_id: user.id,
          last_known_lat: lat,
          last_known_lng: lng,
          last_known_at: nowIso,
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
}