// src/app/login/LoginRedirectClient.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

type Props = {
  next: string;
};

export default function LoginRedirectClient({ next }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("Comprobando tu sesión…");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!alive) return;

        if (error) {
          console.error("Error al obtener sesión:", error);
          setMsg("Error verificando sesión. Intenta de nuevo.");
          return;
        }

        if (data?.session) {
          // ✅ Ya está logueado → lo mando a la ruta deseada
          router.replace(next);
          return;
        }

        // ❌ No logueado → mando a /auth/login con next=
        const encodedNext = encodeURIComponent(next);
        router.replace(`/auth/login?next=${encodedNext}`);
      } catch (e: any) {
        if (!alive) return;
        console.error("Excepción en LoginRedirectClient:", e);
        setMsg("Ocurrió un error verificando tu sesión.");
      }
    })();

    return () => {
      alive = false;
    };
  }, [next, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050816",
        color: "#e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderRadius: 16,
          border: "1px solid rgba(148,163,184,0.45)",
          background: "rgba(15,23,42,0.95)",
          fontSize: 14,
        }}
      >
        {msg}
      </div>
    </main>
  );
}
