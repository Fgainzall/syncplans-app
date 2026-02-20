// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";

import { ToastProvider } from "@/components/ui/Toast";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "SyncPlans",
  description:
    "El calendario que evita discusiones innecesarias cuando compartes tu tiempo.",
};

export const viewport: Viewport = {
  themeColor: "#0B0F19",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" style={{ background: "#0B0F19" }}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#0B0F19" />

        {/* ✅ iOS safe-area support */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>

      <body
        style={{
          minHeight: "100dvh",
          background: "#0B0F19",
          color: "#E5E7EB",
          overflowX: "hidden",

          // ✅ safe-area padding base (no molesta en desktop)
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <SWRegister />

        <ToastProvider>
          {children}
          {/* ✅ BottomNav solo en móvil (oculto en md y arriba) */}
          <div className="md:hidden">
            <BottomNav />
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}