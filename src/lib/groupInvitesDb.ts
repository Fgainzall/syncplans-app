// src/lib/groupInvitesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";
import { inviteToGroup as inviteToGroupCompat } from "@/lib/invitationsDb";

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
  const env = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (env) return env;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

async function trySendEmail(invite_id: string, group_id: string, invited_email: string) {
  const base = clientBaseUrl();
  const accept_url = `${base}/invitations/accept?invite=${encodeURIComponent(invite_id)}`;

  try {
    const r = await fetch("/api/email/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: invited_email,
        inviteId: invite_id,
        groupId: group_id,
      }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return {
        email_sent: false,
        accept_url,
        warning: j?.error || "Invitación creada, pero no se pudo enviar el email.",
      };
    }

    return { email_sent: true, accept_url };
  } catch (e: any) {
    return {
      email_sent: false,
      accept_url,
      warning: e?.message || "Invitación creada, pero falló el envío de email.",
    };
  }
}

export async function inviteToGroup(params: {
  groupId: string;
  email: string;
  role?: "member" | "admin" | "owner" | string;
}): Promise<InviteResult> {
  const { groupId, email, role = "member" } = params;
  const invited_email = clean(email);
  if (!invited_email) return { ok: false, error: "Escribe un email." };

  // 1) Intentar RPC invite_to_group (si existe)
  try {
    const { data, error } = await supabase.rpc("invite_to_group", {
      group_id: groupId,
      email: invited_email,
      role,
    });

    if (!error && data?.ok) {
      const okData = data as {
        ok: true;
        invite_id: string;
        group_id: string;
        invited_email: string;
        status: string;
      };

      const mail = await trySendEmail(okData.invite_id, okData.group_id, okData.invited_email);

      return {
        ...okData,
        ...mail,
        ok: true,
      };
    }

    // si error “real”
    if (error) {
      const msg = String((error as any)?.message ?? "").toLowerCase();
      // si NO es function missing, lo devolvemos
      if (!msg.includes("function") && !msg.includes("rpc")) {
        return { ok: false, error: error.message || "No se pudo invitar." };
      }
    }
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();
    if (!msg.includes("function") && !msg.includes("rpc")) {
      return { ok: false, error: e?.message || "No se pudo invitar." };
    }
  }

  // 2) Fallback: usa invitationsDb.inviteToGroup (create_group_invite / insert directo)
  const r = await inviteToGroupCompat({ groupId, email: invited_email, role: String(role) });
  if (!r.ok || !r.invite_id) return { ok: false, error: r.error || "No se pudo invitar." };

  const invite_id = r.invite_id;
  const mail = await trySendEmail(invite_id, groupId, invited_email);

  return {
    ok: true,
    invite_id,
    group_id: groupId,
    invited_email,
    status: "pending",
    ...mail,
  };
}