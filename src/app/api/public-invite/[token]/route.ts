import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RouteContext = {
  params: Promise<{ token: string }>;
};

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

export async function GET(_: NextRequest, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: invite, error: inviteError } = await supabase
      .from("public_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message || "No se pudo cargar la invitación." },
        { status: 500 }
      );
    }

    if (!invite) {
      return NextResponse.json(
        { error: "Invitación no encontrada." },
        { status: 404 }
      );
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, start, end")
      .eq("id", invite.event_id)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: eventError.message || "No se pudo cargar el evento." },
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
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: "Token inválido." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);

    const status = body?.status;
    const message =
      typeof body?.message === "string" ? body.message.trim() || null : null;
    const proposedDate =
      typeof body?.proposedDate === "string" && body.proposedDate.trim()
        ? new Date(body.proposedDate).toISOString()
        : null;

    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json(
        { error: "Estado inválido." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: currentInvite, error: currentInviteError } = await supabase
      .from("public_invites")
      .select("*")
      .eq("token", token)
      .maybeSingle();

    if (currentInviteError) {
      return NextResponse.json(
        {
          error:
            currentInviteError.message || "No se pudo cargar la invitación.",
        },
        { status: 500 }
      );
    }

    if (!currentInvite) {
      return NextResponse.json(
        { error: "Invitación no encontrada." },
        { status: 404 }
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
      .select("*")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "No se pudo guardar la respuesta." },
        { status: 500 }
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