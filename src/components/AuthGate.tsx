"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      const user = data.session?.user;
      if (!user) {
        router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      setOk(true);
    })();

    return () => {
      alive = false;
    };
  }, [router, pathname]);

  if (!ok) {
    return (
      <main className="min-h-screen bg-[#050816] text-white grid place-items-center">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white/80">
          Verificando sesión…
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
