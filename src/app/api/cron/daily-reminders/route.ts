// src/app/api/cron/daily-reminders/route.ts
import { NextResponse } from "next/server";
import { runDailyDigest } from "../../daily-digest/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET || "";

function isAuthorized(req: Request): boolean {
  if (!CRON_SECRET) return true;

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const headerSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");

  if (token && token === CRON_SECRET) return true;
  if (headerSecret && headerSecret === CRON_SECRET) return true;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    if (bearerToken === CRON_SECRET) return true;
  }

  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");

  return runDailyDigest(dateParam);
}