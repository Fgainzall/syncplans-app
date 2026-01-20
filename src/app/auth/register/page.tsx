// src/app/auth/register/page.tsx
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
    <main className="min-h-screen bg-[#050816] text-white">
      {/* fondo premium */}
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute -top-40 -left-32 h-80 w-80 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="absolute -top-32 right-10 h-72 w-72 rounded-full bg-violet-500/25 blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/3 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        {/* Top bar brand */}
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            SyncPlans · Beta privada
          </div>
          <button
            onClick={() => router.push("/auth/login")}
            className="text-xs font-semibold text-white/70 hover:text-white/90"
          >
            Ya tengo cuenta →
          </button>
        </header>

        {/* Contenido centrado */}
        <div className="flex flex-1 items-center justify-center">
          <div className="grid w-full gap-8 lg:grid-cols-[1.15fr_minmax(0,1fr)]">
            {/* Left: storytelling */}
            <section className="relative overflow-hidden rounded-3xl border border-white/12 bg-gradient-to-br from-white/6 via-white/4 to-white/2 p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)]">
              <div className="pointer-events-none absolute inset-0 opacity-60">
                <div className="absolute -top-24 -left-16 h-60 w-60 rounded-full bg-sky-500/25 blur-3xl" />
                <div className="absolute -bottom-16 right-0 h-64 w-64 rounded-full bg-emerald-500/25 blur-3xl" />
              </div>

              <div className="relative space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-white/70">
                  <span className="h-1.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-emerald-400" />
                  Calendario · Pareja · Familia
                </div>

                <div>
                  <h1 className="text-3xl sm:text-[2.1rem] font-semibold leading-tight tracking-tight">
                    Crea tu cuenta y organiza tu semana{" "}
                    <span className="bg-gradient-to-r from-emerald-300 to-sky-300 bg-clip-text text-transparent">
                      sin choques.
                    </span>
                  </h1>
                  <p className="mt-3 max-w-xl text-sm text-white/70">
                    Registra tus planes una sola vez y deja que SyncPlans se encargue del resto:
                    conflictos, grupos, y quién está libre en cada momento.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniCard
                    title="Personal"
                    dot="bg-amber-400"
                    desc="Tu agenda, limpia y clara."
                  />
                  <MiniCard
                    title="Pareja"
                    dot="bg-rose-400"
                    desc="Citas sin solaparse."
                  />
                  <MiniCard
                    title="Familia"
                    dot="bg-sky-400"
                    desc="Horarios alineados."
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/75">
                  <div className="mb-1 font-semibold text-white/90">
                    ¿Cómo funciona el registro?
                  </div>
                  <ol className="space-y-1 pl-4">
                    <li className="list-decimal">
                      Escribes tu correo y una contraseña.
                    </li>
                    <li className="list-decimal">
                      Te llega un mail de Supabase: haz click en{" "}
                      <span className="font-semibold text-white">“Confirm your mail”</span>.
                    </li>
                    <li className="list-decimal">
                      Vuelves automáticamente a{" "}
                      <span className="font-semibold text-white">/auth/callback</span> y entras a tu
                      calendario.
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            {/* Right: card de formulario */}
            <section className="rounded-3xl border border-white/10 bg-black/60 p-7 shadow-[0_24px_70px_rgba(0,0,0,0.85)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Crear cuenta</h2>
                  <p className="mt-1 text-xs text-white/60">
                    Empieza a organizar tu vida sin conflictos.
                  </p>
                </div>
                <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
                  100% gratis en beta
                </span>
              </div>

              {done ? (
                <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-100">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400 text-[11px] text-black">
                      ✓
                    </span>
                    Cuenta creada
                  </div>
                  <p className="mt-2 text-xs text-emerald-100/85">
                    Revisa tu correo, confirma el registro y luego vuelve aquí para iniciar sesión.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => router.push("/auth/login")}
                      className="rounded-xl border border-emerald-400/60 bg-gradient-to-r from-emerald-500/80 to-sky-500/80 px-4 py-2 text-xs font-semibold text-white shadow-[0_15px_40px_rgba(16,185,129,0.45)] hover:from-emerald-500 hover:to-sky-500"
                    >
                      Ir a iniciar sesión →
                    </button>
                    <button
                      onClick={() => setDone(false)}
                      className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      Crear otra cuenta
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={onSubmit} className="mt-5 grid gap-4">
                  <Field label="Correo">
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@correo.com"
                      className="w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm outline-none ring-0 transition focus:border-sky-400/70 focus:bg-black/60"
                      autoComplete="email"
                    />
                  </Field>

                  <Field label="Contraseña">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres"
                      type="password"
                      className="w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm outline-none ring-0 transition focus:border-emerald-400/70 focus:bg-black/60"
                      autoComplete="new-password"
                    />
                  </Field>

                  {error && (
                    <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-[11px] text-rose-100/90">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={[
                      "mt-1 flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                      canSubmit
                        ? "border-white/12 bg-gradient-to-r from-sky-500/90 via-indigo-500/90 to-emerald-500/90 shadow-[0_20px_50px_rgba(56,189,248,0.55)] hover:from-sky-500 hover:via-indigo-500 hover:to-emerald-500"
                        : "cursor-not-allowed border-white/10 bg-white/5 text-white/40",
                    ].join(" ")}
                  >
                    {loading ? "Creando cuenta…" : "Crear cuenta"}
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/auth/login")}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    Ya tengo cuenta
                  </button>
                </form>
              )}

              <p className="mt-5 text-[11px] leading-relaxed text-white/45">
                Al crear una cuenta aceptas que esta es una beta privada pensada para pruebas
                personales. Podrás borrar tu cuenta y datos cuando quieras desde el panel de perfil.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/55">
        {label}
      </div>
      {children}
    </div>
  );
}

function MiniCard({ title, desc, dot }: { title: string; desc: string; dot: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2 w-2 rounded-full ${dot} shadow-[0_0_10px_rgba(255,255,255,0.6)]`} />
        {title}
      </div>
      <div className="mt-1 text-[11px] text-white/65">{desc}</div>
    </div>
  );
}
