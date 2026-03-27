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

export function getEventOwnerId(
  event:
    | {
        owner_id?: string | null;
        user_id?: string | null;
        created_by?: string | null;
      }
    | null
    | undefined
): string | null {
  const ownerId = String(event?.owner_id ?? "").trim();
  if (ownerId) return ownerId;

  const userId = String(event?.user_id ?? "").trim();
  if (userId) return userId;

  const createdBy = String(event?.created_by ?? "").trim();
  if (createdBy) return createdBy;

  return null;
}

export function isEventOwnedByUser(
  event:
    | {
        owner_id?: string | null;
        user_id?: string | null;
        created_by?: string | null;
      }
    | null
    | undefined,
  uid: string | null | undefined
): boolean {
  const safeUid = String(uid ?? "").trim();
  if (!safeUid) return false;

  const ownerId = getEventOwnerId(event);
  if (!ownerId) return false;

  return ownerId === safeUid;
}

export function getVisibleEvents<T extends { id?: string | null }>(
  events: T[],
  hiddenEventIds: string[] = []
): T[] {
  const hiddenSet = new Set(
    hiddenEventIds.map((id) => String(id).trim()).filter(Boolean)
  );

  return events.filter((event) => {
    const id = String(event?.id ?? "").trim();
    if (!id) return false;
    if (hiddenSet.has(id)) return false;
    return true;
  });
}