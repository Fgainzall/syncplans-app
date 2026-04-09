"use client";

import supabase from "@/lib/supabaseClient";

export type EventResponseStatus = "pending" | "accepted" | "declined";

export type EventResponseRow = {
  id: string;
  event_id: string;
  user_id: string;
  group_id: string | null;
  response_status: EventResponseStatus;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

export async function getMyDeclinedEventIds(): Promise<Set<string>> {
  const uid = await getCurrentUserId();
  if (!uid) return new Set<string>();

  const { data: rows, error } = await supabase
    .from("event_responses")
    .select("event_id")
    .eq("user_id", uid)
    .eq("response_status", "declined");

  if (error) throw error;

  const declinedIds = new Set<string>();

  for (const row of rows ?? []) {
    if (row?.event_id) {
      declinedIds.add(String(row.event_id));
    }
  }

  return declinedIds;
}

export async function getMyEventResponsesMap(): Promise<Record<string, EventResponseStatus>> {
  const uid = await getCurrentUserId();
  if (!uid) return {};

  const { data: rows, error } = await supabase
    .from("event_responses")
    .select("event_id, response_status")
    .eq("user_id", uid);

  if (error) throw error;

  const map: Record<string, EventResponseStatus> = {};

  for (const row of rows ?? []) {
    const eventId = String(row?.event_id ?? "").trim();
    const status = String(row?.response_status ?? "").trim();

    if (!eventId) continue;
    if (status === "pending" || status === "accepted" || status === "declined") {
      map[eventId] = status;
    }
  }

  return map;
}

export async function setMyEventResponse(input: {
  eventId: string;
  groupId: string | null;
  responseStatus: EventResponseStatus;
  comment?: string | null;
}): Promise<EventResponseRow | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;

  const eventId = String(input.eventId ?? "").trim();
  const groupId = input.groupId ? String(input.groupId).trim() : null;
  const responseStatus = input.responseStatus;
  const comment =
    input.comment === undefined ? null : String(input.comment ?? "").trim();

  if (!eventId) {
    throw new Error("setMyEventResponse: eventId es obligatorio.");
  }

  const payload = {
    event_id: eventId,
    user_id: uid,
    group_id: groupId,
    response_status: responseStatus,
    comment,
  };

  const { data, error } = await supabase
    .from("event_responses")
    .upsert(payload, {
      onConflict: "event_id,user_id",
    })
    .select()
    .single();

  if (error) throw error;

  return (data as EventResponseRow) ?? null;
}

export async function acceptEventForCurrentUser(
  eventId: string,
  groupId: string | null,
  comment?: string | null
) {
  return setMyEventResponse({
    eventId,
    groupId,
    responseStatus: "accepted",
    comment,
  });
}

export async function declineEventForCurrentUser(
  eventId: string,
  groupId: string | null,
  comment?: string | null
) {
  return setMyEventResponse({
    eventId,
    groupId,
    responseStatus: "declined",
    comment,
  });
}

export async function resetEventResponseForCurrentUser(eventId: string) {
  const uid = await getCurrentUserId();
  if (!uid) return;

  const safeEventId = String(eventId ?? "").trim();
  if (!safeEventId) return;

  const { error } = await supabase
    .from("event_responses")
    .delete()
    .eq("event_id", safeEventId)
    .eq("user_id", uid);

  if (error) throw error;
}

export function filterOutDeclinedEvents<T extends { id: string }>(
  events: T[],
  declinedIds: Set<string>
): T[] {
  if (!declinedIds || declinedIds.size === 0) return events;

  return events.filter((event) => !declinedIds.has(String(event.id)));
}