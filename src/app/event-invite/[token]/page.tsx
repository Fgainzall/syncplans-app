// src/app/event-invite/[token]/page.tsx
import EventInviteAcceptClient from "./EventInviteAcceptClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
};

export default async function EventInvitePage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = String(resolvedParams?.token ?? "");

  return <EventInviteAcceptClient token={token} />;
}
