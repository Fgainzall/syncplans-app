"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinWithCode } from "@/lib/groups";

export default function JoinGroupPage() {
  const router = useRouter();

  const [myName, setMyName] = useState("Fernando Gainza Llosa");
  const [myEmail, setMyEmail] = useState("fg@ejemplo.com");
  const [code, setCode] = useState("");

  const error =
    !myName.trim()
      ? "Tu nombre es requerido."
      : !myEmail.trim()
      ? "Tu correo es requerido."
      : !code.trim()
      ? "Ingresa el código."
      : code.trim().length < 4
      ? "Código inválido."
      : null;

  function join() {
    if (error) return;

    joinWithCode({
      myName: myName.trim(),
      myEmail: myEmail.trim(),
      code: code.trim(),
    });

    router.push(`/groups/success?joined=1&code=${encodeURIComponent(code.trim().toUpperCase())}`);
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            SyncPlans · Unirse
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Unirme con código</h1>
          <p className="mt-2 text-sm text-white/60">
            Pega el código y quedas sincronizado.
          </p>
        </div>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="grid gap-4">
            <Field label="Tu nombre">
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </Field>

            <Field label="Tu correo">
              <input
                value={myEmail}
                onChange={(e) => setMyEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20"
              />
            </Field>

            <Field label="Código de invitación">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-white/20 tracking-widest"
                placeholder="ABC123"
              />
            </Field>

            {error ? (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs text-amber-100/80">
                ⚠️ {error}
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-100/80">
                ✅ Listo para unirte
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => router.push("/groups/create-pair")}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/10"
              >
                ← Volver
              </button>

              <button
                onClick={join}
                disabled={!!error}
                className={[
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                  error
                    ? "border-white/10 bg-white/5 text-white/40 cursor-not-allowed"
                    : "border-white/10 bg-white/10 hover:bg-white/15",
                ].join(" ")}
              >
                Unirme ✅
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-white/70">{label}</div>
      {children}
    </div>
  );
}
