// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "exchanging" | "ok" | "error"
  >("loading");
  const [message, setMessage] = useState<string>("Confirmando tu acceso…");

  const { code, next, errorDesc } = useMemo(() => {
    if (typeof window === "undefined") {
      return { code: null as string | null, next: "/summary", errorDesc: null as string | null };
    }

    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const nextParam = sp.get("next");
    const nextTarget =
      nextParam && nextParam.startsWith("/") ? nextParam : "/summary";

    return {
      code: sp.get("code"),
      next: nextTarget,
      errorDesc: sp.get("error_description") || sp.get("error") || null,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // Si Supabase mandó error en la URL, salimos rápido
        if (errorDesc) {
          if (!cancelled) {
            setStatus("error");
            setMessage("No se pudo confirmar tu correo. Intenta nuevamente.");
            router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
          }
          return;
        }

        // Si viene code (PKCE), hay que intercambiarlo por sesión
        if (code) {
          if (!cancelled) {
            setStatus("exchanging");
            setMessage("Confirmando tu correo…");
          }

          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            if (!cancelled) {
              setStatus("error");
              setMessage("No se pudo confirmar tu correo. Vuelve a intentar.");
              router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
            }
            return;
          }
        }

        // Finalmente validamos sesión
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (!cancelled) {
            setStatus("error");
            setMessage("Tu sesión no está activa. Inicia sesión para continuar.");
            router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
          }
          return;
        }

        if (!cancelled) {
          setStatus("ok");
          setMessage("Listo ✅ Entrando a SyncPlans…");
          router.replace(next);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Error confirmando tu acceso. Inicia sesión nuevamente.");
          router.replace(`/auth/login?next=${encodeURIComponent(next)}`);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, code, next, errorDesc]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(1200px 600px at 15% -10%, rgba(56,189,248,0.20), transparent 60%)," +
          "radial-gradient(900px 500px at 90% 0%, rgba(37,99,235,0.18), transparent 60%)," +
          "#050816",
        color: "rgba(255,255,255,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(15,23,42,0.92)",
          boxShadow: "0 30px 90px rgba(0,0,0,0.60)",
          padding: 18,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>
          SyncPlans · Confirmación
        </div>

        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
          {message}
        </div>

        <div style={{ marginTop: 12, fontSize: 11, opacity: 0.6 }}>
          {status === "exchanging"
            ? "Intercambiando código seguro…"
            : status === "loading"
              ? "Validando sesión…"
              : status === "ok"
                ? "Redirigiendo…"
                : "Redirigiendo a login…"}
        </div>
      </div>
    </main>
  );
}