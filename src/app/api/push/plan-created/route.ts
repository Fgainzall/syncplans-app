import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createServiceRoleClient, sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PlanCreatedBody = {
  eventId?: string;
};

type EventRow = {
  id: string;
  title: string | null;
  start: string | null;
  group_id: string | null;
  created_by: string | null;
  owner_id: string | null;
  location_label: string | null;
};

type GroupMemberRow = {
  user_id: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

async function parseBody(req: Request): Promise<PlanCreatedBody> {
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PlanCreatedBody;
  } catch {
    return {};
  }
}

function formatCreator(profile: ProfileRow | null | undefined) {
  const display = String(profile?.display_name ?? "").trim();
  if (display) return display;

  const full = [profile?.first_name, profile?.last_name]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");

  return full || "Alguien";
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  try {
    const sessionClient = await supabaseServer();
    const {
      data: { user },
      error: userError,
    } = await sessionClient.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json(
        { ok: false, error: "No autenticado.", code: "PUSH_PLAN_UNAUTHORIZED", requestId },
        { status: 401 },
      );
    }

    const body = await parseBody(req);
    const eventId = String(body.eventId ?? "").trim();

    if (!eventId) {
      return NextResponse.json(
        { ok: false, error: "Falta eventId.", code: "PUSH_PLAN_EVENT_ID_REQUIRED", requestId },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const { data: event, error: eventError } = await admin
      .from("events")
      .select("id,title,start,group_id,created_by,owner_id,location_label")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) throw eventError;

    const row = event as EventRow | null;
    if (!row?.id) {
      return NextResponse.json(
        { ok: false, error: "Plan no encontrado.", code: "PUSH_PLAN_NOT_FOUND", requestId },
        { status: 404 },
      );
    }

    const creatorId = String(row.created_by ?? row.owner_id ?? "").trim();
    if (creatorId !== user.id) {
      return NextResponse.json(
        { ok: false, error: "No puedes enviar push de este plan.", code: "PUSH_PLAN_FORBIDDEN", requestId },
        { status: 403 },
      );
    }

    const groupId = String(row.group_id ?? "").trim();
    if (!groupId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Plan personal", requestId });
    }

    const { data: members, error: membersError } = await admin
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (membersError) throw membersError;

    const recipientIds = Array.from(
      new Set(
        ((members || []) as GroupMemberRow[])
          .map((member) => String(member.user_id ?? "").trim())
          .filter((id) => id && id !== user.id),
      ),
    );

    if (recipientIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Sin otros miembros", requestId });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id,first_name,last_name,display_name")
      .eq("id", user.id)
      .maybeSingle();

    const creatorName = formatCreator(profile as ProfileRow | null);
    const title = String(row.title ?? "Plan sin título").trim() || "Plan sin título";
    const location = String(row.location_label ?? "").trim();
    const bodyText = location
      ? `${creatorName} creó: ${title} · ${location}`
      : `${creatorName} creó: ${title}`;

    const notificationRows = recipientIds.map((userId) => ({
      user_id: userId,
      type: "event_created",
      title: "Nuevo plan por confirmar",
      body: bodyText,
      entity_id: row.id,
      payload: {
        event_id: row.id,
        eventId: row.id,
        group_id: groupId,
        created_by: user.id,
        source: "push_plan_created",
      },
    }));

    const { error: notificationError } = await admin
      .from("notifications")
      .insert(notificationRows);

    if (notificationError) {
      console.warn("[push/plan-created] internal notification insert failed", notificationError.message);
    }

    const pushResult = await sendPushToUsers({
      supabase: admin,
      userIds: recipientIds,
      payload: {
        title: "Nuevo plan en SyncPlans",
        body: bodyText,
        url: `/events/new/details?eventId=${encodeURIComponent(row.id)}&from=push`,
        tag: `event_created:${row.id}`,
        data: {
          type: "event_created",
          eventId: row.id,
          groupId,
          requestId,
        },
      },
    });

    return NextResponse.json({
      ok: true,
      requestId,
      recipients: recipientIds.length,
      push: pushResult,
    });
  } catch (error) {
    console.error("[api/push/plan-created] failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar push del plan.", code: "PUSH_PLAN_FAILED", requestId },
      { status: 500 },
    );
  }
}
