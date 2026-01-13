"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/calendar");
      } else {
        router.replace("/auth/login");
      }
    };

    handleAuth();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050816] text-white">
      <div className="text-sm text-white/70">
        Confirmando acceso…
      </div>
    </main>
  );
}
