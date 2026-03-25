import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
  getPublicInviteByToken,
  respondToPublicInvite,
} from "@/lib/invitationsDb";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Token inválido." },
        { status: 400 }
      );
    }

    const invite = await getPublicInviteByToken(token);

    if (!invite) {
      return NextResponse.json(
        { error: "Invitación no encontrada." },
        { status: 404 }
      );
    }

    const { data: event, error: eventError } = await (supabase as any)
      .from("events")
      .select("id, title, start, end")
      .eq("id", invite.event_id)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: "Error al cargar el evento." },
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
    const message =
      error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json(
        { error: "Token inválido." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => null);

    const status = body?.status;
    const proposedDate = body?.proposedDate ?? null;
    const message = body?.message ?? null;

    if (status !== "accepted" && status !== "rejected") {
      return NextResponse.json(
        { error: "Status inválido. Usa accepted o rejected." },
        { status: 400 }
      );
    }

    const updated = await respondToPublicInvite({
      token,
      status,
      proposedDate,
      message,
    });

    return NextResponse.json({ invite: updated }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}