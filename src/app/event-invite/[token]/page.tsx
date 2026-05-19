// src/app/event-invite/[token]/page.tsx
import { Suspense } from "react";
import type { CSSProperties } from "react";
import EventInviteAcceptClient from "./EventInviteAcceptClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ token: string }> | { token: string };
};

export default async function EventInvitePage({ params }: PageProps) {
  const resolvedParams = await params;
  const token = String(resolvedParams?.token ?? "");

  return (
    <Suspense fallback={<main style={styles.page}>Cargando invitación…</main>}>
      <EventInviteAcceptClient token={token} />
    </Suspense>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#020617",
    color: "white",
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
};
