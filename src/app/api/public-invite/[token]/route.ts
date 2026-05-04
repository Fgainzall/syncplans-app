// src/app/api/public-invite/[token]/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  readJsonBody,
  requiredServerEnv,
} from "@/lib/apiSecurity";
import {
  createApiRequestContext,
  jsonError,
  jsonOk,
  logRequestStart,
  safeError,
  type ApiRequestContext,
} from "@/lib/apiObservability";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type PublicInviteStatus = "pending" | "accepted" | "rejected";

type PublicInviteRow = {
  id: string;
  event_id: string | null;
  status: string | null;
  proposed_date: string | null;
  message: string | null;
  created_at: string | null;
  creator_response: string | null;
};

type PublicEventRow = {
  id: string;
  title: string | null;
  start: string | null;
  end: string | null;
};

const PUBLIC_INVITE_TTL_HOURS = Math.max(
  1,
  Number(process.env.PUBLIC_INVITE_TTL_HOURS ?? 168)
);

const MAX_BODY_BYTES = 4_000;
const MAX_MESSAGE_LENGTH = 1_000;

function normalizeToken(token: string | null | undefined) {
  return String(token ?? "").trim();
}

function isTokenFormatValid(token: string) {
  return token.startsWith("spi_") && token.length >= 12 && token.length <= 256;
}

function normalizeInviteStatus(status: string | null | undefined): PublicInviteStatus {
  const value = String(status ?? "pending").trim().toLowerCase();
  if (value === "accepted") return "accepted";
  if (value === "rejected" || value === "declined") return "rejected";
  return "pending";
}

function isInviteExpired(createdAt: string | null | undefined) {
  if (!createdAt) return false;

  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  const expiresAt = created.getTime() + PUBLIC_INVITE_TTL_HOURS * 60 * 60 * 1000;
  return Date.now() > expiresAt;
}

