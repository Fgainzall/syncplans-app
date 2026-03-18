"use client";

import supabase from "@/lib/supabaseClient";

export type EventResponseStatus = "pending" | "accepted" | "declined";

/**
 * Devuelve los IDs de eventos que el usuario actual marcó como declined
 */
export async function getMyDeclinedEventIds(): Promise<Set<string>> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const uid = data.user?.id;
  if (!uid) return new Set<string>();

  const { data: rows, error: rowsError } = await supabase
    .from("event_responses")
    .select("event_id")
    .eq("user_id", uid)
    .eq("response_status", "declined");

  if (rowsError) throw rowsError;

  const declinedIds = new Set<string>();

  for (const row of rows ?? []) {
    if (row?.event_id) {
      declinedIds.add(String(row.event_id));
    }
  }

  return declinedIds;
}

/**
 * Filtra de una lista los eventos que estén declined para el usuario actual
 */
export function filterOutDeclinedEvents<T extends { id: string }>(
  events: T[],
  declinedIds: Set<string>
): T[] {
  if (!declinedIds || declinedIds.size === 0) return events;

  return events.filter((event) => !declinedIds.has(String(event.id)));
}