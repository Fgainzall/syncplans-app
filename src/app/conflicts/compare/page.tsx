// src/app/conflicts/compare/page.tsx
import { Suspense } from "react";
import CompareClient from "./CompareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ConflictsComparePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <CompareClient />
    </Suspense>
  );
}
