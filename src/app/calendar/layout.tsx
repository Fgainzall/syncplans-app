import AuthGate from "@/components/AuthGate";

export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}