// src/app/invitations/accept/page.tsx
import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[#050816]" />}>
      <AcceptInviteClient />
    </Suspense>
  );
}
