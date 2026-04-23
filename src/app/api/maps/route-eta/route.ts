import { NextResponse } from "next/server";
import { getRouteEta, parseRouteEtaInputFromUnknown, toPublicMapsError } from "@/lib/maps";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8_000;

function parseBodySize(req: Request): number {
  const raw = req.headers.get("content-length");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

export async function POST(req: Request) {
  try {
    if (parseBodySize(req) > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Payload too large.", code: "MAPS_INVALID_BODY" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const input = parseRouteEtaInputFromUnknown(body);
    const result = await getRouteEta(input);

    return NextResponse.json(
      {
        etaSeconds: result.etaSeconds,
        distanceMeters: result.distanceMeters,
        trafficModel: result.trafficModel,
        provider: result.provider,
        calculatedAt: result.calculatedAt,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON body.", code: "MAPS_INVALID_BODY" },
        { status: 400 }
      );
    }

    const mapped = toPublicMapsError(error);
    const status = mapped.isProviderError ? 502 : mapped.status;

    return NextResponse.json(
      {
        error: mapped.status >= 500 ? "Maps request failed." : mapped.message,
        code: mapped.code,
      },
      { status }
    );
  }
}