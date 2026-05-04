// src/lib/cronAuth.ts
import { NextResponse } from "next/server";

type CronAuthSuccess = { ok: true };

type CronAuthFailure = {
  ok: false;
  status: 401 | 500;
  code: "CRON_UNAUTHORIZED" | "CRON_SECRET_MISSING";
  message: string;
};

export type CronAuthResult = CronAuthSuccess | CronAuthFailure;

function getConfiguredCronSecret() {
  return String(process.env.CRON_SECRET ?? "").trim();
}

export function getCronBearerToken(req: Request) {
  const authHeader = String(req.headers.get("authorization") ?? "").trim();

  return authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
}

export function validateCronRequest(req: Request): CronAuthResult {
  const cronSecret = getConfiguredCronSecret();

  if (!cronSecret) {
    return {
      ok: false,
      status: 500,
      code: "CRON_SECRET_MISSING",
      message: "CRON_SECRET is not configured.",
    };
  }

  const bearerToken = getCronBearerToken(req);

  if (!bearerToken || bearerToken !== cronSecret) {
    return {
      ok: false,
      status: 401,
      code: "CRON_UNAUTHORIZED",
      message: "Unauthorized cron request.",
    };
  }

  return { ok: true };
}

export function cronAuthFailureResponse(failure: CronAuthFailure) {
  return NextResponse.json(
    {
      ok: false,
      error: failure.message,
      code: failure.code,
    },
    {
      status: failure.status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export function getCronDateParam(req: Request):
  | { ok: true; date: string | null }
  | { ok: false; response: NextResponse } {
  const url = new URL(req.url);
  const date = String(url.searchParams.get("date") ?? "").trim();

  if (!date) return { ok: true, date: null };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Invalid date parameter. Expected YYYY-MM-DD.",
          code: "INVALID_CRON_DATE",
        },
        {
          status: 400,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      ),
    };
  }

  return { ok: true, date };
}
