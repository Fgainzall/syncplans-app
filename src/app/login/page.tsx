"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginRedirectPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const next = sp.get("next") || "/calendar";
    router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
  }, [router, sp]);

  return (
    <main className="min-h-screen bg-[#050816] text-white grid place-items-center">
      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80">
        Redirigiendo a login…
      </div>
    </main>
  );
}
