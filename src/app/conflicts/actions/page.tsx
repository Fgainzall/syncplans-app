// src/app/conflicts/actions/page.tsx
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

  return <ActionsClient groupIdFromUrl={groupIdFromUrl} />;
}
