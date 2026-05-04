import { runLeaveAlerts } from "@/lib/travelReminders";
import { cronAuthFailureResponse, validateCronRequest } from "@/lib/cronAuth";
import {
  createApiRequestContext,
  durationMs,
  jsonError,
  jsonOk,
  logRequestStart,
  safeError,
} from "@/lib/apiObservability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getLookaheadMinutes(req: Request): number | undefined {
  const url = new URL(req.url);
  const raw = url.searchParams.get("lookaheadMinutes");

  if (!raw) return undefined;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;

  return Math.max(1, Math.min(180, Math.round(parsed)));
}

async function handleCron(req: Request) {
  const ctx = createApiRequestContext(req);
  const startedAt = new Date().toISOString();
  logRequestStart(ctx, { job: "leave-alerts" });

  const auth = validateCronRequest(req);

  if (!auth.ok) {
    return cronAuthFailureResponse(auth, ctx);
  }

  try {
    const lookaheadMinutes = getLookaheadMinutes(req);
    const summary = await runLeaveAlerts({ lookaheadMinutes });

    return jsonOk(ctx, {
      job: "leave-alerts",
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: durationMs(ctx),
      lookaheadMinutes: lookaheadMinutes ?? null,
      summary,
    });
  } catch (error) {
    return jsonError(ctx, {
      error: "Leave alerts failed.",
      code: "CRON_LEAVE_ALERTS_FAILED",
      status: 500,
      log: { job: "leave-alerts", error: safeError(error) },
    });
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
