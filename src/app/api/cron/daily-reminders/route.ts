import { runDailyDigest } from "../../daily-digest/route";
import {
  cronAuthFailureResponse,
  getCronDateParam,
  validateCronRequest,
} from "@/lib/cronAuth";
import {
  createApiRequestContext,
  jsonError,
  logRequestStart,
  safeError,
} from "@/lib/apiObservability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleCron(req: Request) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { job: "daily-reminders" });

  try {
    const auth = validateCronRequest(req);

    if (!auth.ok) {
      return cronAuthFailureResponse(auth, ctx);
    }

    const dateParam = getCronDateParam(req, ctx);

    if (!dateParam.ok) {
      return dateParam.response;
    }

    return runDailyDigest(dateParam.date, ctx);
  } catch (error) {
    return jsonError(ctx, {
      error: "Daily reminders job failed.",
      code: "CRON_DAILY_REMINDERS_FAILED",
      status: 500,
      log: { job: "daily-reminders", error: safeError(error) },
    });
  }
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
