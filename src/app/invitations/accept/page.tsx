import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <AcceptInviteClient />
    </Suspense>
  );
}
