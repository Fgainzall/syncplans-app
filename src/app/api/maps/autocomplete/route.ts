import { NextResponse } from "next/server";
import {
  getPlaceAutocomplete,
  parseAutocompleteInputFromUnknown,
  toPublicMapsError,
} from "@/lib/maps";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 10_000;

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
    const input = parseAutocompleteInputFromUnknown(body);
    const result = await getPlaceAutocomplete(input);

    return NextResponse.json({ predictions: result.predictions }, { status: 200 });
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