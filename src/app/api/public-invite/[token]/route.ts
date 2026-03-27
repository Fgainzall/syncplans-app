import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
  getPublicInviteByToken,
  respondToPublicInvite,
} from "@/lib/invitationsDb";

type RouteContext = {
  params: Promise<{ token: string }>;
};

type PublicInviteStatus = "pending" | "accepted" | "rejected";

function normalizeStatus(value: unknown): PublicInviteStatus {
  const raw = String(value ?? "pending").toLowerCase();
  if (raw === "accepted") return "accepted";
  if (raw === "rejected") return "rejected";
  return "pending";
}

function normalizeOptionalString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const safeToken = String(token ?? "").trim();

    if (!safeToken) {
      return NextResponse.json(
        { error: "Token inválido." },
        { status: 400 }
      );
    }

    const invite = await getPublicInviteByToken(safeToken);

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
        ok: true,
        invite,
        event: event ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message || "Ocurrió un error al cargar la invitación pública.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const safeToken = String(token ?? "").trim();

    if (!safeToken) {
      return NextResponse.json(
        { error: "Token inválido." },
        { status: 400 }
      );
    }

    const existingInvite = await getPublicInviteByToken(safeToken);

    if (!existingInvite) {
      return NextResponse.json(
        { error: "Invitación no encontrada." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));

    const status = normalizeStatus(body?.status);
    const message = normalizeOptionalString(body?.message);
    const proposedDate = normalizeOptionalString(body?.proposedDate);

    if (status === "pending") {
      return NextResponse.json(
        { error: "Estado inválido para responder la invitación." },
        { status: 400 }
      );
    }

    const updatedInvite = await respondToPublicInvite({
      token: safeToken,
      status,
      message,
      proposedDate,
    });

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("id, title, start, end")
      .eq("id", updatedInvite.event_id)
      .maybeSingle();

    if (eventError) {
      return NextResponse.json(
        { error: eventError.message || "No se pudo cargar el evento." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        invite: updatedInvite,
        event: event ?? null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error?.message ||
          "Ocurrió un error al responder la invitación pública.",
      },
      { status: 500 }
    );
  }
}