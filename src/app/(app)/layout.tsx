import type { ReactNode } from "react";
import AuthGate from "@/components/AuthGate";
import RequireProfile from "@/components/RequireProfile";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <RequireProfile>{children}</RequireProfile>
    </AuthGate>
  );
}
