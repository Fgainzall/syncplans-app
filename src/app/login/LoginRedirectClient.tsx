// src/app/login/LoginRedirectClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function LoginRedirectClient({ next }: { next: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("Cargando…");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        if (data?.session) {
          router.replace(next);
          return;
        }

        // no logueado → manda a tu UI real de login
        router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
      } catch (e: any) {
        if (!alive) return;
        setMsg(e?.message || "No se pudo cargar. Intenta recargar.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, next]);

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 600px at 20% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(124,58,237,0.14), transparent 60%), #050816",
        color: "rgba(255,255,255,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
          padding: 18,
        }}
      >
        <div style={{ fontWeight: 950, fontSize: 14 }}>SyncPlans</div>
        <div style={{ marginTop: 8, opacity: 0.75, fontSize: 13 }}>{msg}</div>
      </div>
    </main>
  );
}
