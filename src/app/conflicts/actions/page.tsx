// src/app/conflicts/actions/page.tsx
import ActionsClient from "./ActionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function ConflictsActionsPage({ searchParams }: PageProps) {
  const raw = searchParams?.groupId;
  const groupId =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : null;

  return <ActionsClient groupIdFromUrl={groupId} />;
}
