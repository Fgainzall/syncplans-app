// src/app/events/page.tsx
import { Suspense } from "react";
import EventsPageClient from "./EventsPageClient";

export default function EventsPage() {
  return (
    <Suspense fallback={null}>
      <EventsPageClient />
    </Suspense>
  );
}