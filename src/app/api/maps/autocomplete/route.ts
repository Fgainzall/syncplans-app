// src/app/api/maps/autocomplete/route.ts
import { NextResponse } from "next/server";
import {
  getPlaceAutocomplete,
  parseAutocompleteInputFromUnknown,
  toPublicMapsError,
} from "@/lib/maps";
import {
  checkRateLimit,
  getAuthenticatedUser,
  getClientIp,
  jsonNoStore,
  rateLimitHeaders,
  readJsonBody,
} from "@/lib/apiSecurity";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;
const MAPS_RATE_LIMIT_WINDOW_SECONDS = 60;
const MAPS_RATE_LIMIT_MAX_ATTEMPTS = 30;

export async function POST(req: Request) {
  try {
    const auth = await getAuthenticatedUser(req);
    if (!auth.ok) return auth.response;

    const limit = await checkRateLimit({
      prefix: "maps-autocomplete",
      keyParts: [auth.user.id, getClientIp(req)],
      limit: MAPS_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: MAPS_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!limit.allowed) {
      return jsonNoStore(
        {
          ok: false,
          error: "Demasiadas búsquedas. Intenta nuevamente en unos segundos.",
          code: "MAPS_RATE_LIMITED",
        },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const input = parseAutocompleteInputFromUnknown(body);
    const result = await getPlaceAutocomplete(input);

    return NextResponse.json(
      { predictions: result.predictions },
      {
        status: 200,
        headers: {
          ...rateLimitHeaders(limit),
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonNoStore(
        { error: "Payload too large.", code: "MAPS_INVALID_BODY" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return jsonNoStore(
        { error: "Invalid JSON body.", code: "MAPS_INVALID_BODY" },
        { status: 400 }
      );
    }

    const mapped = toPublicMapsError(error);
    const status = mapped.isProviderError ? 502 : mapped.status;

    return jsonNoStore(
      {
        error: mapped.status >= 500 ? "Maps request failed." : mapped.message,
        code: mapped.code,
      },
      { status }
    );
  }
}
