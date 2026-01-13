// src/app/conflicts/layout.tsx
import type { ReactNode } from "react";

export default function ConflictsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050816] text-white">
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute top-40 right-10 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative">{children}</div>
    </div>
  );
}
