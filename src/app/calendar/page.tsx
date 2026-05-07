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

type CalendarPageProps = {
  searchParams: Promise<SearchParams>;
};

function getSingle(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;

  const highlightId =
    getSingle(params.highlightEventId) ?? getSingle(params.eventId) ?? null;

  const appliedFlag = getSingle(params.applied);
  const hasApplied = appliedFlag === "1" || appliedFlag === "true";

  const appliedToast = hasApplied
    ? {
        deleted: Number(getSingle(params.deleted) ?? "0") || 0,
        skipped: Number(getSingle(params.skipped) ?? "0") || 0,
        appliedCount: Number(getSingle(params.appliedCount) ?? "0") || 0,
      }
    : null;

  return (
    <Suspense fallback={null}>
      <CalendarClient highlightId={highlightId} appliedToast={appliedToast} />
    </Suspense>
  );
}
