import React, { Suspense } from "react";
import NewEventDetailsClient from "./NewEventDetailsClient";

export const dynamic = "force-dynamic";

export default function NewEventDetailsPage() {
  return (
    <Suspense fallback={null}>
      <NewEventDetailsClient />
    </Suspense>
  );
}