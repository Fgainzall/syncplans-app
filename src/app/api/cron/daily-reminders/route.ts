import { NextResponse } from "next/server";
import { runDailyDigest } from "../../daily-digest/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

function getCronAuthError(req: Request): string | null {
  const isProduction = process.env.NODE_ENV === "production";

  if (!CRON_SECRET) {
    return isProduction ? "CRON secret missing in production." : null;
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");

  if (token && token === CRON_SECRET) return null;
  if (headerSecret && headerSecret === CRON_SECRET) return null;

if (authHeader && authHeader.startsWith("Bearer ")) {
  const bearerToken = authHeader.slice(7).trim();
  if (bearerToken === CRON_SECRET) return null;
}

  return "Invalid CRON token.";
}

export async function GET(req: Request) {
  const authError = getCronAuthError(req);

  if (authError) {
    return NextResponse.json(
      { ok: false, message: authError },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}

export async function POST(req: Request) {
  const authError = getCronAuthError(req);

  if (authError) {
    return NextResponse.json(
      { ok: false, message: authError },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}