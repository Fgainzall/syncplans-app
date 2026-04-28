import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ token: string }>;
};

const PUBLIC_INVITE_TTL_HOURS = Math.max(
  1,
  Number(process.env.PUBLIC_INVITE_TTL_HOURS ?? 168)
);
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

const rateLimitStore = new Map<
  string,
  {
    count: number;
    resetAt: number;
  }
>();
function normalizeToken(token: string | null | undefined) {
  return String(token ?? "").trim();
}

function isTokenFormatValid(token: string) {
  return token.startsWith("spi_") && token.length >= 12;
}

function isInviteExpired(createdAt: string | null | undefined) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const expiresAt =
    created.getTime() + PUBLIC_INVITE_TTL_HOURS * 60 * 60 * 1000;

  return Date.now() > expiresAt;
}
function getClientIp(req: NextRequest) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function rateLimitKey(req: NextRequest, token: string) {
  const ip = getClientIp(req);
  const safeTokenPrefix = token.slice(0, 16);
  return `${ip}:${safeTokenPrefix}`;
}

function checkRateLimit(req: NextRequest, token: string) {
  const key = rateLimitKey(req, token);
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return { allowed: true };
  }

  if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);

  return { allowed: true };
}
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Faltan variables de entorno de Supabase.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) {
      return NextResponse.json(
        { error: "Token inválido.", code: "invalid_token" },
        { status: 400 }
      );
    }
const limit = checkRateLimit(req, token);

if (!limit.allowed) {
  return NextResponse.json(
    {
      error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfter ?? 60),
      },
    }
  );
}
    const supabase = getAdminClient();

    const { data: invite, error: inviteError } = await supabase
      .from("public_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      return NextResponse.json(
        {
          error:
            inviteError.message || "No se pudo cargar la invitación.",
        },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        {
          error: "Token inválido o inexistente.",
          code: "invalid_token",
        },
        { status: 404 }
      );
    }

    if (isInviteExpired(invite.created_at)) {
      return NextResponse.json(
        {
          error: "Este enlace de invitación expiró.",
          code: "token_expired",
        },
        { status: 410 }
      );
    }

    if (String(invite.status ?? "pending").toLowerCase() !== "pending") {
      return NextResponse.json(
        {
          error: "Este enlace ya fue usado.",
          code: "token_used",
          invite,
        },
        { status: 409 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, start, end")
      .eq("id", invite.event_id)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        {
          error: eventError.message || "No se pudo cargar el evento.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        invite,
        event: event ?? null,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al cargar la invitación.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) {
      return NextResponse.json(
        { error: "Token inválido.", code: "invalid_token" },
        { status: 400 }
      );
    }
const limit = checkRateLimit(req, token);

if (!limit.allowed) {
  return NextResponse.json(
    {
      error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
      code: "rate_limited",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(limit.retryAfter ?? 60),
      },
    }
  );
}
    const body = await req.json().catch(() => null);

    const status = body?.status;
    const message =
      typeof body?.message === "string"
        ? body.message.trim() || null
        : null;

    let proposedDate: string | null = null;

    if (
      typeof body?.proposedDate === "string" &&
      body.proposedDate.trim()
    ) {
      const parsed = new Date(body.proposedDate);

      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          {
            error: "Fecha propuesta inválida.",
            code: "invalid_proposed_date",
          },
          { status: 400 }
        );
      }

      proposedDate = parsed.toISOString();
    }

    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json(
        { error: "Estado inválido." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: currentInvite, error: currentInviteError } =
      await supabase
        .from("public_invites")
        .select("*")
        .eq("token", token)
        .maybeSingle();

    if (currentInviteError) {
      return NextResponse.json(
        {
          error:
            currentInviteError.message ||
            "No se pudo cargar la invitación.",
        },
        { status: 500 }
      );
    }

    if (!currentInvite) {
      return NextResponse.json(
        {
          error: "Token inválido o inexistente.",
          code: "invalid_token",
        },
        { status: 404 }
      );
    }

    if (isInviteExpired(currentInvite.created_at)) {
      return NextResponse.json(
        {
          error: "Este enlace de invitación expiró.",
          code: "token_expired",
        },
        { status: 410 }
      );
    }

    if (
      String(currentInvite.status ?? "pending").toLowerCase() !==
      "pending"
    ) {
      return NextResponse.json(
        {
          error: "Este enlace ya fue usado.",
          code: "token_used",
          invite: currentInvite,
        },
        { status: 409 }
      );
    }

    const updatePayload = {
      status,
      message,
      proposed_date: proposedDate,
    };

    const { data: invite, error: updateError } = await supabase
      .from("public_invites")
      .update(updatePayload)
      .eq("id", currentInvite.id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.message ||
            "No se pudo guardar la respuesta.",
        },
        { status: 500 }
      );
    }

    if (!invite) {
      const { data: latestInvite } = await supabase
        .from("public_invites")
        .select("*")
        .eq("id", currentInvite.id)
        .maybeSingle();

      return NextResponse.json(
        {
          error: "Este enlace ya fue usado.",
          code: "token_used",
          invite: latestInvite ?? null,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ invite }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al responder la invitación.",
      },
      { status: 500 }
    );
  }
}