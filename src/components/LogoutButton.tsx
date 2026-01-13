"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function LogoutButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
    setOpen(false);
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 transition"
      >
        Salir
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-sm rounded-[22px] border border-white/10 bg-[#070b16]/90 p-5 text-white shadow-2xl backdrop-blur-xl">
            <h3 className="text-lg font-semibold">¿Cerrar sesión?</h3>
            <p className="mt-1 text-sm text-white/70">
              Podrás volver a ingresar cuando quieras.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setOpen(false)}
                disabled={loading}
                className="h-11 rounded-xl border border-white/12 bg-transparent text-sm font-semibold text-white/85 hover:bg-white/5 transition disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={doLogout}
                disabled={loading}
                className="h-11 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-400 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {loading ? "Saliendo…" : "Cerrar sesión"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
