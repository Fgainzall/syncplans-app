import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

  return req.json();
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Missing Supabase server configuration." },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token." },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user?.id) {
      return NextResponse.json(
        { error: "Invalid or expired session." },
        { status: 401 }
      );
    }

    const body = await readJsonBody(req);

    const lat = Number(body?.lat);
    const lng = Number(body?.lng);

    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json(
        { error: "Invalid latitude or longitude." },
        { status: 400 }
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
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("[api/user/location] upsert failed", upsertError);

      return NextResponse.json(
        { error: "Could not save location." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lastKnownLocation: {
        lat,
        lng,
        at: nowIso,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message === "REQUEST_TOO_LARGE") {
      return NextResponse.json(
        { error: "Request body too large." },
        { status: 413 }
      );
    }

    console.error("[api/user/location] unexpected error", error);

    return NextResponse.json(
      { error: "Unexpected location save error." },
      { status: 500 }
    );
  }
}