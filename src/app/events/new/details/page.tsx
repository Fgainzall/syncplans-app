// src/app/events/new/details/page.tsx
import { Suspense } from "react";
import NewEventDetailsClient from "./NewEventDetailsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <NewEventDetailsClient />
    </Suspense>
  );
}
