// src/app/auth/register/RegisterClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function RegisterClient() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.includes("@") && password.trim().length >= 6 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
        options: {
          // ✅ vuelve a TU app al confirmar email
          emailRedirectTo: `${window.location.origin}/auth/callback`,
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

  return (
    <main className="min-h-screen bg-[#050816] text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="grid w-full gap-6 lg:grid-cols-2">
          {/* Left: brand / pitch */}
          <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
            </div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                SyncPlans · Registro
              </div>

              <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                Crea tu cuenta y organiza tu semana{" "}
                <span className="text-emerald-300">sin choques</span>.
              </h1>

              <p className="mt-3 text-sm text-white/70">
                Confirmas tu correo una vez y listo: calendario, grupos
                (personal/pareja/familia) y el flujo estrella de conflictos.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MiniCard title="Personal" dot="bg-amber-400" desc="Tu agenda, simple." />
                <MiniCard title="Pareja" dot="bg-rose-400" desc="Evita solapamientos." />
                <MiniCard title="Familia" dot="bg-sky-400" desc="Todo sincronizado." />
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
                Tip: tras registrarte, revisa tu correo y toca{" "}
                <span className="font-semibold text-white/90">Confirm your mail</span>. Te
                devolverá automáticamente a{" "}
                <span className="font-semibold text-white/90">/auth/callback</span>.
              </div>
            </div>
          </section>

          {/* Right: form */}
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-xl font-semibold">Crear cuenta</h2>
            <p className="mt-1 text-sm text-white/60">
              Empieza a organizar tu vida sin conflictos.
            </p>

            {done ? (
              <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-100">
                  Cuenta creada ✅
                </div>
                <div className="mt-1 text-xs text-emerald-100/80">
                  Revisa tu correo y confirma el registro. Luego vuelve aquí e inicia
                  sesión.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => router.push("/auth/login")}
                    className="rounded-xl border border-white/10 bg-gradient-to-r from-sky-500/80 to-emerald-500/80 px-4 py-2 text-sm font-semibold hover:from-sky-500 hover:to-emerald-500"
                  >
                    Ir a iniciar sesión →
                  </button>
                  <button
                    onClick={() => setDone(false)}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
                  >
                    Crear otra cuenta
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 grid gap-4">
                <Field label="Correo">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/20"
                    autoComplete="email"
                  />
                </Field>

                <Field label="Contraseña">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="mínimo 6 caracteres"
                    type="password"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/20"
                    autoComplete="new-password"
                  />
                </Field>

                {error && (
                  <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-100/90">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={[
                    "mt-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                    canSubmit
                      ? "border-white/10 bg-gradient-to-r from-sky-500/80 to-emerald-500/80 hover:from-sky-500 hover:to-emerald-500"
                      : "cursor-not-allowed border-white/10 bg-white/5 text-white/40",
                  ].join(" ")}
                >
                  {loading ? "Creando cuenta…" : "Crear cuenta"}
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Ya tengo cuenta
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-white/70">{label}</div>
      {children}
    </div>
  );
}

function MiniCard({ title, desc, dot }: { title: string; desc: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {title}
      </div>
      <div className="mt-1 text-xs text-white/60">{desc}</div>
    </div>
  );
}
