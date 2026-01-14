// src/app/audit/page.tsx
import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuditPage() {
  return <AuditClient />;
}
