// src/app/calendar/page.tsx
import CalendarClient from "./CalendarClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function asString(v: string | string[] | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function asNum(v: string | string[] | undefined): number {
  const s = asString(v);
  const n = Number(s ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export default function CalendarPage({ searchParams }: PageProps) {
  const highlightId =
    asString(searchParams?.highlightEventId) ?? asString(searchParams?.eventId);

  const applied = asString(searchParams?.applied) === "1";

  const appliedToast = applied
    ? {
        deleted: asNum(searchParams?.deleted),
        skipped: asNum(searchParams?.skipped),
        appliedCount: asNum(searchParams?.appliedCount),
      }
    : null;

  return <CalendarClient highlightId={highlightId} appliedToast={appliedToast} />;
}
