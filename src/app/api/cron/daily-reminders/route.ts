import { runDailyDigest } from "../../daily-digest/route";
import {
  cronAuthFailureResponse,
  getCronDateParam,
  validateCronRequest,
} from "@/lib/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleCron(req: Request) {
  const auth = validateCronRequest(req);

  if (!auth.ok) {
    return cronAuthFailureResponse(auth);
  }

  const dateParam = getCronDateParam(req);

  if (!dateParam.ok) {
    return dateParam.response;
  }

  return runDailyDigest(dateParam.date);
}

export async function GET(req: Request) {
  return handleCron(req);
}

export async function POST(req: Request) {
  return handleCron(req);
}
