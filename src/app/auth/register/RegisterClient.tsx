// src/app/auth/register/RegisterClient.tsx
"use client";

import React, {
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";

export default function RegisterClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextParam = sp.get("next");
  const nextTarget = useMemo(
    () => (nextParam && nextParam.startsWith("/") ? nextParam : "/summary"),
    [nextParam],
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    const n = name.trim();
    const p1 = password.trim();
    const p2 = password2.trim();
    return (
      e.includes("@") &&
      n.length > 0 &&
      p1.length >= 6 &&
      p2.length >= 6 &&
      p1 === p2 &&
      !loading
    );
  }, [email, name, password, password2, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPass = password.trim();
    const trimmedPass2 = password2.trim();

    if (!trimmedName) {
      setError("Pon tu nombre. Lo usaremos dentro de SyncPlans.");
      setLoading(false);
      return;
    }

    if (trimmedPass !== trimmedPass2) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      const APP_URL =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        "https://syncplansapp.com";

      // ✅ Importante: preservamos next para que después del callback caiga donde toca
      const redirectTo =
        `${APP_URL}/auth/callback?next=` + encodeURIComponent(nextTarget);

      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPass,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: trimmedName,
            display_name: trimmedName,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setDone(true);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta de nuevo.");
      setLoading(false);
    }
  }

  // 🎨 Estilos SOLO para el formulario (el layout general lo pone AuthCard)
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

  const infoBox: CSSProperties = {
    borderRadius: 16,
    border: "1px solid rgba(52,211,153,0.45)",
    background: "rgba(16,185,129,0.12)",
    padding: "8px 10px",
    fontSize: 11,
    color: "rgba(240,253,250,0.95)",
    marginTop: 4,
    marginBottom: 4,
    lineHeight: 1.5,
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
      mode="register"
      title="Crear cuenta en SyncPlans"
      subtitle="Empieza con tu cuenta personal. Después podrás invitar a tu pareja, familia o amigos para compartir el calendario."
      onToggleMode={() =>
        router.push(`/auth/login?next=${encodeURIComponent(nextTarget)}`)
      }
    >
      <>
        {!done && (
          <p style={description}>
            Con una sola cuenta tendrás tu calendario personal y el de tus
            grupos de pareja y familia. SyncPlans detecta choques de horario
            y te obliga a decidir antes, para evitar discusiones después.
          </p>
        )}

        {done ? (
          <>
            <div style={infoBox}>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>
                Cuenta creada ✅
              </div>
              <div>
                Te enviamos un correo para confirmar tu registro. Después de
                hacer clic en <b>&quot;Confirm your mail&quot;</b> volverás
                automáticamente a <b>/auth/callback</b> y desde ahí podrás
                iniciar sesión. Al entrar, comenzarás en tu resumen de planes.
              </div>
            </div>

            <button
              type="button"
              style={secondaryBtn}
              onClick={() =>
                router.push(
                  `/auth/login?next=${encodeURIComponent(nextTarget)}`,
                )
              }
              disabled={loading}
            >
              Ir a iniciar sesión
            </button>

            <button
              type="button"
              style={secondaryBtn}
              onClick={() => {
                setDone(false);
                setName("");
                setEmail("");
                setPassword("");
                setPassword2("");
                setError(null);
              }}
              disabled={loading}
            >
              Crear otra cuenta
            </button>

            <div style={legal}>
              Si no ves el correo, revisa tu bandeja de spam o busca por
              &ldquo;Supabase Auth&rdquo;. Sin confirmar el correo no podrás
              acceder a tu calendario.
            </div>
          </>
        ) : (
          <>
            <form
              onSubmit={onSubmit}
              style={{ display: "grid", gap: 10, marginTop: 6 }}
            >
              <div>
                <div style={label}>Nombre</div>
                <input
                  style={input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cómo quieres que te vean en SyncPlans"
                  autoComplete="name"
                />
              </div>

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
                  autoComplete="new-password"
                />
              </div>

              <div>
                <div style={label}>Confirmar contraseña</div>
                <input
                  style={input}
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repite tu contraseña para confirmar"
                  autoComplete="new-password"
                />
              </div>

              {error && <div style={errorBox}>{error}</div>}

              <button
                type="submit"
                disabled={!canSubmit}
                style={primaryBtn}
              >
                {loading
                  ? "Creando cuenta…"
                  : "Crear mi calendario compartido"}
              </button>
            </form>

            <button
              type="button"
              style={secondaryBtn}
              onClick={() =>
                router.push(
                  `/auth/login?next=${encodeURIComponent(nextTarget)}`,
                )
              }
              disabled={loading}
            >
              Ya tengo cuenta
            </button>

            <div style={legal}>
              Al crear una cuenta aceptas que esta es una beta privada
              pensada para pruebas personales. Podrás borrar tu cuenta y
              datos cuando quieras desde el panel de perfil.
            </div>
          </>
        )}
      </>
    </AuthCard>
  );
}