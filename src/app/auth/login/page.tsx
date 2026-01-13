"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      // 🔒 Caso típico: email no confirmado
      if (error.message.toLowerCase().includes("email")) {
        setError(
          "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."
        );
      } else {
        setError(error.message);
      }
      return;
    }

    if (!data.session) {
      setError("No se pudo iniciar sesión. Intenta nuevamente.");
      return;
    }

    // ✅ Login correcto → Calendar
    router.push("/calendar");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#050816] text-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">
          Iniciar sesión en <span className="text-cyan-400">SyncPlans</span>
        </h1>
        <p className="mt-2 text-sm text-white/70">
          Accede a tu agenda sin choques de horario.
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <div>
            <label className="text-xs text-white/70">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 outline-none focus:border-white/20"
            />
          </div>

          <div>
            <label className="text-xs text-white/70">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 outline-none focus:border-white/20"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-400 px-4 py-2 font-semibold text-black disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <button
          onClick={() => router.push("/auth/register")}
          className="mt-4 text-sm text-white/60 hover:text-white"
        >
          Crear cuenta
        </button>
      </div>
    </main>
  );
}
