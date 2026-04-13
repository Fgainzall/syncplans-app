import { Suspense } from "react";
import CalendarClient from "./CalendarClient";

type SearchParams = {
  highlightEventId?: string | string[];
  eventId?: string | string[];
  applied?: string | string[];
  deleted?: string | string[];
  skipped?: string | string[];
  appliedCount?: string | string[];
};

function getSingle(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const highlightId = getSingle(searchParams.highlightEventId) ?? getSingle(searchParams.eventId) ?? null;

  const appliedFlag = getSingle(searchParams.applied);
  const hasApplied = appliedFlag === "1" || appliedFlag === "true";

  const appliedToast = hasApplied
    ? {
        deleted: Number(getSingle(searchParams.deleted) ?? "0") || 0,
        skipped: Number(getSingle(searchParams.skipped) ?? "0") || 0,
        appliedCount: Number(getSingle(searchParams.appliedCount) ?? "0") || 0,
      }
    : null;

  return (
    <Suspense fallback={null}>
      <CalendarClient highlightId={highlightId} appliedToast={appliedToast} />
    </Suspense>
  );
}