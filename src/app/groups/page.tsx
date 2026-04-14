import { Suspense } from "react";
import GroupsPageClient from "./GroupsPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function GroupsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <GroupsPageClient />
    </Suspense>
  );
}