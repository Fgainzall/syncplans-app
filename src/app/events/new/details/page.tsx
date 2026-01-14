// src/app/events/new/details/page.tsx
import { Suspense } from "react";
import dynamic from "next/dynamic";

const NewEventDetailsClient = dynamic(() => import("./NewEventDetailsClient"), {
  ssr: false,
  loading: () => <main className="min-h-screen bg-[#050816]" />,
});

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function NewEventDetailsPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <NewEventDetailsClient />
    </Suspense>
  );
}
