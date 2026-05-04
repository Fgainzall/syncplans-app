// src/app/api/public-invite/[token]/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  getClientIp,
  jsonNoStore,
  rateLimitHeaders,
  readJsonBody,
  requiredServerEnv,
} from "@/lib/apiSecurity";

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

function invalidTokenResponse(status = 400) {
  return jsonNoStore(
    {
      ok: false,
      error: "Token inválido.",
      code: "invalid_token",
    },
    { status }
  );
}

function tokenUsedResponse(invite: PublicInviteRow, event: PublicEventRow | null) {
  return jsonNoStore(
    {
      ok: false,
      error: "Este enlace ya fue usado.",
      code: "token_used",
      invite: toPublicInviteDto(invite),
      event: toPublicEventDto(event),
    },
    { status: 409 }
  );
}

function tokenExpiredResponse() {
  return jsonNoStore(
    {
      ok: false,
      error: "Este enlace de invitación expiró.",
      code: "token_expired",
    },
    { status: 410 }
  );
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) return invalidTokenResponse(400);

    const limit = await enforcePublicInviteRateLimit(req, token);
    if (!limit.allowed) {
      return jsonNoStore(
        {
          ok: false,
          error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
          code: "rate_limited",
        },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const supabase = getAdminClient();
    const { data: invite, error: inviteError } = await loadPublicInviteByToken(
      supabase,
      token
    );

    if (inviteError) {
      console.error("[api/public-invite] GET invite load failed", inviteError);
      return jsonNoStore(
        {
          ok: false,
          error: "No se pudo cargar la invitación.",
          code: "invite_load_failed",
        },
        { status: 500 }
      );
    }

    if (!invite) return invalidTokenResponse(404);
    if (isInviteExpired(invite.created_at)) return tokenExpiredResponse();

    const event = await loadPublicEvent(supabase, invite.event_id);

    if (normalizeInviteStatus(invite.status) !== "pending") {
      return tokenUsedResponse(invite, event);
    }

    return jsonNoStore(
      {
        ok: true,
        invite: toPublicInviteDto(invite),
        event: toPublicEventDto(event),
      },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    console.error("[api/public-invite] GET unexpected error", error);

    return jsonNoStore(
      {
        ok: false,
        error: "Ocurrió un error al cargar la invitación.",
        code: "public_invite_get_failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { token: tokenParam } = await context.params;
    const token = normalizeToken(tokenParam);

    if (!token || !isTokenFormatValid(token)) return invalidTokenResponse(400);

    const limit = await enforcePublicInviteRateLimit(req, token);
    if (!limit.allowed) {
      return jsonNoStore(
        {
          ok: false,
          error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
          code: "rate_limited",
        },
        { status: 429, headers: rateLimitHeaders(limit) }
      );
    }

    const body = (await readJsonBody(req, MAX_BODY_BYTES)) as Record<string, unknown>;
    const rawStatus = String(body.status ?? "").trim().toLowerCase();
    const status = rawStatus === "declined" ? "rejected" : rawStatus;

    if (status !== "accepted" && status !== "rejected") {
      return jsonNoStore(
        {
          ok: false,
          error: "Estado inválido.",
          code: "invalid_status",
        },
        { status: 400 }
      );
    }

    const messageRaw = typeof body.message === "string" ? body.message.trim() : "";
    const message = messageRaw ? messageRaw.slice(0, MAX_MESSAGE_LENGTH) : null;

    let proposedDate: string | null = null;

    if (typeof body.proposedDate === "string" && body.proposedDate.trim()) {
      const parsed = new Date(body.proposedDate);

      if (Number.isNaN(parsed.getTime())) {
        return jsonNoStore(
          {
            ok: false,
            error: "Fecha propuesta inválida.",
            code: "invalid_proposed_date",
          },
          { status: 400 }
        );
      }

      proposedDate = parsed.toISOString();
    }

    const supabase = getAdminClient();
    const { data: currentInvite, error: currentInviteError } = await loadPublicInviteByToken(
      supabase,
      token
    );

    if (currentInviteError) {
      console.error("[api/public-invite] POST invite load failed", currentInviteError);
      return jsonNoStore(
        {
          ok: false,
          error: "No se pudo cargar la invitación.",
          code: "invite_load_failed",
        },
        { status: 500 }
      );
    }

    if (!currentInvite) return invalidTokenResponse(404);
    if (isInviteExpired(currentInvite.created_at)) return tokenExpiredResponse();

    const currentEvent = await loadPublicEvent(supabase, currentInvite.event_id);

    if (normalizeInviteStatus(currentInvite.status) !== "pending") {
      return tokenUsedResponse(currentInvite, currentEvent);
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
      console.error("[api/public-invite] POST update failed", updateError);
      return jsonNoStore(
        {
          ok: false,
          error: "No se pudo guardar la respuesta.",
          code: "invite_update_failed",
        },
        { status: 500 }
      );
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

      return tokenUsedResponse(latestInvite ?? currentInvite, latestEvent);
    }

    const event = await loadPublicEvent(supabase, updatedInvite.event_id);

    return jsonNoStore(
      {
        ok: true,
        invite: toPublicInviteDto(updatedInvite),
        event: toPublicEventDto(event),
      },
      { status: 200, headers: rateLimitHeaders(limit) }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonNoStore(
        {
          ok: false,
          error: "Payload demasiado grande.",
          code: "invalid_body",
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return jsonNoStore(
        {
          ok: false,
          error: "JSON inválido.",
          code: "invalid_body",
        },
        { status: 400 }
      );
    }

    console.error("[api/public-invite] POST unexpected error", error);

    return jsonNoStore(
      {
        ok: false,
        error: "Ocurrió un error al responder la invitación.",
        code: "public_invite_post_failed",
      },
      { status: 500 }
    );
  }
}
