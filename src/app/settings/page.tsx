// src/app/settings/page.tsx
import { Suspense } from "react";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050816] text-white">
          <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-white/70">
            Cargando settings…
          </div>
        </main>
      }
    >
      <SettingsClient />
    </Suspense>
  );
}