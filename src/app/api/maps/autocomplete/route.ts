// src/app/api/maps/autocomplete/route.ts
import {
  getPlaceAutocomplete,
  parseAutocompleteInputFromUnknown,
  toPublicMapsError,
} from "@/lib/maps";
import {
  checkRateLimit,
  getAuthenticatedUser,
  getClientIp,
  rateLimitHeaders,
  readJsonBody,
} from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  logRequestStart,
  safeError,
} from "@/lib/apiObservability";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;
const MAPS_RATE_LIMIT_WINDOW_SECONDS = 60;
const MAPS_RATE_LIMIT_MAX_ATTEMPTS = 30;

export async function POST(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "maps-autocomplete" });

  try {
    const auth = await getAuthenticatedUser(req, ctx);
    if (!auth.ok) return auth.response;

    const limit = await checkRateLimit({
      prefix: "maps-autocomplete",
      keyParts: [auth.user.id, getClientIp(req)],
      limit: MAPS_RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: MAPS_RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!limit.allowed) {
      return jsonError(ctx, {
        error: "Demasiadas búsquedas. Intenta nuevamente en unos segundos.",
        code: "MAPS_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(limit),
        log: { userId: auth.user.id },
      });
    }

    const body = await readJsonBody(req, MAX_BODY_BYTES);
    const input = parseAutocompleteInputFromUnknown(body);
    const result = await getPlaceAutocomplete(input);

    return jsonOk(
      ctx,
      { predictions: result.predictions },
      {
        headers: rateLimitHeaders(limit),
        log: {
          userId: auth.user.id,
          predictionCount: result.predictions.length,
        },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonError(ctx, {
        error: "Payload too large.",
        code: "MAPS_INVALID_BODY",
        status: 400,
      });
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return jsonError(ctx, {
        error: "Invalid JSON body.",
        code: "MAPS_INVALID_BODY",
        status: 400,
      });
    }

    const mapped = toPublicMapsError(error);
    const status = mapped.isProviderError ? 502 : mapped.status;
    const code = mapped.isProviderError ? "MAPS_PROVIDER_FAILED" : mapped.code;

    return jsonError(ctx, {
      error: mapped.status >= 500 ? "Maps request failed." : mapped.message,
      code,
      status,
      log: { providerCode: mapped.code, error: safeError(error) },
    });
  }
}
