import { NextResponse } from "next/server";
import { runLeaveAlerts } from "@/lib/travelReminders";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(req: Request): boolean {
  const cronSecret = String(process.env.CRON_SECRET ?? "").trim();
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
  const raw = url.searchParams.get("lookaheadMinutes");

  if (!raw) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;

  return Math.max(1, Math.min(180, Math.round(parsed)));
}

async function handleCron(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
        code: "LEAVE_ALERTS_UNAUTHORIZED",
      },
      { status: 401 }
    );
  }

  const startedAt = new Date().toISOString();

  try {
    const lookaheadMinutes = getLookaheadMinutes(req);
    const summary = await runLeaveAlerts({ lookaheadMinutes });

    return NextResponse.json(
      {
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        lookaheadMinutes: lookaheadMinutes ?? null,
        summary,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Leave alerts failed";

    console.error("[cron/leave-alerts] failed", error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
        code: "LEAVE_ALERTS_FAILED",
        startedAt,
        finishedAt: new Date().toISOString(),
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