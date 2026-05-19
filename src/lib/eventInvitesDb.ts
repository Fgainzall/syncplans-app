// src/lib/eventInvitesDb.ts
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import supabase from "@/lib/supabaseClient";

export type CreateEventSpecificInviteInput = {
  eventId: string;
  email: string;
};

export type EventSpecificInviteResult = {
  invite_id: string;
  event_id: string;
  token: string;
  invited_email: string;
};

export type EventInvitePreview = {
  invite_id: string;
  event_id: string;
  event_title: string;
  event_start: string | null;
  event_end: string | null;
  invited_email: string;
  status: string;
  created_at: string | null;
};

function cleanEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeCreateInviteRow(row: any): EventSpecificInviteResult {
  return {
    invite_id: String(row?.invite_id ?? row?.id ?? ""),
    event_id: String(row?.event_id ?? ""),
    token: String(row?.token ?? ""),
    invited_email: cleanEmail(row?.invited_email ?? row?.email ?? ""),
  };
}

function normalizePreviewRow(row: any): EventInvitePreview {
  return {
    invite_id: String(row?.invite_id ?? row?.id ?? ""),
    event_id: String(row?.event_id ?? ""),
    event_title: String(row?.event_title ?? row?.title ?? "Plan"),
    event_start: row?.event_start ? String(row.event_start) : null,
    event_end: row?.event_end ? String(row.event_end) : null,
    invited_email: cleanEmail(row?.invited_email ?? row?.email ?? ""),
    status: String(row?.status ?? "pending").toLowerCase(),
    created_at: row?.created_at ? String(row.created_at) : null,
  };
}

export function buildEventInviteUrl(token: string, baseUrl?: string | null) {
  const safeToken = String(token ?? "").trim();
  const explicitBase = String(baseUrl ?? "").trim().replace(/\/$/, "");

  const origin =
    explicitBase ||
    (typeof window !== "undefined" && window.location?.origin
      ? window.location.origin.replace(/\/$/, "")
      : "");

  return `${origin || "http://localhost:3000"}/event-invite/${encodeURIComponent(
    safeToken
  )}`;
}

export async function createEventSpecificInvite(
  input: CreateEventSpecificInviteInput
): Promise<EventSpecificInviteResult> {
  const eventId = String(input.eventId ?? "").trim();
  const email = cleanEmail(input.email);

  if (!eventId) throw new Error("Falta el evento.");
  if (!email || !email.includes("@")) throw new Error("Escribe un email válido.");

  const { data, error } = await (supabase as any).rpc("create_event_invite", {
    p_event_id: eventId,
    p_email: email,
  });

  if (error) {
    throw new Error(error.message || "No se pudo crear la invitación del plan.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  const normalized = normalizeCreateInviteRow(row);

  if (!normalized.invite_id || !normalized.token) {
    throw new Error("La invitación se creó, pero no devolvió un link válido.");
  }

  return normalized;
}

export async function getEventInvitePreview(
  token: string
): Promise<EventInvitePreview | null> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) return null;

  const { data, error } = await (supabase as any).rpc("get_event_invite_preview", {
    p_token: safeToken,
  });

  if (error) {
    throw new Error(error.message || "No se pudo cargar la invitación del plan.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return normalizePreviewRow(row);
}

export async function acceptEventSpecificInvite(token: string): Promise<{
  event_id: string;
  status: string;
}> {
  const safeToken = String(token ?? "").trim();
  if (!safeToken) throw new Error("Link inválido.");

  const { data, error } = await (supabase as any).rpc("accept_event_invite", {
    p_token: safeToken,
  });

  if (error) {
    throw new Error(error.message || "No se pudo aceptar la invitación.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    event_id: String(row?.event_id ?? ""),
    status: String(row?.status ?? "accepted"),
  };
}
