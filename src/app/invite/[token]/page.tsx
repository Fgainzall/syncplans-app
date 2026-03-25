// src/app/invite/[token]/page.tsx
import { Suspense } from "react";
import InviteClient from "./InviteClient";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Cargando invitación...</div>}>
      <InviteClient token={token} />
    </Suspense>
  );
}