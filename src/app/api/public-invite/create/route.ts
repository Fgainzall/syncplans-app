// src/app/api/public-invite/create/route.ts
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  getAuthenticatedUser,
  getClientIp,
  isUuid,
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
} from "@/lib/apiObservability";

type CreatePublicInviteBody = {
  eventId?: unknown;
};

type EventAccessRow = {
  id: string;
  owner_id: string | null;
  user_id: string | null;
  created_by: string | null;
  group_id: string | null;
};

type PublicInviteRow = {
  id: string;
  event_id: string | null;
  token: string;
  status: string | null;
  created_at: string | null;
};

const MAX_BODY_BYTES = 1_000;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_ATTEMPTS = 15;

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

function makePublicInviteToken() {
  const randomPart =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random()
          .toString(36)
          .slice(2)}${Math.random().toString(36).slice(2)}`;

  return `spi_${randomPart}`;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "pending").trim().toLowerCase();
}

function toPublicInviteDto(row: PublicInviteRow) {
  return {
    id: row.id,
    event_id: row.event_id,
    eventId: row.event_id,
    token: row.token,
    status: normalizeStatus(row.status),
    created_at: row.created_at,
    createdAt: row.created_at,
  };
}

function userOwnsEvent(event: EventAccessRow, userId: string) {
  return [event.owner_id, event.user_id, event.created_by].some(
    (value) => String(value ?? "") === userId
  );
}

async function userBelongsToEventGroup(
  supabase: ReturnType<typeof getAdminClient>,
  groupId: string | null,
  userId: string
) {
  if (!groupId) return false;

  const { data, error } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function loadEventForAccessCheck(
  supabase: ReturnType<typeof getAdminClient>,
  eventId: string
) {
  return supabase
    .from("events")
    .select("id,owner_id,user_id,created_by,group_id")
    .eq("id", eventId)
    .maybeSingle<EventAccessRow>();
}

async function loadPendingInvite(
  supabase: ReturnType<typeof getAdminClient>,
  eventId: string
) {
  return supabase
    .from("public_invites")
    .select("id,event_id,token,status,created_at")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<PublicInviteRow>();
}

async function createInvite(
  supabase: ReturnType<typeof getAdminClient>,
  eventId: string
) {
  return supabase
    .from("public_invites")
    .insert({
      event_id: eventId,
      contact: null,
      token: makePublicInviteToken(),
      status: "pending",
      proposed_date: null,
      message: null,
    })
    .select("id,event_id,token,status,created_at")
    .single<PublicInviteRow>();
}

export async function POST(req: NextRequest) {
  const ctx = createApiRequestContext(req);
  logRequestStart(ctx, { flow: "public-invite.create" });

  try {
    const auth = await getAuthenticatedUser(req, ctx);
    if (!auth.ok) return auth.response;

    const body = (await readJsonBody(req, MAX_BODY_BYTES)) as CreatePublicInviteBody;
    const eventId = String(body.eventId ?? "").trim();

    if (!isUuid(eventId)) {
      return jsonError(ctx, {
        error: "eventId inválido.",
        code: "PUBLIC_INVITE_CREATE_INVALID_EVENT_ID",
        status: 400,
      });
    }

    const limit = await checkRateLimit({
      prefix: "public-invite-create",
      keyParts: [auth.user.id, getClientIp(req), eventId],
      limit: RATE_LIMIT_MAX_ATTEMPTS,
      windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
    });

    if (!limit.allowed) {
      return jsonError(ctx, {
        error: "Demasiados intentos. Intenta nuevamente en unos segundos.",
        code: "PUBLIC_INVITE_CREATE_RATE_LIMITED",
        status: 429,
        headers: rateLimitHeaders(limit),
      });
    }

    const supabase = getAdminClient();

    const { data: event, error: eventError } = await loadEventForAccessCheck(
      supabase,
      eventId
    );

    if (eventError) {
      return jsonError(ctx, {
        error: "No se pudo validar el plan.",
        code: "PUBLIC_INVITE_CREATE_EVENT_LOAD_FAILED",
        status: 500,
        log: { eventId, error: safeError(eventError) },
      });
    }

    if (!event) {
      return jsonError(ctx, {
        error: "No encontramos ese plan.",
        code: "PUBLIC_INVITE_CREATE_EVENT_NOT_FOUND",
        status: 404,
      });
    }

    const canShare =
      userOwnsEvent(event, auth.user.id) ||
      (await userBelongsToEventGroup(supabase, event.group_id, auth.user.id));

    if (!canShare) {
      return jsonError(ctx, {
        error: "No tienes acceso para compartir este plan.",
        code: "PUBLIC_INVITE_CREATE_FORBIDDEN",
        status: 403,
        log: { eventId, userId: auth.user.id },
      });
    }

    const { data: existing, error: existingError } = await loadPendingInvite(
      supabase,
      eventId
    );

    if (existingError) {
      return jsonError(ctx, {
        error: "No se pudo revisar el link existente.",
        code: "PUBLIC_INVITE_CREATE_LOOKUP_FAILED",
        status: 500,
        log: { eventId, error: safeError(existingError) },
      });
    }

    if (existing) {
      return jsonOk(
        ctx,
        { invite: toPublicInviteDto(existing) },
        {
          headers: rateLimitHeaders(limit),
          log: { eventId, inviteId: existing.id, reused: true },
        }
      );
    }

    const { data: created, error: createError } = await createInvite(
      supabase,
      eventId
    );

    if (createError || !created) {
      return jsonError(ctx, {
        error: "No se pudo generar el link del plan.",
        code: "PUBLIC_INVITE_CREATE_INSERT_FAILED",
        status: 500,
        log: { eventId, error: safeError(createError) },
      });
    }

    return jsonOk(
      ctx,
      { invite: toPublicInviteDto(created) },
      {
        headers: rateLimitHeaders(limit),
        log: { eventId, inviteId: created.id, reused: false },
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return jsonError(ctx, {
        error: "Payload demasiado grande.",
        code: "PUBLIC_INVITE_CREATE_INVALID_BODY",
        status: 400,
      });
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return jsonError(ctx, {
        error: "JSON inválido.",
        code: "PUBLIC_INVITE_CREATE_INVALID_BODY",
        status: 400,
      });
    }

    return jsonError(ctx, {
      error: "Ocurrió un error al generar el link del plan.",
      code: "PUBLIC_INVITE_CREATE_FAILED",
      status: 500,
      log: { error: safeError(error) },
    });
  }
}
