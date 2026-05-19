// src/lib/eventInvitesDb.ts
"use client";

import supabase from "@/lib/supabaseClient";

export type EventSpecificInvite = {
  invite_id: string;
  token: string;
  event_id: string;
  invited_email: string;
  status: string;
};

export type EventInvitePreview = {
  invite_id: string | null;
  event_id: string | null;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  invited_email: string;
  invited_by: string | null;
  status: string;
};

export type AcceptEventInviteResult = {
  event_id: string;
  status: string;
};

export type SendEventSpecificInviteEmailResult = {
  sent: boolean;
  id: string | null;
  acceptUrl: string | null;
};

type CreateEventSpecificInviteInput = {
  eventId: string;
  email: string;
};

type SendEventSpecificInviteEmailInput = {
  inviteId: string;
  email: string;
};

function normalizeEmail(value: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function getPublicBaseUrl(): string {
  const envBase = String(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? ""
  )
    .trim()
    .replace(/\/$/, "");

  if (envBase) return envBase;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

function asObjectRow<T extends Record<string, unknown>>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  if (value && typeof value === "object") return value as T;
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "").trim();
    if (msg) return msg;
  }
  return fallback;
}

export function buildEventInviteUrl(token: string): string {
  const safeToken = encodeURIComponent(String(token ?? "").trim());
  return `${getPublicBaseUrl()}/event-invite/${safeToken}`;
}

export async function createEventSpecificInvite(
  input: CreateEventSpecificInviteInput
): Promise<EventSpecificInvite> {
  const eventId = String(input.eventId ?? "").trim();
  const email = normalizeEmail(input.email);

  if (!eventId) throw new Error("No encontramos el evento para compartir.");
  if (!email || !email.includes("@")) {
    throw new Error("Escribe un correo válido para compartir este plan.");
  }

  const { data, error } = await supabase.rpc("create_event_invite", {
    p_event_id: eventId,
    p_invited_email: email,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "No se pudo crear la invitación de este plan.")
    );
  }

  const row = asObjectRow<Record<string, unknown>>(data);
  if (!row?.token || !row?.event_id) {
    throw new Error("La invitación se creó, pero no recibimos un link válido.");
  }

  return {
    invite_id: String(row.invite_id ?? row.id ?? ""),
    token: String(row.token),
    event_id: String(row.event_id),
    invited_email: normalizeEmail(String(row.invited_email ?? email)),
    status: String(row.status ?? "pending"),
  };
}


export async function sendEventSpecificInviteEmail(
  input: SendEventSpecificInviteEmailInput
): Promise<SendEventSpecificInviteEmailResult> {
  const inviteId = String(input.inviteId ?? "").trim();
  const email = normalizeEmail(input.email);

  if (!inviteId) throw new Error("No encontramos la invitación para enviar.");
  if (!email || !email.includes("@")) {
    throw new Error("Escribe un correo válido para enviar este plan.");
  }

  const response = await fetch("/api/email/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      inviteType: "event",
      inviteId,
      email,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { id?: unknown; acceptUrl?: unknown; error?: unknown }
    | null;

  if (!response.ok) {
    const message = String(payload?.error ?? "").trim();
    throw new Error(message || "No pudimos enviar el email de invitación.");
  }

  return {
    sent: true,
    id: payload?.id ? String(payload.id) : null,
    acceptUrl: payload?.acceptUrl ? String(payload.acceptUrl) : null,
  };
}

export async function getEventInvitePreview(
  token: string
): Promise<EventInvitePreview> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) throw new Error("Falta el token de invitación.");

  const { data, error } = await supabase.rpc("get_event_invite_preview", {
    p_token: safeToken,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "No pudimos cargar esta invitación.")
    );
  }

  const row = asObjectRow<Record<string, unknown>>(data);
  if (!row) throw new Error("Invitación no encontrada.");

  return {
    invite_id: row.invite_id ? String(row.invite_id) : null,
    event_id: row.event_id ? String(row.event_id) : null,
    event_title: String(row.event_title ?? "Plan"),
    event_start: row.event_start ? String(row.event_start) : null,
    event_end: row.event_end ? String(row.event_end) : null,
    invited_email: normalizeEmail(String(row.invited_email ?? "")),
    invited_by: row.invited_by ? String(row.invited_by) : null,
    status: String(row.status ?? "pending"),
  };
}

export async function acceptEventInvite(
  token: string
): Promise<AcceptEventInviteResult> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) throw new Error("Falta el token de invitación.");

  const { data, error } = await supabase.rpc("accept_event_invite", {
    p_token: safeToken,
  });

  if (error) {
    throw new Error(
      getErrorMessage(error, "No pudimos aceptar esta invitación.")
    );
  }

  const row = asObjectRow<Record<string, unknown>>(data);
  if (!row?.event_id) throw new Error("No recibimos el evento aceptado.");

  return {
    event_id: String(row.event_id),
    status: String(row.status ?? "accepted"),
  };
}
