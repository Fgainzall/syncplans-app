import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { createServiceRoleClient, sendPushToUsers } from "@/lib/serverPush";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PushSelfTestBody = {
  title?: string;
  body?: string;
  url?: string;
};

async function parseBody(req: Request): Promise<PushSelfTestBody> {
  try {
    const parsed = (await req.json()) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as PushSelfTestBody;
  } catch {
    return {};
  }
}

function cleanText(value: unknown, fallback: string, max = 180) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, max);
}

function cleanUrl(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.startsWith("http://") || raw.startsWith("https://")) {
    return "/settings/notifications";
  }

  return raw.startsWith("/") ? raw.slice(0, 400) : "/settings/notifications";
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
        { ok: false, error: "No autenticado.", code: "PUSH_SELF_TEST_UNAUTHORIZED", requestId },
        { status: 401 },
      );
    }

    const body = await parseBody(req);
    const title = cleanText(body.title, "SyncPlans listo ✅", 90);
    const message = cleanText(
      body.body,
      "Prueba real: este dispositivo puede recibir push fuera de la app.",
      180,
    );
    const url = cleanUrl(body.url);

    const admin = createServiceRoleClient();

    const push = await sendPushToUsers({
      supabase: admin,
      userIds: [user.id],
      payload: {
        title,
        body: message,
        url,
        tag: `push_self_test:${user.id}`,
        data: {
          type: "push_self_test",
          requestId,
        },
      },
    });

    return NextResponse.json({ ok: true, requestId, push });
  } catch (error) {
    console.error("[api/push/self-test] failed", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar la prueba push.", code: "PUSH_SELF_TEST_FAILED", requestId },
      { status: 500 },
    );
  }
}
