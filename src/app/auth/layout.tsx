// src/app/auth/layout.tsx
import React from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#050816] text-white">
      {/* fondo premium */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_-10%,rgba(56,189,248,0.18),transparent_60%),radial-gradient(900px_520px_at_90%_10%,rgba(16,185,129,0.12),transparent_60%)]" />
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(650px_420px_at_70%_85%,rgba(99,102,241,0.10),transparent_60%)]" />
      </div>

      {/* contenedor centrado */}
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
        {children}
      </div>
    </main>
  );
}
