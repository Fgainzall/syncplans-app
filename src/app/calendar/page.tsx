// src/app/calendar/page.tsx
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

export default function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // ✅ highlight: desde ?highlightEventId= o ?eventId=
  const highlightId =
    getSingle(searchParams.highlightEventId) ??
    getSingle(searchParams.eventId) ??
    null;

  // ✅ toast después de /conflicts/actions?applied=1&deleted=...&skipped=...
  const appliedFlag = getSingle(searchParams.applied);
  const hasApplied = appliedFlag === "1" || appliedFlag === "true";

  const appliedToast = hasApplied
    ? {
        deleted: Number(getSingle(searchParams.deleted) ?? "0") || 0,
        skipped: Number(getSingle(searchParams.skipped) ?? "0") || 0,
        appliedCount:
          Number(getSingle(searchParams.appliedCount) ?? "0") || 0,
      }
    : null;

  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background:
              "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
            color: "rgba(255,255,255,0.85)",
            fontFamily:
              "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(5,8,22,0.86)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
              fontSize: 14,
            }}
          >
            Cargando tu calendario…
          </div>
        </main>
      }
    >
      <CalendarClient
        highlightId={highlightId}
        appliedToast={appliedToast}
      />
    </Suspense>
  );
}
