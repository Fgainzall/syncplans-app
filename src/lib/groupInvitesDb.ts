// src/lib/groupInvitesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type InviteResult =
  | {
      ok: true;
      invite_id: string;
      group_id: string;
      invited_email: string;
      status: string;
      email_sent?: boolean;
      accept_url?: string;
      warning?: string;
    }
  | { ok: false; error: string };

function clean(email: string) {
  return String(email || "").trim().toLowerCase();
}

function clientBaseUrl() {
  // En cliente solo existe NEXT_PUBLIC_APP_URL (si lo seteas)
  // Si no, usamos origin actual (ideal en Vercel) o localhost.
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (env) return env;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export async function inviteToGroup(params: {
  groupId: string;
  email: string;
  role?: "member" | "admin" | "owner" | string;
}): Promise<InviteResult> {
  const { groupId, email, role = "member" } = params;

  const invited_email = clean(email);
  if (!invited_email) return { ok: false, error: "Escribe un email." };

  // 1) Crear invitación en DB
  const { data, error } = await supabase.rpc("invite_to_group", {
    group_id: groupId,
    email: invited_email,
    role,
  });

  if (error) return { ok: false, error: error.message || "No se pudo invitar." };
  if (!data?.ok) return { ok: false, error: data?.error || "No se pudo invitar." };

  const okData = data as {
    ok: true;
    invite_id: string;
    group_id: string;
    invited_email: string;
    status: string;
  };

  // 2) Intentar enviar email (NO bloqueante)
  // Si falla, igual devolvemos ok: true, con warning.
  try {
    const base = clientBaseUrl();
    const accept_url =
      `${base}/invitations/accept?invite=${encodeURIComponent(okData.invite_id)}` +
      (okData.group_id ? `&groupId=${encodeURIComponent(okData.group_id)}` : "");

    const r = await fetch("/api/email/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: okData.invited_email,
        inviteId: okData.invite_id,
        groupId: okData.group_id,
      }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return {
        ...okData,
        email_sent: false,
        accept_url,
        warning: j?.error || "Invitación creada, pero no se pudo enviar el email.",
      };
    }

    return {
      ...okData,
      email_sent: true,
      accept_url,
    };
  } catch (e: any) {
    const base = clientBaseUrl();
    const accept_url =
      `${base}/invitations/accept?invite=${encodeURIComponent(okData.invite_id)}` +
      (okData.group_id ? `&groupId=${encodeURIComponent(okData.group_id)}` : "");

    return {
      ...okData,
      email_sent: false,
      accept_url,
      warning: e?.message || "Invitación creada, pero falló el envío de email.",
    };
  }
}
