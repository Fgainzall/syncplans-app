"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";

export default function LogoutModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  if (!open) return null;

  function handleLogout() {
    signOut();
    onClose();
    router.push("/login");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#050816] p-6 text-white shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-rose-500/15 flex items-center justify-center">
            <span className="text-xl">🔒</span>
          </div>

          <h2 className="text-xl font-semibold">Cerrar sesión</h2>
          <p className="mt-2 text-sm text-white/60">
            ¿Seguro que deseas salir de SyncPlans?
          </p>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            Cancelar
          </button>

          <button
            onClick={handleLogout}
            className="flex-1 rounded-xl border border-rose-400/20 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
