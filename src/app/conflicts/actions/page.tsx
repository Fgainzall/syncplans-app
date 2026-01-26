// src/app/conflicts/actions/page.tsx
import { Suspense } from "react";
import ActionsClient from "./ActionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function asString(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export default function ConflictsActionsPage({ searchParams }: PageProps) {
  const groupIdFromUrl = asString(searchParams?.groupId);

  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <ActionsClient groupIdFromUrl={groupIdFromUrl} />
    </Suspense>
  );
}
