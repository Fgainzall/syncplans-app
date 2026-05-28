import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createServiceRoleClient, sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type GroupInviteBody = {
  inviteId?: string;
};

type InviteRow = {
  id: string;
  group_id: string | null;
  invited_user_id: string | null;
  invited_email: string | null;
  email?: string | null;
  invited_by: string | null;
  status: string | null;
};

type GroupRow = {
  id: string;
  name: string | null;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

async function parseBody(req: Request): Promise<GroupInviteBody> {
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as GroupInviteBody;
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
        { ok: false, error: "No autenticado.", code: "PUSH_GROUP_INVITE_UNAUTHORIZED", requestId },
        { status: 401 },
      );
    }

    const body = await parseBody(req);
    const inviteId = String(body.inviteId ?? "").trim();

    if (!inviteId) {
      return NextResponse.json(
        { ok: false, error: "Falta inviteId.", code: "PUSH_GROUP_INVITE_ID_REQUIRED", requestId },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();

    const { data: invite, error: inviteError } = await admin
      .from("group_invites")
      .select("id,group_id,invited_user_id,invited_email,email,invited_by,status")
      .eq("id", inviteId)
      .maybeSingle();

    if (inviteError) throw inviteError;

    const row = invite as InviteRow | null;
    if (!row?.id) {
      return NextResponse.json(
        { ok: false, error: "Invitación no encontrada.", code: "PUSH_GROUP_INVITE_NOT_FOUND", requestId },
        { status: 404 },
      );
    }

    const groupId = String(row.group_id ?? "").trim();
    if (!groupId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Invitación sin grupo", requestId });
    }

    const invitedBy = String(row.invited_by ?? "").trim();
    if (invitedBy && invitedBy !== user.id) {
      const { data: membership, error: membershipError } = await admin
        .from("group_members")
        .select("user_id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (membershipError) throw membershipError;

      if (!membership) {
        return NextResponse.json(
          { ok: false, error: "No puedes enviar push de esta invitación.", code: "PUSH_GROUP_INVITE_FORBIDDEN", requestId },
          { status: 403 },
        );
      }
    }

    const invitedUserId = String(row.invited_user_id ?? "").trim();
    if (!invitedUserId || invitedUserId === user.id) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        reason: "La persona invitada todavía no tiene usuario vinculado a push.",
        requestId,
      });
    }

    const [{ data: group }, { data: profile }] = await Promise.all([
      admin.from("groups").select("id,name").eq("id", groupId).maybeSingle(),
      admin
        .from("profiles")
        .select("id,first_name,last_name,display_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const groupName = String((group as GroupRow | null)?.name ?? "tu grupo").trim() || "tu grupo";
    const creatorName = formatCreator(profile as ProfileRow | null);
    const bodyText = `${creatorName} te invitó a ${groupName}`;

    const { error: notificationError } = await admin.from("notifications").insert({
      user_id: invitedUserId,
      type: "group_invite",
      title: "Nueva invitación en SyncPlans",
      body: bodyText,
      entity_id: row.id,
      payload: {
        invite_id: row.id,
        group_id: groupId,
        invited_by: user.id,
        source: "push_group_invite",
      },
    });

    if (notificationError) {
      console.warn("[push/group-invite] internal notification insert failed", notificationError.message);
    }

    const pushResult = await sendPushToUsers({
      supabase: admin,
      userIds: [invitedUserId],
      payload: {
        title: "Invitación a SyncPlans",
        body: bodyText,
        url: `/invitations/accept?invite=${encodeURIComponent(row.id)}`,
        tag: `group_invite:${row.id}`,
        data: {
          type: "group_invite",
          inviteId: row.id,
          groupId,
          requestId,
        },
      },
    });

    return NextResponse.json({ ok: true, requestId, push: pushResult });
  } catch (error) {
    console.error("[api/push/group-invite] failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar push de invitación.", code: "PUSH_GROUP_INVITE_FAILED", requestId },
      { status: 500 },
    );
  }
}
