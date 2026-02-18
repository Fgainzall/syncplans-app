import { Suspense } from "react";
import AcceptInviteClient from "./AcceptInviteClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh", background: "#050816" }} />}>
      <AcceptInviteClient />
    </Suspense>
  );
}