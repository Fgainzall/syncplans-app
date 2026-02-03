// src/app/events/new/details/page.tsx
import React, { Suspense } from "react";
import NewEventDetailsClient from "./NewEventDetailsClient";

export const dynamic = "force-dynamic";

export default function NewEventDetailsPage() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            background:
              "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
          }}
        />
      }
    >
      <NewEventDetailsClient />
    </Suspense>
  );
}
