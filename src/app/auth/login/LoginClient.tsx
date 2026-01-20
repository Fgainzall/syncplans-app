// src/app/auth/login/LoginClient.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";

function safeNext(raw: string | null): string {
  if (!raw) return "/calendar";
  return raw.startsWith("/") ? raw : "/calendar";
}

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const nextTarget = useMemo(() => safeNext(sp.get("next")), [sp]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (signInError) {
        const msg = signInError.message.toLowerCase();
        if (msg.includes("email") && (msg.includes("confirm") || msg.includes("verified"))) {
          setError("Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.");
        } else {
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      router.replace(nextTarget);
    } catch (err: any) {
      setError(err?.message ?? "Error inesperado. Intenta otra vez.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-6xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white/70">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          SyncPlans · Beta privada
        </div>

        <button
          type="button"
          onClick={() => router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)}
          className="text-xs font-semibold text-white/70 hover:text-white"
        >
          ¿Nuevo aquí? Crear cuenta →
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left hero */}
        <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              Calendario · Pareja · Familia
            </div>

            <h1 className="mt-5 text-3xl font-semibold tracking-tight">
              Inicia sesión y mantén tu semana{" "}
              <span className="bg-gradient-to-r from-sky-300 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">
                sin choques
              </span>
              .
            </h1>

            <p className="mt-3 text-sm text-white/70">
              Registra tus planes y SyncPlans te avisa de conflictos, te muestra quién está libre y te ayuda a
              coordinar grupos.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MiniCard title="Personal" dot="bg-amber-400" desc="Tu agenda clara." />
              <MiniCard title="Pareja" dot="bg-rose-400" desc="Citas sin solapes." />
              <MiniCard title="Familia" dot="bg-sky-400" desc="Todo sincronizado." />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70">
              Tip: si vienes desde una invitación o link con <b>next</b>, te devolveremos automáticamente a{" "}
              <span className="font-semibold text-white/90">{nextTarget}</span>.
            </div>
          </div>
        </section>

        {/* Right form */}
        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_26px_80px_rgba(0,0,0,0.6)]">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Iniciar sesión</h2>
              <p className="mt-1 text-sm text-white/60">Accede a tu agenda en segundos.</p>
            </div>

            <button
              type="button"
              onClick={() => router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)}
              className="text-xs font-semibold text-white/70 underline decoration-white/20 underline-offset-4 hover:text-white"
            >
              Crear cuenta
            </button>
          </div>

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
                autoComplete="current-password"
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
              {loading ? "Ingresando…" : "Ingresar"}
            </button>

            <button
              type="button"
              onClick={() => router.push(`/auth/register?next=${encodeURIComponent(nextTarget)}`)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Crear cuenta
            </button>

            <div className="pt-1 text-[11px] leading-relaxed text-white/50">
              Al entrar aceptas que esta es una beta privada para pruebas. Podrás borrar tu cuenta y tus datos desde
              tu perfil.
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/60">{label}</div>
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
