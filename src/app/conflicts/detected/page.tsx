// src/app/conflicts/detected/page.tsx
import { Suspense } from "react";
import DetectedClient from "./DetectedClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ConflictsDetectedPage() {
  return (
    <Suspense fallback={null}>
      <DetectedClient />
    </Suspense>
  );
}