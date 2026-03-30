// src/app/invite/[token]/page.tsx
import InviteClient from "./InviteClient";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  return <InviteClient token={token} />;
}