function getAdminClient() {
  const url = requiredServerEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function toPublicInviteDto(invite: PublicInviteRow | null) {
  if (!invite) return null;

  const status = normalizeInviteStatus(invite.status);

  return {
    id: invite.id,
    event_id: invite.event_id,
    eventId: invite.event_id,
    status,
    created_at: invite.created_at,
    createdAt: invite.created_at,
    proposed_date: invite.proposed_date,
    proposedDate: invite.proposed_date,
    has_message: Boolean(invite.message),
    hasMessage: Boolean(invite.message),
    creator_response: invite.creator_response,
    creatorResponse: invite.creator_response,
  };
}

function toPublicEventDto(event: PublicEventRow | null) {
  if (!event) return null;

  return {
    id: event.id,
    title: event.title ?? "Plan compartido",
    start: event.start,
    end: event.end,
  };
}

async function enforcePublicInviteRateLimit(req: NextRequest, token: string) {
  return checkRateLimit({
    prefix: "public-invite",
    keyParts: [getClientIp(req), token],
    limit: 20,
    windowSeconds: 60,
  });
}

async function loadPublicInviteByToken(supabase: ReturnType<typeof getAdminClient>, token: string) {
  return supabase
    .from("public_invites")
    .select("id,event_id,status,proposed_date,message,created_at,creator_response")
    .eq("token", token)
    .maybeSingle<PublicInviteRow>();
}

async function loadPublicEvent(supabase: ReturnType<typeof getAdminClient>, eventId: string | null) {
  if (!eventId) return null;

  const { data, error } = await supabase
    .from("events")
    .select("id,title,start,end")
    .eq("id", eventId)
    .maybeSingle<PublicEventRow>();

  if (error) throw error;
  return data ?? null;
}

function invalidTokenResponse(ctx: ApiRequestContext, status = 400) {
  return jsonError(ctx, {
    error: "Token inválido.",
    code: "PUBLIC_INVITE_INVALID_TOKEN",
    status,
  });
}

function tokenUsedResponse(
  ctx: ApiRequestContext,
  invite: PublicInviteRow,
  event: PublicEventRow | null
) {
  return jsonError(ctx, {
    error: "Este enlace ya fue usado.",
    code: "PUBLIC_INVITE_TOKEN_USED",
    status: 409,
    log: { inviteId: invite.id, eventId: invite.event_id },
    data: {
      invite: toPublicInviteDto(invite),
      event: toPublicEventDto(event),
    },
  });
}

function tokenExpiredResponse(ctx: ApiRequestContext) {
  return jsonError(ctx, {
    error: "Este enlace de invitación expiró.",
    code: "PUBLIC_INVITE_TOKEN_EXPIRED",
    status: 410,
  });
}

export async function GET(req: NextRequest, context: RouteContext) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "public-invite.get" });

  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) return invalidTokenResponse(ctx, 400);

    const limit = await enforcePublicInviteRateLimit(req, token);
    if (!limit.allowed) {
      return jsonError(ctx, {
        error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
        code: "PUBLIC_INVITE_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(limit),
      });
    }

    const supabase = getAdminClient();
    const { data: invite, error: inviteError } = await loadPublicInviteByToken(
      supabase,
      token
    );

    if (inviteError) {
      return jsonError(ctx, {
        error: "No se pudo cargar la invitación.",
        code: "PUBLIC_INVITE_LOAD_FAILED",
        status: 500,
        log: { error: safeError(inviteError) },
      });
    }

    if (!invite) return invalidTokenResponse(ctx, 404);
    if (isInviteExpired(invite.created_at)) return tokenExpiredResponse(ctx);

    const event = await loadPublicEvent(supabase, invite.event_id);

    if (normalizeInviteStatus(invite.status) !== "pending") {
      return tokenUsedResponse(ctx, invite, event);
    }

    return jsonOk(
      ctx,
      {
        invite: toPublicInviteDto(invite),
        event: toPublicEventDto(event),
      },
      {
        headers: rateLimitHeaders(limit),
        log: { inviteId: invite.id, eventId: invite.event_id },
      }
    );
  } catch (error) {
    return jsonError(ctx, {
      error: "Ocurrió un error al cargar la invitación.",
      code: "PUBLIC_INVITE_GET_FAILED",
      status: 500,
      log: { error: safeError(error) },
    });
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "public-invite.post" });

  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) return invalidTokenResponse(ctx, 400);

    const limit = await enforcePublicInviteRateLimit(req, token);
    if (!limit.allowed) {
      return jsonError(ctx, {
        error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
        code: "PUBLIC_INVITE_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(limit),
      });
    }

    const body = (await readJsonBody(req, MAX_BODY_BYTES)) as Record<string, unknown>;
    const rawStatus = String(body.status ?? "").trim().toLowerCase();
    const status = rawStatus === "declined" ? "rejected" : rawStatus;

    if (status !== "accepted" && status !== "rejected") {
      return jsonError(ctx, {
        error: "Estado inválido.",
        code: "PUBLIC_INVITE_INVALID_STATUS",
        status: 400,
      });
    }

    const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
    const message = messageRaw ? messageRaw.slice(0, MAX_MESSAGE_LENGTH) : null;

    let proposedDate: string | null = null;

    if (typeof body.proposedDate === "string" && body.proposedDate.trim()) {
      const parsed = new Date(body.proposedDate);

      if (Number.isNaN(parsed.getTime())) {
        return jsonError(ctx, {
          error: "Fecha propuesta inválida.",
          code: "PUBLIC_INVITE_INVALID_PROPOSED_DATE",
          status: 400,
        });
      }

      proposedDate = parsed.toISOString();
    }

    const supabase = getAdminClient();
    const { data: currentInvite, error: currentInviteError } = await loadPublicInviteByToken(
      supabase,
      token
    );

    if (currentInviteError) {
      return jsonError(ctx, {
        error: "No se pudo cargar la invitación.",
        code: "PUBLIC_INVITE_LOAD_FAILED",
        status: 500,
        log: { error: safeError(currentInviteError) },
      });
    }

    if (!currentInvite) return invalidTokenResponse(ctx, 404);
    if (isInviteExpired(currentInvite.created_at)) return tokenExpiredResponse(ctx);

    const currentEvent = await loadPublicEvent(supabase, currentInvite.event_id);

    if (normalizeInviteStatus(currentInvite.status) !== "pending") {
      return tokenUsedResponse(ctx, currentInvite, currentEvent);
    }

    const { data: updatedInvite, error: updateError } = await supabase
      .from("public_invites")
      .update({
        status,
        message,
        proposed_date: proposedDate,
      })
      .eq("id", currentInvite.id)
      .eq("status", "pending")
      .select("id,event_id,status,proposed_date,message,created_at,creator_response")
      .maybeSingle<PublicInviteRow>();

    if (updateError) {
      return jsonError(ctx, {
        error: "No se pudo guardar la respuesta.",
        code: "PUBLIC_INVITE_UPDATE_FAILED",
        status: 500,
        log: { inviteId: currentInvite.id, error: safeError(updateError) },
      });
    }

    if (!updatedInvite) {
      const { data: latestInvite } = await supabase
        .from("public_invites")
        .select("id,event_id,status,proposed_date,message,created_at,creator_response")
        .eq("id", currentInvite.id)
        .maybeSingle<PublicInviteRow>();

      const latestEvent = await loadPublicEvent(
        supabase,
        latestInvite?.event_id ?? currentInvite.event_id
      );

      return tokenUsedResponse(ctx, latestInvite ?? currentInvite, latestEvent);
    }

    const event = await loadPublicEvent(supabase, updatedInvite.event_id);

    return jsonOk(
      ctx,
      {
        invite: toPublicInviteDto(updatedInvite),
        event: toPublicEventDto(event),
      },
      {
        headers: rateLimitHeaders(limit),
        log: { inviteId: updatedInvite.id, eventId: updatedInvite.event_id, status },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonError(ctx, {
        error: "Payload demasiado grande.",
        code: "PUBLIC_INVITE_INVALID_BODY",
        status: 400,
      });
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return jsonError(ctx, {
        error: "JSON inválido.",
        code: "PUBLIC_INVITE_INVALID_BODY",
        status: 400,
      });
    }

    return jsonError(ctx, {
      error: "Ocurrió un error al responder la invitación.",
      code: "PUBLIC_INVITE_POST_FAILED",
      status: 500,
      log: { error: safeError(error) },
    });
  }
}
