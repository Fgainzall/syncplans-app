"use client";

import { filterSoftRejectedEvents } from "@/lib/conflicts";

type IdLike = {
  id: string;
};

export function filterVisibleEvents<T extends IdLike>(
  events: T[],
  opts: {
    declinedIds?: Set<string> | null;
    hiddenIds?: Set<string> | null;
  } = {}
): T[] {
  let next = Array.isArray(events) ? [...events] : [];

  if (opts.declinedIds && opts.declinedIds.size > 0) {
    next = next.filter((event) => !opts.declinedIds?.has(String(event.id)));
  }

  if (opts.hiddenIds && opts.hiddenIds.size > 0) {
    next = filterSoftRejectedEvents(next, opts.hiddenIds);
  }

  return next;
}

export function getEventOwnerId(event: {
  owner_id?: string | null;
  user_id?: string | null;
  created_by?: string | null;
} | null | undefined): string {
  return String(event?.owner_id ?? event?.user_id ?? event?.created_by ?? "").trim();
}

export function isEventOwnedByUser(
  event: {
    owner_id?: string | null;
    user_id?: string | null;
    created_by?: string | null;
  } | null | undefined,
  uid: string | null | undefined
): boolean {
  const safeUid = String(uid ?? "").trim();
  if (!safeUid) return false;
  return getEventOwnerId(event) === safeUid;
}