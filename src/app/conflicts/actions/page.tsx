// src/app/conflicts/actions/page.tsx
import { Suspense } from "react";
import ActionsClient from "./ActionsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ConflictsActionsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <ActionsClient />
    </Suspense>
  );
}