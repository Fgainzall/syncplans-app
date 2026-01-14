// src/app/register/RegisterRedirectClient.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterRedirectClient({ next }: { next: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/auth/register?next=${encodeURIComponent(next)}`);
  }, [router, next]);

  return (
    <main className="min-h-screen bg-[#050816] text-white grid place-items-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80">
        Redirigiendo a registro…
      </div>
    </main>
  );
}
