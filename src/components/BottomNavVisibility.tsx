"use client";

import { usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";

const HIDDEN_EXACT = ["/"];

const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/onboarding",
  "/auth",
];

export default function BottomNavVisibility() {
  const pathname = usePathname();

  const shouldHide =
    HIDDEN_EXACT.includes(pathname) ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (shouldHide) return null;

  return <BottomNav />;
}