// src/app/groups/invite/page.tsx
import { Suspense } from "react";
import GroupInviteClient from "./GroupInviteClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <GroupInviteClient />
    </Suspense>
  );
}
