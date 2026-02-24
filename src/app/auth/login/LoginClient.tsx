// src/app/auth/login/LoginClient.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

/** ✅ Canonical origin helper (evita mismatch entre vercel y dominio propio) */
function getAppOrigin() {
  const env =
    (process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "").trim();

  if (env) {
    try {
      return new URL(env).origin;
    } catch {
      // ignore
    }
  }

  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");

  // ✅ Regla:
  // Si viene ?next=/algo lo respetamos.
  // Si no hay next válido → /summary (una sola verdad sobre tus planes).
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/summary"),
    [nextParam],
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 Guardrail anti-loop:
  // - Si por algún motivo el navegador vuelve con #access_token=...
  //   el servidor no lo ve. Limpiamos el hash para evitar que el usuario
  //   se quede atrapado en /auth/login#...
  // - Si ya hay sesión → nos vamos a nextTarget.
  useEffect(() => {
    let alive = true;

    async function go() {
      try {
        if (typeof window !== "undefined") {
          const h = window.location.hash || "";
          if (h.includes("access_token=") || h.includes("provider_token=")) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname + window.location.search,
            );
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!alive) return;

        if (data?.session) {
          router.replace(nextTarget);
        }
      } catch {
        // no-op
      }
    }

    go();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) router.replace(nextTarget);
    });

    return () => {
      alive = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router, nextTarget]);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && password.trim().length >= 6 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        const msg = String(signInError.message || "").toLowerCase();

        if (
          msg.includes("email not confirmed") ||
          msg.includes("not confirmed") ||
          msg.includes("confirm") ||
          msg.includes("confirmation")
        ) {
          setError(
            "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja (y spam) y entra desde el link.",
          );
        } else if (msg.includes("invalid login") || msg.includes("invalid")) {
          setError("Correo o contraseña incorrectos.");
        } else {
          setError(signInError.message);
        }

        setLoading(false);
        return;
      }

      router.replace(nextTarget);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setLoading(true);

    try {
      const origin = getAppOrigin();

      // ✅ CLAVE: SIEMPRE volver al dominio canónico (no al origin “accidental”)
      // Ej: https://syncplansapp.com/auth/callback?next=/summary
      const redirectTo =
        origin
          ? `${origin}/auth/callback?next=${encodeURIComponent(nextTarget)}`
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "https://www.googleapis.com/auth/calendar.readonly",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // Guardrail: en algunos browsers, supabase no redirige solo
      if (!data?.url) {
        setError("No se pudo iniciar el login con Google.");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch (e: any) {
      setError(e?.message ?? "Error iniciando sesión con Google.");
      setLoading(false);
    }
  }

  // 🎨 Estilos solo para la parte del formulario
  const description: CSSProperties = {
    fontSize: 12,
    color: "rgba(148,163,184,0.96)",
    marginBottom: 8,
    lineHeight: 1.5,
  };

  const label: CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.8,
  };

  const input: CSSProperties = {
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.55)",
    background: "rgba(15,23,42,0.95)",
    padding: "10px 12px",
    fontSize: 13,
    color: "rgba(248,250,252,0.96)",
    outline: "none",
  };

  const errorBox: CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(248,113,113,0.45)",
    background: "rgba(248,113,113,0.14)",
    padding: "8px 10px",
    fontSize: 12,
    color: "rgba(254,242,242,0.95)",
  };

  const primaryBtn: CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(56,189,248,0.9)",
    background:
      "linear-gradient(90deg, rgba(56,189,248,0.97), rgba(16,185,129,0.97))",
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 800,
    cursor: canSubmit ? "pointer" : "not-allowed",
    opacity: canSubmit ? 1 : 0.55,
    marginTop: 4,
  };

  const secondaryBtn: CSSProperties = {
    width: "100%",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.6)",
    background: "rgba(15,23,42,0.95)",
    padding: "10px 14px",
    fontSize: 12,
    fontWeight: 750,
    cursor: loading ? "wait" : "pointer",
    opacity: loading ? 0.6 : 0.9,
    marginTop: 6,
  };

  const legal: CSSProperties = {
    marginTop: 4,
    fontSize: 10,
    opacity: 0.6,
    lineHeight: 1.6,
  };

  return (
    <AuthCard
      mode="login"
      title="Iniciar sesión en SyncPlans"
      subtitle="Accede a tu calendario compartido y deja que SyncPlans detecte los conflictos por ti."
      onToggleMode={() =>
        router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)
      }
    >
      <>
        <p style={description}>
          En lugar de tener cada plan en tu cabeza o perdido en distintos
          chats, entra a SyncPlans y deja que el calendario compartido te
          muestre qué viene, dónde hay choques y qué decisiones hay que tomar.
        </p>

        <form
          onSubmit={onSubmit}
          style={{ display: "grid", gap: 10, marginTop: 6 }}
        >
          <div>
            <div style={label}>Correo</div>
            <input
              style={input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div style={label}>Contraseña</div>
            <input
              style={input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={errorBox}>{error}</div>}

          <button type="submit" disabled={!canSubmit} style={primaryBtn}>
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        {/* ✅ Google OAuth Calendar Readonly */}
        <button
          type="button"
          style={secondaryBtn}
          onClick={onGoogle}
          disabled={loading}
        >
          {loading ? "Conectando…" : "Continuar con Google (Calendar)"}
        </button>

        <button
          type="button"
          style={secondaryBtn}
          onClick={() =>
            router.push(
              `/auth/register?next=${encodeURIComponent(nextTarget)}`,
            )
          }
          disabled={loading}
        >
          Crear cuenta
        </button>

        <div style={legal}>
          Al entrar aceptas que esta es una beta privada pensada para pruebas
          personales. Podrás borrar tu cuenta y datos cuando quieras desde el
          panel de perfil.
        </div>
      </>
    </AuthCard>
  );
}