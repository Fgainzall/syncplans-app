"use client";

import { createContext, useContext, useMemo, useState } from "react";

type ToastItem = { id: string; title: string; body?: string; kind?: "ok" | "err" };

const ToastCtx = createContext<{ push: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const api = useMemo(
    () => ({
      push: (t: Omit<ToastItem, "id">) => {
        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const next: ToastItem = { id, kind: "ok", ...t };
        setItems((s) => [next, ...s].slice(0, 3));
        window.setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3200);
      },
    }),
    []
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed right-4 top-4 z-[9999] flex w-[340px] flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl border p-3 shadow-xl backdrop-blur ${
              t.kind === "err"
                ? "border-red-500/30 bg-red-500/10"
                : "border-emerald-500/30 bg-emerald-500/10"
            }`}
          >
            <div className="text-sm font-semibold text-white">{t.title}</div>
            {t.body ? <div className="mt-1 text-xs text-white/70">{t.body}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
