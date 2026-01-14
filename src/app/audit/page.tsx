import AuditClient from "./AuditClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuditPage() {
  return <AuditClient />;
}
git status
git add -A
git commit -m "chore: trigger vercel deploy"
git push
