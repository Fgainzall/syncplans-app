import { NextResponse } from "next/server";
import { runLeaveAlerts } from "@/lib/travelReminders";

export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET || "";
  if (!cronSecret) return false;

  const url = new URL(req.url);
  const querySecret = String(url.searchParams.get("secret") ?? "").trim();
  const headerSecret = String(req.headers.get("x-cron-secret") ?? "").trim();

  const authHeader = String(req.headers.get("authorization") ?? "").trim();
  const bearerSecret = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";

  return [querySecret, headerSecret, bearerSecret].some(
    (candidate) => candidate && candidate === cronSecret
  );
}

function getLookaheadMinutes(req: Request): number | undefined {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("lookaheadMinutes") ?? "");
  if (!Number.isFinite(raw)) return undefined;
  return Math.max(1, Math.min(120, Math.round(raw)));
}

async function handleCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const lookaheadMinutes = getLookaheadMinutes(req);
    const summary = await runLeaveAlerts({ lookaheadMinutes });

    return NextResponse.json(
      {
        ok: true,
        summary,
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Leave alerts failed";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}